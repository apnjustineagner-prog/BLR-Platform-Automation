// tests/platform/Payment Console/ECPay/ecpayHelpers.ts
//
// ==============================================================================
// PAYMENT CONSOLE — ECPay SHARED HELPERS
// ==============================================================================
//
// Shared setup + flow helpers for every ECPay biller spec in this folder
// (manila-water.spec.ts, visayan-electric.spec.ts). Each biller has its own
// spec file for organization; the common flow lives here so it isn't
// duplicated.
//
// FLOW: Login → Dashboard → Payment Console → select business name, biller
// account, service type → search & select biller → fill payment form → Pay
// Now → Confirm. All wired-up ECPay billers use the same Manila Water form
// fields (8 Digit Contract Account Number + Account Name + Amount + Email) —
// only the biller and account number differ. (VECO's form differs — see
// visayan-electric.spec.ts.)
//
// USAGE (in a biller spec):
//   import { registerEcpayHooks, ecpayState, setQaseId, paySuccessfully }
//     from './ecpayHelpers';
//   registerEcpayHooks();   // wires describe.configure + beforeEach/afterEach
//
// ==============================================================================

import { test, type TestInfo, type Page } from '@playwright/test';
import { PaymentConsolePage } from '../../../../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import { TransactionPage } from '../../../../pages/PLATFORM(SUPERADMIN)/transactionPage';
import {
  paymentConsoleContext,
  BillerConfig,
  randomBillerAccountNumber,
  randomAccountName,
  randomBillAmount,
  invalidBillerAccountNumber,
  computeTotalAmount,
  SERVICE_FEE,
} from '../../../../utils/paymentConsoleData';
import { accountForProject, type PaymentConsoleContext } from '../../../../utils/accounts';
import { attachScreenshot } from '../../../../utils/attachScreenshot';
import { logTransactionSummary } from '../../../../utils/logTransactionSummary';
import { applyZoom } from '../../../../utils/applyZoom';

// Page objects + the current qase id, shared across the flow helpers. Set in
// the beforeEach registered by registerEcpayHooks().
export const ecpayState: {
  paymentConsole: PaymentConsolePage;
  transactionPage: TransactionPage;
  currentQaseId: number;
  // In-app Payment Console context for the account this test runs under —
  // resolved per-test in beforeEach from the project name.
  context: PaymentConsoleContext;
} = {
  paymentConsole: undefined as unknown as PaymentConsolePage,
  transactionPage: undefined as unknown as TransactionPage,
  currentQaseId: 0,
  context: paymentConsoleContext,
};

export function setQaseId(id: number) {
  ecpayState.currentQaseId = id;
}

// Wires the shared retry config + per-test setup/teardown. Call once at the
// top of each biller spec (before the describe block).
export function registerEcpayHooks() {
  // Backend has been observed to hang after Confirm and never render the
  // receipt (see assertPaymentReceipt's comment in paymentConsolePage.ts) —
  // a real backend flake, not a test bug. Retries give these specs some
  // headroom to ride it out.
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }, testInfo) => {
    ecpayState.paymentConsole = new PaymentConsolePage(page);
    ecpayState.transactionPage = new TransactionPage(page);
    ecpayState.currentQaseId = 0;
    ecpayState.context = accountForProject(testInfo.project.name).paymentConsoleContext;
    await applyZoom(page, 0.5); // zoom out to 50% so wide tables/modals fit
    await page.goto('https://test-web-admin.billeroo.com/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }, testInfo) => {
    const baseName = ecpayState.currentQaseId
      ? `BLR-${ecpayState.currentQaseId}`
      : undefined;
    // Bundled under screenshots/<spec-slug>/ and attached to Playwright + Qase.
    await attachScreenshot(testInfo, { page, baseName, label: 'final-page' });

    if (testInfo.status === 'passed') {
      console.log(`[PASSED] qase.id ${ecpayState.currentQaseId} - ${testInfo.title}`);
    }
  });
}

