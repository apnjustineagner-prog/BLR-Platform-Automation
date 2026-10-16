import { chromium } from '@playwright/test';
import path from 'path';

const STORAGE_FILE = path.resolve('/Users/jagner/Downloads/blr-platform-automation', 'storageState.json');
const OUT_DIR = '/private/tmp/claude-502/-Users-jagner-Downloads-blr-platform-automation/1f44cc53-f886-4178-a9f9-0acb5ae7ccba/scratchpad';

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
  console.log('button text after call 1:', await button.textContent());
  console.log('aria-expanded after call 1:', await button.getAttribute('aria-expanded'));

  await button.click();
  await page.waitForTimeout(500);
  console.log('aria-expanded after 2nd click:', await button.getAttribute('aria-expanded'));
  await page.screenshot({ path: OUT_DIR + '/repeat-click-state.png' });

  const dropdownHtml = await page.evaluate(() => {
    const el = document.querySelector('.dropdown-menu.dt-button-collection');
    return el ? el.outerHTML : 'NOT FOUND';
  });
  require('fs').writeFileSync(OUT_DIR + '/repeat-click-dropdown.html', dropdownHtml);
  console.log('dropdown html len:', dropdownHtml.length, dropdownHtml.slice(0, 200));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
