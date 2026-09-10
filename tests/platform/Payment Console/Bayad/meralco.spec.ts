// tests/platform/Payment Console/Bayad/meralco.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE — BAYAD — MERALCO
// ==============================================================================
//
// One biller per file; the shared Bayad flow/setup lives in ./bayadHelpers.ts.
//
// MERALCO renders the same generic Bayad payment form as Maynilad Water
// (Account Number + Amount + Email(Optional), no Account Name field —
// confirmed live), so it reuses the same helpers unchanged.
//
// TEST CASES COVERED:
//   BLR-3671  Valid Meralco payment is processed successfully via Bayad
//   BLR-3672  Meralco payment is reflected in Transaction History
//   BLR-3673  Invalid Meralco account number is rejected
//   (no ticket) Meralco payment sends a transaction receipt email with the
//             correct details (verified via Gmail/IMAP — add a qase() id
//             once one's filed)
//
// Run: npx playwright test "tests/platform/Payment Console/Bayad/meralco.spec.ts"
//
// ==============================================================================

// ==============================================================================
// COMMENTED OUT (2026-09-09): Meralco has hit its monthly transaction limit on
// the biller side ("Uh oh! Your account has already reached maximum
// transactions with us for this month." on the Payment Summary). Payments
// can't complete, so the receipt never renders and every pay-based test fails.
// Disabled entirely for now — the Bayad pay flow is covered by Manila Water
// (see ./manila-water.spec.ts) meanwhile. Uncomment this whole block once the
// monthly limit resets or the account cap is raised.
// ==============================================================================

// import { test } from '@playwright/test';
// import { qase } from 'playwright-qase-reporter';
// import { bayadBillers } from '../../../../utils/paymentConsoleData';
// import { fetchTransactionReceiptEmail } from '../../../../utils/fetchTransactionReceiptEmail';
// import {
//   registerBayadHooks,
//   setQaseId,
//   bayadState,
//   context,
//   payBayadSuccessfully,
//   payBayadWithInvalidAccountNumber,
//   computeTotalAmount,
//   expect,
// } from './bayadHelpers';

// registerBayadHooks();

// test.describe('Payment Console — Bayad — Meralco', () => {

//   test(
//     qase(3671, 'Valid Meralco payment is processed successfully via Bayad'),
//     { tag: ['@smoke', '@regression'] },
//     async () => {
//       setQaseId(3671);
//       await payBayadSuccessfully(bayadBillers.meralco);
//     }
//   );

//   // Same pattern as ECPay's BLR-3681 — pay successfully, then find the
//   // transaction in the Transaction List by its Merchant Reference No.
//   test(
//     qase(3672, 'Meralco payment is reflected in Transaction History under the Transaction Module after successful validation'),
//     { tag: ['@regression'] },
//     async () => {
//       setQaseId(3672);

//       const { merchantReference } = await payBayadSuccessfully(bayadBillers.meralco);

//       await test.step('Navigate to Transaction List', async () => {
//         await bayadState.transactionPage.goToTransactionList();
//       });

//       await test.step('Search by Merchant Reference Number', async () => {
//         await bayadState.transactionPage.searchByReference(merchantReference);
//       });

//       await test.step('Verify transaction reflects with correct details', async () => {
//         await bayadState.transactionPage.assertTransactionRow({
//           billerName: bayadBillers.meralco.name,
//           merchantReference,
//         });
//       });
//     }
//   );

//   // Pay successfully, then confirm the "Transaction Successful!" receipt
//   // EMAIL lands in the payer's Gmail (context.email) and echoes the payment
//   // details. The email is matched by its unique Merchant Reference No. so it
//   // can't pick up a stale receipt (see fetchTransactionReceiptEmail.ts).
//   test(
//     'Meralco payment sends a transaction receipt email with the correct details',
//     { tag: ['@regression'] },
//     async ({}, testInfo) => {
//       // Payment + up to 2 min of IMAP polling for the email — well over the
//       // 120s default, so give it room.
//       testInfo.setTimeout(240_000);

//       // Record the cutoff BEFORE paying so we only accept an email that
//       // arrives after this point (same discipline as the OTP/activation
//       // fetchers).
//       const beforePayment = new Date();

//       const { merchantReference, amount, accountNumber } = await payBayadSuccessfully(bayadBillers.meralco);

//       const email = await test.step('Fetch the transaction receipt email', async () => {
//         return fetchTransactionReceiptEmail(beforePayment, merchantReference);
//       });

//       await test.step('Verify the receipt email details', async () => {
//         expect(email.toAddress, 'Receipt should be sent to the payer email').toContain(context.email);
//         expect(email.body, 'Email should confirm a successful transaction').toContain('Transaction Successful');
//         expect(email.body, 'Email should name the biller and amount paid').toContain(`PHP ${amount} to ${bayadBillers.meralco.name}`);
//         expect(email.body, 'Email should show the merchant reference').toContain(merchantReference);
//         expect(email.body, 'Email should show the account number').toContain(accountNumber);
//         expect(email.body, 'Email should show the total amount').toContain(computeTotalAmount(amount, bayadBillers.meralco));
//       });
//     }
//   );

//   // Meralco validates account-number *length* up front (must be 10 digits) —
//   // the shared invalidBillerAccountNumber ('00000000', 8 digits) trips that
//   // check, so the rejection reason is a length error, not Maynilad's
//   // "starts with 5/6/7" format error (confirmed live 2026-09-08).
//   test(
//     qase(3673, 'Payment is rejected when an invalid Meralco account number is submitted via Bayad'),
//     { tag: ['@regression'] },
//     async () => {
//       setQaseId(3673);
//       await payBayadWithInvalidAccountNumber(
//         bayadBillers.meralco,
//         'The account number must be 10 digits.'
//       );
//     }
//   );

// });

export {};
