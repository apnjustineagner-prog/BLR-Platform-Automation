import { chromium } from '@playwright/test';
import path from 'path';

const STORAGE_FILE = path.resolve('/Users/jagner/Downloads/blr-platform-automation', 'storageState.json');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE_FILE, viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto('https://test-web-admin.billeroo.com/business-category', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (page.url().includes('/login')) { console.log('SESSION EXPIRED'); await browser.close(); return; }

  await page.locator('#business-CategoryTable').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByRole('button', { name: /show \d+ rows/i }).click();
  await page.waitForTimeout(300);

  const start = Date.now();
  await page.getByRole('link', { name: 'All', exact: true }).click();
  // Wait for the footer to reflect all rows loaded.
  await page.getByText(/Showing 1 to [\d,]+ of [\d,]+ entries/).waitFor({ timeout: 60000 });
  const elapsed = Date.now() - start;
  const footerText = await page.getByText(/Showing 1 to [\d,]+ of [\d,]+ entries/).textContent();
  console.log('Elapsed ms:', elapsed, 'Footer:', footerText);

  const target = page.locator('#business-CategoryTable tbody tr').filter({ hasText: 'Test Business SMQDEM' });
  const foundStart = Date.now();
  const found = await target.first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  console.log('Found target row:', found, 'lookup ms:', Date.now() - foundStart);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
