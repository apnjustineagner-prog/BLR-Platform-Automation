// tests/platform/Payment Console/SSS/individual.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE — SSS (Individual) — HAPPY PATH + NEGATIVE
// ==============================================================================
//
// TESTS:
//   Happy path  Generate PRN and Pay e2e
//   Negative    Already paid, Cancelled, Invalid spacing, Invalid characters,
//               No data found, Non-individual PRN, Malformed email,
//               Blank PRN + Country Code
//
// SSS is a third processor alongside ECPay and Bayad. "SSS - Individual" is
// reached through the same selection flow (business name -> biller account ->
// service type -> search -> select), but its payment form differs: a PRN field
// (not an account number), a Country Code, and a "Generate PRN" modal.
//
// FLOW (Generate PRN path):
//   Select biller -> Generate PRN (OFW member details; scan Applicable Months
//   until one is unpaid) -> PRN auto-fills -> Country Code (PH) + Email ->
//   Pay Now -> Payment Summary -> Confirm -> Transaction Receipt ->
//   Transaction History + View modal -> Email receipt.
//
// FEES: Add-on Fee and Service Fee are both 0.00 for SSS (expected), so Total
// Amount == Bill Amount. The receipt renders Account Number blank (expected).
//
// WALLET: SSS payments do NOT deduct the ECPay wallet, so this runs in regular
// regression (unlike the wallet-constrained ECPay/Bayad specs).
//
// Run: npx playwright test "tests/platform/Payment Console/SSS/individual.spec.ts"
//
// ==============================================================================

import { test, expect } from '@playwright/test';
import {
  sssBillers,
  sssIndividualGeneratePrn,
  sssIndividualNegativePrns as prns,
} from '../../../../utils/paymentConsoleData';
import { fetchTransactionReceiptEmail } from '../../../../utils/fetchTransactionReceiptEmail';
import { attachScreenshot, attachEmailScreenshot } from '../../../../utils/attachScreenshot';
import { registerSssHooks, sssState, navigateAndSelectBiller } from './sssHelpers';

registerSssHooks();

