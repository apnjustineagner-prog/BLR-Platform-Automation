// tests/platform/Payment Console/Bayad/maynilad-water.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE — BAYAD — MAYNILAD WATER — END TO END
// ==============================================================================
//
// One biller per file; the shared Bayad flow/setup lives in ./bayadHelpers.ts.
//
// TEST CASES COVERED:
//   BLR-3674 + BLR-3675  End-to-end happy path — one payment verified across
//             Payment Summary, Transaction Receipt, Transaction History, and
//             Email Receipt (merged into one test, same shape as Bayad Manila
//             Water). Transaction History (3675) and the Email Receipt step are
//             NEWLY added here and pending live confirmation for Maynilad — if
//             either fails, that's the surface to investigate, not a
//             pre-existing regression.
//   BLR-3676  Invalid Maynilad Water account number is rejected
//   (no ticket) Duplicate transaction succeeds (no protection — by design)
//
// Invalid-account rejection: Bayad validates the account number *format* up
// front ("The account number should start with '5', '6', or '7'."), not a
// backend "no such account" check.
//
// Duplicate transaction: Bayad has no duplicate-transaction validation
// (confirmed by dev 2026-09-01) — resubmitting the identical account + amount
// pair succeeds both times. The test locks in that behavior.
//
// Run: npx playwright test "tests/platform/Payment Console/Bayad/maynilad-water.spec.ts"
//
// ==============================================================================

import { test } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import { bayadBillers } from '../../../../utils/paymentConsoleData';
import { fetchTransactionReceiptEmail } from '../../../../utils/fetchTransactionReceiptEmail';
import { attachScreenshot, attachEmailScreenshot } from '../../../../utils/attachScreenshot';
import {
  registerBayadHooks,
  setQaseId,
  bayadState,
  payBayadSuccessfully,
  payBayadWithInvalidAccountNumber,
  payBayadDuplicateTransaction,
  computeTotalAmount,
  expect,
} from './bayadHelpers';

registerBayadHooks();

