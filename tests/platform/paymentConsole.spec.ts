// tests/platform/paymentConsole.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE TEST SUITE — ECPay
// ==============================================================================
//
// PROCESSOR SCOPE: Payment Console routes a payment through one of two
// processors depending on the biller — ECPay or Bayad. This file covers
// ECPay billers ONLY (every biller in utils/paymentConsoleData.ts's
// `billers` registry has `processor: 'ECPay'`). Bayad billers (Meralco,
// Maynilad Water — BLR-3671–3676) are a separate, currently-inactive suite:
// their page object (pages/PLATFORM(SUPERADMIN)/bayadPage.ts) exists but
// has no wired-up spec file (dropped 2026-07-23 as "superseded, not ready
// to run" — see memory/project_bayad_tests.md). Don't add a Bayad biller to
// this file's `billers` registry or describe blocks — it needs its own
// suite once bayadPage.ts's locators are confirmed live.
//
// FLOW:
//   Login → Dashboard → Payment Console → select business name, biller
//   account, service type → search & select biller → fill payment form →
//   Pay Now → Confirm. All ECPay billers use the same form fields — only
//   the biller and account number differ (confirmed 2026-07-23).
//
// TEST ORGANIZATION (one test.describe per biller — grep by describe title
// to run a single biller, or run the whole file for everything):
//   ECPay — Manila Water Company
//     BLR-3680  Successful payment
//     BLR-3681  Payment reflected in Transaction History
//     BLR-3682  Payment rejected for invalid account number
//     BLR-3683  Payment rejected as duplicate transaction (already paid)
//   ECPay — Visayan Electric Company (VECO) — all fixme, see below (form
//   fields aren't identical to Manila Water's after all — deferred)
//     BLR-3684  Successful payment
//     BLR-3685  Payment reflected in Transaction History
//     BLR-3686  Payment rejected for invalid account number
//
// Run one biller:  npx playwright test tests/platform/paymentConsole.spec.ts -g "Manila Water"
// Run all ECPay:   npx playwright test tests/platform/paymentConsole.spec.ts -g "ECPay"
// Run everything:  npx playwright test tests/platform/paymentConsole.spec.ts
//
// ==============================================================================

import { test } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import { PaymentConsolePage } from '../../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import { TransactionPage } from '../../pages/PLATFORM(SUPERADMIN)/transactionPage';
import {
  paymentConsoleContext,
  billers,
  BillerConfig,
  randomBillerAccountNumber,
  randomAccountName,
  randomBillAmount,
  invalidBillerAccountNumber,
  computeTotalAmount,
  SERVICE_FEE,
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
let transactionPage: TransactionPage;
let currentQaseId = 0;

test.beforeEach(async ({ page }) => {
  paymentConsole = new PaymentConsolePage(page);
  transactionPage = new TransactionPage(page);
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

// Shared by every scenario below — navigate to Payment Console, pick the
// business/credential/service type, then search and select the biller.
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

// accountNumber/accountName/amount can be pinned by the caller (e.g. to
// resubmit the exact same transaction for the duplicate-transaction
// scenario) — default to fresh random values otherwise, same as before.
async function paySuccessfully(
  biller: BillerConfig,
  overrides: { accountNumber?: string; accountName?: string; amount?: string } = {}
) {
  const amount = overrides.amount ?? randomBillAmount();
  const accountNumber = overrides.accountNumber ?? randomBillerAccountNumber(biller);
  const accountName = overrides.accountName ?? randomAccountName();

  await navigateAndSelectBiller(biller);

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
      addOnFee: biller.addOnFee.toFixed(2),
      serviceFee: SERVICE_FEE,
      totalAmount: computeTotalAmount(amount, biller),
    });
  });

  await test.step('Click Confirm', async () => {
    await paymentConsole.clickConfirm();
  });

  const merchantReference = await test.step('Verify payment receipt', async () => {
    await paymentConsole.assertPaymentReceipt(biller.name);
    return paymentConsole.getMerchantReferenceNumber();
  });

  return { merchantReference, amount };
}

// The account number field isn't validated until after Confirm — Pay Now and
// the summary modal both accept it same as a valid number (confirmed live
// 2026-08-05, BLR-3682). Only the outcome differs from paySuccessfully().
// Note: Confirm no longer redirects to a rejection page on failure — the
// modal stays open and shows the reason inline (confirmed live 2026-08-10).
async function payWithInvalidAccountNumber(biller: BillerConfig) {
  const amount = randomBillAmount();
  const accountName = randomAccountName();

  await navigateAndSelectBiller(biller);

  await test.step('Fill payment form with an invalid account number', async () => {
    await paymentConsole.fillContractAccountNumber(invalidBillerAccountNumber);
    await paymentConsole.fillBillerAccountName(accountName);
    await paymentConsole.fillBillerAmount(amount);
    await paymentConsole.fillBillerEmail(context.email);
  });

  await test.step('Click Pay Now', async () => {
    await paymentConsole.clickPayNow();
  });

  await test.step('Click Confirm', async () => {
    await paymentConsole.clickConfirm();
  });

  await test.step('Verify payment is rejected', async () => {
    await paymentConsole.assertPaymentRejected('Please enter a valid account number');
  });
}

