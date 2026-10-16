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
  console.log('Button text before:', await button.textContent());
  await button.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT_DIR + '/show-all-dropdown-open.png' });

  const allLink = page.getByRole('link', { name: 'All', exact: true });
  console.log('All link visible:', await allLink.isVisible().catch(() => 'ERR'));
  await allLink.click();
  console.log('Clicked All. Waiting for network...');

  // Poll footer text over time
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const footer = await page.locator('.dataTables_info, [class*="dt-info"], *:has-text("Showing")').last().textContent().catch(() => 'ERR');
    const btnText = await button.textContent().catch(() => 'ERR');
    console.log(`t=${i+1}s footer-ish:`, footer?.slice(0,60), '| button:', btnText);
  }

  await page.screenshot({ path: OUT_DIR + '/show-all-after.png' });
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
