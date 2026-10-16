// pages/PLATFORM(SUPERADMIN)/tlpeCheckoutPage.ts
//
// ==============================================================================
// TLPE HOSTED CHECKOUT — PAGE OBJECT (used by the SWB and DWB payment links)
// ==============================================================================
//
// FLOW (after the SWB Consent -> Proceed):
//   1. Transaction Info   test-webapi.tlpe.io/transaction/pay/render
//        Customer Details (name prefilled) + Payment Options -> Next
//   2. Confirm Payment    test-opp.tlpe.io/web/checkout?id=<txnRef>
//        Card Number / Holder / Expiry / CVV -> "PAY <amount> PHP"
//   3. 3DS Simulator      test.oppwa.com/connectors/demo/...  (test env only)
//        Select authentication outcome (Approve) -> Submit
//   4. Payment Result     test-webapi.tlpe.io/transaction/<txnRef>/status
//        "TRANSACTION SUCCESSFUL" + references; auto-redirects back to the
//        biller after 10s, or click "here" to go immediately (-> the SWB
//        receipt, see SwbSssPage.waitForReceipt)
//
// NOTE: must run HEADED — in headless Chromium, PAY lands on TLPE's "Sorry,
// something went wrong." page instead of 3DS (confirmed 2026-10-15).
//
// ==============================================================================

import { Page, Locator, expect } from '@playwright/test';

export type TlpeCustomerDetails = {
  // Prefilled for SWB (from the PRN) but EMPTY for DWB — pass them for DWB.
  firstName?: string;
  lastName?: string;
  email: string;
  mobile: string;   // PH mobile without +63, e.g. 9171234567
  address: string;
  city: string;
  zip: string;
  stateProvince: string;
};

export type TlpeCard = {
  number: string;   // digits only
  holderName: string;
  expiry: string;   // MMYY digits, e.g. 0331
  cvv: string;
};

export class TlpeCheckoutPage {
  readonly page: Page;
  // Transaction Info
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly mobileInput: Locator;
  readonly addressInput: Locator;
  readonly cityInput: Locator;
  readonly zipInput: Locator;
  readonly stateProvinceInput: Locator;
  readonly creditDebitCardToggle: Locator;
  readonly visaOption: Locator;
  readonly transactionInfoNextButton: Locator;
  // Confirm Payment
  readonly cardNumberInput: Locator;
  readonly cardHolderInput: Locator;
  readonly cardExpiryInput: Locator;
  readonly cardCvvInput: Locator;
  readonly payButton: Locator;
  // 3DS Simulator
  readonly threeDsOutcomeSelect: Locator;
  readonly threeDsSubmitButton: Locator;
  // Payment Result
  readonly transactionSuccessful: Locator;
  readonly redirectHereLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput            = page.locator('[name="customer.firstName"]');
    this.lastNameInput             = page.locator('[name="customer.lastName"]');
    this.emailInput                = page.locator('[name="customer.contact.email"]');
    this.mobileInput               = page.locator('[name="customer.contact.mobile"]');
    this.addressInput              = page.locator('[name="customer.billingAddress.line1"]');
    this.cityInput                 = page.locator('[name="customer.billingAddress.cityMunicipality"]');
    this.zipInput                  = page.locator('[name="customer.billingAddress.zip"]');
    this.stateProvinceInput        = page.locator('[name="customer.billingAddress.stateProvinceRegion"]');
    this.creditDebitCardToggle     = page.getByRole('button', { name: 'Credit/Debit Card' });
    this.visaOption                = page.locator('button[data-name="Visa"]');
    this.transactionInfoNextButton = page.locator('#nextButton');
    this.cardNumberInput           = page.locator('#cc-pan');
    this.cardHolderInput           = page.locator('#cc-name');
    this.cardExpiryInput           = page.locator('#cc-exp');
    this.cardCvvInput              = page.locator('#cc-cvv');
    this.payButton                 = page.locator('#pay-button');
    this.threeDsOutcomeSelect      = page.locator('#outcomeSelect');
    this.threeDsSubmitButton       = page.getByRole('button', { name: 'Submit' });
    this.transactionSuccessful     = page.getByText(/transaction\s+successful/i).first();
    this.redirectHereLink          = page.getByRole('link', { name: 'here', exact: true });
  }

  async waitForTransactionInfo() {
    await this.page.waitForURL(/test-webapi\.tlpe\.io\/transaction\/pay\/render/, { timeout: 90_000 });
    await this.emailInput.waitFor({ state: 'visible', timeout: 90_000 });
  }

  async fillCustomerDetails(c: TlpeCustomerDetails) {
    if (c.firstName !== undefined) await this.firstNameInput.fill(c.firstName);
    if (c.lastName !== undefined) await this.lastNameInput.fill(c.lastName);
    await this.emailInput.fill(c.email);
    await this.mobileInput.fill(c.mobile);
    await this.addressInput.fill(c.address);
    await this.cityInput.fill(c.city);
    await this.zipInput.fill(c.zip);
    await this.stateProvinceInput.fill(c.stateProvince);
  }

  // Visa sits inside the collapsed "Credit/Debit Card" accordion.
  async selectVisa() {
    await this.creditDebitCardToggle.click();
    await this.visaOption.click();
  }

  async clickTransactionInfoNext() {
    await this.transactionInfoNextButton.click();
  }

  async waitForConfirmPayment() {
    await this.page.waitForURL(/test-opp\.tlpe\.io\/web\/checkout/, { timeout: 90_000 });
    await this.cardNumberInput.waitFor({ state: 'visible', timeout: 90_000 });
  }

  // Number and expiry are masked inputs (auto-insert spaces / "/"), so type
  // the digits instead of fill().
  async fillCard(card: TlpeCard) {
    await this.cardNumberInput.pressSequentially(card.number);
    await this.cardHolderInput.fill(card.holderName);
    await this.cardExpiryInput.pressSequentially(card.expiry);
    await this.cardCvvInput.fill(card.cvv);
  }

  async clickPay() {
    await this.payButton.click();
  }

  async waitFor3ds() {
    await this.page.waitForURL(/oppwa\.com/, { timeout: 120_000 });
    await this.threeDsOutcomeSelect.waitFor({ state: 'visible', timeout: 60_000 });
  }

  async approve3ds() {
    await this.threeDsOutcomeSelect.selectOption({ label: 'Approve' });
    await this.threeDsSubmitButton.click();
  }

  async waitForPaymentResult() {
    await this.page.waitForURL(/test-webapi\.tlpe\.io\/transaction\/[^/]+\/status/, { timeout: 120_000 });
    await expect(this.transactionSuccessful, 'Payment Result should read TRANSACTION SUCCESSFUL').toBeVisible({ timeout: 60_000 });
  }

  // "Transaction Reference Number:" row on the Payment Result page.
  async getResultTransactionReference(): Promise<string> {
    const m = this.page.url().match(/transaction\/([^/]+)\/status/);
    return m ? m[1] : '';
  }

  // Skip the 10s auto-redirect and go straight back to the biller's receipt.
  async clickHereToReturn() {
    await this.redirectHereLink.click();
  }
}