test.describe('Payment Console — Bayad — Maynilad Water — End to End', () => {
  
  // One payment, four checkpoints against that same transaction:
  //   Payment Summary + Transaction Receipt (both inside payBayadSuccessfully)
  //   → Transaction History → Email Receipt. Reports to both Qase cases via
  //   qase([3674, 3675]).
  test(
    qase([3674, 3675], 'Maynilad Water payment is processed successfully via Bayad and verified across Payment Summary, Transaction Receipt, Transaction History, and Email Receipt'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }, testInfo) => {
      // Full pay flow + up to 2 min of IMAP polling for the receipt email —
      // well over the 120s default, so give it room.
      testInfo.setTimeout(240_000);
      setQaseId(3674);
      // Screenshot filename prefix — keeps names short (e.g.
      // BLR-3674-payment-summary.png) instead of the long test title.
      const baseName = 'BLR-3674';

      // Record the cutoff BEFORE paying so we only accept an email that
      // arrives after this point (same discipline as the OTP/activation
      // fetchers).
      const beforePayment = new Date();

      // Pay once. payBayadSuccessfully asserts + screenshots checkpoints 1 & 2
      // (Payment Summary and the on-screen Transaction Receipt) when given
      // testInfo.
      const { merchantReference, amount, accountNumber } = await payBayadSuccessfully(bayadBillers.mayniladWater, { testInfo, baseName, page });

      // Checkpoint 3 — Transaction History: the same transaction reflects in
      // the Transaction List (row presence + status), found by its Merchant
      // Reference No.
      await test.step('Verify transaction reflects in Transaction History', async () => {
        await bayadState.transactionPage.goToTransactionList();
        await bayadState.transactionPage.searchByReference(merchantReference);
        await bayadState.transactionPage.assertTransactionRow({
          billerName: bayadBillers.mayniladWater.name,
          merchantReference,
        });
        // Full-page screenshot of the whole Transaction List screen (at 50%
        // zoom the wide table + fee columns fit in frame).
        await attachScreenshot(testInfo, {
          page,
          fullPage: true,
          baseName,
          label: 'transaction-history',
        });
      });

      // Checkpoint 3b — View Transaction modal: open the row's detail modal
      // (eye icon) and verify the fee breakdown reflects correctly (Bill
      // Amount / Add-on Fee / Service Fee / Total), plus key references.
      await test.step('Verify fee breakdown in the View Transaction modal', async () => {
        await bayadState.transactionPage.viewTransaction(merchantReference);
        await bayadState.transactionPage.assertTransactionDetails({
          billerName: bayadBillers.mayniladWater.name,
          processor: 'BAYAD',
          merchantReference,
          accountNumber,
          billAmount: amount,
          addOnFee: bayadBillers.mayniladWater.addOnFee.toFixed(2),
          serviceFee: '0.00',
          totalAmount: computeTotalAmount(amount, bayadBillers.mayniladWater),
          statusDescription: 'Payment Posted',
        });
        // Element screenshot of the modal's scrollable body — captures the
        // whole modal top-to-bottom (fee breakdown + Transaction Details),
        // even the parts below the fold.
        await attachScreenshot(testInfo, {
          locator: bayadState.transactionPage.viewModalLocator(),
          baseName,
          label: 'transaction-view-modal',
        });
        await bayadState.transactionPage.closeViewTransaction();
      });

      // Checkpoint 4 — Email Receipt: the "Transaction Successful!" receipt
      // email lands in the payer's Gmail and echoes the payment details.
      // Matched by the unique Merchant Reference No. so it can't pick up a
      // stale receipt (see fetchTransactionReceiptEmail.ts).
      const email = await test.step('Fetch the receipt email', async () => {
        return fetchTransactionReceiptEmail(beforePayment, merchantReference);
      });

      // Render + screenshot the email so the report has a visual of the
      // receipt email, bundled alongside the test's other screenshots.
      await attachEmailScreenshot(testInfo, page, email, { baseName, label: 'email-receipt' });

      await test.step('Verify the receipt email details', async () => {
        expect(email.toAddress, 'Receipt should be sent to the payer email').toContain(bayadState.context.email);
        expect(email.body, 'Email should confirm a successful transaction').toContain('Transaction Successful');
        // The "payment of PHP X to <biller>" line uses the TOTAL amount
        // (bill + add-on fee), not the raw bill amount — confirmed live
        // 2026-09-16 (bill 25.00 + fee 10.00 → email says "PHP 35.00").
        expect(email.body, 'Email should name the biller and total paid').toContain(`PHP ${computeTotalAmount(amount, bayadBillers.mayniladWater)} to ${bayadBillers.mayniladWater.name}`);
        expect(email.body, 'Email should show the merchant reference').toContain(merchantReference);
        expect(email.body, 'Email should show the account number').toContain(accountNumber);
        expect(email.body, 'Email should show the total amount').toContain(computeTotalAmount(amount, bayadBillers.mayniladWater));
      });
    }
  );

  test(
    qase(3676, 'Payment is rejected when an invalid Maynilad Water account number is submitted via Bayad'),
    { tag: ['@regression'] },
    async () => {
      setQaseId(3676);
      await payBayadWithInvalidAccountNumber(
        bayadBillers.mayniladWater,
        "The account number should start with '5', '6', or '7'."
      );
    }
  );

  // SKIPPED (2026-09-10): the identical-transaction (duplicate) flow is
  // disabled for Maynilad — Bayad has no duplicate-transaction protection, so
  // resubmitting the same account + amount just goes through a second time.
  // Re-enable if/when duplicate handling is added or a Qase case is filed.
  test.skip(
    'Resubmitting an identical Maynilad Water transaction succeeds twice — no duplicate-transaction protection on Bayad (by design, confirmed by dev)',
    { tag: ['@regression'] },
    async ({}, testInfo) => {
      // Chains two full payment submissions — needs more than the default
      // per-test budget.
      testInfo.setTimeout(180_000);
      await payBayadDuplicateTransaction(bayadBillers.mayniladWater);
    }
  );

});
