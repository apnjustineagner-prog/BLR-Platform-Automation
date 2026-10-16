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

  // Wait for the table to actually populate before dumping.
  await page.locator('#business-CategoryTable').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Dump the whole wrapper around the DataTable (controls + table), not just the table.
  const wrapperHtml = await page.locator('#business-CategoryTable').evaluate((el) => {
    // Walk up to find the DataTables wrapper (commonly has class containing "dataTables_wrapper")
    let node: Element | null = el;
    for (let i = 0; i < 5 && node; i++) {
      if (node.className && String(node.className).includes('dataTable')) break;
      node = node.parentElement;
    }
    return (node ?? el).outerHTML;
  }).catch((e) => `ERROR: ${e}`);
  fs.writeFileSync(path.join(OUT_DIR, 'onboarding-table-wrapper.html'), wrapperHtml);

  // Also grab any input elements anywhere near the top controls area (siblings before the table).
  const allInputsInfo = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    return inputs.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      placeholder: i.placeholder,
      ariaLabel: i.getAttribute('aria-label'),
      role: i.getAttribute('role'),
      outerHTML: i.outerHTML.slice(0, 300),
    }));
  });
  fs.writeFileSync(path.join(OUT_DIR, 'onboarding-all-inputs.json'), JSON.stringify(allInputsInfo, null, 2));

  console.log('DONE, url=', page.url());
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
