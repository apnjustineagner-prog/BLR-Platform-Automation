// pages/PLATFORM(SUPERADMIN)/paymentConsolePage.ts
//
// ==============================================================================
// PAYMENT CONSOLE — PAGE OBJECT
// ==============================================================================
//
// TEST CASES COVERED:
//
//   PREVIEW PAYMENT CATEGORY
//     BLR-914  Unsuccessfully preview — no account credential
//     BLR-915  Unsuccessfully preview — no service type
//     BLR-916  Successfully preview — without agent
//     BLR-917  Successfully preview — with agent
//
//   SEARCH & SELECT
//     BLR-918  Search a specific biller account
//     BLR-919  Select payment category using search option
//     BLR-920  Select a specific biller account
//
//   PAY BILLS
//     BLR-921  Cancel bills payment
//     BLR-922  Pay with empty fields
//     BLR-923  Pay with invalid input
//     BLR-924  Pay with invalid account number
//     BLR-925  Pay with insufficient balance
//     BLR-926  Pay with negative amount
//     BLR-927  Pay without email input
//     BLR-928  Pay with email input
//     BLR-929  Pay using business category account
//     BLR-930  Pay using agent account
//
//   PRN GENERATION
//     BLR-312  PRN Generation - Basic Flow
//     BLR-313  PRN Generation - Copy PRN
//     BLR-314  PRN Generation - Multiple Attempts
//     BLR-316  PRN Generation - Error Recovery
//
// FORM FIELD ORDER (from UI):
//   1. Business Category Account
//   2. Agent (optional)
//   3. Account Credential
//   4. Service Type
//   → Preview → Biller category list appears
//
// ==============================================================================

import { Page, expect } from '@playwright/test';

// ==============================================================================
// PAGE OBJECT
// ==============================================================================

export class PaymentConsolePage {
  // --- Locators ---------------------------------------------------------------

  private readonly businessCategoryAccountSelect;
  private readonly select2SearchBox;
  private readonly agentSelect;
  private readonly accountCredentialSelect;
  private readonly serviceTypeSelect;
  private readonly billerSearchInput;
  private readonly paymentCategorySelect;
  private readonly billerAccountSelect;
  private readonly amountInput;
  private readonly emailInput;
  private readonly previewButton;
  private readonly payButton;
  private readonly cancelButton;
  private readonly confirmPayButton;
  private readonly billerCategoryList;
  private readonly prnDisplay;
  private readonly copyPrnButton;
  private readonly generatePrnButton;

  constructor(private page: Page) {
    // Recorded as textbox in one session and combobox in another (see bayadPage)
    this.businessCategoryAccountSelect = page
      .getByRole('combobox', { name: 'Select Business Name' })
      .or(page.getByRole('textbox', { name: 'Select Business Name' }));
    this.select2SearchBox              = page.getByRole('searchbox', { name: 'Search' });
    this.agentSelect                   = page.locator('#select2-agentSelect-container');
    this.accountCredentialSelect       = page.locator('#select2-credentialSelect-container');
    this.serviceTypeSelect             = page.locator('#select2-serviceTypesSelect-container');
    this.billerSearchInput             = page.locator('#billerSearch');
    this.paymentCategorySelect         = page.locator('#paymentCategory');
    this.billerAccountSelect           = page.locator('#billerAccount');
    this.amountInput                   = page.locator('#amount');
    this.emailInput                    = page.locator('#email');
    this.previewButton                 = page.getByRole('button', { name: /preview/i });
    this.payButton                     = page.getByRole('button', { name: 'Pay', exact: true });
    this.cancelButton                  = page.getByRole('button', { name: 'Cancel', exact: true });
    this.confirmPayButton              = page.getByRole('button', { name: 'Confirm' });
    this.billerCategoryList            = page.locator('#billers');
    this.prnDisplay                    = page.locator('#prnDisplay');
    this.copyPrnButton                 = page.getByRole('button', { name: 'Copy' });
    this.generatePrnButton             = page.getByRole('button', { name: 'Generate PRN' });
  }

  // --- Navigation -------------------------------------------------------------

  // Sidebar link name includes an icon glyph and varies between sessions, so
  // match loosely (same as bayadPage). networkidle is unreliable on this SPA —
  // wait for the breadcrumb instead.
  async goToPaymentConsole() {
    await this.page.getByRole('link', { name: /payment console/i }).first().click();
    await this.page.getByText('Payment Console Category').waitFor();
    console.log('[PaymentConsolePage] Navigated to Payment Console');
  }

