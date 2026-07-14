// tests/platform/onboarding.spec.ts
//
// ==============================================================================
// ONBOARDING TEST SUITE
// ==============================================================================
//
// MERCHANT
// BLR-2714  Merchant creation is successful with valid data
// BLR-2715  Merchant details can be viewed successfully
// BLR-2716  Merchant update is successful with valid data
// BLR-2717  Merchant deletion is successful when no linked entities exist
// BLR-2718  Merchant creation fails when required fields are missing
// BLR-2719  Merchant creation fails when email already exists
// BLR-2720  Merchant update fails when required fields are missing
// BLR-2721  Merchant deletion is prevented when linked agents exist
// BLR-2722  Merchant deletion requires removal of linked agents before proceeding
// BLR-2723  Merchant activation is successful when in inactive state
// BLR-2724  Merchant deactivation is successful when active
// BLR-2725  Resend activation successfully triggers email
//
// AGENT
// BLR-2726  Agent creation is successful with valid data
// BLR-2727  Agent update is successful with valid data
// BLR-2728  Agent deletion is successful
// BLR-2729  Agent creation fails when name is empty
// BLR-2730  Agent creation fails when name exceeds maximum length
// BLR-2731  Agent creation prevents duplicate names
//
// ==============================================================================

import { test, expect, type Page } from '@playwright/test';
import { BlrLoginPage } from '../../pages/blrAccountOnboardingPage/blrLoginPage';
import { OnboardingPage } from '../../pages/PLATFORM(SUPERADMIN)/onboardingPage';
import { createDefaultAgentData } from '../../utils/businessData';
import { OnboardModulePage } from '../../pages/blrAccountOnboardingPage/blrOnboardingModulePage';
import { qase } from 'playwright-qase-reporter';
import credentials from '../../utils/decrypt';
import { faker } from '@faker-js/faker';
import { fetchActivationEmail, ACTIVATION_EMAIL_SUBJECT, ACTIVATION_EMAIL_SENDER } from '../../utils/fetchActivationEmail';
import { errorMessages, merchantData, testCredentials, agentTestMerchant } from '../../utils/testData';

// ==============================================================================
// CONSTANTS & CLEANUP STATE
// ==============================================================================

const BASE_URL = 'https://test-web-api.billeroo.com';
let cleanupTasks: Array<() => Promise<void>> = [];
let authTokenForCleanup = '';

// ==============================================================================
// HELPERS
// ==============================================================================

