// tests/platform/bayad.spec.ts
//
// ==============================================================================
// BAYAD BILL PAYMENT TEST SUITE
// ==============================================================================
//
// FLOW:
//   Login → Dashboard → Payment Console → Bayad → Biller → Pay
//   (history tests continue: → Transaction Module → Transaction History)
//
// PREREQUISITES:
//   - Business "AltPayNet Corp. III" with credential "AltPayNet Test Credential"
//     and service type "Bills Payment" configured in the Payment Console
//   - Valid Maynilad Water account number still needed (see TODO in TEST DATA)
//
// TEST ORGANIZATION:
//   1. Meralco          — BLR-3671, BLR-3672, BLR-3673
//   2. Maynilad Water   — BLR-3674, BLR-3675, BLR-3676
//
// ==============================================================================

import { test } from '@playwright/test';
import { BayadPage } from '../../pages/PLATFORM(SUPERADMIN)/bayadPage';
import { BlrLoginPage } from '../../pages/blrAccountOnboardingPage/blrLoginPage';
import { qase } from 'playwright-qase-reporter';
import credentials from '../../utils/decrypt';

// ==============================================================================
// TEST DATA — Replace TODO placeholders with real values from the UI
// ==============================================================================

const console_ = {
  businessCategoryAccount: 'AltPayNet Corp. III',
  accountCredential: 'AltPayNet Test Credential',
  serviceType: 'Bills Payment',
};

const meralco = {
  biller: 'MERALCO',
  validAccountNumber: '1715063524',
  invalidAccountNumber: '0000000000',
  amount: '50',
};

const maynilad = {
  biller: 'MAYNILAD WATER SERVICES',
  validAccountNumber: '5972634',
  invalidAccountNumber: '00000000',
  accountName: 'Justine Agner',
  amount: '50',
  email: 'apn.justineagner@gmail.com',
};

// ==============================================================================
// SETUP
// ==============================================================================

let bayad: BayadPage;
let currentQaseId = 0;

test.beforeEach(async ({ page }) => {
  bayad = new BayadPage(page);
  const loginPage = new BlrLoginPage(page);
  await loginPage.gotoLogin();
  await loginPage.loginIfNeeded(credentials);
  await page.goto('https://test-web-admin.billeroo.com/dashboard');
  await page.waitForLoadState('networkidle');
});

test.afterEach(async ({ page }, testInfo) => {
  const screenshotName = currentQaseId
    ? `BLR-${currentQaseId}`
    : testInfo.title.replace(/\s+/g, '_');

  const screenshotPath = `screenshots/${screenshotName}.png`;

  await page.screenshot({ path: screenshotPath });

  await testInfo.attach(screenshotName, {
    path: screenshotPath,
    contentType: 'image/png',
  });

  if (testInfo.status === 'passed') {
    console.log(`[PASSED] qase.id ${currentQaseId} - ${testInfo.title}`);
  }
});

// Shared preamble: open Payment Console with the Bayad credential and land on
// the biller payment form for the given biller.
async function openBayadBillerForm(billerName: string) {
  await test.step('Navigate to Payment Console and set up Bayad billers', async () => {
    await bayad.goToPaymentConsole();
    await bayad.selectBusinessCategoryAccount(console_.businessCategoryAccount);
    await bayad.selectAccountCredential(console_.accountCredential);
    await bayad.selectServiceType(console_.serviceType);
  });

  await test.step(`Search and select biller: ${billerName}`, async () => {
    await bayad.searchBiller(billerName);
    await bayad.selectBiller(billerName);
  });
}

// ==============================================================================
// TESTS
// ==============================================================================

