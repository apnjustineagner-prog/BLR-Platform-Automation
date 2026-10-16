// tests/platform/Payment Link/SWB/sss-input-prn.spec.ts
//
// ==============================================================================
// PAYMENT LINK — STATIC WEB BILLER (SWB) — SSS — MANUAL PRN INPUT
// ==============================================================================
//
// TESTS:
//   Navigation   Open the SWB SSS PRN input link -> PRN input page renders
//   Happy path   Valid unpaid PRN -> Payment Checkout Summary (stops before
//                payment, so the PRN is NOT used up)
//   Negative     Blank PRN is blocked by the required field (stays on /inputprn)
//
// The SWB link is a public consumer page, so these tests run as a fresh
// visitor (no admin session) — the welcome + cookie modals are dismissed if
// they show.
//
// Run: npx playwright test "tests/platform/Payment Link/SWB" --project=chromium-admin --no-deps
//
// ==============================================================================

import { test, expect } from '@playwright/test';
import { SwbSssPage } from '../../../../pages/PLATFORM(SUPERADMIN)/swbSssPage';
import { attachScreenshot } from '../../../../utils/attachScreenshot';
import { swbSssInputPrnUrl as SWB_SSS_INPUT_PRN_URL, swbSssAvailablePrns } from '../../../../utils/paymentLinkData';

// Public page — browse as a fresh visitor, not with the admin session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Payment Link — SWB — SSS — Manual PRN input', () => {
  let swb: SwbSssPage;

  test.beforeEach(async ({ page }) => {
    swb = new SwbSssPage(page);
    await swb.openInputPrn(SWB_SSS_INPUT_PRN_URL);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachScreenshot(testInfo, { page, label: 'final-page' });
  });

  test('PRN input link opens the PRN input page', { tag: ['@smoke', '@regression'] }, async ({ page }, testInfo) => {
    await test.step('Verify the PRN input page', async () => {
      await swb.assertOnInputPrnPage(SWB_SSS_INPUT_PRN_URL);
      await attachScreenshot(testInfo, { page, label: 'input-prn' });
    });
  });

  test('Valid PRN shows the Payment Checkout Summary', { tag: ['@smoke', '@regression'] }, async ({ page }, testInfo) => {
    const expected = swbSssAvailablePrns[0];
    await test.step(`Enter PRN ${expected.prn} and click Next`, async () => {
      await swb.fillPrn(expected.prn);
      await swb.clickNext();
    });
    await test.step('Verify the Payment Checkout Summary details', async () => {
      await swb.assertCheckoutSummary(expected);
      await attachScreenshot(testInfo, { page, label: 'checkout-summary' });
    });
  });

  test('Blank PRN is blocked by the required field', { tag: ['@regression'] }, async ({ page }) => {
    await swb.assertOnInputPrnPage(SWB_SSS_INPUT_PRN_URL);
    await test.step('Click Next with PRN blank', async () => {
      await swb.clickNext();
    });
    await test.step('Verify it stays on /inputprn with the field invalid', async () => {
      await expect(page).toHaveURL(SWB_SSS_INPUT_PRN_URL);
      expect(
        await swb.prnInput.evaluate((el) => (el as { validity: { valueMissing: boolean } }).validity.valueMissing),
        'PRN field should report a missing required value',
      ).toBe(true);
    });
  });
});