async function cleanupMerchant(page: Page, merchantId: string, searchTerm: string, token: string): Promise<void> {
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
 * Visits an activation link in a throwaway browser context so the admin
 * session in the test's own page is never abandoned. Completing account setup
 * in the main page logs the admin out, and the forced mid-run OTP re-login
 * revokes the storageState session every other test relies on — one bad
 * overlap and the rest of the run cascades onto the login page.
 */
async function completeAccountSetup(
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
async function activateAgent(page: Page, agentEmail: string, since: Date): Promise<void> {
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

async function cleanupAgent(page: Page, agentName: string, agentEmail: string, since: Date): Promise<void> {
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


/**
 * Onboards a fresh merchant, fetches its activation email, and completes account
 * setup. Retries with a brand-new email address when the activation link is stale
 * or rejected by the system (OTP flakiness), so each retry gets a fresh token.
 */
async function retryOnboardAndActivate(
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
// SETUP
// ==============================================================================

let loginPage: BlrLoginPage;
let onboarding: OnboardingPage;
let currentPage: Page;
let currentQaseId = 0;

test.beforeEach(async ({ page }) => {
  currentPage = page;
  loginPage  = new BlrLoginPage(page);
  onboarding = new OnboardingPage(page);
  cleanupTasks = [];
  authTokenForCleanup = '';

  page.on('request', request => {
    const auth = request.headers()['authorization'];
    if (auth?.startsWith('Bearer ')) authTokenForCleanup = auth;
  });

  // Test env pages can take upwards of a minute to render, so every test in
  // this file gets the extended timeout the slowest tests already used.
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
  // Screenshot first — before cleanup — so Qase shows the test's final UI state,
  // not the post-deletion state after cleanup runs.
  const screenshotName = currentQaseId
    ? `BLR-${currentQaseId}`
    : testInfo.title.replace(/\s+/g, '_');

  const screenshotPath = `screenshots/${screenshotName}.png`;

  await page.screenshot({ path: screenshotPath });

  await testInfo.attach(screenshotName, {
    path: screenshotPath,
    contentType: 'image/png',
  });

  for (const task of cleanupTasks) {
    try { await task(); } catch (e) { console.warn('[cleanup] failed:', e); }
  }
});

// ==============================================================================
// SHARED HELPERS
// ==============================================================================

/**
 * Arms a listener for the merchant-creation POST and reads its JSON body the
 * moment the response arrives. Chromium evicts response bodies from its buffer
 * once the SPA moves on, so calling .json() after further UI steps races
 * against eviction and intermittently fails with
 * "Network.getResponseBody: No resource with given identifier found".
 */
function waitForMerchantCreateBody(page: Page): Promise<any> {
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

// ==============================================================================
// MERCHANT TESTS
// ==============================================================================

test.describe('Merchant', () => {

  test(
    qase(2714, 'Merchant creation is successful with valid data'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      currentQaseId = 2714;

      const onboardModulePage = new OnboardModulePage(page);

      await test.step('Onboard a new merchant with valid data', async () => {
        const merchantCreateBodyPromise = waitForMerchantCreateBody(page);
        const { input, saved } = await onboardModulePage.onboardBiller();
        onboardModulePage.verifyMerchantDetails(input, saved);
        const body = await merchantCreateBodyPromise;
        const merchantId: string = body.data?.merchantId ?? body.id ?? '';
        if (merchantId) cleanupTasks.push(() => cleanupMerchant(page, merchantId, input.businessName, authTokenForCleanup));
      });
    }
  );

  test(
    qase(2715, 'Merchant details can be viewed successfully'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      currentQaseId = 2715;

      const onboardModulePage = new OnboardModulePage(page);
      let merchantName: string;

      await test.step('Create a merchant to view', async () => {
        const merchantCreateBodyPromise = waitForMerchantCreateBody(page);
        const { saved } = await onboardModulePage.onboardBiller();
        merchantName = saved.name;
        const body = await merchantCreateBodyPromise;
        const merchantId: string = body.data?.merchantId ?? body.id ?? '';
        if (merchantId) cleanupTasks.push(() => cleanupMerchant(page, merchantId, merchantName, authTokenForCleanup));
      });

      await test.step('Navigate to Onboarding and search for the merchant', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantName);
      });

      await test.step('Open the view modal', async () => {
        await onboarding.openViewModal();
      });

      await test.step('Verify the view modal is displayed', async () => {
        await onboarding.assertViewModalVisible();
      });
    }
  );

  test(
    qase(2716, 'Merchant update is successful with valid data'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      currentQaseId = 2716;

      const onboardModulePage = new OnboardModulePage(page);
      let merchantName: string;

      const updatedData = {
        businessName: `Test Business ${faker.string.alphanumeric(6).toUpperCase()} UPDATED`,
        addressLine1: faker.location.streetAddress(),
        city:         faker.location.city(),
        zipCode:      faker.location.zipCode('#####'),
        state:        faker.location.state(),
        supportEmail: faker.internet.email(),
        businessEmail: faker.internet.email(),
        phoneNumber:  faker.phone.number().replace(/\D/g, '').slice(0, 10),
      };

      await test.step('Create a merchant to update', async () => {
        const merchantCreateBodyPromise = waitForMerchantCreateBody(page);
        const { saved } = await onboardModulePage.onboardBiller();
        merchantName = saved.name;
        const body = await merchantCreateBodyPromise;
        const merchantId: string = body.data?.merchantId ?? body.id ?? '';
        if (merchantId) cleanupTasks.push(() => cleanupMerchant(page, merchantId, updatedData.businessName, authTokenForCleanup));
      });

      await test.step('Navigate to Onboarding and search for the merchant', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantName);
      });

      await test.step('Open the edit form and update all details', async () => {
        await onboarding.clickBusinessEdit();
        await onboarding.fillMerchantEditForm(updatedData);
      });

      await test.step('Save the updated merchant details', async () => {
        await onboarding.saveMerchantDetails();
      });

      await test.step('Verify the merchant was updated successfully', async () => {
        await onboarding.searchSpecificMerchant(updatedData.businessName);
        const saved = await onboardModulePage.getMerchantDetails(updatedData.businessName);
        expect(saved.name).toBe(updatedData.businessName);
      });
    }
  );

  test(
    qase(2717, 'Merchant deletion is successful when no linked entities exist'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      test.setTimeout(180_000);
      currentQaseId = 2717;

      let merchantEmail = '';
      const onboardModulePage = new OnboardModulePage(page);

      await test.step('Onboard and activate merchant account', async () => {
        ({ merchantEmail } = await retryOnboardAndActivate(
          page, onboardModulePage, loginPage, credentials
        ));
      });

      // Account setup runs in a separate context, so the admin session here is
      // still alive — loginIfNeeded is only a safety net and normally no-ops.
      await test.step('Ensure admin session is active', async () => {
        await loginPage.gotoLogin();
        await loginPage.loginIfNeeded(credentials);
      });

      await test.step('Search for the onboarded merchant', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantEmail);
      });

      await test.step('Deactivate the merchant', async () => {
        await onboarding.deactivateMerchant();
      });

      await test.step('Delete the merchant', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantEmail);
        await onboarding.clickDelete(merchantEmail);
        await onboarding.confirmDelete();
      });

      await test.step('Verify merchant is deleted', async () => {
        await onboarding.assertMerchantDeleted(merchantEmail);
      });
    }
  );

  test(
    qase(2718, 'Merchant creation fails when required fields are missing'),
    { tag: ['@regression'] },
    async ({ page }) => {
      currentQaseId = 2718;

      const onboardModulePage = new OnboardModulePage(page);

      await test.step('Open the Add New Business modal', async () => {
        await onboardModulePage.openAddNewBusinessModal();
      });

      await test.step('Submit without filling any required fields', async () => {
        await onboardModulePage.submitAddNewBusiness();
      });

      await test.step('Verify required field errors are shown', async () => {
        await onboardModulePage.assertRequiredFieldErrors();
      });
    }
  );

  test(
    qase(2719, 'Merchant creation fails when email already exists'),
    { tag: ['@regression'] },
    async ({ page }) => {
      currentQaseId = 2719;

      const onboardModulePage = new OnboardModulePage(page);

      await test.step('Open the Add New Business modal and fill all fields with duplicate email', async () => {
        await onboardModulePage.openAddNewBusinessModal();
        await onboardModulePage.fillNewBusinessForm(merchantData.existingMerchantEmail);
      });

      await test.step('Submit the form', async () => {
        await onboardModulePage.submitAddNewBusiness();
      });

      await test.step('Verify duplicate email error is shown', async () => {
        await onboarding.assertErrorMessage(errorMessages.EXISTING_EMAIL_MSG);
      });
    }
  );

  test(
    qase(2720, 'Merchant update fails when required fields are missing'),
    { tag: ['@regression'] },
    async ({ page }) => {
      currentQaseId = 2720;

      const onboardModulePage = new OnboardModulePage(page);
      let newMerchantName: string;

      await test.step('Onboard a new merchant', async () => {
        const merchantCreateBodyPromise = waitForMerchantCreateBody(page);
        const { saved } = await onboardModulePage.onboardBiller();
        newMerchantName = saved.name;
        const body = await merchantCreateBodyPromise;
        const merchantId: string = body.data?.merchantId ?? body.id ?? '';
        if (merchantId) cleanupTasks.push(() => cleanupMerchant(page, merchantId, newMerchantName, authTokenForCleanup));
      });

      await test.step('Search for the new merchant and open edit form', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(newMerchantName);
        await onboarding.clickBusinessEdit();
      });

      await test.step('Clear Business Name and attempt to save', async () => {
        await onboarding.clearBusinessNameInEdit();
        await onboarding.saveMerchantDetails();
      });

      await test.step('Verify Business Name required field error is shown', async () => {
        await onboarding.assertErrorMessage(errorMessages.REQUIRED_FIELD_MSG);
      });
    }
  );

  test(
    qase(2721, 'Merchant deletion is prevented when linked SYSTEM users exist'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 2721;

      await test.step('Navigate to Onboarding and search for merchant with linked agents', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantData.merchantWithLinkedAgents);
      });

      await test.step('Attempt to delete the merchant', async () => {
        await onboarding.clickDelete(merchantData.merchantWithLinkedAgents);
        await onboarding.confirmDelete();
      });

      await test.step('Verify deletion is blocked with an error message', async () => {
        await onboarding.assertMerchantNotDeleted(merchantData.merchantSystemUsersMessage);
      });
    }
  );

  test(
    qase(2722, 'Merchant deletion requires removal of linked agents before proceeding'),
    { tag: ['@regression'] },
    async ({ page }) => {
      test.setTimeout(180_000);
      currentQaseId = 2722;

      let merchantEmail  = '';
      let merchantName   = '';
      const onboardModulePage = new OnboardModulePage(page);

      let authToken    = '';
      let merchantId   = '';
      let credentialId = '';
      let agentName    = '';
      let agentEmail   = '';
      let agentCreatedAt = new Date();
      let merchantDeleted = false;

      page.on('request', request => {
        const auth = request.headers()['authorization'];
        if (auth?.startsWith('Bearer ')) authToken = auth;
      });

      await test.step('Onboard and activate merchant account', async () => {
        ({ merchantEmail, merchantId, merchantName } = await retryOnboardAndActivate(
          page, onboardModulePage, loginPage, credentials
        ));
        expect(merchantId, 'merchantId must be captured from merchant creation response').not.toBe('');
        cleanupTasks.push(async () => {
          if (agentName) await cleanupAgent(page, agentName, agentEmail, agentCreatedAt);
          if (!merchantDeleted) await cleanupMerchant(page, merchantId, merchantEmail, authTokenForCleanup);
        });
      });

      // Account setup runs in a separate context, so the admin session here is
      // still alive — loginIfNeeded is only a safety net and normally no-ops.
      await test.step('Ensure admin session is active', async () => {
        await loginPage.gotoLogin();
        await loginPage.loginIfNeeded(credentials);
        await onboarding.goToOnboarding();
      });

      await test.step('Create and activate account credential', async () => {
        const credResp = await page.request.post(
          `${BASE_URL}/account-credential?merchantId=${merchantId}`,
          {
            headers: { Authorization: authToken, 'Content-Type': 'application/json' },
            data: { name: 'test-credential', description: '', updateUrl: '' },
            timeout: 30000,
          }
        );
        expect(credResp.ok(), 'Account credential creation should succeed').toBeTruthy();

        const credListResp = await page.request.get(
          `${BASE_URL}/account-credential/list?merchantId=${merchantId}`,
          { headers: { Authorization: authToken }, timeout: 30000 }
        );
        const credListRaw = await credListResp.json();
        const credList = Array.isArray(credListRaw) ? credListRaw : (credListRaw.data ?? []);
        credentialId = credList[0]?.uuid ?? credList[0]?.id ?? '';
        expect(credentialId, 'credentialId must be found in credential list').not.toBe('');

        const activateResp = await page.request.patch(
          `${BASE_URL}/account-credential/${credentialId}/activate`,
          { headers: { Authorization: authToken, 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        expect(activateResp.ok(), 'Credential activation should succeed').toBeTruthy();
      });

      await test.step('Create agent via UI', async () => {
        const agentData = createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`);
        agentCreatedAt = new Date();
        await onboarding.goToAgentModule();
        await onboarding.addAgent({ ...agentData, merchant: merchantName, credential: 'test-credential' });
        await onboarding.assertSuccessMessage('Agent added successfully');
        agentName = agentData.name;
        agentEmail = agentData.email;
      });

      await test.step('Deactivate the merchant', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantEmail);
        await onboarding.deactivateMerchant();
      });

      await test.step('Attempt to delete the merchant with active agent', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantEmail);
        await onboarding.clickDelete(merchantEmail);
        await onboarding.confirmDelete();
      });

      await test.step('Verify deletion is blocked with an error message', async () => {
        await onboarding.assertMerchantNotDeleted(merchantData.merchantDeletionUnsuccessfulMessage);
      });

      await test.step('Activate and delete linked agent', async () => {
        await onboarding.closeOpenDeleteModal();
        await activateAgent(page, agentEmail, agentCreatedAt);
        await onboarding.goToAgentModule();
        await onboarding.searchAgent(agentName);
        await onboarding.deactivateAgent(agentName);
        await onboarding.clickAgentDelete(agentName);
        await onboarding.confirmAgentDelete();
        agentName = '';
      });

      await test.step('Delete the merchant after agent is removed', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantEmail);
        await onboarding.clickDelete(merchantEmail);
        await onboarding.confirmDelete();
        merchantDeleted = true;
      });

      await test.step('Verify merchant is deleted', async () => {
        await onboarding.assertMerchantDeleted(merchantEmail);
      });
    }
  );

  test(
    qase(2723, 'Merchant activation is successful when in inactive state'),
    { tag: ['@regression'] },
    async ({ page }) => {
      test.setTimeout(180_000);
      currentQaseId = 2723;

      const merchantEmail = `apn.justineagner+${Date.now()}@gmail.com`;
      const onboardModulePage = new OnboardModulePage(page);
      let authToken  = '';
      let merchantId = '';

      page.on('request', request => {
        const auth = request.headers()['authorization'];
        if (auth?.startsWith('Bearer ')) authToken = auth;
      });

      const merchantCreateBodyPromise = waitForMerchantCreateBody(page);

      await test.step('Create a fresh merchant', async () => {
        await onboardModulePage.onboardBillerWithValidEmail(merchantEmail);
        const body = await merchantCreateBodyPromise;
        merchantId = body.data?.merchantId ?? body.id ?? '';
        expect(merchantId, 'merchantId must be captured from merchant creation response').not.toBe('');
        cleanupTasks.push(() => cleanupMerchant(page, merchantId, merchantEmail, authTokenForCleanup));
      });

      await test.step('Activate the merchant via API', async () => {
        await onboarding.goToOnboarding(); // triggers API calls → refreshes authToken
        const activateResp = await page.request.patch(
          `${BASE_URL}/business-category/${merchantId}/activate`,
          { headers: { Authorization: authToken, 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        expect(activateResp.ok(), 'Merchant API activation should succeed').toBeTruthy();
      });

      await test.step('Search for the merchant and deactivate it', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantEmail);
        await onboarding.deactivateMerchant();
      });

      await test.step('Activate the merchant from inactive state', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantEmail);
        await onboarding.activateMerchant(); // asserts success toast internally
      });
    }
  );

  test(
    qase(2724, 'Merchant deactivation is successful when active'),
    { tag: ['@regression'] },
    async ({ page }) => {
      currentQaseId = 2724;

      const merchantEmail = `apn.justineagner+${Date.now()}@gmail.com`;
      const onboardModulePage = new OnboardModulePage(page);
      let authToken  = '';
      let merchantId = '';

      page.on('request', request => {
        const auth = request.headers()['authorization'];
        if (auth?.startsWith('Bearer ')) authToken = auth;
      });

      const merchantCreateBodyPromise = waitForMerchantCreateBody(page);

      await test.step('Create a fresh merchant', async () => {
        await onboardModulePage.onboardBillerWithValidEmail(merchantEmail);
        const body = await merchantCreateBodyPromise;
        merchantId = body.data?.merchantId ?? body.id ?? '';
        expect(merchantId, 'merchantId must be captured from merchant creation response').not.toBe('');
        cleanupTasks.push(() => cleanupMerchant(page, merchantId, merchantEmail, authTokenForCleanup));
      });

      await test.step('Activate the merchant via API', async () => {
        await onboarding.goToOnboarding(); // triggers API calls → refreshes authToken
        const activateResp = await page.request.patch(
          `${BASE_URL}/business-category/${merchantId}/activate`,
          { headers: { Authorization: authToken, 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        expect(activateResp.ok(), 'Merchant API activation should succeed').toBeTruthy();
      });

      await test.step('Search for the merchant and deactivate it', async () => {
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(merchantEmail);
        await onboarding.deactivateMerchant(); // asserts success toast internally
      });
    }
  );

  test(
    qase(2725, 'Resend activation successfully triggers email'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      test.setTimeout(180_000);
      currentQaseId = 2725;

      const testEmail = `apn.justineagner+${Date.now()}@gmail.com`;
      // Capture before merchant creation so the timestamp predates all emails
      // sent to this unique address — both initial onboarding and resend.
      const beforeResend = new Date();

      await test.step('Onboard a new merchant and search for it', async () => {
        const onboardModulePage = new OnboardModulePage(page);
        const merchantCreateBodyPromise = waitForMerchantCreateBody(page);
        await onboardModulePage.onboardBillerWithValidEmail(testEmail);
        const body = await merchantCreateBodyPromise;
        const merchantId: string = body.data?.merchantId ?? body.id ?? '';
        if (merchantId) cleanupTasks.push(() => cleanupMerchant(page, merchantId, testEmail, authTokenForCleanup));
        await onboarding.goToOnboarding();
        await onboarding.searchSpecificMerchant(testEmail);
      });

      await test.step('Open the view modal and click Resend Activation', async () => {
        await onboarding.openViewModal();
        await onboarding.resendActivationEmail();
      });

      await test.step('Verify activation email is received with correct details', async () => {
        const email = await fetchActivationEmail(beforeResend, testEmail);
        expect(email.toAddress.toLowerCase()).toContain(testEmail.toLowerCase());
        expect(email.subject).toBe(ACTIVATION_EMAIL_SUBJECT);
        expect(email.fromAddress.toLowerCase()).toContain(ACTIVATION_EMAIL_SENDER);
        expect(email.activationLink).not.toBeNull();
      });
    }
  );

 });

// ==============================================================================
// AGENT TESTS
// ==============================================================================

test.describe.serial('Agent', () => {

  test(
    qase(2726, 'Agent creation is successful with valid data'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 2726;

      const merchantName = agentTestMerchant.name;
      let agentName = '';
      let agentEmail = '';
      let agentCreatedAt = new Date();

      cleanupTasks.push(async () => {
        if (agentName) await cleanupAgent(currentPage, agentName, agentEmail, agentCreatedAt);
      });

      const agentData2726 = createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`);

      await test.step('Navigate to the Agent module', async () => {
        await onboarding.goToAgentModule();
      });

      await test.step('Open Add Agent modal and fill form with valid data', async () => {
        await onboarding.openAddAgentModal();
        await onboarding.fillAddAgentForm({ ...agentData2726, merchant: merchantName, credential: agentTestMerchant.credential });
      });

      await test.step('Submit the Add Agent form', async () => {
        agentCreatedAt = new Date();
        await onboarding.submitAddAgent();
      });

      await test.step('Verify agent was created successfully', async () => {
        await onboarding.assertSuccessMessage('Agent added successfully');
        agentName = agentData2726.name;
        agentEmail = agentData2726.email;
      });
    }
  );

  test(
    qase(2727, 'Agent update is successful with valid data'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 2727;

      const merchantName = agentTestMerchant.name;
      let originalAgentName = '';
      let agentCurrentName  = '';
      let agentEmail = '';
      let agentCreatedAt = new Date();
      const updatedName = `Test Agent ${faker.string.alpha(6).toUpperCase()} UPDATED`;
      const updatedAddressLine1 = `${faker.location.streetAddress()} UPDATED`;
      const updatedState = `${faker.location.state()} UPDATED`;

      cleanupTasks.push(async () => {
        if (agentCurrentName) await cleanupAgent(currentPage, agentCurrentName, agentEmail, agentCreatedAt);
      });

      await test.step('Navigate to Agent module and create agent via UI', async () => {
        const agentData = createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`);
        originalAgentName = agentData.name;
        agentEmail = agentData.email;
        agentCreatedAt = new Date();
        await onboarding.goToAgentModule();
        await onboarding.addAgent({ ...agentData, merchant: merchantName, credential: agentTestMerchant.credential });
        await onboarding.assertSuccessMessage('Agent added successfully');
        agentCurrentName = agentData.name;
      });

      await test.step('Search for the agent', async () => {
        await onboarding.searchAgent(originalAgentName);
      });

      await test.step('Open edit form', async () => {
        await onboarding.clickAgentEdit();
      });

      await test.step('Verify Business and Account Credential are not editable', async () => {
        await onboarding.assertAgentBusinessAndCredentialNotEditable();
      });

      await test.step('Verify Address/Contact/Network Information fields are editable', async () => {
        await onboarding.assertAgentEditableFieldsAreEditable();
      });

      await test.step('Update agent name, address line 1, and state', async () => {
        await onboarding.fillAgentNameInEdit(updatedName);
        await onboarding.fillAgentAddressLine1InEdit(updatedAddressLine1);
        await onboarding.fillAgentStateInEdit(updatedState);
      });

      await test.step('Save the updated agent', async () => {
        await onboarding.saveAgent();
        agentCurrentName = updatedName;
      });

      await test.step('Verify agent name was updated successfully', async () => {
        await onboarding.searchAgent(updatedName);
        await onboarding.assertAgentVisible(updatedName);
      });
    }
  );

  test(
    qase(2728, 'Agent deletion is successful'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 2728;

      const merchantName = agentTestMerchant.name;
      let agentName = '';
      let agentEmail = '';
      let agentCreatedAt = new Date();

      cleanupTasks.push(async () => {
        if (agentName) await cleanupAgent(currentPage, agentName, agentEmail, agentCreatedAt);
      });

      await test.step('Navigate to Agent module and create agent via UI', async () => {
        const agentData = createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`);
        agentCreatedAt = new Date();
        await onboarding.goToAgentModule();
        await onboarding.addAgent({ ...agentData, merchant: merchantName, credential: agentTestMerchant.credential });
        await onboarding.assertSuccessMessage('Agent added successfully');
        agentName = agentData.name;
        agentEmail = agentData.email;
      });

      await test.step('Activate the agent account', async () => {
        await activateAgent(currentPage, agentEmail, agentCreatedAt);
      });

      await test.step('Search for the agent', async () => {
        await onboarding.goToAgentModule();
        await onboarding.searchAgent(agentName);
      });

      await test.step('Deactivate the agent', async () => {
        await onboarding.deactivateAgent(agentName);
      });

      const deletedAgentName = agentName;

      await test.step('Delete the agent', async () => {
        await onboarding.clickAgentDelete(agentName);
        await onboarding.confirmAgentDelete();
        agentName = ''; // already deleted — skip redundant cleanup
      });

      await test.step('Verify agent is deleted', async () => {
        await onboarding.assertAgentDeleted(deletedAgentName);
      });
    }
  );

  test(
    qase(2729, 'Agent creation fails when name is empty'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 2729;

      const merchantName = agentTestMerchant.name;

      await test.step('Navigate to the Agent module', async () => {
        await onboarding.goToAgentModule();
      });

      await test.step('Open Add Agent modal, fill all fields, then clear the name', async () => {
        const agentData = createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`);
        await onboarding.openAddAgentModal();
        await onboarding.fillAddAgentForm({ ...agentData, merchant: merchantName, credential: agentTestMerchant.credential });
        await onboarding.clearAgentNameInEdit();
      });

      await test.step('Submit the form', async () => {
        await onboarding.submitAddAgent();
      });

      await test.step('Verify required field error is shown for name', async () => {
        await onboarding.assertErrorMessage(errorMessages.REQUIRED_FIELD_MSG);
      });
    }
  );

  test(
    qase(2730, 'Agent creation fails when name exceeds maximum length'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 2730;

      await test.step('Navigate to the Agent module', async () => {
        await onboarding.goToAgentModule();
      });

      await test.step('Open Add Agent modal and fill name with 101 characters', async () => {
        await onboarding.openAddAgentModal();
        await onboarding.fillAgentName(faker.string.alpha(101));
      });

      await test.step('Submit the form', async () => {
        await onboarding.submitAddAgent();
      });

      await test.step('Verify maximum length error is shown for name', async () => {
        await onboarding.assertErrorMessage(errorMessages.EXCEEDEDCHAR_100_MSG);
      });
    }
  );

  // test(
  //   qase(2731, 'Agent creation prevents duplicate names'),
  //   { tag: ['@regression'] },
  //   async ({ page }) => {
  //     currentQaseId = 2731;

  //     const onboardModulePage = new OnboardModulePage(page);
  //     let authToken = '';
  //     let merchantId = '';
  //     let merchantName = '';
  //     let credentialName = '';
  //     let agentName = '';
  //     let agentEmail = '';
  //     let agentCreatedAt = new Date();

  //     page.on('request', request => {
  //       const auth = request.headers()['authorization'];
  //       if (auth?.startsWith('Bearer ')) authToken = auth;
  //     });

  //     await test.step('Set up merchant with active credential', async () => {
  //       ({ merchantId, merchantName, credentialName } = await setupMerchantAndCredential(
  //         page, onboardModulePage, () => authToken
  //       ));
  //       cleanupTasks.push(async () => {
  //         if (agentName) await cleanupAgent(page, agentName, agentEmail, agentCreatedAt);
  //         await cleanupMerchant(page, merchantId, merchantName, authTokenForCleanup);
  //       });
  //     });

  //     const agentData = createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`);

  //     await test.step('Navigate to Agent module and create the first agent', async () => {
  //       agentCreatedAt = new Date();
  //       await onboarding.goToAgentModule();
  //       await onboarding.openAddAgentModal();
  //       await onboarding.fillAddAgentForm({ ...agentData, merchant: merchantName, credential: credentialName });
  //       await onboarding.submitAddAgent();
  //       await onboarding.assertSuccessMessage('Agent added successfully');
  //       agentName = agentData.name;
  //       agentEmail = agentData.email;
  //     });

  //     await test.step('Open Add Agent modal and fill with the same name but a new email', async () => {
  //       const duplicateNameAgentData = {
  //         ...createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`),
  //         name: agentData.name,
  //       };
  //       await onboarding.openAddAgentModal();
  //       await onboarding.fillAddAgentForm({ ...duplicateNameAgentData, merchant: merchantName, credential: credentialName });
  //     });

  //     await test.step('Submit the form', async () => {
  //       await onboarding.submitAddAgent();
  //     });

  //     await test.step('Verify duplicate name error is shown', async () => {
  //       await onboarding.assertErrorMessage(errorMessages.DUPLICATE_AGENT_NAME_MSG);
  //     });
  //   }
  // );

});
