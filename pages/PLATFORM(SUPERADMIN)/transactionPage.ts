// pages/PLATFORM(SUPERADMIN)/transactionPage.ts
//
// ==============================================================================
// TRANSACTION MODULE — PAGE OBJECT
// ==============================================================================
//
// Navigation captured via codegen (2026-07-23): sidebar "Transaction" →
// submenu "Transaction List" → search box "Search by Reference (...)"
// (accessible name truncated in the recorder; matched loosely below).
//
// ==============================================================================

import { Page, expect } from '@playwright/test';

export class TransactionPage {
  private readonly transactionNavLink;
  private readonly transactionListLink;
  private readonly searchByReferenceInput;
  private readonly applyFilterButton;
  private readonly transactionTable;

  constructor(private page: Page) {
    // Accessible name has leading/trailing whitespace from an embedded icon
    // (same pattern as paymentConsolePage's sidebar links) — an anchored
    // whitespace-only regex (`^\s*transaction\s*$`) failed to resolve this
    // link at all when called right after the payment receipt (observed
    // 2026-07-23), so match loosely like the rest of the sidebar locators.
    // .first() avoids ambiguity with the "Transaction List" submenu link.
    this.transactionNavLink   = page.getByRole('link', { name: /transaction/i }).first();
    this.transactionListLink  = page.getByRole('link', { name: 'Transaction List' });
    this.searchByReferenceInput = page.getByRole('textbox', { name: /search by reference/i });
    this.applyFilterButton    = page.getByRole('button', { name: 'Apply Filter' });
    // DataTable — columns include Date, Date Posted, Service Provider,
    // Service Code, Business, ..., Transaction Reference, Business Reference
    // (== the receipt's Merchant Reference No.), Processor Reference, Total
    // Amount, Currency, Integrator Message, Status. Ids confirmed live 2026-07-23.
    this.transactionTable     = page.locator('#transactionTable');
  }

  // Called right after the payment receipt, which is long enough that the
  // page ends up scrolled down to it — scrolling the "Transaction" sidebar
  // link above the viewport. scrollIntoViewIfNeeded() + a generous timeout
  // give the sidebar chrome time to settle after the receipt renders.
  async goToTransactionList() {
    await this.transactionNavLink.scrollIntoViewIfNeeded({ timeout: 20000 });
    await this.transactionNavLink.click({ timeout: 20000 });
    await this.transactionListLink.click();
    await this.searchByReferenceInput.waitFor({ state: 'visible' });
    console.log('[TransactionPage] Navigated to Transaction List');
  }

