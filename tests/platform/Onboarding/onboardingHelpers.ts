// tests/platform/Onboarding/onboardingHelpers.ts
//
// ==============================================================================
// ONBOARDING MODULE — SHARED HELPERS
// ==============================================================================
//
// Shared setup + flow helpers for the Onboarding module specs in this folder
// (merchant.spec.ts, account-credential.spec.ts, processor-credential.spec.ts).
//
// Onboarding entities are sequential with prerequisites:
//   Merchant (business) -> Account Credential -> Processor Credential
// so the credential specs reuse the merchant-onboarding helpers here to build
// their prerequisites before exercising their own concern.
//
// Cross-module helpers shared with the Agent module (completeAccountSetup,
// activateAgent, cleanupAgent) live in utils/onboardingCommon.ts.
//
// USAGE (in a spec):
//   import { registerOnboardingHooks, onbState, setQaseId, ... } from './onboardingHelpers';
//   registerOnboardingHooks();   // wires beforeEach/afterEach
//
// ==============================================================================

import { test, expect, type Page } from '@playwright/test';
import { attachScreenshot } from '../../../utils/attachScreenshot';
import { BlrLoginPage } from '../../../pages/blrAccountOnboardingPage/blrLoginPage';
import { OnboardingPage } from '../../../pages/PLATFORM(SUPERADMIN)/onboardingPage';
import { OnboardModulePage } from '../../../pages/blrAccountOnboardingPage/blrOnboardingModulePage';
import credentials from '../../../utils/decrypt';
import { fetchActivationEmail } from '../../../utils/fetchActivationEmail';
import { testCredentials } from '../../../utils/testData';
import { completeAccountSetup, ONBOARDING_BASE_URL } from '../../../utils/onboardingCommon';

export const BASE_URL = ONBOARDING_BASE_URL;

// Shared per-test state, mirroring the original onboarding.spec.ts module-level
// vars. Wrapped in an object so specs can mutate fields (e.g. push cleanup
// tasks, set the qase id) without import-binding issues.
export const onbState: {
  loginPage: BlrLoginPage;
  onboarding: OnboardingPage;
  currentPage: Page;
  currentQaseId: number;
  cleanupTasks: Array<() => Promise<void>>;
  authTokenForCleanup: string;
} = {
  loginPage: undefined as unknown as BlrLoginPage,
  onboarding: undefined as unknown as OnboardingPage,
  currentPage: undefined as unknown as Page,
  currentQaseId: 0,
  cleanupTasks: [],
  authTokenForCleanup: '',
};

export function setQaseId(id: number) {
  onbState.currentQaseId = id;
}

// Wires the shared per-test setup/teardown. Call once at the top of each
// Onboarding spec (before the describe block).
export function registerOnboardingHooks() {
  test.beforeEach(async ({ page }) => {
    onbState.currentPage = page;
    onbState.loginPage = new BlrLoginPage(page);
    onbState.onboarding = new OnboardingPage(page);
    onbState.currentQaseId = 0;
    onbState.cleanupTasks = [];
    onbState.authTokenForCleanup = '';

    page.on('request', request => {
      const auth = request.headers()['authorization'];
      if (auth?.startsWith('Bearer ')) onbState.authTokenForCleanup = auth;
    });

    // Test env pages can take upwards of a minute to render, so every test in
    // this module gets the extended timeout the slowest tests already used.
    test.setTimeout(180_000);

    // domcontentloaded + sidebar wait, not 'load'/networkidle: the dashboard
    // keeps polling indefinitely, so networkidle never fires.
    await page.goto('https://test-web-admin.billeroo.com/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.getByRole('link', { name: 'Dashboard' }).first().waitFor({ state: 'visible', timeout: 60_000 });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Screenshot first — before cleanup — so the capture shows the test's
    // final UI state, not the post-deletion state after cleanup runs.
    // Bundled under screenshots/<spec-slug>/ and attached to Playwright + Qase.
    const baseName = onbState.currentQaseId ? `BLR-${onbState.currentQaseId}` : undefined;
    await attachScreenshot(testInfo, { page, baseName, label: 'final-page' });

    for (const task of onbState.cleanupTasks) {
      try { await task(); } catch (e) { console.warn('[cleanup] failed:', e); }
    }
  });
}

// ==============================================================================
// MERCHANT-SPECIFIC HELPERS
// ==============================================================================

/**
 * Arms a listener for the merchant-creation POST and reads its JSON body the
 * moment the response arrives. Chromium evicts response bodies from its buffer
 * once the SPA moves on, so calling .json() after further UI steps races
 * against eviction and intermittently fails with
 * "Network.getResponseBody: No resource with given identifier found".
 */
export function waitForMerchantCreateBody(page: Page): Promise<any> {
  const bodyPromise = page
    .waitForResponse(
      resp =>
        resp.request().method() === 'POST' &&
        /\/business-category$/.test(new URL(resp.url()).pathname) &&
        resp.status() < 300,
      { timeout: 60_000 }
    )
    .then(resp => resp.json());
  // Mark the promise handled now: if the 60s timer fires while the form fill
  // is still in flight, an unattached rejection aborts the whole test
  // (closing the page) before the caller's catch can run.
  bodyPromise.catch(() => {});
  return bodyPromise;
}

export async function cleanupMerchant(page: Page, merchantId: string, searchTerm: string, token: string): Promise<void> {
  await page.request.patch(
    `${BASE_URL}/business-category/${merchantId}/deactivate`,
    { headers: { Authorization: token, 'Content-Type': 'application/json' }, timeout: 30000 }
  ).catch(() => {});
  const ob = new OnboardingPage(page);
  await ob.goToOnboarding();
  await ob.searchSpecificMerchant(searchTerm);
  await ob.clickDelete(searchTerm);
  await ob.confirmDelete();
}

/**
 * Onboards a fresh merchant, fetches its activation email, and completes account
 * setup. Retries with a brand-new email address when the activation link is stale
 * or rejected by the system (OTP flakiness), so each retry gets a fresh token.
 */
export async function retryOnboardAndActivate(
  page: Page,
  onboardModulePage: OnboardModulePage,
  loginPage: BlrLoginPage,
  creds: { username: string; password: string },
  maxAttempts = 2
): Promise<{ merchantEmail: string; merchantId: string; merchantName: string }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const merchantEmail = `apn.justineagner+${Date.now()}@gmail.com`;
    const beforeOnboard = new Date();

    try {
      const merchantCreateBodyPromise = waitForMerchantCreateBody(page);

      const { input: billerInput } = await onboardModulePage.onboardBillerWithValidEmail(merchantEmail);
      const merchantName = billerInput.businessName;

      const body = await merchantCreateBodyPromise;
      const merchantId: string = body.data?.merchantId ?? body.id ?? '';

      const activationEmail = await fetchActivationEmail(beforeOnboard, merchantEmail);
      expect(activationEmail.activationLink).not.toBeNull();
      await completeAccountSetup(page, activationEmail.activationLink!, setupPage =>
        new OnboardingPage(setupPage).fillAccountSetupDetails(
          testCredentials.merchantUsername(),
          testCredentials.defaultPassword,
          testCredentials.defaultPassword,
        )
      );

      return { merchantEmail, merchantId, merchantName };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        // Best-effort re-anchor — a failure here shouldn't mask lastError or
        // skip the remaining attempt; the next attempt surfaces any real issue.
        await loginPage.gotoLogin().catch(() => {});
        await loginPage.loginIfNeeded(creds).catch(() => {});
      }
    }
  }

  throw lastError;
}

