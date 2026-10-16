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

  const requests: { url: string; method: string; postData: string | null }[] = [];
  page.on('request', (req) => {
    const url = req.url();
    // Only care about XHR/fetch calls, not static assets.
    if (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
      requests.push({ url, method: req.method(), postData: req.postData() });
    }
  });

  const responses: { url: string; status: number; bodySnippet: string }[] = [];
  page.on('response', async (res) => {
    const req = res.request();
    if (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
      let bodySnippet = '';
      try {
        const text = await res.text();
        bodySnippet = text.slice(0, 500);
      } catch {}
      responses.push({ url: res.url(), status: res.status(), bodySnippet });
    }
  });

  await page.goto('https://test-web-admin.billeroo.com/business-category', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  console.log('URL after goto+wait:', page.url());
  try {
    await page.locator('#business-CategoryTable').waitFor({ state: 'visible', timeout: 30000 });
  } catch (e) {
    console.log('Table did not appear. Current URL:', page.url());
    await page.screenshot({ path: path.join(OUT_DIR, 'debug-fail.png') });
    fs.writeFileSync(path.join(OUT_DIR, 'debug-fail.html'), await page.content());
    fs.writeFileSync(path.join(OUT_DIR, 'xhr-requests.json'), JSON.stringify(requests, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'xhr-responses.json'), JSON.stringify(responses, null, 2));
    throw e;
  }
  await page.waitForTimeout(1500);

  // Click page 2 to trigger another data fetch, so we can see the pagination request shape.
  const page2 = page.getByRole('link', { name: '2', exact: true });
  if (await page2.isVisible().catch(() => false)) {
    await page2.click();
    await page.waitForTimeout(2000);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'xhr-requests.json'), JSON.stringify(requests, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'xhr-responses.json'), JSON.stringify(responses, null, 2));

  console.log('DONE, requests captured:', requests.length);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
