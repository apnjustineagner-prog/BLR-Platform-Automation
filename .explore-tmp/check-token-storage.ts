import { chromium } from '@playwright/test';
import path from 'path';

const STORAGE_FILE = path.resolve('/Users/jagner/Downloads/blr-platform-automation', 'storageState.json');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE_FILE });
  const page = await context.newPage();
  await page.goto('https://test-web-admin.billeroo.com/business-category', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const storageDump = await page.evaluate(() => {
    const ls: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      ls[k] = localStorage.getItem(k) ?? '';
    }
    const ss: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)!;
      ss[k] = sessionStorage.getItem(k) ?? '';
    }
    return { localStorage: ls, sessionStorage: ss };
  });
  console.log(JSON.stringify(storageDump, null, 2).slice(0, 3000));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
