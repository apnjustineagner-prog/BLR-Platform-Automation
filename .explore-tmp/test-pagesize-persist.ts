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
  await page.waitForTimeout(500);
  await page.getByRole('link', { name: '100', exact: true }).or(page.getByText('100', { exact: true })).first().click();
  await page.waitForTimeout(1500);
  const beforeReload = await page.getByText(/Showing 1 to \d+ of/).textContent();
  console.log('Before reload:', beforeReload);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#business-CategoryTable').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);
  const afterReload = await page.getByText(/Showing 1 to \d+ of/).textContent();
  console.log('After reload:', afterReload);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