test.describe('Bayad', () => {

  // --- Meralco ------------------------------------------------------------------

  test(
    qase(3671, 'Bill payment is processed successfully when a valid Meralco transaction is submitted via Bayad'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3671;

      await openBayadBillerForm(meralco.biller);

      await test.step('Fill payment details with a valid Meralco account number', async () => {
        await bayad.fillAccountNumber(meralco.validAccountNumber);
        await bayad.fillAmount(meralco.amount);
      });

      await test.step('Submit the payment', async () => {
        await bayad.clickPayNow();
      });

      await test.step('Verify confirmation modal shows the payment details', async () => {
        await bayad.assertConfirmationModalShowsDetails([meralco.validAccountNumber]);
      });

      await test.step('Confirm the payment', async () => {
        await bayad.clickConfirm();
      });

      await test.step('Verify payment is processed successfully', async () => {
        await bayad.assertPaymentProcessed();
      });
    }
  );

  test(
    qase(3672, 'Meralco payment is reflected in Transaction History under the Transaction Module after successful validation'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3672;

      await openBayadBillerForm(meralco.biller);

      await test.step('Submit a valid Meralco payment', async () => {
        await bayad.fillAccountNumber(meralco.validAccountNumber);
        await bayad.fillAmount(meralco.amount);
        await bayad.clickPayNow();
        await bayad.clickConfirm();
        await bayad.assertPaymentProcessed();
      });

      await test.step('Navigate to Transaction Module', async () => {
        await bayad.goToTransactionModule();
      });

      await test.step('Verify the Meralco payment appears in Transaction History', async () => {
        await bayad.searchTransaction(meralco.validAccountNumber);
        await bayad.assertTransactionInHistory(meralco.validAccountNumber, meralco.biller);
      });
    }
  );

  test(
    qase(3673, 'Payment is rejected when an invalid Meralco account number is submitted via Bayad'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3673;

      await openBayadBillerForm(meralco.biller);

      await test.step('Fill payment details with an invalid Meralco account number', async () => {
        await bayad.fillAccountNumber(meralco.invalidAccountNumber);
        await bayad.fillAmount(meralco.amount);
      });

      await test.step('Submit the payment', async () => {
        await bayad.clickPayNow();
      });

      await test.step('Verify payment is rejected', async () => {
        await bayad.assertPaymentRejected();
      });
    }
  );

  // --- Maynilad Water -------------------------------------------------------------

  test(
    qase(3674, 'Bill payment is processed successfully when a valid Maynilad Water transaction is submitted via Bayad'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3674;

      await openBayadBillerForm(maynilad.biller);

      await test.step('Fill payment details with a valid Maynilad contract account number', async () => {
        await bayad.fillContractAccountNumber(maynilad.validAccountNumber);
        await bayad.fillAccountName(maynilad.accountName);
        await bayad.fillAmount(maynilad.amount);
        await bayad.fillEmail(maynilad.email);
      });

      await test.step('Submit the payment', async () => {
        await bayad.clickPayNow();
      });

      await test.step('Verify confirmation modal shows the payment details', async () => {
        await bayad.assertConfirmationModalShowsDetails([
          maynilad.validAccountNumber,
          maynilad.accountName,
        ]);
      });

      await test.step('Confirm the payment', async () => {
        await bayad.clickConfirm();
      });

      await test.step('Verify payment is processed successfully', async () => {
        await bayad.assertPaymentProcessed();
      });
    }
  );

  test(
    qase(3675, 'Maynilad Water payment is reflected in Transaction History under the Transaction Module after successful validation'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3675;

      await openBayadBillerForm(maynilad.biller);

      await test.step('Submit a valid Maynilad Water payment', async () => {
        await bayad.fillContractAccountNumber(maynilad.validAccountNumber);
        await bayad.fillAccountName(maynilad.accountName);
        await bayad.fillAmount(maynilad.amount);
        await bayad.clickPayNow();
        await bayad.clickConfirm();
        await bayad.assertPaymentProcessed();
      });

      await test.step('Navigate to Transaction Module', async () => {
        await bayad.goToTransactionModule();
      });

      await test.step('Verify the Maynilad Water payment appears in Transaction History', async () => {
        await bayad.searchTransaction(maynilad.validAccountNumber);
        await bayad.assertTransactionInHistory(maynilad.validAccountNumber, maynilad.biller);
      });
    }
  );

  test(
    qase(3676, 'Payment is rejected when an invalid Maynilad Water account number is submitted via Bayad'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3676;

      await openBayadBillerForm(maynilad.biller);

      await test.step('Fill payment details with an invalid Maynilad contract account number', async () => {
        await bayad.fillContractAccountNumber(maynilad.invalidAccountNumber);
        await bayad.fillAccountName(maynilad.accountName);
        await bayad.fillAmount(maynilad.amount);
      });

      await test.step('Submit the payment', async () => {
        await bayad.clickPayNow();
      });

      await test.step('Verify payment is rejected', async () => {
        await bayad.assertPaymentRejected();
      });
    }
  );

});
