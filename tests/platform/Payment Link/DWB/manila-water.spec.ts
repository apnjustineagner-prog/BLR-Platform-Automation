// tests/platform/Payment Link/DWB/manila-water.spec.ts
//
// ==============================================================================
// PAYMENT LINK — DYNAMIC WEB BILLER (DWB) — MANILA WATER COMPANY
// ==============================================================================
//
// TESTS (no payment — free to run any time):
//   Payment page renders the Manila Water form, Add-on Fee and Total
//   Total Amount updates with the entered amount
//   Valid details show a matching Payment Summary
//   Blank required fields are blocked (stays on /payment)
//   Summary Next opens Consent; Proceed enables only after the 3 required boxes
//
// TEST (PAYS — opt-in only):
//   Full payment e2e: form -> Summary -> Consent -> TLPE (names, Visa) -> card
//   -> PAY -> 3DS Approve -> TRANSACTION SUCCESSFUL -> "here" -> receipt.
//   Makes a real test payment (the account number is reusable). Skipped unless
//   RUN_PAID_E2E=1 so regression runs don't pay. Must run HEADED.
//
// The DWB link is a public consumer page, so these run as a fresh visitor.
//
// Run (free tests): npx playwright test "tests/platform/Payment Link/DWB" --project=chromium-admin --no-deps
// Run (paid e2e):   RUN_PAID_E2E=1 npx playwright test "tests/platform/Payment Link/DWB" --project=chromium-admin --no-deps --headed -g "Full payment"
//
// ==============================================================================

import { test, expect } from '@playwright/test';
import { DwbPaymentPage } from '../../../../pages/PLATFORM(SUPERADMIN)/dwbPaymentPage';
import { TlpeCheckoutPage } from '../../../../pages/PLATFORM(SUPERADMIN)/tlpeCheckoutPage';
import {
  dwbManilaWaterUrl,
  dwbManilaWaterAddOnFee,
  dwbManilaWaterAccount,
  tlpeCustomerDetails,
  tlpeTestVisaCard,
} from '../../../../utils/paymentLinkData';
import { accountForProject } from '../../../../utils/accounts';
import { attachScreenshot } from '../../../../utils/attachScreenshot';

const ACCOUNT_NAME = 'Justine Agner';
const money = (n: number) => n.toFixed(2);
// Manila Water rejects paying the same account the same amount twice in a day
// ("System detects double transaction ... try with a different amount"), so
// every run uses its own random amount, 10.01–99.99 PHP.
const randomAmount = () => (1001 + Math.floor(Math.random() * 8999)) / 100;
const asInput = (n: number) => n.toFixed(2);

