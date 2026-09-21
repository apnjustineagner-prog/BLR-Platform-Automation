// utils/onboardingMerchantTable.ts
//
// ==============================================================================
// ONBOARDING MERCHANT TABLE — SHARED ROW-LOOKUP HELPERS
// ==============================================================================
//
// The Onboarding merchant table (#business-CategoryTable, served from
// /business-category) has NO search/filter control — confirmed live
// 2026-09-18 via a live DOM dump + screenshot: the only element on the page
// with an ARIA "Search" label is an unrelated top-nav quick-search input
// (type="text", so it doesn't even carry the `searchbox` role), and no
// search input exists anywhere near the table itself. The backend DataTables
// endpoint (`GET /business-category/page/search`) still fully supports a
// `search[value]` param, but the frontend widget for it was removed — so
// every `page.getByRole('searchbox', ...)` locator that used to drive this
// table's row lookup was matching nothing and burning the full action
// timeout (45s) before failing.
//
// The table still sorts by Date Created descending by default (no explicit
// `order` param is even sent — it's a fixed server-side default) and offers
// a page-size control (10/25/50/100/All) in place of search. So instead of
// searching, these helpers switch to "All" and scan the rendered rows
// directly for the target business name — this also covers long-lived
// fixture merchants referenced by name in test data (utils/testData.ts),
// which can sit anywhere in the 1,300+ row table, not just near the top
// (confirmed live 2026-09-18: BLR-2721's fixture merchant was NOT within the
// first 100 rows and was never found by a "top 100" strategy).
//
// Used by:
//   pages/blrAccountOnboardingPage/blrOnboardingModulePage.ts (getMerchantDetails)
//   pages/PLATFORM(SUPERADMIN)/onboardingPage.ts (searchForMerchantRow, assertMerchantDeleted, goToOnboarding)
//   pages/PLATFORM(SUPERADMIN)/accountCredentialPage.ts (goToOnboarding, selectMerchant)
//   pages/PLATFORM(SUPERADMIN)/processorCredentialPage.ts (goToOnboarding, selectMerchant)
//
// ==============================================================================

import { expect, type Locator, type Page } from '@playwright/test';

export const ONBOARDING_TABLE_SELECTOR = '#business-CategoryTable';

/**
 * Switches the onboarding table's page size to "All" so every row is in view
 * (~1,300+ rows; confirmed live 2026-09-18 the table redraws with all of
 * them within ~1-2s — light enough to not be worth the pagination logic a
 * fixed page size would need to cover fixture merchants deep in the list).
 * The selection does NOT persist across a reload (confirmed live 2026-09-18
 * — reloading always resets it back to the 10-row default), so callers must
 * call this again after every reload.
 *
 * Idempotent: skips the click entirely if already showing "All" rows.
 * Re-opening this dropdown a second time in the same page load (i.e.
 * without a reload in between) is NOT safe to do unconditionally — confirmed
 * live 2026-09-18 that the second open leaves the "All"/page-size option
 * links present in the DOM but absent from the accessibility tree (so
 * `getByRole('link', ...)` never finds them and times out), and its
 * `.dt-button-background` backdrop can get stuck covering the entire page,
 * silently intercepting every subsequent click anywhere (including
 * unrelated nav links) until the next reload. Skipping the redundant
 * re-open avoids the bug entirely.
 */
export async function showMaxRowsPerPage(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /show (\d+|all) rows/i });
  const currentText = await button.textContent().catch(() => '');
  if (currentText && /show all rows/i.test(currentText)) return;

  await button.click();
  await page.getByRole('link', { name: 'All', exact: true }).click();
}

/**
 * Waits for the onboarding table to finish loading its rows (a real row, not
 * the empty "No Merchants" placeholder) before scanning it. Best-effort — if
 * the list is genuinely empty within the budget, the caller's reload loop
 * keeps retrying.
 */
export async function waitForOnboardingListLoaded(page: Page, timeoutMs = 20_000): Promise<void> {
  const table = page.locator(ONBOARDING_TABLE_SELECTOR);
  const dataRow = table.locator('tbody tr').filter({ hasNotText: 'No Merchants' }).first();
  await dataRow.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => {});
}

/**
 * Finds a merchant's row in the onboarding table by reloading + rescanning
 * (not searching — see file header). Reloading also absorbs the
 * create/update → queryable lag on this shared test env: the row is often
 * not yet present immediately after a create/update completes, only
 * appearing a few reload passes later.
 *
 * Returns the live row locator once found; throws after maxAttempts.
 */
export async function findOnboardingRow(
  page: Page,
  businessName: string,
  maxAttempts = 8,
): Promise<Locator> {
  const table = page.locator(ONBOARDING_TABLE_SELECTOR);
  const targetRow = table.locator('tbody tr').filter({ hasText: businessName });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    await table.waitFor({ state: 'visible', timeout: 60_000 });
    await waitForOnboardingListLoaded(page);
    await showMaxRowsPerPage(page);

    const found = await targetRow
      .first()
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (found) return targetRow;
  }

  throw new Error(`Merchant "${businessName}" not found in onboarding table after ${maxAttempts} reload attempts`);
}

/**
 * Waits for a merchant's row to disappear from the onboarding table after
 * deletion. Deletion is processed async server-side, so the row can still
 * appear for a while after the confirm click returns — reload + rescan
 * (same reasoning as findOnboardingRow) until it's gone.
 */
export async function waitForOnboardingRowGone(
  page: Page,
  businessName: string,
  maxAttempts = 5,
): Promise<void> {
  const table = page.locator(ONBOARDING_TABLE_SELECTOR);
  const targetRow = table.locator('tbody tr').filter({ hasText: businessName }).first();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await table.waitFor({ state: 'visible', timeout: 60_000 });
    }
    await showMaxRowsPerPage(page);
    const stillVisible = await targetRow.isVisible().catch(() => false);
    if (!stillVisible) return;
    await page.waitForTimeout(3000);
  }

  // Final assertion surfaces a clear failure if it truly never disappears.
  await expect(targetRow, `Merchant "${businessName}" should no longer appear in the table`).toBeHidden();
}
