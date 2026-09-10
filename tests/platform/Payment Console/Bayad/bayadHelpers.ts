// tests/platform/Payment Console/Bayad/bayadHelpers.ts
//
// ==============================================================================
// PAYMENT CONSOLE — BAYAD SHARED HELPERS
// ==============================================================================
//
// Shared setup + flow helpers for every Bayad biller spec in this folder
// (maynilad-water.spec.ts, meralco.spec.ts). Each biller has its own spec
// file for organization; the common flow lives here so it isn't duplicated.
//
// Bayad billers reuse PaymentConsolePage (confirmed live 2026-09-01 that they
// render through the same Payment Console modal/receipt as ECPay —
// #dynamicModalBody / #dynamicReceiptContent). Only the biller-specific
// payment form differs; every Bayad biller so far uses the generic form
// (Account Number + Amount + Email(Optional), no Account Name field).
//
// Bayad enforces a Php20.00 minimum payment amount (confirmed live
// 2026-09-01) — higher than ECPay's floor, hence randomBayadBillAmount().
//
// USAGE (in a biller spec):
//   import { registerBayadHooks, bayadState, setQaseId, payBayadSuccessfully }
//     from './bayadHelpers';
//   registerBayadHooks();   // wires describe.configure + beforeEach/afterEach
//
// ==============================================================================

import { test, expect, type TestInfo, type Page } from '@playwright/test';
import { PaymentConsolePage } from '../../../../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import { TransactionPage } from '../../../../pages/PLATFORM(SUPERADMIN)/transactionPage';
import {
  paymentConsoleContext,
  BillerConfig,
  randomBayadBillAmount,
  randomBillerAccountNumber,
  invalidBillerAccountNumber,
  computeTotalAmount,
  SERVICE_FEE,
} from '../../../../utils/paymentConsoleData';
import { attachScreenshot } from '../../../../utils/attachScreenshot';
import { logTransactionSummary } from '../../../../utils/logTransactionSummary';
import { applyZoom } from '../../../../utils/applyZoom';

export const context = paymentConsoleContext;

// Page objects + the current qase id, shared across the flow helpers. Set in
// the beforeEach registered by registerBayadHooks(). Wrapped in an object so
// biller specs can mutate currentQaseId (setQaseId) without import binding
// issues.
export const bayadState: {
  paymentConsole: PaymentConsolePage;
  transactionPage: TransactionPage;
  currentQaseId: number;
} = {
  paymentConsole: undefined as unknown as PaymentConsolePage,
  transactionPage: undefined as unknown as TransactionPage,
  currentQaseId: 0,
};

export function setQaseId(id: number) {
  bayadState.currentQaseId = id;
}

// Wires the shared retry config + per-test setup/teardown. Call once at the
// top of each biller spec (before the describe block).
export function registerBayadHooks() {
  // Backend has been observed to hang after Confirm and never render the
  // receipt (see assertPaymentReceipt's comment in paymentConsolePage.ts) —
  // a real backend flake, not a test bug. Retries give these specs some
  // headroom to ride it out.
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }) => {
    bayadState.paymentConsole = new PaymentConsolePage(page);
    bayadState.transactionPage = new TransactionPage(page);
    bayadState.currentQaseId = 0;
    await applyZoom(page, 0.5); // zoom out to 50% so wide tables/modals fit
    await page.goto('https://test-web-admin.billeroo.com/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }, testInfo) => {
    const baseName = bayadState.currentQaseId
      ? `BLR-${bayadState.currentQaseId}`
      : undefined;
    // Bundled under screenshots/<spec-slug>/ and attached to Playwright + Qase.
    await attachScreenshot(testInfo, { page, baseName, label: 'final-page' });

    if (testInfo.status === 'passed') {
      console.log(`[PASSED] qase.id ${bayadState.currentQaseId} - ${testInfo.title}`);
    }
  });
}

