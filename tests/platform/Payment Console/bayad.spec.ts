// tests/platform/Payment Console/bayad.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE TEST SUITE — BAYAD
// ==============================================================================
//
// PROCESSOR SCOPE: companion to the sibling ecpay.spec.ts in this folder,
// which is ECPay-only by design. This file covers Bayad billers
// (utils/paymentConsoleData.ts's `bayadBillers` registry) — kept separate
// per that file's header comment.
//
// Reuses PaymentConsolePage rather than the older, unfinished bayadPage.ts —
// confirmed live 2026-09-01 that Bayad billers render through the same
// Payment Console modal/receipt (#dynamicModalBody / #dynamicReceiptContent,
// identical ids to ECPay). Only the biller-specific payment form differs:
// Maynilad Water has a plain "Account Number" + "Amount" + "Email(Optional)",
// no separate "Account Name" field like Manila Water's form.
//
// Bayad enforces a Php20.00 minimum payment amount (confirmed live
// 2026-09-01: "The minimum amount for payments must be at least Php20.00")
// — higher than ECPay's floor, hence randomBayadBillAmount() instead of
// paymentConsoleData.ts's randomBillAmount().
//
// TEST CASES COVERED (see pages/PLATFORM(SUPERADMIN)/bayadPage.ts for the
// full original list):
//   MAYNILAD WATER
//     BLR-3674  Valid Maynilad Water payment is processed successfully via Bayad
//     BLR-3676  Invalid Maynilad Water account number is rejected
//     (no ticket) Duplicate transaction succeeds (no protection — by design)
//
// Invalid-account rejection (confirmed live 2026-09-01) follows the exact
// same pattern as ECPay's BLR-3682 — #myModal stays open, an inline red
// banner (#validationErrorBox) shows the reason — so it reuses
// assertPaymentRejected() unchanged. The reason text differs from ECPay's
// though: Bayad validates account number *format* up front ("The account
// number should start with '5', '6', or '7'."), not a backend "no such
// account" check.
//
// Duplicate transaction behaves differently from ECPay's BLR-3683 on
// purpose: confirmed by the dev team 2026-09-01 that Bayad has no
// duplicate-transaction validation — resubmitting the identical account +
// amount pair is a valid scenario and succeeds both times (independently
// verified live). The test locks in that behavior rather than asserting a
// rejection that doesn't happen.
//
// Not yet covered:
//   BLR-3675  Maynilad Water payment reflected in Transaction History — needs
//             its own live investigation
//   MERALCO (BLR-3671–3673) — not in bayadBillers yet, no confirmed test account
//
// Run: npx playwright test "tests/platform/Payment Console/bayad.spec.ts"
//
// ==============================================================================

import { test } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import { PaymentConsolePage } from '../../../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import {
  paymentConsoleContext,
  bayadBillers,
  BillerConfig,
  randomBayadBillAmount,
  randomBillerAccountNumber,
  invalidBillerAccountNumber,
  computeTotalAmount,
  SERVICE_FEE,
} from '../../../utils/paymentConsoleData';
import fs from 'fs';
import path from 'path';

const context = paymentConsoleContext;

// Backend has been observed to hang after Confirm and never render the
// receipt (see assertPaymentReceipt's comment in paymentConsolePage.ts,
// shared with ecpay.spec.ts) — a real backend flake, not a test bug. 5
// retries (above the global default of 3) gives this file more headroom
// to ride it out.
test.describe.configure({ retries: 5 });

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

async function navigateAndSelectBiller(biller: BillerConfig) {
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
}

