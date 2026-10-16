import { test } from '@playwright/test';
import { BlrLoginPage } from '../pages/blrAccountOnboardingPage/blrLoginPage';
import credentials from '../utils/decrypt';

test('check if XORWL2 exists', async ({ page }) => {
  test.setTimeout(240_000);
  const loginPage = new BlrLoginPage(page);
  await loginPage.gotoLogin();
  await loginPage.loginIfNeeded(credentials);
  await page.goto('https://test-web-admin.billeroo.com/business-category', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  for (const name of ['Test Business XORWL2', 'XORWL2', 'Test Business']) {
    const params = new URLSearchParams({
      draw: '1',
      'columns[0][data]': 'dateCreated',
      'columns[6][data]': 'name',
      start: '0',
      length: '25',
      'search[value]': name,
      'search[regex]': 'false',
      page: '0',
      size: '25',
      mode: 'STRICT',
    });
    const res = await page.request.get(
      `https://test-web-api.billeroo.com/business-category/page/search?${params.toString()}`,
    );
    let json: any = null;
    try { json = await res.json(); } catch { /* */ }
    const rows = json?.data ?? json?.content ?? json?.rows ?? [];
    const total = json?.recordsFiltered ?? json?.totalElements ?? (Array.isArray(rows) ? rows.length : 'n/a');
    console.log(`\n=== query "${name}" === httpStatus=${res.status()} matchCount=${total}`);
    if (Array.isArray(rows)) {
      for (const r of rows.slice(0, 8)) {
        console.log('  ->', JSON.stringify({ id: r.id ?? r.merchantId, name: r.name, status: r.status ?? r.state }));
      }
    }
  }
});