  // Filling the search box alone doesn't filter — Apply Filter has to be
  // clicked to actually run the search (confirmed via codegen 2026-07-23).
  //
  // Apply Filter occasionally doesn't take on the first click — the table
  // stays empty (Total Amount Php 0.00, no rows) even with the reference typed
  // in (observed live 2026-09-16). So re-click Apply Filter until the matching
  // row appears, rather than clicking once and hoping. The reference is unique
  // per transaction, so the row's presence is the reliable "filter applied"
  // signal.
  async searchByReference(value: string) {
    await this.searchByReferenceInput.fill(value);
    const row = this.transactionTable.locator('tbody tr', { hasText: value });
    await expect(async () => {
      await this.applyFilterButton.click();
      await expect(row).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
    console.log(`[TransactionPage] Searched by reference: ${value}`);
  }

  // Filters by Business Reference (== Merchant Reference No. on the payment
  // receipt) since it's unique per transaction, then checks the other
  // columns within that same row — avoids relying on fixed column indexes.
  //
  // Doesn't assert the Total Amount value: confirmed live 2026-07-23 that it
  // doesn't equal the submitted amount (e.g. paid 53.00, table showed 63.00,
  // a flat +10 difference) — an undisclosed fee, presumably, but computation
  // isn't confirmed (same caveat as paymentConsolePage.assertPaymentReceipt).
  async assertTransactionRow(details: { billerName: string; merchantReference: string; status?: string }) {
    const row = this.transactionTable.locator('tbody tr', { hasText: details.merchantReference });
    await expect(row, 'Transaction row should appear for this merchant reference').toBeVisible();
    await expect(row, 'Row should show the correct service provider').toContainText(details.billerName);
    await expect(row, 'Row should show the correct status').toContainText(details.status ?? 'Payment Posted');
    console.log('[TransactionPage] Transaction row verified');
  }

  // The DataTable element — screenshot this (not the viewport) so the full,
  // horizontally-scrolling table width is captured rather than clipped.
  tableLocator() {
    return this.transactionTable;
  }

  // --- View Transaction modal --------------------------------------------------
  //
  // Opens the per-row "View Transaction" modal (the eye icon, `.far.fa-eye`)
  // for the row matching `merchantReference`. This modal shows the full,
  // un-clipped transaction detail incl. the fee breakdown (Bill Amount /
  // Add-on Fee / Service Fee / Total Amount) — a cleaner source than the wide
  // table. The eye icon is scoped to the matched row so it can't open the
  // wrong transaction. Amounts render PHP-prefixed (e.g. "PHP 34.00").

  private viewModal() {
    // The modal titled "View Transaction"; matched by the visible header so
    // it's independent of a container id.
    return this.page.locator('.modal, [role="dialog"]').filter({ hasText: 'View Transaction' }).first();
  }

  async viewTransaction(merchantReference: string) {
    const row = this.transactionTable.locator('tbody tr', { hasText: merchantReference });
    await expect(row, 'Transaction row should be present before opening its View modal').toBeVisible();
    await row.locator("//i[@class='far fa-eye']").click();
    await expect(this.viewModal(), 'View Transaction modal should open').toBeVisible({ timeout: 20000 });
    // Let the modal fade-in settle so a screenshot isn't captured mid-transition
    // (ghosted over the page behind it).
    await this.page.waitForTimeout(500);
    console.log(`[TransactionPage] Opened View Transaction modal for ${merchantReference}`);
  }

  // Verifies the fee breakdown + key details in the open View Transaction
  // modal. Amounts are matched with the "PHP " prefix the modal renders.
  // Pass only what you want to assert; omitted fields are skipped.
  async assertTransactionDetails(details: {
    billerName?: string;      // viewServiceProviderName
    processor?: string;       // viewProcessorName
    merchantReference?: string; // viewMerchantReference (Business Reference)
    accountNumber?: string;   // accountNumber
    billAmount?: string;      // viewBillAmount   (e.g. "24.00")
    addOnFee?: string;        // viewAddOnFee
    serviceFee?: string;      // viewServiceFee
    totalAmount?: string;     // viewTotalAmount
    integratorMessage?: string; // viewIntegratorMessage
    statusDescription?: string; // viewStatusDescription
  }) {
    // Every field is a disabled <input> — its content is in the `value`
    // attribute, not text content — so assert with toHaveValue, and amounts
    // render PHP-prefixed (e.g. "PHP 34.00"). Confirmed live 2026-09-10.
    const php = (v: string) => `PHP ${v}`;
    const checks: Array<[string, string | undefined, boolean]> = [
      ['#viewServiceProviderName', details.billerName, false],
      ['#viewProcessorName', details.processor, false],
      ['#viewMerchantReference', details.merchantReference, false],
      ['#accountNumber', details.accountNumber, false],
      ['#viewBillAmount', details.billAmount, true],
      ['#viewAddOnFee', details.addOnFee, true],
      ['#viewServiceFee', details.serviceFee, true],
      ['#viewTotalAmount', details.totalAmount, true],
      ['#viewIntegratorMessage', details.integratorMessage, false],
      ['#viewStatusDescription', details.statusDescription, false],
    ];
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const [selector, value, isAmount] of checks) {
      if (value === undefined) continue;
      const expected = isAmount ? php(value) : value;
      // The account-number field's id varies (given as `accountNumber`, but
      // the live modal uses `viewAccountNumber` alongside the other view*
      // fields). Match either, scoped to the modal, so we don't depend on one.
      const locator =
        selector === '#accountNumber'
          ? this.viewModal().locator('#viewAccountNumber, #accountNumber, [name="accountNumber"]').first()
          : this.page.locator(selector);
      // Contains-match (tolerant of surrounding whitespace in the input value).
      await expect(
        locator,
        `View Transaction modal should show ${selector} = ${expected}`,
      ).toHaveValue(new RegExp(escapeRe(expected)));
    }
    console.log('[TransactionPage] View Transaction details verified');
  }

  // The modal's scrollable body — the element that actually scrolls (the outer
  // .modal is a fixed-height backdrop). Playwright element screenshots expand a
  // scrollable element to its FULL height, capturing the whole transaction
  // detail (fee breakdown + the lower Transaction Details section) top-to-
  // bottom without clipping, regardless of what's visible. Falls back through
  // likely Bootstrap container classes.
  viewModalLocator() {
    const modal = this.viewModal();
    return modal.locator('.modal-body, .modal-content').first();
  }

  async closeViewTransaction() {
    await this.viewModal().getByRole('button', { name: /close|×/i }).first().click().catch(() => {});
  }
}

export default TransactionPage;
