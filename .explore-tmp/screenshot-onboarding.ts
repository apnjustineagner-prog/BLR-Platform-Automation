import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const STORAGE_FILE = path.resolve('/Users/jagner/Downloads/blr-platform-automation', 'storageState.json');
const OUT_DIR = '/private/tmp/claude-502/-Users-jagner-Downloads-blr-platform-automation/1f44cc53-f886-4178-a9f9-0acb5ae7ccba/scratchpad';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE_FILE, viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto('https://test-web-admin.billeroo.com/business-category', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  if (page.url().includes('/login')) {
    console.log('SESSION EXPIRED');
    await browser.close();
    return;
  }
  await page.locator('#business-CategoryTable').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, 'onboarding-full.png'), fullPage: false });

  // Also isolate just the table-controls area right above the table.
  const controlsHtml = await page.evaluate(() => {
    const table = document.querySelector('#business-CategoryTable');
    if (!table) return null;
    // climb up until we find something with 'table-responsive' or similar container, then grab previous siblings
    let container: Element | null = table;
    for (let i = 0; i < 6 && container; i++) {
      container = container.parentElement;
    }
    return container ? container.outerHTML : null;
  });
  if (controlsHtml) fs.writeFileSync(path.join(OUT_DIR, 'onboarding-controls.html'), controlsHtml);

  console.log('DONE');
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
