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

  constructor(private page: Page) {
    // Sidebar toggle — anchored to avoid also matching the "Transaction List"
    // submenu link (both contain "Transaction").
    this.transactionNavLink   = page.getByRole('link', { name: /^\s*transaction\s*$/i });
    this.transactionListLink  = page.getByRole('link', { name: 'Transaction List' });
    this.searchByReferenceInput = page.getByRole('textbox', { name: /search by reference/i });
  }

  async goToTransactionList() {
    await this.transactionNavLink.click();
    await this.transactionListLink.click();
    await this.searchByReferenceInput.waitFor({ state: 'visible' });
    console.log('[TransactionPage] Navigated to Transaction List');
  }

  // TODO: confirm what value the search actually filters on (reference no.?
  // PRN? account number?) and how a match renders (row appears? status
  // column?) before wiring up a real assertion.
  async searchByReference(value: string) {
    await this.searchByReferenceInput.fill(value);
    console.log(`[TransactionPage] Searched by reference: ${value}`);
  }
}

export default TransactionPage;
