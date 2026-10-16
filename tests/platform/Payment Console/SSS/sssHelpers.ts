// tests/platform/Payment Console/SSS/sssHelpers.ts
//
// Shared setup + selection flow for the SSS Payment Console specs
// (individual.spec.ts, individual-negative.spec.ts). Same shape as
// ../ECPay/ecpayHelpers.ts: call registerSssHooks() once at the top of a spec,
// then use sssState + navigateAndSelectBiller() inside tests.

import { test } from '@playwright/test';
import { PaymentConsolePage } from '../../../../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import { TransactionPage } from '../../../../pages/PLATFORM(SUPERADMIN)/transactionPage';
import { BillerConfig, paymentConsoleContext } from '../../../../utils/paymentConsoleData';
import { accountForProject, projectSupports, type PaymentConsoleContext } from '../../../../utils/accounts';
import { attachScreenshot } from '../../../../utils/attachScreenshot';
import { applyZoom } from '../../../../utils/applyZoom';

export const sssState: {
  paymentConsole: PaymentConsolePage;
  transactionPage: TransactionPage;
  context: PaymentConsoleContext;
} = {
  paymentConsole: undefined as unknown as PaymentConsolePage,
  transactionPage: undefined as unknown as TransactionPage,
  context: paymentConsoleContext,
};

export function registerSssHooks() {
  // Backend post-Confirm can be slow to render the receipt — retries give the
  // specs headroom, same as the ECPay suite.
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !projectSupports(testInfo.project.name, 'SSS'),
      `${testInfo.project.name} has no SSS credential — skipping SSS suite`,
    );
    sssState.paymentConsole = new PaymentConsolePage(page);
    sssState.transactionPage = new TransactionPage(page);
    sssState.context = accountForProject(testInfo.project.name).paymentConsoleContext;
    await applyZoom(page, 0.5); // zoom out to 50% so wide tables/modals fit
    await page.goto('https://test-web-admin.billeroo.com/dashboard');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachScreenshot(testInfo, { page, label: 'final-page' });
  });
}

// Payment Console -> business name -> biller account -> service type ->
// search -> select the biller.
export async function navigateAndSelectBiller(biller: BillerConfig) {
  const { paymentConsole, context } = sssState;
  await test.step('Navigate to Payment Console', async () => {
    await paymentConsole.goToPaymentConsole();
    await paymentConsole.assertOnPaymentConsolePage();
  });
  await test.step('Select business name, biller account, and service type', async () => {
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
