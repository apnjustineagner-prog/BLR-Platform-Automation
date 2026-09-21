// tests/platform/Onboarding/merchant.spec.ts
//
// ==============================================================================
// ONBOARDING — MERCHANT (BUSINESS)
// ==============================================================================
//
// First entity in the onboarding chain (Merchant -> Account Credential ->
// Processor Credential). Shared setup/flow lives in ./onboardingHelpers.ts;
// cross-module helpers in utils/onboardingCommon.ts.
//
// TEST CASES COVERED:
//   BLR-2714  Merchant creation is successful with valid data
//   BLR-2715  Merchant details can be viewed successfully
//   BLR-2716  Merchant update is successful with valid data
//   BLR-2717  Merchant deletion is successful when no linked entities exist
//   BLR-2718  Merchant creation fails when required fields are missing
//   BLR-2719  Merchant creation fails when email already exists
//   BLR-2720  Merchant update fails when required fields are missing
//   BLR-2721  Merchant deletion is prevented when linked SYSTEM users exist
//   BLR-2722  Merchant deletion requires removal of linked agents before proceeding
//   BLR-2723  Merchant activation is successful when in inactive state
//   BLR-2724  Merchant deactivation is successful when active
//   BLR-2725  Resend activation successfully triggers email
//
// Run: npx playwright test "tests/platform/Onboarding/merchant.spec.ts"
//
// ==============================================================================

import { test, expect } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import { OnboardModulePage } from '../../../pages/blrAccountOnboardingPage/blrOnboardingModulePage';
import credentials from '../../../utils/decrypt';
import { faker } from '@faker-js/faker';
import { fetchActivationEmail, ACTIVATION_EMAIL_SUBJECT, ACTIVATION_EMAIL_SENDER } from '../../../utils/fetchActivationEmail';
import { errorMessages, merchantData, testCredentials } from '../../../utils/testData';
import { createDefaultAgentData } from '../../../utils/businessData';
import { activateAgent, cleanupAgent } from '../../../utils/onboardingCommon';
import {
  registerOnboardingHooks,
  setQaseId,
  onbState,
  BASE_URL,
  waitForMerchantCreateBody,
  cleanupMerchant,
  retryOnboardAndActivate,
} from './onboardingHelpers';

registerOnboardingHooks();

