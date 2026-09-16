// tests/platform/Payment Console/ECPay/visayan-electric.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE — ECPay — VISAYAN ELECTRIC COMPANY (VECO)
// ==============================================================================
//
// One biller per file; the shared ECPay flow/setup lives in ./ecpayHelpers.ts.
//
// ENABLED 2026-09-10. VECO's form is the same as Manila Water Company's except
// the first field is labeled "11 Digit Account ID" (id "11_Digit_Account_ID")
// instead of "8 Digit Contract Account Number" — the rest (Account Name /
// Amount / Email) is identical. paymentConsolePage.ts's contractAccountNumber
// locator now matches either id, so the shared paySuccessfully() flow works for
// VECO unchanged. Live payment confirmed working with account 99999200001
// (add-on fee 9.00, receipt "Payment Posted").
//
// TEST CASES:
//   BLR-3684  Successful payment                          (enabled)
//   BLR-3685  Payment reflected in Transaction History    (enabled)
//   BLR-3686  Payment rejected for invalid account number (still fixme — the
//             rejection message for VECO's "11 Digit Account ID" field hasn't
//             been confirmed live yet; wire it up once the exact text is known)
//
// Run: npx playwright test "tests/platform/Payment Console/ECPay/visayan-electric.spec.ts"
//
// ==============================================================================

import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import { billers } from '../../../../utils/paymentConsoleData';
import { fetchTransactionReceiptEmail } from '../../../../utils/fetchTransactionReceiptEmail';
import { attachScreenshot, attachEmailScreenshot } from '../../../../utils/attachScreenshot';
import {
  registerEcpayHooks,
  setQaseId,
  ecpayState,
  paySuccessfully,
  computeTotalAmount,
} from './ecpayHelpers';

registerEcpayHooks();

test.describe('Payment Console — ECPay — Visayan Electric Company (VECO)', () => {

  // BLR-3684 (successful payment) and BLR-3685 (reflected in Transaction
  // History) are merged into one test so a SINGLE ECPay transaction covers
  // both — the history check reuses the transaction created here instead of
  // paying again (ECPay deducts real wallet balance, so avoid a second live
  // payment). Reports to both Qase cases via qase([3684, 3685]).
  // BLR-3684 (successful payment) and BLR-3685 (reflected in Transaction
  // History) merged into one end-to-end test. Verifies + screenshots five
  // surfaces against a single transaction: Payment Summary, Transaction
  // Receipt, Transaction History, View Transaction modal, and Email Receipt.
  test(
    qase([3684, 3685], 'Valid VECO payment is processed successfully via ECPay and verified across Payment Summary, Transaction Receipt, Transaction History, View Modal, and Email Receipt'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }, testInfo) => {
      testInfo.setTimeout(240_000);
      setQaseId(3684);
      const baseName = 'BLR-3684';

      const beforePayment = new Date();

      // Pay once. paySuccessfully asserts + screenshots Payment Summary and the
      // on-screen Transaction Receipt when given testInfo/page.
      const { merchantReference, amount, accountNumber } = await paySuccessfully(billers.visayanElectric, {
        testInfo,
        baseName,
        page,
      });

      // Checkpoint 3 — Transaction History.
      await test.step('Verify transaction reflects in Transaction History', async () => {
        await ecpayState.transactionPage.goToTransactionList();
        await ecpayState.transactionPage.searchByReference(merchantReference);
        await ecpayState.transactionPage.assertTransactionRow({
          billerName: billers.visayanElectric.name,
          merchantReference,
        });
        await attachScreenshot(testInfo, { page, fullPage: true, baseName, label: 'transaction-history' });
      });

      // Checkpoint 3b — View Transaction modal + fee breakdown.
      await test.step('Verify fee breakdown in the View Transaction modal', async () => {
        await ecpayState.transactionPage.viewTransaction(merchantReference);
        await ecpayState.transactionPage.assertTransactionDetails({
          billerName: billers.visayanElectric.name,
          processor: 'ECPAY',
          merchantReference,
          billAmount: amount,
          addOnFee: billers.visayanElectric.addOnFee.toFixed(2),
          serviceFee: '0.00',
          totalAmount: computeTotalAmount(amount, billers.visayanElectric),
          statusDescription: 'Payment Posted',
        });
        await attachScreenshot(testInfo, {
          locator: ecpayState.transactionPage.viewModalLocator(),
          baseName,
          label: 'transaction-view-modal',
        });
        await ecpayState.transactionPage.closeViewTransaction();
      });

      // Checkpoint 4 — Email Receipt.
      const email = await test.step('Fetch the receipt email', async () => {
        return fetchTransactionReceiptEmail(beforePayment, merchantReference);
      });
      await attachEmailScreenshot(testInfo, page, email, { baseName, label: 'email-receipt' });
      await test.step('Verify the receipt email details', async () => {
        expect(email.toAddress, 'Receipt should be sent to the payer email').toContain(ecpayState.context.email);
        expect(email.body, 'Email should confirm a successful transaction').toContain('Transaction Successful');
        expect(email.body, 'Email should show the merchant reference').toContain(merchantReference);
      });
    }
  );

  // Still fixme: VECO's invalid-account rejection message hasn't been confirmed
  // live for the "11 Digit Account ID" field (may differ from Manila Water's
  // "Please enter a valid account number"). Wire up payWithInvalidAccountNumber
  // once the exact text is known.
  test.fixme(
    qase(3686, 'Payment is rejected when an invalid VECO account number is submitted via ECPay'),
    { tag: ['@regression'] },
    async () => {
      setQaseId(3686);
    }
  );

});
