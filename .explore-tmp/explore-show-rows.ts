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
  await page.locator('#business-CategoryTable').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /show \d+ rows/i }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, 'show-rows-dropdown.png') });

  const dropdownHtml = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /show \d+ rows/i.test(b.textContent || ''));
    if (!btn) return 'BUTTON NOT FOUND';
    let node: Element | null = btn.parentElement;
    return node ? node.outerHTML : 'NO PARENT';
  });
  fs.writeFileSync(path.join(OUT_DIR, 'show-rows-dropdown.html'), dropdownHtml);

  console.log('DONE');
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
