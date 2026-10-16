// pages/PLATFORM(SUPERADMIN)/swbSssPage.ts
//
// ==============================================================================
// PAYMENT LINK — STATIC WEB BILLER (SWB) — SSS QRpay — PAGE OBJECT
// ==============================================================================
//
// The SWB SSS payment link is a PUBLIC consumer page (no admin login):
//   https://test-new-sss.billeroo.com/<linkId>
//
// FLOW (Manual PRN input):
//   Open /<linkId>/inputprn directly (the landing page's "Yes, I have a PRN"
//   answer leads here) -> dismiss the Welcome modal (OK) and Cookie notice
//   (Necessary Cookies Only) if they show -> PRN field + Next/Cancel
//   -> Next POSTs to /<linkId>/inputprn/details
//        - valid unpaid PRN: Payment Checkout Summary (payee, SS number,
//          months, amounts, due date) + Cancel / Next (#goToPaymentButton)
//          -> Next opens the CONSENT modal (#privacyModal): tick the 3 required
//             boxes -> Proceed (#privacyAcceptBtn) -> TLPE hosted checkout
//             (see tlpeCheckoutPage.ts)
//   After payment, TLPE returns to the receipt:
//     test-new-sss.billeroo.com/payment/result?transaction_id=<txnRef>
//     "Payment Summary" + status banner: "Payment has been posted successfully"
//     (green) or "Payment Posting Failed" (red) + PRN details, fees, FINISH
//        - otherwise: back on the PRN form with a red alert, e.g.
//          "Payment Reference No. is already paid" / "is cancelled" / "is invalid"
//
// ==============================================================================

import { Page, Locator, expect } from '@playwright/test';
import type { SssCheckoutSummary } from '../../utils/paymentLinkData';

