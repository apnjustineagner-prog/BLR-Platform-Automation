// tests/platform/Payment Console/SSS/individual.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE TEST SUITE — SSS (Individual)
// ==============================================================================
//
// PROCESSOR SCOPE: SSS is a third processor alongside ECPay (ecpay.spec.ts)
// and Bayad (bayad.spec.ts). SSS has two billers in the search directory —
// "SSS - Individual" (this file) and "SSS - Employer" (employer.spec.ts).
//
// SCOPE FOR NOW: navigation only. The selection flow up to and including
// picking the biller is identical to the other processors (business name ->
// biller account -> service type -> search -> select). The biller-specific
// SSS payment form fields aren't captured yet, so these tests stop once the
// biller is selected — form fill/submit will be added once the form is
// explored live.
//
// Run: npx playwright test "tests/platform/Payment Console/SSS/individual.spec.ts"
//
// ==============================================================================

import { test } from '@playwright/test';
import { PaymentConsolePage } from '../../../../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import { paymentConsoleContext, sssBillers, BillerConfig } from '../../../../utils/paymentConsoleData';
import { accountForProject, type PaymentConsoleContext } from '../../../../utils/accounts';
import { attachScreenshot } from '../../../../utils/attachScreenshot';
import { applyZoom } from '../../../../utils/applyZoom';

// In-app context for the account this project runs under — set in beforeEach.
let context: PaymentConsoleContext = paymentConsoleContext;

test.describe.configure({ retries: 2 });

let paymentConsole: PaymentConsolePage;

test.beforeEach(async ({ page }, testInfo) => {
  paymentConsole = new PaymentConsolePage(page);
  context = accountForProject(testInfo.project.name).paymentConsoleContext;
  await applyZoom(page, 0.5); // zoom out to 50% so wide tables/modals fit
  await page.goto('https://test-web-admin.billeroo.com/dashboard');
  await page.waitForLoadState('networkidle');
});

test.afterEach(async ({ page }, testInfo) => {
  // Bundled under screenshots/<spec-slug>/ and attached to Playwright + Qase.
  await attachScreenshot(testInfo, { page, label: 'final-page' });
});

// Same selection flow as ecpay.spec.ts / bayad.spec.ts — navigate to Payment
// Console, pick the business/credential/service type, then search and select
// the biller.
async function navigateAndSelectBiller(biller: BillerConfig) {
  await test.step('Navigate to Payment Console', async () => {
    await paymentConsole.goToPaymentConsole();
    await paymentConsole.assertOnPaymentConsolePage();
  });

  await test.step('Select business name, biller account, and service type', async () => {
    // Merchant/agent consoles have no Business Name selector (context omits it).
    if (context.businessCategoryAccount) {
      await paymentConsole.selectBusinessCategoryAccount(context.businessCategoryAccount);
    }
    await paymentConsole.selectAccountCredential(context.billerAccount);
    await paymentConsole.selectServiceType(context.serviceType);
  });

  await test.step(`Search for biller: ${biller.name}`, async () => {
    await paymentConsole.searchBillerAccount(biller.name);
  });

  await test.step(`Select biller: ${biller.name}`, async () => {
    await paymentConsole.selectBillerAccount(biller.name);
  });
}

// ==============================================================================
// TESTS — SSS INDIVIDUAL
// ==============================================================================

test.describe('Payment Console — SSS — Individual', () => {

  test(
    'Navigate to and select SSS - Individual in Payment Console',
    { tag: ['@smoke', '@regression'] },
    async () => {
      await navigateAndSelectBiller(sssBillers.individual);
    }
  );

});