test.describe('Merchant', () => {

  test(
    qase(2714, 'Merchant creation is successful with valid data'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      setQaseId(2714);

      const onboardModulePage = new OnboardModulePage(page);

      await test.step('Onboard a new merchant with valid data', async () => {
        const merchantCreateBodyPromise = waitForMerchantCreateBody(page);
        const { input, saved } = await onboardModulePage.onboardBiller();
        onboardModulePage.verifyMerchantDetails(input, saved);
        const body = await merchantCreateBodyPromise;
        const merchantId: string = body.data?.merchantId ?? body.id ?? '';
        if (merchantId) onbState.cleanupTasks.push(() => cleanupMerchant(page, merchantId, input.businessName, onbState.authTokenForCleanup));
      });
    }
  );

  test(
    qase(2715, 'Merchant details can be viewed successfully'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      setQaseId(2715);

      const onboardModulePage = new OnboardModulePage(page);
      let merchantName: string;

      await test.step('Create a merchant to view', async () => {
        const merchantCreateBodyPromise = waitForMerchantCreateBody(page);
        const { saved } = await onboardModulePage.onboardBiller();
        merchantName = saved.name;
        const body = await merchantCreateBodyPromise;
        const merchantId: string = body.data?.merchantId ?? body.id ?? '';
        if (merchantId) onbState.cleanupTasks.push(() => cleanupMerchant(page, merchantId, merchantName, onbState.authTokenForCleanup));
      });

      await test.step('Navigate to Onboarding and search for the merchant', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantName);
      });

      await test.step('Open the view modal', async () => {
        await onbState.onboarding.openViewModal(merchantName);
      });

      await test.step('Verify the view modal is displayed', async () => {
        await onbState.onboarding.assertViewModalVisible();
      });
    }
  );

  test(
    qase(2716, 'Merchant update is successful with valid data'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      setQaseId(2716);

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
        if (merchantId) onbState.cleanupTasks.push(() => cleanupMerchant(page, merchantId, updatedData.businessName, onbState.authTokenForCleanup));
      });

      await test.step('Navigate to Onboarding and search for the merchant', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantName);
      });

      await test.step('Open the edit form and update all details', async () => {
        await onbState.onboarding.clickBusinessEdit(merchantName);
        await onbState.onboarding.fillMerchantEditForm(updatedData);
      });

      await test.step('Save the updated merchant details', async () => {
        await onbState.onboarding.saveMerchantDetails();
      });

      await test.step('Verify the merchant was updated successfully', async () => {
        await onbState.onboarding.searchSpecificMerchant(updatedData.businessName);
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
      setQaseId(2717);

      let merchantEmail = '';
      const onboardModulePage = new OnboardModulePage(page);

      await test.step('Onboard and activate merchant account', async () => {
        ({ merchantEmail } = await retryOnboardAndActivate(
          page, onboardModulePage, onbState.loginPage, credentials
        ));
      });

      // Account setup runs in a separate context, so the admin session here is
      // still alive — loginIfNeeded is only a safety net and normally no-ops.
      await test.step('Ensure admin session is active', async () => {
        await onbState.loginPage.gotoLogin();
        await onbState.loginPage.loginIfNeeded(credentials);
      });

      await test.step('Search for the onboarded merchant', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantEmail);
      });

      await test.step('Deactivate the merchant', async () => {
        await onbState.onboarding.deactivateMerchant(merchantEmail);
      });

      await test.step('Delete the merchant', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantEmail);
        await onbState.onboarding.clickDelete(merchantEmail);
        await onbState.onboarding.confirmDelete();
      });

      await test.step('Verify merchant is deleted', async () => {
        await onbState.onboarding.assertMerchantDeleted(merchantEmail);
      });
    }
  );

  test(
    qase(2718, 'Merchant creation fails when required fields are missing'),
    { tag: ['@regression'] },
    async ({ page }) => {
      setQaseId(2718);

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
      setQaseId(2719);

      const onboardModulePage = new OnboardModulePage(page);

      await test.step('Open the Add New Business modal and fill all fields with duplicate email', async () => {
        await onboardModulePage.openAddNewBusinessModal();
        await onboardModulePage.fillNewBusinessForm(merchantData.existingMerchantEmail);
      });

      await test.step('Submit the form', async () => {
        await onboardModulePage.submitAddNewBusiness();
      });

      await test.step('Verify duplicate email error is shown', async () => {
        await onbState.onboarding.assertErrorMessage(errorMessages.EXISTING_EMAIL_MSG);
      });
    }
  );

  test(
    qase(2720, 'Merchant update fails when required fields are missing'),
    { tag: ['@regression'] },
    async ({ page }) => {
      setQaseId(2720);

      const onboardModulePage = new OnboardModulePage(page);
      let newMerchantName: string;

      await test.step('Onboard a new merchant', async () => {
        const merchantCreateBodyPromise = waitForMerchantCreateBody(page);
        const { saved } = await onboardModulePage.onboardBiller();
        newMerchantName = saved.name;
        const body = await merchantCreateBodyPromise;
        const merchantId: string = body.data?.merchantId ?? body.id ?? '';
        if (merchantId) onbState.cleanupTasks.push(() => cleanupMerchant(page, merchantId, newMerchantName, onbState.authTokenForCleanup));
      });

      await test.step('Search for the new merchant and open edit form', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(newMerchantName);
        await onbState.onboarding.clickBusinessEdit(newMerchantName);
      });

      await test.step('Clear Business Name and attempt to save', async () => {
        await onbState.onboarding.clearBusinessNameInEdit();
        await onbState.onboarding.saveMerchantDetails();
      });

      await test.step('Verify Business Name required field error is shown', async () => {
        await onbState.onboarding.assertErrorMessage(errorMessages.REQUIRED_FIELD_MSG);
      });
    }
  );

  test(
    qase(2721, 'Merchant deletion is prevented when linked SYSTEM users exist'),
    { tag: ['@regression'] },
    async () => {
      setQaseId(2721);

      await test.step('Navigate to Onboarding and search for merchant with linked agents', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantData.merchantWithLinkedAgents);
      });

      await test.step('Attempt to delete the merchant', async () => {
        await onbState.onboarding.clickDelete(merchantData.merchantWithLinkedAgents);
        await onbState.onboarding.confirmDelete();
      });

      await test.step('Verify deletion is blocked with an error message', async () => {
        await onbState.onboarding.assertMerchantNotDeleted(merchantData.merchantSystemUsersMessage);
      });
    }
  );

  test(
    qase(2722, 'Merchant deletion requires removal of linked agents before proceeding'),
    { tag: ['@regression'] },
    async ({ page }) => {
      // Heaviest test in the suite (OTP re-login, 2 raw API calls, UI agent
      // creation, deactivate, blocked-delete assertion, reactivate+delete
      // agent, final delete+verify — 9+ steps). 180s was tight even before
      // the search-retry padding added elsewhere; bumped to give it real
      // headroom instead of racing the clock on every run.
      test.setTimeout(300_000);
      setQaseId(2722);

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
          page, onboardModulePage, onbState.loginPage, credentials
        ));
        expect(merchantId, 'merchantId must be captured from merchant creation response').not.toBe('');
        onbState.cleanupTasks.push(async () => {
          if (agentName) await cleanupAgent(page, agentName, agentEmail, agentCreatedAt);
          if (!merchantDeleted) await cleanupMerchant(page, merchantId, merchantEmail, onbState.authTokenForCleanup);
        });
      });

      // Account setup runs in a separate context, so the admin session here is
      // still alive — loginIfNeeded is only a safety net and normally no-ops.
      await test.step('Ensure admin session is active', async () => {
        await onbState.loginPage.gotoLogin();
        await onbState.loginPage.loginIfNeeded(credentials);
        await onbState.onboarding.goToOnboarding();
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
        await onbState.onboarding.goToAgentModule();
        await onbState.onboarding.addAgent({ ...agentData, merchant: merchantName, credential: 'test-credential' });
        await onbState.onboarding.assertSuccessMessage('Agent added successfully');
        agentName = agentData.name;
        agentEmail = agentData.email;
      });

      await test.step('Deactivate the merchant', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantEmail);
        await onbState.onboarding.deactivateMerchant(merchantEmail);
      });

      await test.step('Attempt to delete the merchant with active agent', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantEmail);
        await onbState.onboarding.clickDelete(merchantEmail);
        await onbState.onboarding.confirmDelete();
      });

      await test.step('Verify deletion is blocked with an error message', async () => {
        await onbState.onboarding.assertMerchantNotDeleted(merchantData.merchantDeletionUnsuccessfulMessage);
      });

      await test.step('Activate and delete linked agent', async () => {
        await onbState.onboarding.closeOpenDeleteModal();
        await activateAgent(page, agentEmail, agentCreatedAt);
        await onbState.onboarding.goToAgentModule();
        await onbState.onboarding.searchAgent(agentName);
        await onbState.onboarding.deactivateAgent(agentName);
        await onbState.onboarding.clickAgentDelete(agentName);
        await onbState.onboarding.confirmAgentDelete();
        agentName = '';
      });

      await test.step('Delete the merchant after agent is removed', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantEmail);
        await onbState.onboarding.clickDelete(merchantEmail);
        await onbState.onboarding.confirmDelete();
        merchantDeleted = true;
      });

      await test.step('Verify merchant is deleted', async () => {
        await onbState.onboarding.assertMerchantDeleted(merchantEmail);
      });
    }
  );

  test(
    qase(2723, 'Merchant activation is successful when in inactive state'),
    { tag: ['@regression'] },
    async ({ page }) => {
      test.setTimeout(180_000);
      setQaseId(2723);

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
        onbState.cleanupTasks.push(() => cleanupMerchant(page, merchantId, merchantEmail, onbState.authTokenForCleanup));
      });

      await test.step('Activate the merchant via API', async () => {
        await onbState.onboarding.goToOnboarding(); // triggers API calls → refreshes authToken
        const activateResp = await page.request.patch(
          `${BASE_URL}/business-category/${merchantId}/activate`,
          { headers: { Authorization: authToken, 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        expect(activateResp.ok(), 'Merchant API activation should succeed').toBeTruthy();
      });

      await test.step('Search for the merchant and deactivate it', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantEmail);
        await onbState.onboarding.deactivateMerchant(merchantEmail);
      });

      await test.step('Activate the merchant from inactive state', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantEmail);
        await onbState.onboarding.activateMerchant(merchantEmail); // asserts success toast internally
      });
    }
  );

  test(
    qase(2724, 'Merchant deactivation is successful when active'),
    { tag: ['@regression'] },
    async ({ page }) => {
      setQaseId(2724);

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
        onbState.cleanupTasks.push(() => cleanupMerchant(page, merchantId, merchantEmail, onbState.authTokenForCleanup));
      });

      await test.step('Activate the merchant via API', async () => {
        await onbState.onboarding.goToOnboarding(); // triggers API calls → refreshes authToken
        const activateResp = await page.request.patch(
          `${BASE_URL}/business-category/${merchantId}/activate`,
          { headers: { Authorization: authToken, 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        expect(activateResp.ok(), 'Merchant API activation should succeed').toBeTruthy();
      });

      await test.step('Search for the merchant and deactivate it', async () => {
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(merchantEmail);
        await onbState.onboarding.deactivateMerchant(merchantEmail); // asserts success toast internally
      });
    }
  );

  test(
    qase(2725, 'Resend activation successfully triggers email'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      test.setTimeout(180_000);
      setQaseId(2725);

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
        if (merchantId) onbState.cleanupTasks.push(() => cleanupMerchant(page, merchantId, testEmail, onbState.authTokenForCleanup));
        await onbState.onboarding.goToOnboarding();
        await onbState.onboarding.searchSpecificMerchant(testEmail);
      });

      await test.step('Open the view modal and click Resend Activation', async () => {
        await onbState.onboarding.openViewModal(testEmail);
        await onbState.onboarding.resendActivationEmail();
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