export class SwbSssPage {
  readonly page: Page;
  readonly welcomeModal: Locator;
  readonly welcomeOkButton: Locator;
  readonly cookieModal: Locator;
  readonly necessaryCookiesOnlyButton: Locator;
  readonly inputPrnHeading: Locator;
  readonly prnInput: Locator;
  readonly nextButton: Locator;
  readonly cancelLink: Locator;
  readonly prnAlert: Locator;
  readonly checkoutSummaryHeading: Locator;
  readonly goToPaymentButton: Locator;
  readonly consentModal: Locator;
  readonly consentRequiredCheckboxes: Locator;
  readonly consentProceedButton: Locator;
  readonly receiptHeading: Locator;
  readonly receiptStatusBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeModal               = page.locator('#welcomeModal');
    this.welcomeOkButton            = page.locator('#welcome-close-btn');
    this.cookieModal                = page.locator('#cookieModal');
    this.necessaryCookiesOnlyButton = page.locator('#declineButton');
    this.inputPrnHeading            = page.getByText('Input Payment Reference Number (PRN)', { exact: true });
    this.prnInput                   = page.locator('#prn');
    this.nextButton                 = page.locator('#nextButton');
    this.cancelLink                 = page.getByRole('link', { name: 'Cancel' });
    this.prnAlert                   = page.locator('.alert').first();
    this.checkoutSummaryHeading     = page.getByText('Payment Checkout Summary', { exact: true });
    this.goToPaymentButton          = page.locator('#goToPaymentButton');
    this.consentModal               = page.locator('#privacyModal');
    // T&C, Privacy Policy, and "process of my payment transactions" — the two
    // (Optional) marketing/analytics boxes are left unticked.
    this.consentRequiredCheckboxes  = page.locator('#privacyModal .required-checkbox');
    this.consentProceedButton       = page.locator('#privacyAcceptBtn');
    this.receiptHeading             = page.getByText('Payment Summary', { exact: true });
    this.receiptStatusBanner        = page.locator('.alert[role="alert"]').first();
  }

  // Opens the PRN input page and clears the blocking modals. The cookie notice
  // only appears after the welcome modal closes, and both intercept clicks on
  // the page underneath until dismissed.
  async openInputPrn(inputPrnUrl: string) {
    // Wait on the PRN field, not the 'load' event — a slow third-party asset
    // has stalled 'load' for 30s+ while the page itself was already usable.
    await this.page.goto(inputPrnUrl, { waitUntil: 'domcontentloaded' });
    await this.prnInput.waitFor({ state: 'visible', timeout: 60_000 });
    await this.dismissStartupModals();
    console.log(`[SwbSssPage] Opened SWB PRN input: ${inputPrnUrl}`);
  }

  async dismissStartupModals() {
    await this.dismissModalIfShown(this.welcomeModal, this.welcomeOkButton);
    await this.dismissModalIfShown(this.cookieModal, this.necessaryCookiesOnlyButton);
  }

  // Bootstrap fades modals in; a click on the button before the modal has its
  // `show` class (fade-in finished) is swallowed and the modal stays up. Wait
  // for it to be fully shown, then re-click until it actually closes.
  private async dismissModalIfShown(modal: Locator, button: Locator) {
    const shown = await expect(modal).toHaveClass(/\bshow\b/, { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!shown) return;
    await expect(async () => {
      if (await button.isVisible()) await button.click();
      await expect(modal).toBeHidden({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  }

  async assertOnInputPrnPage(inputPrnUrl: string) {
    await expect(this.page, 'Should be on the manual PRN input page').toHaveURL(inputPrnUrl);
    await expect(this.inputPrnHeading).toBeVisible();
    await expect(this.prnInput).toBeVisible();
    await expect(this.prnInput).toHaveAttribute('required', '');
    await expect(this.nextButton).toBeVisible();
    await expect(this.cancelLink).toBeVisible();
  }

  async fillPrn(prn: string) {
    await this.prnInput.fill(prn);
  }

  async clickNext() {
    await this.nextButton.click();
  }

  // Rejected PRNs come back to the PRN form with an inline red alert.
  async assertPrnRejected(expectedMessage: string) {
    await expect(this.prnAlert, `PRN should be rejected with: ${expectedMessage}`).toHaveText(expectedMessage);
    await expect(this.checkoutSummaryHeading).toBeHidden();
  }

  // Each summary row is a bold "<Label> :" with its value in the sibling column.
  summaryValue(label: string): Locator {
    return this.page
      .locator('.form_detail')
      .filter({ has: this.page.locator('b', { hasText: new RegExp(`^\\s*${label.replace(/[()]/g, '\\$&')}\\s*:`) }) })
      .locator('span');
  }

  async assertCheckoutSummary(expected: SssCheckoutSummary) {
    await expect(this.checkoutSummaryHeading, 'Valid PRN should show the Payment Checkout Summary').toBeVisible();
    const rows: Array<[string, string]> = [
      ['Payee Name', expected.payeeName],
      ['SS Number', expected.ssNumber],
      ['Applicable Month(Start)', expected.monthStart],
      ['Applicable Month(End)', expected.monthEnd],
      ['Payment Reference Number', expected.prn],
      ['Member Type', expected.memberType],
      ['Bill Amount', expected.billAmount],
      ['Due Date', expected.dueDate],
    ];
    for (const [label, value] of rows) {
      await expect(this.summaryValue(label), `Checkout Summary "${label}"`).toHaveText(value);
    }
    await expect(this.goToPaymentButton).toBeVisible();
    console.log(`[SwbSssPage] Checkout Summary verified for PRN ${expected.prn}`);
  }

  // The summary's Next only opens the Consent modal once the page script has
  // run (it fills the hidden timeOffset field on document.ready). Clicking
  // earlier submits the form natively and SKIPS consent (confirmed 2026-10-15),
  // so wait for that before clicking.
  async waitForSummaryReady() {
    await expect(this.page.locator('#inputDetailsForm [name="timeOffset"]')).not.toHaveValue('', { timeout: 30_000 });
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

  // The receipt shows the posting outcome in a banner; returns its text.
  async waitForReceipt(): Promise<string> {
    await this.page.waitForURL(/\/payment\/result\?transaction_id=/, { timeout: 90_000 });
    await this.receiptStatusBanner.waitFor({ state: 'visible', timeout: 60_000 });
    return (await this.receiptStatusBanner.innerText()).trim();
  }
}
