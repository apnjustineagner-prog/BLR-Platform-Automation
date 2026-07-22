// pages/PLATFORM(SUPERADMIN)/bayadPage.ts
//
// ==============================================================================
// BAYAD BILL PAYMENT — PAGE OBJECT
// ==============================================================================
//
// FLOW (captured via codegen):
//   Payment Console → select business name + biller account (credential) +
//   service type ("Bills Payment") → search biller (MERALCO / Maynilad Water)
//   → fill account number + amount → Pay Now
//
//   Transaction Module → Transaction History → verify posted payment
//
// TEST CASES COVERED:
//
//   MERALCO
//     BLR-3671  Valid Meralco payment is processed successfully via Bayad
//     BLR-3672  Meralco payment is reflected in Transaction History
//     BLR-3673  Invalid Meralco account number is rejected
//
//   MAYNILAD WATER
//     BLR-3674  Valid Maynilad Water payment is processed successfully via Bayad
//     BLR-3675  Maynilad Water payment is reflected in Transaction History
//     BLR-3676  Invalid Maynilad Water account number is rejected
//
// NOTE:
//   Console, Meralco, and Maynilad locators were captured via codegen.
//   Pay Now → confirmation modal (#myModal) → Confirm.
//   Remaining TODOs: success/error indicators after Confirm, and the
//   Transaction Module — capture those with codegen the same way.
//
// ==============================================================================

import { Page, Locator, expect } from '@playwright/test';

// ==============================================================================
// PAGE OBJECT
// ==============================================================================

export class BayadPage {
  // --- Locators ---------------------------------------------------------------

  private readonly businessCategoryAccountSelect: Locator;
  private readonly select2SearchBox:              Locator;
  private readonly accountCredentialSelect:       Locator;
  private readonly serviceTypeSelect:             Locator;
  private readonly billerSearchInput:             Locator;
  private readonly billerSearchResults:           Locator;
  private readonly accountNumberInput:            Locator;
  private readonly contractAccountNumberInput:    Locator;
  private readonly accountNameInput:              Locator;
  private readonly amountInput:                   Locator;
  private readonly emailInput:                    Locator;
  private readonly payNowButton:                  Locator;
  private readonly confirmationModal:             Locator;
  private readonly confirmPayButton:              Locator;
  private readonly successToast:                  Locator;
  private readonly errorMessage:                  Locator;
  private readonly transactionTableRows:          Locator;
  private readonly transactionSearchInput:        Locator;

  constructor(private page: Page) {
    // Console form (captured via codegen). The account credential dropdown is
    // labeled "Select Biller Account" in the UI. The business name trigger was
    // recorded as textbox in one session and combobox in another, so accept both.
    this.businessCategoryAccountSelect = page
      .getByRole('combobox', { name: 'Select Business Name' })
      .or(page.getByRole('textbox', { name: 'Select Business Name' }))
      .first();
    this.select2SearchBox              = page.getByRole('searchbox', { name: 'Search' });
    this.accountCredentialSelect       = page.getByRole('textbox', { name: 'Select Biller Account' });
    this.serviceTypeSelect             = page.getByRole('textbox', { name: 'Select Service Type' });

    // Biller list — the search box's accessible name has leading whitespace
    // from an embedded icon, so match by regex instead of exact string
    this.billerSearchInput             = page.getByRole('textbox', { name: /search biller/i });
    this.billerSearchResults           = page.locator('#searchInput');

    // Biller payment form (captured via codegen; fields vary per biller —
    // MERALCO has "Account Number", Maynilad has "8 Digit Contract Account
    // Number" + a required "Account Name")
    this.accountNumberInput            = page.getByRole('textbox', { name: 'Account Number', exact: true });
    this.contractAccountNumberInput    = page.getByRole('textbox', { name: 'Digit Contract Account Number' });
    this.accountNameInput              = page.getByRole('textbox', { name: 'Account Name' });
    this.amountInput                   = page.getByRole('spinbutton', { name: 'Amount' });
    this.emailInput                    = page.getByRole('textbox', { name: 'Email(Optional)' });
    this.payNowButton                  = page.getByRole('button', { name: 'Pay Now' });

    // Pay Now opens a confirmation modal (#myModal) summarizing the payment
    // details; Confirm submits it
    this.confirmationModal             = page.locator('#myModal');
    this.confirmPayButton              = page.getByRole('button', { name: 'Confirm' });

    // Feedback
    this.successToast                  = page.locator('#toast.bg-success'); // TODO: capture success indicator after payment
    this.errorMessage                  = page.locator('.error-message, [class*="error"], [class*="invalid"]').first(); // TODO: capture invalid-account error

    // Transaction Module
    this.transactionTableRows          = page.locator('table tbody tr'); // TODO: capture via codegen
    this.transactionSearchInput        = page.getByRole('searchbox', { name: 'Search:' }); // TODO: capture via codegen
  }

