// pages/PLATFORM(SUPERADMIN)/dwbPaymentPage.ts
//
// ==============================================================================
// PAYMENT LINK — DYNAMIC WEB BILLER (DWB) — PAGE OBJECT
// ==============================================================================
//
// The DWB payment link is a PUBLIC consumer page (no admin login), e.g. the
// MANILA WATER COMPANY link:
//   https://test-pay.billeroo.com/<linkId>/payment
//
// FLOW:
//   /payment          biller form (fields vary per biller; Manila Water:
//                     8 Digit Contract Account Number, Account Name, Amount,
//                     Email(Optional)) + Add-on Fee + live Total Amount -> Next
//   /payment/details  Payment Summary (entered values, Bill Amount, Add-on Fee,
//                     Total Amount) + Cancel / Next (#goToPaymentButton)
//                     -> Next opens the CONSENT modal (#privacyModal): tick the
//                        3 required boxes -> Proceed (#privacyAcceptBtn)
//                     -> TLPE hosted checkout (see tlpeCheckoutPage.ts; on DWB
//                        TLPE's First/Last Name are EMPTY and must be filled)
//
//   After payment, TLPE returns ("here", or after 10s) to the receipt:
//   test-pay.billeroo.com/payment/result?transaction_id=<txnRef>
//     status banner ("Payment has been posted successfully" / "Payment Posting
//     Failed") + references, account, name, Payment Method, Bill Amount,
//     Add-on Fee, Service Fee (TLPE's card fee, not shown before payment),
//     Total Amount, FINISH
//
// Unlike SWB there is no Welcome modal, no cookie notice, and no PRN step.
//
// ==============================================================================

import { Page, Locator, expect } from '@playwright/test';

export type DwbManilaWaterForm = {
  accountNumber: string;
  accountName: string;
  amount: string;   // e.g. '10'
  email?: string;
};

