// .explore-tmp/dump-sss-form-html.ts
//
// One-off explorer: logs in via saved storageState, drives the Payment Console
// selection flow (business name -> biller account -> service type), then for
// each SSS biller (Individual, Employer) searches/selects it and dumps the
// rendered payment-form HTML so we can extract exact field labels/ids for the
// page object. Mirrors the pattern in dump-payment-link-html.ts.
//
// Run: npx ts-node .explore-tmp/dump-sss-form-html.ts
//   (or) npx tsx .explore-tmp/dump-sss-form-html.ts

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { PaymentConsolePage } from '../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import { paymentConsoleContext } from '../utils/paymentConsoleData';

const STORAGE_FILE = path.resolve(process.cwd(), 'storageState.json');
const OUT_DIR = path.resolve(process.cwd(), '.explore-tmp/sss-exploration');

const SSS_BILLERS = ['SSS - Individual', 'SSS - Employer'];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: STORAGE_FILE });
  const page = await context.newPage();
  const pc = new PaymentConsolePage(page);

  await page.goto('https://test-web-admin.billeroo.com/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  if (page.url().includes('/login')) {
    console.log('SESSION EXPIRED — regenerate storageState.json (run the setup project) and retry.');
    await browser.close();
    return;
  }

  for (const biller of SSS_BILLERS) {
    const safeName = biller.replace(/[^A-Za-z0-9]+/g, '_');
    console.log(`\n=== Exploring: ${biller} ===`);

    try {
      // Fresh navigation per biller so a stale form from the previous one
      // can't bleed into the dump.
      await pc.goToPaymentConsole();
      await pc.assertOnPaymentConsolePage();
      await pc.selectBusinessCategoryAccount(paymentConsoleContext.businessCategoryAccount);
      await pc.selectAccountCredential(paymentConsoleContext.billerAccount);
      await pc.selectServiceType(paymentConsoleContext.serviceType);
      await pc.searchBillerAccount(biller);
      await pc.selectBillerAccount(biller);

      // Give the biller-specific form time to render.
      await page.waitForTimeout(2500);

      // Dump the whole main content region — the form lives inside it. Grab a
      // few candidate containers so we don't miss it if the layout differs.
      const containerHtml =
        (await page.locator('main, .container-fluid, form').first().evaluate((el: any) => el.outerHTML).catch(() => null)) ??
        (await page.content());
      fs.writeFileSync(path.join(OUT_DIR, `${safeName}-form.html`), containerHtml);

      // Also dump a compact list of every input/select/textarea + its label,
      // id, name, placeholder, type — the useful bits for building locators.
      const fields = await page.$$eval('input, select, textarea, button', (els: any[]) =>
        els.map((e: any) => {
          const doc: any = e.ownerDocument;
          const labelEl = e.id ? doc.querySelector(`label[for="${e.id}"]`) : null;
          return {
            tag: e.tagName.toLowerCase(),
            type: e.getAttribute('type'),
            id: e.id || null,
            name: e.getAttribute('name'),
            placeholder: e.getAttribute('placeholder'),
            ariaLabel: e.getAttribute('aria-label'),
            label: labelEl?.textContent?.trim() || null,
            text: e.tagName.toLowerCase() === 'button' ? e.textContent?.trim() : null,
          };
        })
      );
      fs.writeFileSync(path.join(OUT_DIR, `${safeName}-fields.json`), JSON.stringify(fields, null, 2));

      console.log(`  wrote ${safeName}-form.html and ${safeName}-fields.json`);
    } catch (e) {
      console.error(`  FAILED exploring ${biller}:`, (e as Error).message);
    }
  }

  console.log('\nDONE');
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