test.describe('Payment Console — SSS — Individual', () => {

  test(
    'Generate PRN and Pay e2e',
    { tag: ['@smoke', '@regression'] },
    async ({ page }, testInfo) => {
      const { paymentConsole, transactionPage, context } = sssState;
      // Full flow + Generate PRN month scan + up to 2 min IMAP email poll.
      testInfo.setTimeout(300_000);
      const baseName = 'BLR-905';
      const biller = sssBillers.individual;
      const gen = sssIndividualGeneratePrn;
      const amount = gen.amount;        // 1200.00
      const addOnFee = '0.00';          // expected 0.00 for SSS
      const serviceFee = '0.00';        // expected 0.00 for SSS
      const totalAmount = amount;       // Total == Bill (both fees 0.00)
      const email = context.email;

      // Cutoff BEFORE paying so we only accept a receipt email that arrives after.
      const beforePayment = new Date();

      await navigateAndSelectBiller(biller);

      const prn = await test.step('Generate a PRN (OFW; scan Applicable Months until unpaid)', async () => {
        return paymentConsole.generateIndividualPRN({
          ssNumber: gen.ssNumbers[0],
          memberTypeLabel: gen.memberTypeLabel,
          amount,
          startYear: gen.monthSearchStartYear,
          endYear: gen.monthSearchEndYear,
        });
      });
      expect(prn, 'Generate PRN should auto-fill a PRN on the form').not.toBe('');

      await test.step('Fill Country Code and Email, then Pay Now', async () => {
        await paymentConsole.selectCountryCode('PH');
        await paymentConsole.fillBillerEmail(email);
        await paymentConsole.clickSssPayNow();
      });

      await test.step('Verify Payment Summary matches input', async () => {
        await paymentConsole.assertPaymentSummaryDetails({
          billerName: biller.name,
          accountNumber: prn,       // the PRN is echoed in the summary
          amount,
          email,
          addOnFee,
          serviceFee,
          totalAmount,
        });
        await paymentConsole.waitForModalSettled();
        await attachScreenshot(testInfo, { page, fullPage: true, baseName, label: 'payment-summary' });
      });

      await test.step('Confirm the payment', async () => {
        await paymentConsole.clickConfirm();
      });

      await test.step('Verify the Transaction Receipt', async () => {
        await paymentConsole.assertPaymentReceipt({
          billerName: biller.name,
          // SSS renders Account Number blank on the receipt (expected behavior).
          accountNumber: '',
          amount,
          addOnFee,
          serviceFee,
          totalAmount,
        });
        await attachScreenshot(testInfo, { page, fullPage: true, baseName, label: 'transaction-receipt' });
      });

      const merchantReference = await paymentConsole.getMerchantReferenceNumber();

      await test.step('Verify transaction reflects in Transaction History', async () => {
        await transactionPage.goToTransactionList();
        await transactionPage.searchByReference(merchantReference);
        await transactionPage.assertTransactionRow({
          billerName: biller.name,
          merchantReference,
        });
        await attachScreenshot(testInfo, { page, fullPage: true, baseName, label: 'transaction-history' });
      });

      await test.step('Verify fee breakdown in the View Transaction modal', async () => {
        await transactionPage.viewTransaction(merchantReference);
        await transactionPage.assertTransactionDetails({
          billerName: biller.name,
          processor: 'SSS',
          merchantReference,
          billAmount: amount,
          addOnFee,
          serviceFee,
          totalAmount,
          statusDescription: 'Payment Posted',
        });
        await attachScreenshot(testInfo, {
          locator: transactionPage.viewModalLocator(),
          baseName,
          label: 'transaction-view-modal',
        });
        await transactionPage.closeViewTransaction();
      });

      const receiptEmail = await test.step('Fetch the receipt email', async () => {
        return fetchTransactionReceiptEmail(beforePayment, merchantReference);
      });
      await attachEmailScreenshot(testInfo, page, receiptEmail, { baseName, label: 'email-receipt' });
      await test.step('Verify the receipt email details', async () => {
        expect(receiptEmail.toAddress, 'Receipt should be sent to the payer email').toContain(email);
        expect(receiptEmail.body, 'Email should confirm a successful transaction').toContain('Transaction Successful');
        expect(receiptEmail.body, 'Email should show the merchant reference').toContain(merchantReference);
      });
    }
  );

  // ----------------------------------------------------------------------------
  // NEGATIVE — each submits an invalid payment and asserts it's rejected (SSS
  // "Try Again" modal or client-side field errors), never a Payment Summary.
  // Nothing is paid.
  // ----------------------------------------------------------------------------

  test('Already paid PRN is rejected', { tag: ['@regression'] }, async () => {
    await payAndExpectRejection(prns.alreadyPaid, 'PRN is already paid.');
  });

  test('Cancelled PRN is rejected', { tag: ['@regression'] }, async () => {
    await payAndExpectRejection(prns.cancelled, 'PRN is already cancelled.');
  });

  test('PRN with invalid spacing is rejected', { tag: ['@regression'] }, async () => {
    await payAndExpectRejection(prns.invalidSpacing, 'Invalid PRN format.');
  });

  test('PRN with invalid characters is rejected', { tag: ['@regression'] }, async () => {
    await payAndExpectRejection(prns.invalidFormat, 'Invalid PRN format.');
  });

  test('Unknown PRN is rejected with no data found', { tag: ['@regression'] }, async () => {
    await payAndExpectRejection(prns.noData, 'No data found for the provided PRN.');
  });

  test('Non-individual PRN is rejected', { tag: ['@regression'] }, async () => {
    await payAndExpectRejection(
      prns.wrongMemberType,
      'Invalid PRN. Use a PRN generated for an SSS individual member.',
    );
  });

  test('Malformed email is rejected', { tag: ['@regression'] }, async () => {
    const { paymentConsole } = sssState;
    const gen = sssIndividualGeneratePrn;
    await navigateAndSelectBiller(sssBillers.individual);
    // Use a freshly generated (valid, unpaid) PRN so the email is the only
    // thing wrong. Generating doesn't pay, so it doesn't use up the month.
    await test.step('Generate a valid PRN', async () => {
      await paymentConsole.generateIndividualPRN({
        ssNumber: gen.ssNumbers[0],
        memberTypeLabel: gen.memberTypeLabel,
        amount: gen.amount,
        startYear: gen.monthSearchStartYear,
        endYear: gen.monthSearchEndYear,
      });
    });
    await test.step('Enter a malformed email and Pay Now', async () => {
      await paymentConsole.selectCountryCode('PH');
      await paymentConsole.fillBillerEmail('apn.justineagnergmail.com'); // missing "@"
      await paymentConsole.submitSssPayNow();
    });
    await test.step('Verify rejection: Invalid email address format.', async () => {
      await paymentConsole.assertSssRejection('Invalid email address format.');
    });
  });

  test('Blank PRN and Country Code show required-field errors', { tag: ['@regression'] }, async () => {
    const { paymentConsole } = sssState;
    await navigateAndSelectBiller(sssBillers.individual);
    await test.step('Pay Now with PRN and Country Code blank', async () => {
      // Fill the (actually required) email so only PRN + Country Code error.
      await paymentConsole.fillBillerEmail(sssState.context.email);
      await paymentConsole.submitSssPayNow();
    });
    await test.step('Verify "This field is required." on both fields', async () => {
      await paymentConsole.assertSssRequiredFieldErrors();
    });
  });

});

// Fill PRN + Country Code + Email, Pay Now, expect the rejection. Email is
// labelled "(Optional)" but the form rejects a blank one with "This field is
// required.", so always fill it to keep the PRN the only thing under test.
async function payAndExpectRejection(prn: string, expected: string | RegExp, email?: string) {
  const { paymentConsole, context } = sssState;
  await navigateAndSelectBiller(sssBillers.individual);
  await test.step(`Enter PRN "${prn}" and Pay Now`, async () => {
    await paymentConsole.fillSssPrn(prn);
    await paymentConsole.selectCountryCode('PH');
    await paymentConsole.fillBillerEmail(email ?? context.email);
    await paymentConsole.submitSssPayNow();
  });
  await test.step(`Verify rejection: ${expected}`, async () => {
    await paymentConsole.assertSssRejection(expected);
  });
}