// accountNumber/amount can be pinned by the caller (e.g. to resubmit the
// exact same transaction for the duplicate-transaction scenario) — default
// to fresh random values otherwise, same pattern as ecpay.spec.ts's
// paySuccessfully().
async function payBayadSuccessfully(
  biller: BillerConfig,
  overrides: { accountNumber?: string; amount?: string } = {}
) {
  const amount = overrides.amount ?? randomBayadBillAmount();
  const accountNumber = overrides.accountNumber ?? randomBillerAccountNumber(biller);

  await navigateAndSelectBiller(biller);

  await test.step('Fill payment form', async () => {
    await paymentConsole.fillGenericAccountNumber(accountNumber);
    await paymentConsole.fillGenericAmount(amount);
    await paymentConsole.fillGenericEmail(context.email);
  });

  await test.step('Click Pay Now', async () => {
    await paymentConsole.clickGenericPayNow();
  });

  await test.step('Verify payment summary matches input', async () => {
    await paymentConsole.assertPaymentSummaryDetails({
      billerName: biller.name,
      accountNumber,
      amount,
      email: context.email,
      addOnFee: biller.addOnFee.toFixed(2),
      serviceFee: SERVICE_FEE,
      totalAmount: computeTotalAmount(amount, biller),
    });
  });

  await test.step('Click Confirm', async () => {
    await paymentConsole.clickConfirm();
  });

  await test.step('Verify payment receipt', async () => {
    await paymentConsole.assertPaymentReceipt({
      billerName: biller.name,
      accountNumber,
      amount,
      addOnFee: biller.addOnFee.toFixed(2),
      serviceFee: SERVICE_FEE,
      totalAmount: computeTotalAmount(amount, biller),
    });
  });
}

// Bayad validates account number format up front — the modal stays open
// (never reaches the receipt) and shows the reason inline, same #myModal /
// #validationErrorBox mechanism as ECPay's rejection (confirmed live
// 2026-09-01), so assertPaymentRejected() is reused as-is.
async function payBayadWithInvalidAccountNumber(biller: BillerConfig, expectedReason: string) {
  const amount = randomBayadBillAmount();

  await navigateAndSelectBiller(biller);

  await test.step('Fill payment form with an invalid account number', async () => {
    await paymentConsole.fillGenericAccountNumber(invalidBillerAccountNumber);
    await paymentConsole.fillGenericAmount(amount);
    await paymentConsole.fillGenericEmail(context.email);
  });

  await test.step('Click Pay Now', async () => {
    await paymentConsole.clickGenericPayNow();
  });

  await test.step('Click Confirm', async () => {
    await paymentConsole.clickConfirm();
  });

  await test.step('Verify payment is rejected', async () => {
    await paymentConsole.assertPaymentRejected(expectedReason);
  });
}

// Unlike ECPay (BLR-3683, rejected as a double transaction), Bayad has no
// duplicate-transaction protection — confirmed by the dev team 2026-09-01,
// and independently verified live: resubmitting the identical account +
// amount pair succeeded as two separate payments both times. This is
// intentional/by-design for Bayad, not a gap, so this locks in that both
// submissions succeed rather than asserting a rejection that doesn't happen.
async function payBayadDuplicateTransaction(biller: BillerConfig) {
  const accountNumber = randomBillerAccountNumber(biller);
  const amount = randomBayadBillAmount();

  await test.step('Submit the original transaction', async () => {
    await payBayadSuccessfully(biller, { accountNumber, amount });
  });

  await test.step('Resubmit the identical transaction', async () => {
    await payBayadSuccessfully(biller, { accountNumber, amount });
  });
}

// ==============================================================================
// TESTS — MAYNILAD WATER (Bayad)
// ==============================================================================

test.describe('Payment Console — Bayad — Maynilad Water', () => {

  test(
    qase(3674, 'Valid Maynilad Water payment is processed successfully via Bayad'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3674;
      await payBayadSuccessfully(bayadBillers.mayniladWater);
    }
  );

  test(
    qase(3676, 'Payment is rejected when an invalid Maynilad Water account number is submitted via Bayad'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3676;
      await payBayadWithInvalidAccountNumber(
        bayadBillers.mayniladWater,
        "The account number should start with '5', '6', or '7'."
      );
    }
  );

  // No Qase ticket exists for this yet — Bayad's duplicate-transaction
  // behavior wasn't part of the original BLR-3671–3676 scope. Add a real
  // qase() id here once one's filed.
  test(
    'Resubmitting an identical Maynilad Water transaction succeeds twice — no duplicate-transaction protection on Bayad (by design, confirmed by dev)',
    { tag: ['@regression'] },
    async ({}, testInfo) => {
      // Chains two full payment submissions — same budget rationale as
      // ecpay.spec.ts's BLR-3683 duplicate-transaction test.
      testInfo.setTimeout(180_000);
      await payBayadDuplicateTransaction(bayadBillers.mayniladWater);
    }
  );

});
