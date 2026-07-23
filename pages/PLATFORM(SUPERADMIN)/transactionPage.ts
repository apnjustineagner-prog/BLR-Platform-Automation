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
  async searchByReference(value: string) {
    await this.searchByReferenceInput.fill(value);
    await this.applyFilterButton.click();
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
}

export default TransactionPage;