// ==============================================================================
// PREREQUISITE-SETUP HELPERS — the onboarding chain
// ==============================================================================
// Onboarding entities are sequential: Merchant -> Account Credential ->
// Processor Credential. A credential spec needs the entities before it in the
// chain to exist before it can exercise its own concern. These helpers build
// those prerequisites via the same raw-API pattern already used inline in
// merchant.spec.ts's BLR-2722 (POST/GET/PATCH against the account-credential
// endpoints), so a credential spec can start from a known-good state without
// re-driving the whole UI onboarding flow.
//
// NOTE: setupMerchantWithAccountCredential is scaffolding for the not-yet-
// written account/processor credential specs — lift the exact create/activate
// calls into place and confirm the endpoints/response shapes live before
// relying on it. The account-credential create/list/activate calls below
// mirror what BLR-2722 does today.

/**
 * Onboards + activates a fresh merchant and returns its ids. Thin wrapper over
 * retryOnboardAndActivate so credential specs read as "set up the merchant
 * prerequisite" rather than repeating the onboarding call.
 *
 * Requires an OnboardModulePage and the current auth-token getter (the token
 * is captured by registerOnboardingHooks's request listener into
 * onbState.authTokenForCleanup, but a fresh token is best read live via a
 * getter after a navigation that triggers an authenticated request).
 */
export async function setupActivatedMerchant(
  page: Page,
  onboardModulePage: OnboardModulePage,
): Promise<{ merchantEmail: string; merchantId: string; merchantName: string }> {
  return retryOnboardAndActivate(page, onboardModulePage, onbState.loginPage, credentials);
}

/**
 * Builds the Merchant -> Account Credential prerequisite for processor-
 * credential tests. Creates + activates an account credential against a freshly
 * onboarded merchant via the raw API (same calls as BLR-2722). Returns the ids
 * needed to then create a processor credential on top.
 *
 * `getAuthToken` should return a live Bearer token — trigger an authenticated
 * navigation (e.g. onbState.onboarding.goToOnboarding()) first so the request
 * listener has captured a fresh one.
 */
export async function setupMerchantWithAccountCredential(
  page: Page,
  onboardModulePage: OnboardModulePage,
  getAuthToken: () => string,
  credentialName = 'test-credential',
): Promise<{ merchantId: string; merchantName: string; credentialId: string; credentialName: string }> {
  const { merchantId, merchantName } = await setupActivatedMerchant(page, onboardModulePage);

  // Refresh the captured token via an authenticated navigation before the API
  // calls (same reason BLR-2722 calls goToOnboarding before reading authToken).
  await onbState.onboarding.goToOnboarding();
  const token = getAuthToken();

  const credResp = await page.request.post(
    `${BASE_URL}/account-credential?merchantId=${merchantId}`,
    {
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      data: { name: credentialName, description: '', updateUrl: '' },
      timeout: 30000,
    }
  );
  expect(credResp.ok(), 'Account credential creation should succeed').toBeTruthy();

  const credListResp = await page.request.get(
    `${BASE_URL}/account-credential/list?merchantId=${merchantId}`,
    { headers: { Authorization: token }, timeout: 30000 }
  );
  const credListRaw = await credListResp.json();
  const credList = Array.isArray(credListRaw) ? credListRaw : (credListRaw.data ?? []);
  const credentialId: string = credList[0]?.uuid ?? credList[0]?.id ?? '';
  expect(credentialId, 'credentialId must be found in credential list').not.toBe('');

  const activateResp = await page.request.patch(
    `${BASE_URL}/account-credential/${credentialId}/activate`,
    { headers: { Authorization: token, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  expect(activateResp.ok(), 'Credential activation should succeed').toBeTruthy();

  return { merchantId, merchantName, credentialId, credentialName };
}