export async function navigateAndSelectBiller(biller: BillerConfig) {
  const { paymentConsole } = bayadState;

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
// to fresh random values otherwise.
export async function payBayadSuccessfully(
  biller: BillerConfig,
  overrides: { accountNumber?: string; amount?: string; testInfo?: TestInfo; baseName?: string; page?: Page } = {}
) {
  const { paymentConsole } = bayadState;
  const amount = overrides.amount ?? randomBayadBillAmount();
  const accountNumber = overrides.accountNumber ?? randomBillerAccountNumber(biller);
  const testInfo = overrides.testInfo;
  const baseName = overrides.baseName;
  const page = overrides.page;

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
    // Full-page shot of the Payment Summary (fee breakdown) while it's still
    // open — before Confirm dismisses it. Wait for the modal fade-in to settle
    // first so the capture isn't ghosted/blurry mid-transition.
    if (testInfo && page) {
      await paymentConsole.waitForModalSettled();
      await attachScreenshot(testInfo, { page, fullPage: true, baseName, label: 'payment-summary' });
    }
  });

  await test.step('Click Confirm', async () => {
    await paymentConsole.clickConfirm();
  });

  const merchantReference = await test.step('Verify payment receipt', async () => {
    await paymentConsole.assertPaymentReceipt({
      billerName: biller.name,
      // Asserted against the SUBMITTED account number on purpose. The receipt
      // (and the emailed receipt) currently zero-pad it to 10 digits (e.g.
      // Manila Water 12358959 → 0012358959, confirmed live 2026-09-10) while
      // the Payment Summary modal echoes it raw — so the account number is NOT
      // consistent across summary / receipt / email. That inconsistency is a
      // real product defect; we assert the correct (unchanged) value so the
      // test fails and keeps the defect visible. Remove this note once the app
      // renders the submitted account number consistently everywhere.
      accountNumber,
      amount,
      addOnFee: biller.addOnFee.toFixed(2),
      serviceFee: SERVICE_FEE,
      totalAmount: computeTotalAmount(amount, biller),
    });
    // Full-page shot of the on-screen Transaction Receipt (fee breakdown).
    if (testInfo && page) {
      await attachScreenshot(testInfo, { page, fullPage: true, baseName, label: 'transaction-receipt' });
    }
    return paymentConsole.getMerchantReferenceNumber();
  });

  // Clean, human-readable summary of what was paid — printed to the run log.
  logTransactionSummary(`Bayad — ${biller.name}`, {
    'Processor': 'BAYAD',
    'Service Provider': biller.name,
    'Account Number': accountNumber,
    'Merchant Reference': merchantReference,
    'Email': context.email,
    'Bill Amount': `PHP ${amount}`,
    'Add-on Fee': `PHP ${biller.addOnFee.toFixed(2)}`,
    'Service Fee': `PHP ${SERVICE_FEE}`,
    'Total Amount': `PHP ${computeTotalAmount(amount, biller)}`,
    'Status': 'Payment Posted',
  });

  return { merchantReference, amount, accountNumber };
}

// Bayad validates the account number up front — the modal stays open (never
// reaches the receipt) and shows the reason inline, same #myModal /
// #validationErrorBox mechanism as ECPay's rejection (confirmed live
// 2026-09-01), so assertPaymentRejected() is reused as-is. The reason text
// varies per biller (Maynilad: format "start with 5/6/7"; Meralco: length
// "must be 10 digits"), so the caller passes the expected text.
export async function payBayadWithInvalidAccountNumber(biller: BillerConfig, expectedReason: string) {
  const { paymentConsole } = bayadState;
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
export async function payBayadDuplicateTransaction(biller: BillerConfig) {
  const accountNumber = randomBillerAccountNumber(biller);
  const amount = randomBayadBillAmount();

  await test.step('Submit the original transaction', async () => {
    await payBayadSuccessfully(biller, { accountNumber, amount });
  });

  await test.step('Resubmit the identical transaction', async () => {
    await payBayadSuccessfully(biller, { accountNumber, amount });
  });
}

// Re-exported so biller specs can build assertions without importing from
// paymentConsoleData.ts directly.
export { computeTotalAmount, SERVICE_FEE, BillerConfig, expect };
