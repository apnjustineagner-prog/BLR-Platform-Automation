// tests/platform/Onboarding/processor-credential.spec.ts
//
// ==============================================================================
// ONBOARDING — PROCESSOR CREDENTIAL
// ==============================================================================
//
// Third/last entity in the onboarding chain:
//   Merchant (business) -> Account Credential -> [Processor Credential]
//
// PREREQUISITE: an activated merchant WITH an activated account credential
// must exist first. Use setupMerchantWithAccountCredential(page,
// onboardModulePage, getAuthToken) from ./onboardingHelpers to build the full
// chain before exercising processor-credential scenarios.
//
// STATUS: PLACEHOLDER. No processor-credential test cases have been written
// yet, and no processor-credential API/UI flow is wired up in this repo yet.
// The test below is a fixme scaffold showing how a real test would obtain its
// merchant + account-credential prerequisites; fill in the actual steps (and a
// qase() id) once the scenarios and the processor-credential flow are defined.
//
// Run: npx playwright test "tests/platform/Onboarding/processor-credential.spec.ts"
//
// ==============================================================================

import { test } from '@playwright/test';
import { OnboardModulePage } from '../../../pages/blrAccountOnboardingPage/blrOnboardingModulePage';
import {
  registerOnboardingHooks,
  setQaseId,
  onbState,
  setupMerchantWithAccountCredential,
  cleanupMerchant,
} from './onboardingHelpers';

registerOnboardingHooks();

test.describe('Onboarding — Processor Credential', () => {

  // Scaffold — replace with the real processor-credential scenario + qase() id.
  test.fixme(
    'Processor credential can be created for a merchant with an account credential',
    { tag: ['@regression'] },
    async ({ page }) => {
      setQaseId(0);
      const onboardModulePage = new OnboardModulePage(page);

      // Live Bearer token captured by the request listener in
      // registerOnboardingHooks (refreshed on authenticated navigations).
      const getAuthToken = () => onbState.authTokenForCleanup;

      // PREREQUISITE: activated merchant + activated account credential.
      const { merchantId, merchantName } = await setupMerchantWithAccountCredential(
        page, onboardModulePage, getAuthToken
      );
      onbState.cleanupTasks.push(() => cleanupMerchant(page, merchantId, merchantName, onbState.authTokenForCleanup));

      // TODO: drive the Processor Credential UI/API (create / view / activate
      // / deactivate / delete) and assert the outcome.
    }
  );

});
