// utils/onboardingCommon.ts
//
// ==============================================================================
// ONBOARDING / AGENT — CROSS-MODULE SHARED HELPERS
// ==============================================================================
//
// Helpers used by BOTH the Onboarding (merchant/credential) and Agent test
// modules. They're pure functions that take a Page, so they don't belong to
// either module's shared-state helper file — they live here so neither module
// owns them and there's no duplication.
//
//   completeAccountSetup  — visit an activation link in a throwaway context
//   activateAgent         — fetch + activate an agent's account-setup email
//   cleanupAgent          — best-effort teardown of an agent
//
// Merchant-specific helpers (cleanupMerchant, retryOnboardAndActivate,
// waitForMerchantCreateBody) live in tests/platform/Onboarding/onboardingHelpers.ts
// since only the Onboarding module uses them.
//
// ==============================================================================

import { expect, type Page } from '@playwright/test';
import { BlrLoginPage } from '../pages/blrAccountOnboardingPage/blrLoginPage';
import { OnboardingPage } from '../pages/PLATFORM(SUPERADMIN)/onboardingPage';
import credentials from './decrypt';
import { fetchActivationEmail } from './fetchActivationEmail';
import { testCredentials } from './testData';

export const ONBOARDING_BASE_URL = 'https://test-web-api.billeroo.com';

/**
 * Visits an activation link in a throwaway browser context so the admin
 * session in the test's own page is never abandoned. Completing account setup
 * in the main page logs the admin out, and the forced mid-run OTP re-login
 * revokes the storageState session every other test relies on — one bad
 * overlap and the rest of the run cascades onto the login page.
 */
export async function completeAccountSetup(
  page: Page,
  activationLink: string,
  fill: (setupPage: Page) => Promise<void>,
): Promise<void> {
  const browser = page.context().browser();
  if (!browser) throw new Error('completeAccountSetup requires a browser-backed page');
  const context = await browser.newContext();
  const setupPage = await context.newPage();
  try {
    await setupPage.goto(activationLink);
    await fill(setupPage);
  } finally {
    await context.close();
  }
}

/**
 * Agents stay in "NEW" status — with no Delete action available — until the
 * agent's account-setup email is activated, mirroring merchant onboarding.
 */
export async function activateAgent(page: Page, agentEmail: string, since: Date): Promise<void> {
  const activationEmail = await fetchActivationEmail(since, agentEmail);
  expect(activationEmail.activationLink, 'Agent activation link must be present').not.toBeNull();
  await completeAccountSetup(page, activationEmail.activationLink!, setupPage =>
    new OnboardingPage(setupPage).fillAgentAccountSetupDetails(
      testCredentials.agentUsername(),
      testCredentials.defaultPassword,
      testCredentials.defaultPassword,
    )
  );
}

export async function cleanupAgent(page: Page, agentName: string, agentEmail: string, since: Date): Promise<void> {
  const login = new BlrLoginPage(page);
  const ob = new OnboardingPage(page);
  await activateAgent(page, agentEmail, since).catch(() => {});
  await login.gotoLogin();
  await login.loginIfNeeded(credentials);
  await ob.goToAgentModule();
  await ob.searchAgent(agentName);
  await ob.deactivateAgent(agentName).catch(() => {});
  await ob.clickAgentDelete(agentName).catch(() => {});
  await ob.confirmAgentDelete().catch(() => {});
}