  async assertOnPaymentConsolePage() {
    await expect(
      this.page.getByText('Payment Console Category'),
      'Should be on Payment Console page'
    ).toBeVisible();
  }

  // --- Form Actions -----------------------------------------------------------

  // The options load asynchronously after the page renders; filling the select2
  // search box forces a re-query, so this doesn't race the initial load. The
  // option text can be longer than the searched value, so match non-exact.
  async selectBusinessCategoryAccount(value: string) {
    await this.businessCategoryAccountSelect.click();
    await this.select2SearchBox.fill(value);
    await this.page.getByRole('option', { name: value }).first().click();
  }

  async selectAgent(value: string) {
    await this.agentSelect.click();
    await this.page.getByRole('option', { name: value }).click();
  }

  async selectAccountCredential(value: string) {
    await this.accountCredentialSelect.click();
    await this.page.getByRole('option', { name: value }).click();
  }

  async selectServiceType(value: string) {
    await this.serviceTypeSelect.click();
    await this.page.getByRole('option', { name: value }).click();
  }

  async assertAgentEmpty() {
    await expect(this.agentSelect, 'Agent field should have no selection').toHaveText('Select Agent');
  }

  async assertAccountCredentialEmpty() {
    await expect(this.accountCredentialSelect, 'Biller Account field should have no selection').toHaveText('Select Biller Account');
  }

  async assertServiceTypeEmpty() {
    await expect(this.serviceTypeSelect, 'Service Type field should have no selection').toHaveText('Select Service Type');
  }

  async searchBillerAccount(searchTerm: string) {
    await this.billerSearchInput.fill(searchTerm);
    await this.page.waitForLoadState('networkidle');
    console.log(`[PaymentConsolePage] Searched for biller: ${searchTerm}`);
  }

  async selectPaymentCategory(value: string) {
    await this.paymentCategorySelect.selectOption(value);
  }

  async selectBillerAccount(value: string) {
    await this.billerAccountSelect.selectOption(value);
  }

  async fillAmount(value: string) {
    await this.amountInput.fill(value);
  }

  async fillEmail(value: string) {
    await this.emailInput.fill(value);
  }

  async clickPreview() {
    await this.previewButton.scrollIntoViewIfNeeded();
    await this.previewButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[PaymentConsolePage] Preview clicked');
  }

  async clickPay() {
    await this.payButton.click();
  }

  async clickCancel() {
    await this.cancelButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[PaymentConsolePage] Payment cancelled');
  }

  async clickConfirm() {
    await this.confirmPayButton.waitFor({ state: 'visible' });
    await this.confirmPayButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[PaymentConsolePage] Payment confirmed');
  }

  // --- PRN Actions ------------------------------------------------------------

  async generatePRN() {
    await this.generatePrnButton.click();
    await this.prnDisplay.waitFor({ state: 'visible' });
    const prn = (await this.prnDisplay.innerText()).trim();
    console.log(`[PaymentConsolePage] PRN generated: ${prn}`);
    return prn;
  }

  async copyPRN() {
    await this.copyPrnButton.click();
    console.log('[PaymentConsolePage] PRN copied');
  }

  // --- Verifications ----------------------------------------------------------

  async assertBillerCategoryListVisible() {
    await expect(this.billerCategoryList, 'Biller category list should be visible').toBeVisible();
  }

  async assertBillerCategoryListHidden() {
    await expect(this.billerCategoryList, 'Biller category list should not be displayed').toBeHidden();
  }

  async assertErrorMessage(expectedMessage: string) {
    const error = this.page.locator('.error-message, [class*="error"], [class*="invalid"]').first();
    await expect(error, `Expected error: ${expectedMessage}`).toContainText(expectedMessage);
  }

  async assertPaymentCancelled() {
    await expect(this.cancelButton, 'Cancel button should be hidden after cancel').toBeHidden();
  }

  async assertPRNGenerated() {
    await expect(this.prnDisplay, 'PRN should be displayed').toBeVisible();
    const prn = (await this.prnDisplay.innerText()).trim();
    expect(prn, 'PRN should not be empty').not.toBe('');
  }

  async assertPRNCopied() {
    await expect(
      this.page.locator('[class*="copied"], [aria-label*="Copied"]'),
      'Copy confirmation should appear'
    ).toBeVisible();
  }
}

export default PaymentConsolePage;
