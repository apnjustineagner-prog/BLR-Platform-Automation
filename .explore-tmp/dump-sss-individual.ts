// .explore-tmp/dump-sss-individual.ts
//
// One-off explorer: logs in as admin (via saved storageState), navigates the
// Payment Console to SSS - Individual, and dumps the payment form at each
// stage so we can map the SSS flow (membership type, SSS number, how payable
// months are fetched/selected, consent step, submit). Writes stage snapshots
// to console + .explore-tmp/sss-exploration/.
//
// Run: KEEP_SESSION=1 npx playwright test --project=setup-admin   (first, to make storageState.json)
//      npx ts-node --transpile-only .explore-tmp/dump-sss-individual.ts

import 'dotenv/config';
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { PaymentConsolePage } from '../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import { paymentConsoleContext } from '../utils/paymentConsoleData';

const STORAGE = path.resolve(process.cwd(), 'storageState.json');
const OUT = path.resolve(process.cwd(), '.explore-tmp/sss-exploration');

const DUMP = () => {
  const els = Array.from(
    (globalThis as any).document.querySelectorAll(
      'input, select, textarea, button, a, [role="combobox"], [role="option"], [class*="select2-selection"], label, th'
    )
  );
  return els
    .map((el: any) => {
      const rect = el.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        id: el.id || null,
        name: el.getAttribute('name'),
        title: el.getAttribute('title'),
        placeholder: el.getAttribute('placeholder'),
        role: el.getAttribute('role'),
        text: (el.textContent || '').trim().slice(0, 70) || null,
        visible,
      };
    })
    .filter((e: any) => e.visible && (e.id || e.name || e.title || e.placeholder || e.role || e.text));
};

async function dump(page: any, name: string) {
  const data = await page.evaluate(DUMP);
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2));
  console.log(`\n=== ${name} (${data.length} elements) ===`);
  for (const e of data) {
    console.log('  ' + [
      e.tag + (e.type ? `[${e.type}]` : ''),
      e.id ? `#${e.id}` : '',
      e.name ? `name=${e.name}` : '',
      e.title ? `title="${e.title}"` : '',
      e.placeholder ? `ph="${e.placeholder}"` : '',
      e.role ? `role=${e.role}` : '',
      e.text ? `text="${e.text}"` : '',
    ].filter(Boolean).join('  '));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(STORAGE)) {
    console.log('MISSING storageState.json — run: KEEP_SESSION=1 npx playwright test --project=setup-admin');
    return;
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE, viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const pc = new PaymentConsolePage(page);

  await page.goto('https://test-web-admin.billeroo.com/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (page.url().includes('/login')) { console.log('SESSION EXPIRED — regenerate storageState.json'); await browser.close(); return; }

  const ctx = paymentConsoleContext;
  await pc.goToPaymentConsole();
  await pc.assertOnPaymentConsolePage();
  if (ctx.businessCategoryAccount) await pc.selectBusinessCategoryAccount(ctx.businessCategoryAccount);
  await pc.selectAccountCredential(ctx.billerAccount);
  await pc.selectServiceType(ctx.serviceType);
  await pc.searchBillerAccount('SSS - Individual');
  await pc.selectBillerAccount('SSS - Individual');
  await page.waitForTimeout(2500);

  // Stage 1: the SSS Individual form as first rendered.
  await dump(page, 'sss-individual-01-form');

  console.log('\nDONE — snapshots in .explore-tmp/sss-exploration/');
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
