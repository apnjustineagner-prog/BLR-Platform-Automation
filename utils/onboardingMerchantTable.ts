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
// The table sorts by Date Created descending by default (a fixed server-side
// default — no explicit `order` param is even sent), so a just-created or
// just-updated merchant always lands on the FIRST page (the newest rows).
// These helpers therefore just scan the first page for the target business
// name — no page-size / "show rows" control needed.
//
// NOTE (2026-09-21): the page-size control ("Show 10/25/50/100/All rows") is
// intentionally NOT used. The table is server-side processed (bServerSide),
// and switching to "All" does not actually re-render all ~1,360 rows — the
// table stays on the default 10-row page (confirmed live 2026-09-21 across
// the dropdown link, the DataTables API page.len(-1).draw(), and .search()).
// Since every flow here creates/updates the merchant it then looks up, and
// those always appear on the first page, scanning the first page is both
// sufficient and far more reliable. (Any test that needs a specific
// long-lived merchant should create its own fresh one rather than relying on
// a pre-seeded fixture buried deep in the list.)
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
 * Finds a merchant's row in the onboarding table.
 *
 * The table's "Search:" box is present again (ref confirmed live via the
 * failure error-context: `searchbox "Search:"`), and the DataTables backend
 * (`GET /business-category/page/search`) filters server-side on `search[value]`
 * — so typing the business name narrows the WHOLE list to the match regardless
 * of which page it sits on. That is far more reliable than the old
 * reload-and-scan-first-page approach, which (a) only saw page 1, and (b) could
 * run 8 reloads × up to ~88s each, blowing past the 180s test timeout and
 * getting the page torn down mid-reload (the "Target page ... has been closed"
 * failures on BLR-2716/2717/2721/2723).
 *
 * Strategy: type the name into the search box, wait for the filtered row. Retry
 * by re-typing (cheap) rather than full-page reloading, to absorb the
 * create/update → queryable lag on this slow env. Falls back to a bounded
 * reload+rescan only if the search box isn't present at all.
 *
 * Returns the live row locator once found; throws after the deadline.
 */
export async function findOnboardingRow(
  page: Page,
  businessName: string,
  maxAttempts = 6,
): Promise<Locator> {
  const table = page.locator(ONBOARDING_TABLE_SELECTOR);
  const searchBox = page.getByRole('searchbox', { name: 'Search:' });
  const targetRow = table.locator('tbody tr').filter({ hasText: businessName });

  await table.waitFor({ state: 'visible', timeout: 60_000 });

  // Preferred path: server-side search box (filters the whole list, not just
  // page 1). Keep each attempt bounded so the total stays well under the
  // 180s test timeout even in the worst case.
  const hasSearch = await searchBox
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (hasSearch) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Re-type each attempt: clear then fill so a create/update that was still
      // propagating on the previous try is re-queried. fill() replaces the
      // existing value, so this also recovers from a stale/partial entry.
      await searchBox.fill('');
      await searchBox.fill(businessName);
      // DataTables debounces then round-trips to the server; give it a beat.
      await page.waitForTimeout(1_500);
      await waitForOnboardingListLoaded(page);

      const found = await targetRow
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      if (found) return targetRow;

      // Not there yet (create/update lag) — wait a little and re-search.
      await page.waitForTimeout(2_000);
    }
    throw new Error(
      `Merchant "${businessName}" not found via onboarding search after ${maxAttempts} attempts`,
    );
  }

  // Fallback: no search box — bounded reload + rescan of the first page.
  // Fewer attempts than before so a hung list fails fast instead of eating
  // the whole test timeout and tearing the page down mid-reload.
  for (let attempt = 1; attempt <= 4; attempt++) {
    if (attempt > 1) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await table.waitFor({ state: 'visible', timeout: 60_000 });
    }
    await waitForOnboardingListLoaded(page);

    const found = await targetRow
      .first()
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (found) return targetRow;
  }

  throw new Error(`Merchant "${businessName}" not found in onboarding table (search box absent, reload fallback exhausted)`);
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
  const searchBox = page.getByRole('searchbox', { name: 'Search:' });
  const targetRow = table.locator('tbody tr').filter({ hasText: businessName }).first();

  await table.waitFor({ state: 'visible', timeout: 60_000 });

  const hasSearch = await searchBox
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (hasSearch) {
    // Server-side search scopes the whole list to this name, so "no matching
    // row" means it's genuinely deleted (not just absent from page 1).
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await searchBox.fill('');
      await searchBox.fill(businessName);
      await page.waitForTimeout(1_500);
      await waitForOnboardingListLoaded(page);
      const stillVisible = await targetRow.isVisible().catch(() => false);
      if (!stillVisible) return;
      await page.waitForTimeout(2_000);
    }
    await expect(targetRow, `Merchant "${businessName}" should no longer appear in the table`).toBeHidden();
    return;
  }

  // Fallback: reload + rescan when the search box isn't present.
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await table.waitFor({ state: 'visible', timeout: 60_000 });
    }
    await waitForOnboardingListLoaded(page);
    const stillVisible = await targetRow.isVisible().catch(() => false);
    if (!stillVisible) return;
    await page.waitForTimeout(3000);
  }

  // Final assertion surfaces a clear failure if it truly never disappears.
  await expect(targetRow, `Merchant "${businessName}" should no longer appear in the table`).toBeHidden();
}
