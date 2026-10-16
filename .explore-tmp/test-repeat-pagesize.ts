import { chromium } from '@playwright/test';
import path from 'path';

const STORAGE_FILE = path.resolve('/Users/jagner/Downloads/blr-platform-automation', 'storageState.json');

async function showMaxRowsPerPage(page: any, label: string) {
  console.log(`[${label}] clicking Show X rows button...`);
  await page.getByRole('button', { name: /show \d+ rows/i }).click();
  const option = page.getByRole('link', { name: '100', exact: true });
  try {
    await option.waitFor({ state: 'visible', timeout: 5000 });
    console.log(`[${label}] "100" option visible, clicking...`);
    await option.click();
    console.log(`[${label}] done.`);
  } catch (e) {
    console.log(`[${label}] FAILED waiting for "100" option:`, (e as Error).message.split('\n')[0]);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE_FILE, viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto('https://test-web-admin.billeroo.com/business-category', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (page.url().includes('/login')) { console.log('SESSION EXPIRED'); await browser.close(); return; }
  await page.locator('#business-CategoryTable').waitFor({ state: 'visible', timeout: 30000 });

  await showMaxRowsPerPage(page, 'call-1');
  await page.waitForTimeout(1000);
  await showMaxRowsPerPage(page, 'call-2-immediately-after');

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
