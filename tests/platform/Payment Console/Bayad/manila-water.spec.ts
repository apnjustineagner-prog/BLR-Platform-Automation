// tests/platform/Payment Console/Bayad/manila-water.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE — BAYAD — MANILA WATER — END TO END
// ==============================================================================
//
// One biller per file; the shared Bayad flow/setup lives in ./bayadHelpers.ts.
//
// IMPORTANT: this is the BAYAD "MANILA WATER" (Water Utility) biller — NOT the
// ECPay "MANILA WATER COMPANY" biller (that one has its own form with an
// Account Name field and lives in ../ECPay/manila-water-company.spec.ts as
// billers.manilaWater). This Bayad biller renders the plain generic Bayad form
// (Account Number + Amount + Email(Optional), no Account Name field), so it
// reuses the same helpers as Maynilad/Meralco.
//
// Stood up as the active Bayad pay-flow spec while MERALCO is hitting its
// monthly transaction limit on the biller side (see meralco.spec.ts, skipped
// 2026-09-09).
//
// Account number: 12358959 (addOnFee 10 — confirmed live 2026-09-10 via the
// Payment Summary and on-screen receipt).
//
// END-TO-END: a single test pays ONCE and verifies the same transaction across
// all four surfaces it touches, rather than paying separately per check:
//   1. Payment Summary   — values echo the input (inside payBayadSuccessfully)
//   2. Transaction Receipt — on-screen "Payment Successful!" receipt
//                            (inside payBayadSuccessfully)
//   3. Transaction History — the transaction reflects in the Transaction List
//   4. Email Receipt       — the receipt email lands in the payer's Gmail
// One payment feeds all four assertions, keyed by the same Merchant Reference.
//
// NOTE: no qase() IDs yet — the Meralco IDs (BLR-3671/3672/3673) belong to the
// Meralco cases in the BLR project and must not be reused here. File cases in
// Qase and add qase(<id>, ...) once available.
//
// Run: npx playwright test "tests/platform/Payment Console/Bayad/manila-water.spec.ts"
//
// ==============================================================================

import { test } from '@playwright/test';
import { bayadBillers } from '../../../../utils/paymentConsoleData';
import { fetchTransactionReceiptEmail } from '../../../../utils/fetchTransactionReceiptEmail';
import { attachScreenshot, attachEmailScreenshot } from '../../../../utils/attachScreenshot';
import {
  registerBayadHooks,
  bayadState,
  payBayadSuccessfully,
  computeTotalAmount,
  expect,
} from './bayadHelpers';

registerBayadHooks();

test.describe('Payment Console — Bayad — Manila Water — End to End', () => {

  // One payment, four checkpoints against that same transaction:
  //   Payment Summary + Transaction Receipt (both inside payBayadSuccessfully)
  //   → Transaction History → Email Receipt.
  test(
    'Manila Water payment is processed successfully via Bayad and verified across Payment Summary, Transaction Receipt, Transaction History, and Email Receipt',
    { tag: ['@smoke', '@regression'] },
    async ({ page }, testInfo) => {
      // Full pay flow + up to 2 min of IMAP polling for the receipt email —
      // well over the 120s default, so give it room.
      testInfo.setTimeout(240_000);
      // Screenshot filename prefix — keeps names short (e.g.
      // BLR-manila-water-payment-summary.png) instead of the long test title.
      // No Qase id here yet (Meralco's IDs must not be reused), so use a
      // biller-based prefix.
      const baseName = 'BLR-manila-water';

      // Record the cutoff BEFORE paying so we only accept an email that
      // arrives after this point (same discipline as the OTP/activation
      // fetchers).
      const beforePayment = new Date();

      // Pay once. payBayadSuccessfully asserts + screenshots checkpoints 1 & 2
      // (Payment Summary and the on-screen Transaction Receipt) when given
      // testInfo.
      const { merchantReference, amount, accountNumber } = await payBayadSuccessfully(bayadBillers.manilaWater, { testInfo, baseName, page });

      // Checkpoint 3 — Transaction History: the same transaction reflects in
      // the Transaction List (row presence + status), found by its Merchant
      // Reference No.
      await test.step('Verify transaction reflects in Transaction History', async () => {
        await bayadState.transactionPage.goToTransactionList();
        await bayadState.transactionPage.searchByReference(merchantReference);
        await bayadState.transactionPage.assertTransactionRow({
          billerName: bayadBillers.manilaWater.name,
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
          billerName: bayadBillers.manilaWater.name,
          processor: 'BAYAD',
          merchantReference,
          accountNumber,
          billAmount: amount,
          addOnFee: bayadBillers.manilaWater.addOnFee.toFixed(2),
          serviceFee: '0.00',
          totalAmount: computeTotalAmount(amount, bayadBillers.manilaWater),
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
        // (bill + add-on fee), not the raw bill amount (confirmed live 2026-09-16).
        expect(email.body, 'Email should name the biller and total paid').toContain(`PHP ${computeTotalAmount(amount, bayadBillers.manilaWater)} to ${bayadBillers.manilaWater.name}`);
        expect(email.body, 'Email should show the merchant reference').toContain(merchantReference);
        expect(email.body, 'Email should show the account number').toContain(accountNumber);
        expect(email.body, 'Email should show the total amount').toContain(computeTotalAmount(amount, bayadBillers.manilaWater));
      });
    }
  );

});
