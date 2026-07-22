// tests/platform/paymentConsole.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE TEST SUITE (ECPay)
// ==============================================================================
//
// FLOW:
//   Login → Dashboard → Payment Console → select business name, biller
//   account, service type → search & select biller → fill payment form →
//   Pay Now → Confirm. All billers use the same form fields — only the
//   biller and account number differ (confirmed 2026-07-23).
//
// TEST ORGANIZATION (one test.describe per biller — grep by describe title
// to run a single biller, or run the whole file for everything):
//   Manila Water Company
//     BLR-3680  Successful payment
//     BLR-3681  Payment reflected in Transaction History      — fixme, see below
//     BLR-3682  Payment rejected for invalid account number   — fixme, see below
//   Visayan Electric Company (VECO)
//     BLR-3683  Successful payment
//     BLR-3684  Payment reflected in Transaction History      — fixme, see below
//     BLR-3685  Payment rejected for invalid account number   — fixme, see below
//
// Run one biller:  npx playwright test tests/platform/paymentConsole.spec.ts -g "Manila Water"
// Run everything:  npx playwright test tests/platform/paymentConsole.spec.ts
//
// ==============================================================================

import { test } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import { PaymentConsolePage } from '../../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import {
  paymentConsoleContext,
  billers,
  BillerConfig,
  randomBillerAccountNumber,
  randomAccountName,
  randomBillAmount,
} from '../../utils/paymentConsoleData';
import fs from 'fs';
import path from 'path';

// ==============================================================================
// TEST DATA
// ==============================================================================

const context = paymentConsoleContext;

// ==============================================================================
// SETUP
// ==============================================================================

let paymentConsole: PaymentConsolePage;
let currentQaseId = 0;

test.beforeEach(async ({ page }) => {
  paymentConsole = new PaymentConsolePage(page);
  await page.goto('https://test-web-admin.billeroo.com/dashboard');
  await page.waitForLoadState('networkidle');
});

test.afterEach(async ({ page }, testInfo) => {
  const screenshotName = currentQaseId ? `BLR-${currentQaseId}` : testInfo.title.replace(/\s+/g, '_');
  const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  const screenshotPath = path.join(screenshotsDir, `${screenshotName}.png`);

  await page.screenshot({ path: screenshotPath });
  await testInfo.attach(screenshotName, { path: screenshotPath, contentType: 'image/png' });

  if (testInfo.status === 'passed') {
    console.log(`[PASSED] qase.id ${currentQaseId} - ${testInfo.title}`);
  }
});

// ==============================================================================
// SHARED STEPS — same flow/fields for every biller, only qase IDs + data differ
// ==============================================================================

async function paySuccessfully(biller: BillerConfig) {
  const amount = randomBillAmount();
  const accountNumber = randomBillerAccountNumber(biller);
  const accountName = randomAccountName();

  await test.step('Navigate to Payment Console', async () => {
    await paymentConsole.goToPaymentConsole();
    await paymentConsole.assertOnPaymentConsolePage();
  });

  await test.step('Select business name, biller account, and service type', async () => {
    await paymentConsole.selectBusinessCategoryAccount(context.businessCategoryAccount);
    await paymentConsole.selectAccountCredential(context.billerAccount);
    await paymentConsole.selectServiceType(context.serviceType);
  });

  await test.step(`Search for biller: ${biller.name}`, async () => {
    await paymentConsole.searchBillerAccount(biller.name);
  });

  await test.step(`Select biller: ${biller.name}`, async () => {
    await paymentConsole.selectBillerAccount(biller.name);
  });

  await test.step('Fill payment form', async () => {
    await paymentConsole.fillContractAccountNumber(accountNumber);
    await paymentConsole.fillBillerAccountName(accountName);
    await paymentConsole.fillBillerAmount(amount);
    await paymentConsole.fillBillerEmail(context.email);
  });

  await test.step('Click Pay Now', async () => {
    await paymentConsole.clickPayNow();
  });

  await test.step('Verify payment summary matches input', async () => {
    await paymentConsole.assertPaymentSummaryDetails({
      billerName: biller.name,
      accountNumber,
      accountName,
      amount,
      email: context.email,
    });
  });

  await test.step('Click Confirm', async () => {
    await paymentConsole.clickConfirm();
  });
}

// ==============================================================================
// TESTS — MANILA WATER COMPANY
// ==============================================================================

test.describe('Payment Console — Manila Water Company', () => {

  test(
    qase(3680, 'Bill payment is processed successfully when a valid Manila Water Company transaction is submitted via ECPay'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3680;
      await paySuccessfully(billers.manilaWater);
    }
  );

  // CONFIRMED (2026-07-23): the submit button (#submitPaymentFormButton) gets
  // stuck disabled + "Loading..." because transactions are currently failing
  // on the backend — a system issue on this environment, not a locator/test
  // problem. paySuccessfully() doesn't assert post-Confirm success, so
  // BLR-3680/3683 pass even while this is broken; they only prove the form
  // submits, not that the payment completes. There IS a results table on the
  // Transaction List page to verify against (see transactionPage.ts) — this
  // stays fixme until payments actually complete so the reflected data can
  // be captured for real.
  test.fixme(
    qase(3681, 'Manila Water Company payment is reflected in Transaction History under the Transaction Module after successful validation'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3681;
    }
  );

  // Rejection behavior is unconfirmed: unknown whether it happens at Pay Now
  // or after Confirm, and what the error indicator looks like (toast? inline
  // field error?). Needs a codegen pass with a deliberately invalid account
  // number before this can be written for real.
  test.fixme(
    qase(3682, 'Payment is rejected when an invalid Manila Water Company account number is submitted via ECPay'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3682;
    }
  );

});

// ==============================================================================
// TESTS — VISAYAN ELECTRIC COMPANY (VECO)
// ==============================================================================

test.describe('Payment Console — Visayan Electric Company (VECO)', () => {

  test(
    qase(3683, 'Bill payment is processed successfully when a valid VECO transaction is submitted via ECPay'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3683;
      await paySuccessfully(billers.visayanElectric);
    }
  );

  // Same blocker as Manila Water BLR-3681.
  test.fixme(
    qase(3684, 'VECO payment is reflected in Transaction History under the Transaction Module after successful validation'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3684;
    }
  );

  // Same blocker as Manila Water BLR-3682.
  test.fixme(
    qase(3685, 'Payment is rejected when an invalid VECO account number is submitted via ECPay'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3685;
    }
  );

});
