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
  private readonly billerSearchResults;
  private readonly paymentCategorySelect;
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

  // MANILA WATER COMPANY biller payment form (ids captured live 2026-07-22).
  // id starts with a digit, so match by attribute rather than a #id selector.
  private readonly contractAccountNumberInput;
  private readonly billerAccountNameInput;
  private readonly billerAmountInput;
  private readonly billerEmailInput;
  // Labeled "Pay Now" in the UI; opens the #myModal confirmation dialog whose
  // real submit button is #submitPaymentFormButton ("Confirm" — see confirmPayButton).
  private readonly confirmPaymentButton;
  // Payment Summary modal content — shows back the values just entered
  // (plus computed Add-on Fee / Service Fee / Total Amount).
  private readonly paymentSummaryModalBody;

  // Post-Confirm receipt ("Payment Successful!") — ids confirmed live 2026-07-23.
  private readonly receiptHeading;
  private readonly statusCodeValue;
  private readonly processorReferenceValue;
  private readonly transactionDateValue;
  private readonly totalAmountValue;
  private readonly serviceProviderValue;
  private readonly merchantReferenceValue;
  private readonly transactionReferenceValue;

  constructor(private page: Page) {
    // Recorded as textbox in one session and combobox in another (see bayadPage)
    this.businessCategoryAccountSelect = page
      .getByRole('combobox', { name: 'Select Business Name' })
      .or(page.getByRole('textbox', { name: 'Select Business Name' }))
      .first();
    this.select2SearchBox              = page.getByRole('searchbox', { name: 'Search' });
    this.agentSelect                   = page.locator('#select2-agentSelect-container');
    this.accountCredentialSelect       = page.locator('#select2-credentialSelect-container');
    this.serviceTypeSelect             = page.locator('#select2-serviceTypesSelect-container');
    // Accessible name has leading whitespace from an embedded icon, so match
    // loosely (see bayadPage.ts for the same fix). Results render into #searchInput.
    this.billerSearchInput             = page.getByRole('textbox', { name: /search biller/i });
    this.billerSearchResults           = page.locator('#searchInput');
    this.paymentCategorySelect         = page.locator('#paymentCategory');
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

    this.contractAccountNumberInput    = page.locator('[id="8_Digit_Contract_Account_Number_"]');
    this.billerAccountNameInput        = page.locator('#Account_Name');
    this.billerAmountInput             = page.locator('#Amount');
    this.billerEmailInput              = page.locator('#email-optional');
    this.confirmPaymentButton          = page.locator('#confirmPaymentButton');
    this.paymentSummaryModalBody       = page.locator('#dynamicModalBody');

    this.receiptHeading                = page.getByText('Payment Successful!');
    this.statusCodeValue               = page.locator('#statusCodeValue');
    this.processorReferenceValue       = page.locator('#processorReferenceValue');
    this.transactionDateValue          = page.locator('#transactionDateValue');
    this.totalAmountValue              = page.locator('#totalAmountValue');
    this.serviceProviderValue          = page.locator('#serviceProviderValue');
    this.merchantReferenceValue        = page.locator('#merchantReferenceValue');
    this.transactionReferenceValue     = page.locator('#transactionReferenceValue');
  }

  // --- Navigation -------------------------------------------------------------

  // Sidebar link name includes an icon glyph and varies between sessions, so
  // match loosely (same as bayadPage). networkidle is unreliable on this SPA —
  // wait for the breadcrumb instead. The business-name select2 filters
  // client-side against the /lookup/merchants list fetched on page load; if
  // that response hasn't landed yet, typing into the search box searches an
  // empty list and shows "No results found" (observed 2026-07-22) — wait for
  // it here so selectBusinessCategoryAccount never races it.
  async goToPaymentConsole() {
    const merchantsLoaded = this.page.waitForResponse((res) =>
      res.url().includes('/lookup/merchants')
    );
    await this.page.getByRole('link', { name: /payment console/i }).first().click();
    await this.page.getByText('Payment Console Category').waitFor();
    await merchantsLoaded;
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
  // Selecting the business triggers an AJAX call that populates the Biller
  // Account dropdown; wait on that specific response (networkidle proved
  // flaky — the option list can still be empty for a moment after the
  // network settles, see bayadPage.ts for the same fix).
  async selectBusinessCategoryAccount(value: string) {
    await this.businessCategoryAccountSelect.click();
    await this.select2SearchBox.pressSequentially(value, { delay: 100 });
    const credentialsLoaded = this.page.waitForResponse((res) =>
      res.url().includes('/lookup/payment-console/options/account-credentials')
    );
    await this.page.getByRole('option', { name: value }).first().click();
    await credentialsLoaded;
  }

  async selectAgent(value: string) {
    await this.agentSelect.click();
    await this.page.getByRole('option', { name: value }).click();
    await this.page.waitForLoadState('networkidle');
  }

  // Selecting the credential triggers an AJAX call that populates the Service
  // Type dropdown — same wait requirement as above.
  async selectAccountCredential(value: string) {
    await this.accountCredentialSelect.click();
    const serviceTypesLoaded = this.page.waitForResponse((res) =>
      res.url().includes('/payment-console/service-type')
    );
    await this.page.getByRole('option', { name: value }).first().click();
    await serviceTypesLoaded;
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

  // The biller list is already loaded client-side (fetched when the service
  // type was selected); this search filters it locally via a keyup handler,
  // so fill() — which doesn't dispatch real key events — silently produces no
  // results. Type it out for real (see bayadPage.ts for the equivalent fix).
  async searchBillerAccount(searchTerm: string) {
    await this.billerSearchInput.pressSequentially(searchTerm, { delay: 80 });
    await this.billerSearchResults.getByRole('link', { name: searchTerm, exact: true }).waitFor({ state: 'visible' });
    console.log(`[PaymentConsolePage] Searched for biller: ${searchTerm}`);
  }

  async selectBillerAccount(billerName: string) {
    await this.billerSearchResults.getByRole('link', { name: billerName, exact: true }).click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[PaymentConsolePage] Selected biller: ${billerName}`);
  }

  // --- MANILA WATER COMPANY biller payment form --------------------------------

  async fillContractAccountNumber(value: string) {
    await this.contractAccountNumberInput.fill(value);
  }

  async fillBillerAccountName(value: string) {
    await this.billerAccountNameInput.fill(value);
  }

  async fillBillerAmount(value: string) {
    await this.billerAmountInput.fill(value);
  }

  async fillBillerEmail(value: string) {
    await this.billerEmailInput.fill(value);
  }

  // Labeled "Pay Now"; opens the #myModal confirmation dialog (submitted via
  // clickConfirm(), which already targets the modal's "Confirm" button).
  async clickPayNow() {
    await this.confirmPaymentButton.click();
    await this.page.locator('#myModal').waitFor({ state: 'visible' });
    console.log('[PaymentConsolePage] Pay Now clicked');
  }

  // Verifies the Payment Summary modal echoes back what was actually typed
  // into the form, plus the biller's computed fee/total rows (addOnFee,
  // serviceFee, totalAmount) when the caller wants those pinned down too —
  // they're server-computed, not user input, so they're optional.
  async assertPaymentSummaryDetails(details: {
    billerName: string;
    accountNumber: string;
    accountName: string;
    amount: string;
    email: string;
    addOnFee?: string;
    serviceFee?: string;
    totalAmount?: string;
  }) {
    await this.paymentSummaryModalBody.waitFor({ state: 'visible' });
    // The biller name/category header sits in #myModal outside #dynamicModalBody
    // (observed 2026-07-22: #dynamicModalBody only contains the field rows).
    await expect(this.page.locator('#myModal'), 'Payment summary should show biller name').toContainText(details.billerName);
    await expect(this.paymentSummaryModalBody, 'Payment summary should show contract account number').toContainText(details.accountNumber);
    await expect(this.paymentSummaryModalBody, 'Payment summary should show account name').toContainText(details.accountName);
    await expect(this.paymentSummaryModalBody, 'Payment summary should show bill amount').toContainText(details.amount);
    await expect(this.paymentSummaryModalBody, 'Payment summary should show email').toContainText(details.email);
    if (details.addOnFee !== undefined) {
      await expect(this.paymentSummaryModalBody, 'Payment summary should show add-on fee').toContainText(details.addOnFee);
    }
    if (details.serviceFee !== undefined) {
      await expect(this.paymentSummaryModalBody, 'Payment summary should show service fee').toContainText(details.serviceFee);
    }
    if (details.totalAmount !== undefined) {
      await expect(this.paymentSummaryModalBody, 'Payment summary should show total amount').toContainText(details.totalAmount);
    }
    console.log('[PaymentConsolePage] Payment summary details verified against input');
  }

  async selectPaymentCategory(value: string) {
    await this.paymentCategorySelect.selectOption(value);
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

  // --- Receipt (post-Confirm) --------------------------------------------------

  // The backend has been observed to hang after Confirm instead of ever
  // rendering the receipt (see BLR-3681 fixme note in paymentConsole.spec.ts),
  // so this waits explicitly on the heading with a generous timeout rather
  // than relying on the default actionTimeout — makes "still stuck loading"
  // fail clearly here instead of surfacing as a confusing timeout later.
  async assertPaymentReceipt(billerName: string) {
    await expect(this.receiptHeading, 'Payment Successful! receipt should render').toBeVisible({ timeout: 30000 });
    await expect(this.serviceProviderValue, 'Receipt should show the biller name').toHaveText(billerName);
    await expect(this.statusCodeValue, 'Receipt should show a status').toBeVisible();
    await expect(this.processorReferenceValue, 'Receipt should show a processor reference').toBeVisible();
    await expect(this.transactionDateValue, 'Receipt should show a transaction date').toBeVisible();
    // Fee/total computation isn't confirmed yet — just verify it renders.
    await expect(this.totalAmountValue, 'Receipt should show the total amount').toBeVisible();
    await expect(this.merchantReferenceValue, 'Receipt should show a merchant reference number').toBeVisible();
    await expect(this.transactionReferenceValue, 'Receipt should show a transaction reference number').toBeVisible();
    console.log('[PaymentConsolePage] Payment receipt verified');
  }

  async getMerchantReferenceNumber(): Promise<string> {
    return (await this.merchantReferenceValue.innerText()).trim();
  }

  async getTransactionReferenceNumber(): Promise<string> {
    return (await this.transactionReferenceValue.innerText()).trim();
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
