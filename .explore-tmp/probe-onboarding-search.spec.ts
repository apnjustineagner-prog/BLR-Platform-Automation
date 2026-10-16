import { test, expect } from '@playwright/test';

// Probe: does the onboarding table search box work now?
test('probe onboarding search box', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto('/business-category', { waitUntil: 'domcontentloaded' });

  const table = page.locator('#business-CategoryTable');
  await table.waitFor({ state: 'visible', timeout: 60_000 });

  const searchBox = page.getByRole('searchbox', { name: 'Search:' });
  const exists = await searchBox.count();
  console.log('[probe] searchbox count:', exists);

  if (exists > 0) {
    // Grab the first real merchant name to search for
    const firstRowName = await table
      .locator('tbody tr')
      .filter({ hasNotText: 'No Merchants' })
      .first()
      .locator('td')
      .nth(6) // Name column (0-indexed: Date Created=0 ... Name=6)
      .innerText()
      .catch(() => '');
    console.log('[probe] first row name before search:', JSON.stringify(firstRowName));

    if (firstRowName.trim()) {
      const term = firstRowName.trim().slice(0, 8);
      await searchBox.fill(term);
      await page.waitForTimeout(3000); // let DataTables debounce + server round-trip
      const rowCount = await table.locator('tbody tr').filter({ hasNotText: 'No Merchants' }).count();
      console.log(`[probe] rows after searching "${term}":`, rowCount);
      const entriesText = await page.locator('#business-CategoryTable_info, [id*="_info"]').innerText().catch(() => 'n/a');
      console.log('[probe] entries info:', entriesText);
    }
  }
});