// Public page — browse as a fresh visitor, not with the admin session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Payment Link — DWB — Manila Water Company', () => {
  let dwb: DwbPaymentPage;

  test.beforeEach(async ({ page }) => {
    dwb = new DwbPaymentPage(page);
    await dwb.open(dwbManilaWaterUrl);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachScreenshot(testInfo, { page, label: 'final-page' });
  });

  test('Payment page shows the Manila Water form, Add-on Fee and Total', { tag: ['@smoke', '@regression'] }, async ({ page }, testInfo) => {
    await expect(page).toHaveTitle(/MANILA WATER COMPANY Payment Page/);
    for (const input of [dwb.accountNumberInput, dwb.accountNameInput, dwb.amountInput]) {
      await expect(input).toBeVisible();
      await expect(input).toHaveAttribute('required', '');
    }
    await expect(dwb.emailInput).toBeVisible();
    await expect(dwb.emailInput).not.toHaveAttribute('required', '');
    await expect(dwb.detailValue('Add-on Fee')).toHaveText(money(dwbManilaWaterAddOnFee));
    await expect(dwb.totalAmount, 'With amount 0 the total is just the add-on fee').toHaveText(`${money(dwbManilaWaterAddOnFee)} PHP`);
    await attachScreenshot(testInfo, { page, label: 'payment-page' });
  });

  test('Total Amount updates with the entered amount', { tag: ['@regression'] }, async () => {
    await dwb.amountInput.fill('25');
    await expect(dwb.totalAmount).toHaveText(`${money(25 + dwbManilaWaterAddOnFee)} PHP`);
  });

  test('Valid details show a matching Payment Summary', { tag: ['@smoke', '@regression'] }, async ({ page }, testInfo) => {
    const email = accountForProject(testInfo.project.name).paymentConsoleContext.email;
    const amount = Number(await dwb.submitWithUniqueAmount(
      { accountNumber: dwbManilaWaterAccount, accountName: ACCOUNT_NAME, email }, () => asInput(randomAmount())));
    await dwb.assertPaymentSummary({
      accountNumber: dwbManilaWaterAccount,
      accountName: ACCOUNT_NAME,
      billAmount: money(amount),
      email,
      addOnFee: money(dwbManilaWaterAddOnFee),
      totalAmount: money(amount + dwbManilaWaterAddOnFee),
    });
    await attachScreenshot(testInfo, { page, label: 'payment-summary' });
  });

  test('Blank required fields are blocked', { tag: ['@regression'] }, async ({ page }) => {
    await dwb.clickNext();
    await expect(page, 'Should stay on the payment form').toHaveURL(dwbManilaWaterUrl);
    expect(
      await dwb.accountNumberInput.evaluate((el) => (el as { validity: { valueMissing: boolean } }).validity.valueMissing),
      'Account number should report a missing required value',
    ).toBe(true);
  });

  test('Summary Next opens Consent and Proceed needs the 3 required boxes', { tag: ['@regression'] }, async ({ page }, testInfo) => {
    await dwb.submitWithUniqueAmount({ accountNumber: dwbManilaWaterAccount, accountName: ACCOUNT_NAME }, () => asInput(randomAmount()));
    await dwb.openConsent();
    await expect(dwb.consentRequiredCheckboxes).toHaveCount(3);
    await expect(dwb.consentProceedButton, 'Proceed starts disabled').toBeDisabled();
    await dwb.acceptRequiredConsent();
    await attachScreenshot(testInfo, { page, label: 'consent' });
  });

  test('Full payment e2e via TLPE + Visa 3DS', { tag: ['@e2e', '@paid'] }, async ({ page }, testInfo) => {
    test.skip(process.env.RUN_PAID_E2E !== '1', 'Makes a real test payment — set RUN_PAID_E2E=1 to run');
    test.setTimeout(300_000);
    const accountNumber = dwbManilaWaterAccount;
    const email = accountForProject(testInfo.project.name).paymentConsoleContext.email;
    let amount = 0;
    const tlpe = new TlpeCheckoutPage(page);
    const shot = (label: string) => attachScreenshot(testInfo, { page, label });

    await test.step(`Fill the form (account ${accountNumber}, unique amount) and check the Payment Summary`, async () => {
      amount = Number(await dwb.submitWithUniqueAmount({ accountNumber, accountName: ACCOUNT_NAME, email }, () => asInput(randomAmount())));
      console.log(`[DWB e2e] amount ${money(amount)} PHP`);
      await dwb.assertPaymentSummary({
        accountNumber, accountName: ACCOUNT_NAME, billAmount: money(amount), email,
        addOnFee: money(dwbManilaWaterAddOnFee), totalAmount: money(amount + dwbManilaWaterAddOnFee),
      });
      await shot('1-payment-summary');
    });

    await test.step('Accept consent and go to TLPE', async () => {
      await dwb.openConsent();
      await dwb.acceptRequiredConsent();
      await shot('2-consent');
      await dwb.clickConsentProceed();
      await tlpe.waitForTransactionInfo();
    });

    await test.step('Fill TLPE customer details and choose Visa', async () => {
      const [firstName, ...rest] = ACCOUNT_NAME.split(' ');
      await tlpe.fillCustomerDetails({ firstName, lastName: rest.join(' '), email, ...tlpeCustomerDetails });
      await tlpe.selectVisa();
      await shot('3-tlpe-transaction-info');
      await tlpe.clickTransactionInfoNext();
      await tlpe.waitForConfirmPayment();
    });

    let transactionReference = '';
    await test.step('Pay with the Visa test card and approve 3DS', async () => {
      await tlpe.fillCard(tlpeTestVisaCard);
      await shot('4-tlpe-confirm-payment');
      await tlpe.clickPay();
      await tlpe.waitFor3ds();
      await shot('5-3ds-simulator');
      await tlpe.approve3ds();
      await tlpe.waitForPaymentResult();
      transactionReference = await tlpe.getResultTransactionReference();
      await shot('6-payment-result');
    });
    console.log(`[DWB e2e] account ${accountNumber} paid, txn ${transactionReference}`);

    await test.step('Return to the biller receipt via "here"', async () => {
      await tlpe.clickHereToReturn();
      const status = await dwb.waitForReceipt();
      await shot('7-receipt');
      console.log(`[DWB e2e] receipt: "${status}"`);
      await dwb.assertReceipt({
        transactionReference, accountNumber, name: ACCOUNT_NAME, paymentMethod: 'Visa',
        billAmount: money(amount), addOnFee: money(dwbManilaWaterAddOnFee),
      });
    });
  });
});
