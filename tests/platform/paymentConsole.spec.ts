// tests/platform/paymentConsole.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE TEST SUITE
// ==============================================================================
//
// PURPOSE:
//   Payment Console module under PLATFORM (SUPER ADMIN)
//
// FLOW COVERED:
//   Navigate to Payment Console → select business name, biller account,
//   and service type.
//
// ==============================================================================

import { test } from '@playwright/test';
import { PaymentConsolePage } from '../../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import { randomBillAmount, randomManilaWaterAccountNumber } from '../../utils/testData';

// ==============================================================================
// TEST DATA — Replace placeholders with real values from the UI
// ==============================================================================

const validData = {
  businessCategoryAccount: 'AltPayNet Corp. III -',
  billerAccount: 'AltPayNet Test Credential',
  serviceType: 'Bills Payment',
  billerToSearch: 'MANILA WATER COMPANY',
  accountName: 'Justine Agner',
  email: 'apn.justineagner@gmail.com',
};

// ==============================================================================
// SETUP
// ==============================================================================

let paymentConsole: PaymentConsolePage;

test.beforeEach(async ({ page }) => {
  paymentConsole = new PaymentConsolePage(page);
  await page.goto('https://test-web-admin.billeroo.com/dashboard');
  await page.waitForLoadState('networkidle');
});

import fs from 'fs';
import path from 'path';

test.afterEach(async ({ page }, testInfo) => {
  const screenshotName = testInfo.title.replace(/\s+/g, '_');
  const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
  const screenshotPath = path.join(screenshotsDir, `${screenshotName}.png`);

  // Ensure screenshots directory exists to avoid write errors
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  await page.screenshot({ path: screenshotPath });

  // Attach the saved screenshot to the test report
  await testInfo.attach(screenshotName, {
    path: screenshotPath,
    contentType: 'image/png',
  });
});

// ==============================================================================
// TEST: SELECT BUSINESS NAME, BILLER ACCOUNT, AND SERVICE TYPE
// ==============================================================================

test('Select business name, biller account, and service type', { tag: ['@smoke'] }, async () => {
  await test.step('Navigate to Payment Console', async () => {
    await paymentConsole.goToPaymentConsole();
    await paymentConsole.assertOnPaymentConsolePage();
  });

  await test.step('Select business name', async () => {
    await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
  });

  await test.step('Select biller account', async () => {
    await paymentConsole.selectAccountCredential(validData.billerAccount);
  });

  await test.step('Select service type', async () => {
    await paymentConsole.selectServiceType(validData.serviceType);
  });
});

// ==============================================================================
// TEST: SEARCH FOR A SPECIFIC BILLER ACCOUNT
// ==============================================================================

test('Search for a specific biller account', { tag: ['@smoke'] }, async () => {
  const amount = randomBillAmount();
  const contractAccountNumber = randomManilaWaterAccountNumber();

  await test.step('Navigate to Payment Console', async () => {
    await paymentConsole.goToPaymentConsole();
    await paymentConsole.assertOnPaymentConsolePage();
  });

  await test.step('Select business name, biller account, and service type', async () => {
    await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
    await paymentConsole.selectAccountCredential(validData.billerAccount);
    await paymentConsole.selectServiceType(validData.serviceType);
  });

  // The biller category list (with the search box) renders immediately after
  // Service Type is selected — there is no Preview button in the current UI
  // (observed 2026-07-22: clickPreview() timed out, no "Preview" role=button
  // anywhere in the accessibility tree, biller list already populated).
  await test.step('Search for biller: MANILA WATER COMPANY', async () => {
    await paymentConsole.searchBillerAccount(validData.billerToSearch);
  });

  await test.step('Select biller: MANILA WATER COMPANY', async () => {
    await paymentConsole.selectBillerAccount(validData.billerToSearch);
  });

  await test.step('Fill MANILA WATER COMPANY payment form', async () => {
    await paymentConsole.fillContractAccountNumber(contractAccountNumber);
    await paymentConsole.fillBillerAccountName(validData.accountName);
    await paymentConsole.fillBillerAmount(amount);
    await paymentConsole.fillBillerEmail(validData.email);
  });

  await test.step('Click Pay Now', async () => {
    await paymentConsole.clickPayNow();
  });

  await test.step('Verify payment summary matches input', async () => {
    await paymentConsole.assertPaymentSummaryDetails({
      billerName: validData.billerToSearch,
      accountNumber: contractAccountNumber,
      accountName: validData.accountName,
      amount,
      email: validData.email,
    });
  });

  await test.step('Click Confirm', async () => {
    await paymentConsole.clickConfirm();
  });
});
