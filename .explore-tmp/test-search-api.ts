import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const STORAGE_FILE = path.resolve('/Users/jagner/Downloads/blr-platform-automation', 'storageState.json');
const OUT_DIR = '/private/tmp/claude-502/-Users-jagner-Downloads-blr-platform-automation/1f44cc53-f886-4178-a9f9-0acb5ae7ccba/scratchpad';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE_FILE });
  const page = await context.newPage();
  // Need to be on the domain first for cookies/CSRF-relevant headers, but the
  // API is on a different subdomain (test-web-api) — request context still
  // sends the storageState cookies scoped to that domain since it's in the file.
  await page.goto('https://test-web-admin.billeroo.com/business-category', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const targetName = 'Test Business PO8BU2'; // known-existing row from earlier screenshot

  const params = new URLSearchParams({
    draw: '1',
    'columns[0][data]': 'dateCreated',
    'columns[6][data]': 'name',
    start: '0',
    length: '10',
    'search[value]': targetName,
    'search[regex]': 'false',
    page: '0',
    size: '10',
    mode: 'STRICT',
  });

  const res = await page.request.get(
    `https://test-web-api.billeroo.com/business-category/page/search?${params.toString()}`,
  );
  const status = res.status();
  const body = await res.text();
  fs.writeFileSync(path.join(OUT_DIR, 'search-api-result.json'), JSON.stringify({ status, body: body.slice(0, 3000) }, null, 2));
  console.log('status:', status);
  console.log(body.slice(0, 1500));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