// Shared by every scenario — navigate to Payment Console, pick the
// business/credential/service type, then search and select the biller.
export async function navigateAndSelectBiller(biller: BillerConfig) {
  const { paymentConsole } = ecpayState;

  await test.step('Navigate to Payment Console', async () => {
    await paymentConsole.goToPaymentConsole();
    await paymentConsole.assertOnPaymentConsolePage();
  });

  await test.step('Select business name, biller account, and service type', async () => {
    // Merchant/agent consoles have no Business Name selector (context omits it)
    // — skip that step for them; admin/super-admin selects it first.
    if (ecpayState.context.businessCategoryAccount) {
      await paymentConsole.selectBusinessCategoryAccount(ecpayState.context.businessCategoryAccount);
    }
    await paymentConsole.selectAccountCredential(ecpayState.context.billerAccount);
    await paymentConsole.selectServiceType(ecpayState.context.serviceType);
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
// scenario) — default to fresh random values otherwise.
//
// The biller side's duplicate-transaction check is keyed by account number
// and isn't scoped to a single test run, so even a pinned/random account
// number can occasionally come back rejected as a double transaction against
// something outside this run (see isDuplicateTransactionRejection's comment
// in paymentConsolePage.ts, confirmed live 2026-09-02, BLR-3681). When that
// happens here, retry with the next untried account number from the biller's
// own pool rather than failing — returns whichever account number actually
// succeeded so callers that need it (payWithDuplicateTransaction) don't
// resubmit a combo that was never actually paid.
export async function paySuccessfully(
  biller: BillerConfig,
  overrides: { accountNumber?: string; accountName?: string; amount?: string; testInfo?: TestInfo; baseName?: string; page?: Page } = {}
) {
  const { paymentConsole } = ecpayState;
  const amount = overrides.amount ?? randomBillAmount();
  const accountName = overrides.accountName ?? randomAccountName();
  const triedAccountNumbers = new Set<string>();
  let accountNumber = overrides.accountNumber ?? randomBillerAccountNumber(biller);
  const testInfo = overrides.testInfo;
  const baseName = overrides.baseName;
  const page = overrides.page;

  for (;;) {
    triedAccountNumbers.add(accountNumber);

    await navigateAndSelectBiller(biller);

    await test.step('Fill payment form', async () => {
      await paymentConsole.fillContractAccountNumber(accountNumber);
      await paymentConsole.fillBillerAccountName(accountName);
      await paymentConsole.fillBillerAmount(amount);
      await paymentConsole.fillBillerEmail(ecpayState.context.email);
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
        email: ecpayState.context.email,
        addOnFee: biller.addOnFee.toFixed(2),
        serviceFee: SERVICE_FEE,
        totalAmount: computeTotalAmount(amount, biller),
      });
      // Full-page shot of the Payment Summary (fee breakdown) while it's still
      // open — wait for the modal fade-in to settle so it isn't ghosted.
      if (testInfo && page) {
        await paymentConsole.waitForModalSettled();
        await attachScreenshot(testInfo, { page, fullPage: true, baseName, label: 'payment-summary' });
      }
    });

    await test.step('Click Confirm', async () => {
      await paymentConsole.clickConfirm();
    });

    // Post-Confirm, the app can (a) render the receipt, (b) reject inline as a
    // duplicate, or (c) redirect to the ER.00.05 error page when the account
    // number is flagged (confirmed live 2026-09-16). Both (b) and (c) mean
    // "this account won't work — try the next one"; (a) is success.
    const outcome = await paymentConsole.awaitPostConfirmOutcome();
    if (outcome === 'receipt') break;

    if (outcome === 'unknown') {
      // Neither success nor a known rejection appeared — the backend
      // post-Confirm hang. Let the test-level retry re-run the whole flow.
      throw new Error(
        `[ecpay] No receipt or rejection after Confirm for ${biller.name} (${accountNumber}) — backend hang.`,
      );
    }

    const nextAccountNumber = biller.accountNumbers.find((n) => !triedAccountNumbers.has(n));
    if (!nextAccountNumber) {
      throw new Error(
        `Every account number for ${biller.name} was rejected (${outcome}) — no fallback left to retry.`
      );
    }
    console.log(`[ecpay] ${accountNumber} rejected (${outcome}), retrying with ${nextAccountNumber}`);
    accountNumber = nextAccountNumber;
    // The next loop iteration calls navigateAndSelectBiller() →
    // goToPaymentConsole(), which navigates back to the console, so an
    // error-page redirect recovers on its own.
  }

  const merchantReference = await test.step('Verify payment receipt', async () => {
    await paymentConsole.assertPaymentReceipt({
      billerName: biller.name,
      // Assert the receipt echoes back the submitted Account Number, same as
      // the Payment Summary modal one step earlier and Bayad's receipt.
      // KNOWN DEFECT: ECPay receipts currently render this blank (confirmed
      // live 2026-09-01) — this is a real product bug, not test data, so we
      // assert the correct behavior on purpose and let the test fail to keep
      // the defect visible. Remove this note once the app renders it.
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
  logTransactionSummary(`ECPay — ${biller.name}`, {
    'Processor': 'ECPay',
    'Service Provider': biller.name,
    'Account Number': accountNumber,
    'Account Name': accountName,
    'Merchant Reference': merchantReference,
    'Email': ecpayState.context.email,
    'Bill Amount': `PHP ${amount}`,
    'Add-on Fee': `PHP ${biller.addOnFee.toFixed(2)}`,
    'Service Fee': `PHP ${SERVICE_FEE}`,
    'Total Amount': `PHP ${computeTotalAmount(amount, biller)}`,
    'Status': 'Payment Posted',
  });

  return { merchantReference, amount, accountNumber };
}

// The account number field isn't validated until after Confirm — Pay Now and
// the summary modal both accept it same as a valid number (confirmed live
// 2026-08-05, BLR-3682). Only the outcome differs from paySuccessfully().
// Note: Confirm no longer redirects to a rejection page on failure — the
// modal stays open and shows the reason inline (confirmed live 2026-08-10).
export async function payWithInvalidAccountNumber(biller: BillerConfig) {
  const { paymentConsole } = ecpayState;
  const amount = randomBillAmount();
  const accountName = randomAccountName();

  await navigateAndSelectBiller(biller);

  await test.step('Fill payment form with an invalid account number', async () => {
    await paymentConsole.fillContractAccountNumber(invalidBillerAccountNumber);
    await paymentConsole.fillBillerAccountName(accountName);
    await paymentConsole.fillBillerAmount(amount);
    await paymentConsole.fillBillerEmail(ecpayState.context.email);
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
// account number, different reason text). Pin the account number/name/amount
// so both submissions are identical — the random helpers in
// paymentConsoleData.ts exist specifically to *avoid* this rejection on
// unrelated runs, so bypass them here on purpose.
export async function payWithDuplicateTransaction(biller: BillerConfig, overrides: { accountNumber?: string } = {}) {
  const { paymentConsole } = ecpayState;
  const accountName = randomAccountName();
  const amount = randomBillAmount();

  // paySuccessfully can itself fall back to a different account number if the
  // requested one gets flagged as a duplicate against something outside this
  // run (see its comment) — resubmit whatever combo actually went through,
  // not necessarily overrides.accountNumber.
  const { accountNumber } = await test.step('Submit the original transaction', async () => {
    return paySuccessfully(biller, { accountNumber: overrides.accountNumber, accountName, amount });
  });

  await navigateAndSelectBiller(biller);

  await test.step('Resubmit the identical transaction', async () => {
    await paymentConsole.fillContractAccountNumber(accountNumber);
    await paymentConsole.fillBillerAccountName(accountName);
    await paymentConsole.fillBillerAmount(amount);
    await paymentConsole.fillBillerEmail(ecpayState.context.email);
  });

  await test.step('Click Pay Now', async () => {
    await paymentConsole.clickPayNow();
  });

  await test.step('Click Confirm', async () => {
    await paymentConsole.clickConfirm();
  });

  await test.step('Verify duplicate transaction is rejected', async () => {
    // The app shows one of two duplicate-rejection wordings (both confirmed
    // live) — match either via the shared "double transaction" phrasing.
    await paymentConsole.assertPaymentRejected(/double transaction/i);
  });
}

// Re-exported so biller specs can build assertions without importing from
// paymentConsoleData.ts directly.
export { computeTotalAmount, SERVICE_FEE, BillerConfig };