export class DwbPaymentPage {
  readonly page: Page;
  readonly billerHeading: Locator;
  readonly accountNumberInput: Locator;
  readonly accountNameInput: Locator;
  readonly amountInput: Locator;
  readonly emailInput: Locator;
  readonly totalAmount: Locator;
  readonly nextButton: Locator;
  readonly summaryHeading: Locator;
  readonly goToPaymentButton: Locator;
  readonly summaryCancelLink: Locator;
  readonly consentModal: Locator;
  readonly consentRequiredCheckboxes: Locator;
  readonly consentProceedButton: Locator;
  readonly receiptStatusBanner: Locator;
  readonly duplicateTransactionMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.billerHeading             = page.getByText(/Payment Page$/).first();
    this.accountNumberInput        = page.locator('#numeric-field-id');
    this.accountNameInput          = page.locator('#alphanumeric-field-id');
    this.amountInput               = page.locator('#amount-field-id');
    this.emailInput                = page.locator('#email-field-id');
    this.totalAmount               = page.locator('.title-total-amount');
    this.nextButton                = page.locator('#nextButton');
    this.summaryHeading            = page.getByRole('heading', { name: 'Payment Summary' });
    this.goToPaymentButton         = page.locator('#goToPaymentButton');
    this.summaryCancelLink         = page.getByRole('link', { name: 'Cancel' });
    this.consentModal              = page.locator('#privacyModal');
    // T&C, Privacy Policy, and "process of my payment transactions" — the two
    // (Optional) marketing/analytics boxes are left unticked.
    this.consentRequiredCheckboxes = page.locator('#privacyModal .required-checkbox');
    this.consentProceedButton      = page.locator('#privacyAcceptBtn');
    this.receiptStatusBanner       = page.locator('.alert[role="alert"]').first();
    // "System detects double transaction for this account with the same
    // amount. To avoid duplicate payments please try again tomorrow or try
    // with a different amount." — shown on Next when this account was already
    // paid the same amount today.
    this.duplicateTransactionMessage = page.getByText(/double transaction/i).first();
  }

  // Wait on the form field, not 'load' — third-party assets can stall 'load'.
  async open(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.accountNumberInput.waitFor({ state: 'visible', timeout: 60_000 });
    console.log(`[DwbPaymentPage] Opened DWB link: ${url}`);
  }

  async fillManilaWaterForm(f: DwbManilaWaterForm) {
    await this.accountNumberInput.fill(f.accountNumber);
    await this.accountNameInput.fill(f.accountName);
    await this.amountInput.fill(f.amount);
    if (f.email !== undefined) await this.emailInput.fill(f.email);
  }

  async clickNext() {
    await this.nextButton.click();
  }

  // Fills the form and clicks Next, retrying with a fresh amount (from
  // `nextAmount`) when the account was already paid that amount today.
  // Returns the amount that reached the Payment Summary.
  async submitWithUniqueAmount(f: Omit<DwbManilaWaterForm, 'amount'>, nextAmount: () => string, maxAttempts = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const amount = nextAmount();
      if (attempt > 1) await this.open(this.page.url().replace(/\/payment\/details$/, '/payment'));
      await this.fillManilaWaterForm({ ...f, amount });
      await this.clickNext();
      await this.summaryHeading.or(this.duplicateTransactionMessage).first().waitFor({ state: 'visible', timeout: 60_000 });
      if (await this.summaryHeading.isVisible()) return amount;
      console.log(`[DwbPaymentPage] Amount ${amount} already paid today for ${f.accountNumber} — retrying with another amount`);
    }
    throw new Error(`Double-transaction rejection for ${f.accountNumber} on ${maxAttempts} different amounts.`);
  }

  // One "<label>" row of a details table (the form's Add-on Fee row, or the
  // Payment Summary's rows) -> its value cell.
  detailValue(label: string): Locator {
    return this.page
      .locator('tr')
      .filter({ has: this.page.locator('td.payment-details-field', { hasText: new RegExp(`^\\s*${label}\\s*$`) }) })
      .locator('td.payment-details-value');
  }

  async assertPaymentSummary(expected: { accountNumber: string; accountName: string; billAmount: string; email?: string; addOnFee: string; totalAmount: string }) {
    await expect(this.page, 'Next should open the Payment Summary').toHaveURL(/\/payment\/details$/);
    await expect(this.summaryHeading).toBeVisible();
    await expect(this.detailValue('8 Digit Contract Account Number'), 'Summary account number').toHaveText(expected.accountNumber);
    await expect(this.detailValue('Account Name'), 'Summary account name').toHaveText(expected.accountName);
    await expect(this.detailValue('Bill Amount'), 'Summary bill amount').toHaveText(expected.billAmount);
    if (expected.email !== undefined) {
      await expect(this.detailValue('Email\\(Optional\\)'), 'Summary email').toHaveText(expected.email);
    }
    await expect(this.detailValue('Add-on Fee'), 'Summary add-on fee').toHaveText(expected.addOnFee);
    await expect(this.totalAmount, 'Summary total').toHaveText(`${expected.totalAmount} PHP`);
    await expect(this.goToPaymentButton).toBeVisible();
    console.log(`[DwbPaymentPage] Payment Summary verified (total ${expected.totalAmount} PHP)`);
  }

  // The summary's Next only opens the Consent modal once the page script has
  // run (it fills the hidden timeOffset field on document.ready). Clicking
  // earlier submits the form natively and SKIPS consent (same race as SWB),
  // so wait for that before clicking.
  async waitForSummaryReady() {
    await expect(this.page.locator('#displayDetailsForm [name="timeOffset"]')).not.toHaveValue('', { timeout: 30_000 });
  }

  async openConsent() {
    await this.waitForSummaryReady();
    await this.goToPaymentButton.click();
    await expect(this.consentModal, 'Next should open the CONSENT modal').toHaveClass(/\bshow\b/, { timeout: 30_000 });
  }

  async acceptRequiredConsent() {
    for (const box of await this.consentRequiredCheckboxes.all()) await box.check();
    await expect(this.consentProceedButton).toBeEnabled();
  }

  async clickConsentProceed() {
    await this.consentProceedButton.click();
  }

  // Waits for the receipt and returns its status banner text.
  async waitForReceipt(): Promise<string> {
    await this.page.waitForURL(/\/payment\/result\?transaction_id=/, { timeout: 90_000 });
    await this.receiptStatusBanner.waitFor({ state: 'visible', timeout: 60_000 });
    return (await this.receiptStatusBanner.innerText()).trim();
  }

  // Service Fee is TLPE's card fee (not known before paying), so the total is
  // checked as Bill + Add-on + whatever Service Fee the receipt shows.
  async assertReceipt(expected: { transactionReference: string; accountNumber: string; name: string; paymentMethod: string; billAmount: string; addOnFee: string }) {
    await expect(this.receiptStatusBanner, 'Receipt should say the payment posted').toHaveText('Payment has been posted successfully');
    await expect(this.detailValue('Transaction Reference')).toHaveText(expected.transactionReference);
    await expect(this.detailValue('Account Number')).toHaveText(expected.accountNumber);
    await expect(this.detailValue('Name')).toHaveText(expected.name);
    await expect(this.detailValue('Payment Method')).toHaveText(expected.paymentMethod);
    await expect(this.detailValue('Bill Amount')).toHaveText(`${expected.billAmount} PHP`);
    await expect(this.detailValue('Add-on Fee')).toHaveText(`${expected.addOnFee} PHP`);
    const php = async (label: string) => Number((await this.detailValue(label).innerText()).replace(/[^\d.]/g, ''));
    const total = (await php('Bill Amount')) + (await php('Add-on Fee')) + (await php('Service Fee'));
    expect(await php('Total Amount'), 'Total = Bill + Add-on Fee + Service Fee').toBeCloseTo(total, 2);
    console.log(`[DwbPaymentPage] Receipt verified for txn ${expected.transactionReference}`);
  }
}
