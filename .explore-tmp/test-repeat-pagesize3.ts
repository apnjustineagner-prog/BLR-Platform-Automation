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

  const button = page.getByRole('button', { name: /show \d+ rows/i });
  await button.click();
  await page.getByRole('link', { name: '100', exact: true }).click();
  await page.waitForTimeout(1000);

  await button.click();
  await page.waitForTimeout(500);

  const links = page.getByRole('link', { name: '100', exact: true });
  console.log('count of role=link name=100:', await links.count());
  const allLinksText = await page.locator('.dropdown-menu.dt-button-collection a').allTextContents();
  console.log('all dropdown link texts:', allLinksText);
  const allLinksRoles = await page.locator('.dropdown-menu.dt-button-collection a').evaluateAll(els => els.map(e => ({ text: e.textContent, tabindex: e.getAttribute('tabindex'), href: e.getAttribute('href') })));
  console.log(JSON.stringify(allLinksRoles, null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
