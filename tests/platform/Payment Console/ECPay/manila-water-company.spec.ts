// tests/platform/Payment Console/ECPay/manila-water-company.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE — ECPay — MANILA WATER COMPANY
// ==============================================================================
//
// One biller per file; the shared ECPay flow/setup lives in ./ecpayHelpers.ts.
//
// TEST CASES COVERED:
//   BLR-3680  Successful payment
//   BLR-3681  Payment reflected in Transaction History
//   BLR-3682  Payment rejected for invalid account number
//   BLR-3683  Payment rejected as duplicate transaction (already paid)
//
// Run: npx playwright test "tests/platform/Payment Console/ECPay/manila-water-company.spec.ts"
//
// ==============================================================================

import { test } from '@playwright/test';
import { expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import { billers } from '../../../../utils/paymentConsoleData';
import { fetchTransactionReceiptEmail } from '../../../../utils/fetchTransactionReceiptEmail';
import { attachScreenshot, attachEmailScreenshot } from '../../../../utils/attachScreenshot';
import {
  registerEcpayHooks,
  setQaseId,
  ecpayState,
  context,
  paySuccessfully,
  payWithInvalidAccountNumber,
  payWithDuplicateTransaction,
  computeTotalAmount,
} from './ecpayHelpers';

registerEcpayHooks();

// ==============================================================================
// MANILA WATER COMPANY (ECPay)
// ==============================================================================

// 3 of these 4 tests draw a real account number from Manila Water's pool
// (paymentConsoleData.ts) to make an actual payment, and the backend rejects
// a repeated account number as a duplicate transaction regardless of amount
// (see BLR-3683 below, and isDuplicateTransactionRejection's comment in
// paymentConsolePage.ts — confirmed manually 2026-09-02: reusing an account
// number with a different amount still gets rejected). Each test is pinned to
// its own account number index, but under fullyParallel that only stops these
// 4 tests colliding *with each other* — it doesn't stop this block running
// interleaved with unrelated runs/workers touching the same pool. Forced to
// declaration order (3680 → 3681 → 3682 → 3683) with test.describe.serial()
// so the plain successful-payment case always runs first (confirmed live
// 2026-09-02: out-of-order execution was implicated in spurious failures).
// Tried this before and reverted once (2026-09-01) — a flaky backend hang
// (see assertPaymentReceipt's comment in paymentConsolePage.ts) exhausted
// retries on one test and skipped the rest of the serial group — so if all 4
// start showing failed/skipped together, that cascade is why; check the first
// failure in the group, not the later ones.
test.describe.serial('Payment Console — ECPay — Manila Water Company', () => {

  // BLR-3680 (successful payment) and BLR-3681 (reflected in Transaction
  // History) are merged into one test so a SINGLE ECPay transaction covers
  // both — the history check reuses the transaction created here instead of
  // paying again (ECPay deducts real wallet balance, so avoid a second live
  // payment). Reports to both Qase cases via qase([3680, 3681]).
  // BLR-3680 (successful payment) and BLR-3681 (reflected in Transaction
  // History) merged into one end-to-end test so a SINGLE ECPay transaction
  // covers both. Verifies + screenshots five surfaces against that one
  // transaction: Payment Summary, Transaction Receipt, Transaction History,
  // View Transaction modal, and the Email Receipt.
  test(
    qase([3680, 3681], 'Valid Manila Water Company payment is processed successfully via ECPay and verified across Payment Summary, Transaction Receipt, Transaction History, View Modal, and Email Receipt'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }, testInfo) => {
      // Full pay flow + up to 2 min of IMAP polling for the receipt email.
      testInfo.setTimeout(240_000);
      setQaseId(3680);
      const baseName = 'BLR-3680';

      // Cutoff BEFORE paying so we only accept an email that arrives after.
      const beforePayment = new Date();

      // Pay once. paySuccessfully asserts + screenshots checkpoints 1 & 2
      // (Payment Summary and the on-screen Transaction Receipt) when given
      // testInfo/page.
      const { merchantReference, amount, accountNumber } = await paySuccessfully(billers.manilaWater, {
        accountNumber: billers.manilaWater.accountNumbers[0],
        testInfo,
        baseName,
        page,
      });

      // Checkpoint 3 — Transaction History: the same transaction reflects in
      // the Transaction List (row presence + status).
      await test.step('Verify transaction reflects in Transaction History', async () => {
        await ecpayState.transactionPage.goToTransactionList();
        await ecpayState.transactionPage.searchByReference(merchantReference);
        await ecpayState.transactionPage.assertTransactionRow({
          billerName: billers.manilaWater.name,
          merchantReference,
        });
        await attachScreenshot(testInfo, { page, fullPage: true, baseName, label: 'transaction-history' });
      });

      // Checkpoint 3b — View Transaction modal: open the row's detail modal
      // (eye icon) and verify the fee breakdown, then screenshot it.
      await test.step('Verify fee breakdown in the View Transaction modal', async () => {
        await ecpayState.transactionPage.viewTransaction(merchantReference);
        await ecpayState.transactionPage.assertTransactionDetails({
          billerName: billers.manilaWater.name,
          processor: 'ECPAY',
          merchantReference,
          billAmount: amount,
          addOnFee: billers.manilaWater.addOnFee.toFixed(2),
          serviceFee: '0.00',
          totalAmount: computeTotalAmount(amount, billers.manilaWater),
          statusDescription: 'Payment Posted',
        });
        await attachScreenshot(testInfo, {
          locator: ecpayState.transactionPage.viewModalLocator(),
          baseName,
          label: 'transaction-view-modal',
        });
        await ecpayState.transactionPage.closeViewTransaction();
      });

      // Checkpoint 4 — Email Receipt: the receipt email lands in the payer's
      // Gmail and echoes the payment details; render + screenshot it.
      const email = await test.step('Fetch the receipt email', async () => {
        return fetchTransactionReceiptEmail(beforePayment, merchantReference);
      });
      await attachEmailScreenshot(testInfo, page, email, { baseName, label: 'email-receipt' });
      await test.step('Verify the receipt email details', async () => {
        expect(email.toAddress, 'Receipt should be sent to the payer email').toContain(context.email);
        expect(email.body, 'Email should confirm a successful transaction').toContain('Transaction Successful');
        expect(email.body, 'Email should show the merchant reference').toContain(merchantReference);
      });
    }
  );

  test(
    qase(3682, 'Payment is rejected when an invalid Manila Water Company account number is submitted via ECPay'),
    { tag: ['@regression'] },
    async () => {
      setQaseId(3682);
      await payWithInvalidAccountNumber(billers.manilaWater);
    }
  );

  test(
    qase(3683, 'Payment is rejected as a duplicate when the same Manila Water Company transaction is resubmitted via ECPay'),
    { tag: ['@regression'] },
    async ({}, testInfo) => {
      // Chains two full payment submissions (original + resubmit) — needs
      // more than the default per-test budget.
      testInfo.setTimeout(180_000);
      setQaseId(3683);
      await payWithDuplicateTransaction(billers.manilaWater, { accountNumber: billers.manilaWater.accountNumbers[2] });
    }
  );

});