  // --- Navigation -------------------------------------------------------------

  // Recorded as " Payment Console" in one session and "Payment Console
  // Category" in another, so match loosely
  async goToPaymentConsole() {
    await this.page.getByRole('link', { name: /payment console/i }).first().click();
    await this.page.waitForLoadState('networkidle');
    console.log('[BayadPage] Navigated to Payment Console');
  }

  async goToTransactionModule() {
    await this.page.getByRole('link', { name: /transaction/i }).click(); // TODO: capture nav link via codegen
    await this.page.waitForLoadState('networkidle');
    console.log('[BayadPage] Navigated to Transaction Module');
  }

  // --- Console setup (shared preamble for every Bayad payment) -----------------

  // The business name dropdown filters via a search box; the option text can
  // be longer than the searched value, so match non-exact.
  // Selecting the business triggers an AJAX call that populates the Biller
  // Account dropdown; waiting on that specific response (rather than
  // networkidle, which proved flaky — the option list can still be empty for
  // a moment after the network settles) so the next select isn't opened
  // before its options exist (observed 2026-07-22).
  async selectBusinessCategoryAccount(value: string) {
    await this.businessCategoryAccountSelect.click();
    await this.select2SearchBox.fill(value);
    const credentialsLoaded = this.page.waitForResponse((res) =>
      res.url().includes('/lookup/payment-console/options/account-credentials')
    );
    await this.page.getByRole('option', { name: value }).first().click();
    await credentialsLoaded;
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
    await this.page.getByRole('option', { name: value }).first().click();
  }

  // --- Biller selection ---------------------------------------------------------

  async searchBiller(billerName: string) {
    await this.billerSearchInput.fill(billerName);
    await this.page.waitForLoadState('networkidle');
    console.log(`[BayadPage] Searched for biller: ${billerName}`);
  }

  async selectBiller(billerName: string) {
    await this.billerSearchResults.getByRole('link', { name: billerName, exact: true }).click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[BayadPage] Selected biller: ${billerName}`);
  }

  // --- Payment form -------------------------------------------------------------

  async fillAccountNumber(accountNumber: string) {
    await this.accountNumberInput.fill(accountNumber);
  }

  // Maynilad-specific fields
  async fillContractAccountNumber(accountNumber: string) {
    await this.contractAccountNumberInput.fill(accountNumber);
  }

  async fillAccountName(accountName: string) {
    await this.accountNameInput.fill(accountName);
  }

  async fillAmount(amount: string) {
    await this.amountInput.fill(amount);
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async clickPayNow() {
    await this.payNowButton.click();
    console.log('[BayadPage] Pay Now clicked');
  }

  async clickConfirm() {
    await this.confirmationModal.waitFor({ state: 'visible' });
    await this.confirmPayButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[BayadPage] Payment confirmed');
  }

  async assertConfirmationModalShowsDetails(details: string[]) {
    await this.confirmationModal.waitFor({ state: 'visible' });
    for (const detail of details) {
      await expect(
        this.confirmationModal,
        `Confirmation modal should show: ${detail}`
      ).toContainText(detail);
    }
    console.log('[BayadPage] Confirmation modal shows payment details');
  }

  // --- Verifications ------------------------------------------------------------

  async assertPaymentProcessed() {
    await expect(
      this.successToast, // TODO: confirm — may be a receipt modal instead of a toast
      'Payment success confirmation should be visible'
    ).toBeVisible();
    console.log('[BayadPage] Payment processed successfully');
  }

  async assertPaymentRejected() {
    await expect(
      this.errorMessage,
      'Invalid account number error should be visible'
    ).toBeVisible();
    console.log('[BayadPage] Payment rejected as expected');
  }

  // --- Transaction History --------------------------------------------------------

  async searchTransaction(term: string) {
    await this.transactionSearchInput.fill(term);
    await this.page.waitForLoadState('networkidle');
    console.log(`[BayadPage] Searched transaction history for: ${term}`);
  }

  async assertTransactionInHistory(accountNumber: string, billerName: string) {
    const row = this.transactionTableRows
      .filter({ hasText: accountNumber })
      .filter({ hasText: billerName });
    await expect(
      row.first(),
      `Transaction History should contain a ${billerName} payment for ${accountNumber}`
    ).toBeVisible();
    console.log(`[BayadPage] Found ${billerName} transaction for ${accountNumber}`);
  }
}

export default BayadPage;