// Resubmitting the exact same account number + amount as an already-processed
// transaction is rejected post-Confirm with "Transaction cannot be processed.
// System detects this to be a double transaction." (confirmed live
// 2026-08-05, BLR-3683 — same inline-modal-banner shape as BLR-3682's invalid
// account number, different reason text). Pin the account
// number/name/amount so both submissions are identical — the random helpers
// in paymentConsoleData.ts exist specifically to *avoid* this rejection on
// unrelated runs, so bypass them here on purpose.
async function payWithDuplicateTransaction(biller: BillerConfig) {
  const accountNumber = randomBillerAccountNumber(biller);
  const accountName = randomAccountName();
  const amount = randomBillAmount();

  await test.step('Submit the original transaction', async () => {
    await paySuccessfully(biller, { accountNumber, accountName, amount });
  });

  await navigateAndSelectBiller(biller);

  await test.step('Resubmit the identical transaction', async () => {
    await paymentConsole.fillContractAccountNumber(accountNumber);
    await paymentConsole.fillBillerAccountName(accountName);
    await paymentConsole.fillBillerAmount(amount);
    await paymentConsole.fillBillerEmail(context.email);
  });

  await test.step('Click Pay Now', async () => {
    await paymentConsole.clickPayNow();
  });

  await test.step('Click Confirm', async () => {
    await paymentConsole.clickConfirm();
  });

  await test.step('Verify duplicate transaction is rejected', async () => {
    await paymentConsole.assertPaymentRejected('Transaction cannot be processed. System detects this to be a double transaction.');
  });
}

// ==============================================================================
// TESTS — MANILA WATER COMPANY (ECPay)
// ==============================================================================

test.describe('Payment Console — ECPay — Manila Water Company', () => {

  test(
    qase(3680, 'Bill payment is processed successfully when a valid Manila Water Company transaction is submitted via ECPay'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3680;
      await paySuccessfully(billers.manilaWater);
    }
  );

  test(
    qase(3681, 'Manila Water Company payment is reflected in Transaction History under the Transaction Module after successful validation'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3681;

      const { merchantReference } = await paySuccessfully(billers.manilaWater);

      await test.step('Navigate to Transaction List', async () => {
        await transactionPage.goToTransactionList();
      });

      await test.step('Search by Merchant Reference Number', async () => {
        await transactionPage.searchByReference(merchantReference);
      });

      await test.step('Verify transaction reflects with correct details', async () => {
        await transactionPage.assertTransactionRow({
          billerName: billers.manilaWater.name,
          merchantReference,
        });
      });
    }
  );

  test(
    qase(3682, 'Payment is rejected when an invalid Manila Water Company account number is submitted via ECPay'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3682;
      await payWithInvalidAccountNumber(billers.manilaWater);
    }
  );

  test(
    qase(3683, 'Payment is rejected as a duplicate when the same Manila Water Company transaction is resubmitted via ECPay'),
    { tag: ['@regression'] },
    async ({}, testInfo) => {
      // Chains two full payment submissions (original + resubmit) — same
      // budget rationale as BLR-2722's bump (see project_fixes_merchant.md).
      testInfo.setTimeout(180_000);
      currentQaseId = 3683;
      await payWithDuplicateTransaction(billers.manilaWater);
    }
  );

});

// ==============================================================================
// TESTS — VISAYAN ELECTRIC COMPANY (VECO) (ECPay)
// ==============================================================================

test.describe('Payment Console — ECPay — Visayan Electric Company (VECO)', () => {

  // CONFIRMED (2026-07-23): VECO's form is NOT identical to Manila Water's,
  // despite earlier confirmation that all billers share the same fields —
  // the account field is labeled "11 Digit Account ID" (not "8 Digit
  // Contract Account Number"), so paySuccessfully()'s
  // fillContractAccountNumber() call (locator `[id="8_Digit_Contract_..."]`)
  // times out for VECO. paymentConsolePage.ts needs a biller-agnostic way to
  // fill that first field (e.g. by position within the form, not by its
  // label-derived id) before either VECO test can run for real. Deferred —
  // focusing on Manila Water for now.
  test.fixme(
    qase(3684, 'Bill payment is processed successfully when a valid VECO transaction is submitted via ECPay'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3684;
      await paySuccessfully(billers.visayanElectric);
    }
  );

  // Same blocker as BLR-3684 above.
  test.fixme(
    qase(3685, 'VECO payment is reflected in Transaction History under the Transaction Module after successful validation'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3685;

      const { merchantReference } = await paySuccessfully(billers.visayanElectric);

      await test.step('Navigate to Transaction List', async () => {
        await transactionPage.goToTransactionList();
      });

      await test.step('Search by Merchant Reference Number', async () => {
        await transactionPage.searchByReference(merchantReference);
      });

      await test.step('Verify transaction reflects with correct details', async () => {
        await transactionPage.assertTransactionRow({
          billerName: billers.visayanElectric.name,
          merchantReference,
        });
      });
    }
  );

  // Same blocker as Manila Water BLR-3682.
  test.fixme(
    qase(3686, 'Payment is rejected when an invalid VECO account number is submitted via ECPay'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3686;
    }
  );

});
