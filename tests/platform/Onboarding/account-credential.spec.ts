// tests/platform/Onboarding/account-credential.spec.ts
//
// ==============================================================================
// ONBOARDING — ACCOUNT CREDENTIAL
// ==============================================================================
//
// Second entity in the onboarding chain:
//   Merchant (business) -> [Account Credential] -> Processor Credential
//
// PREREQUISITE: an activated merchant must exist first. Use
// setupActivatedMerchant(page, onboardModulePage) from ./onboardingHelpers to
// build it before exercising account-credential scenarios.
//
// STATUS: PLACEHOLDER. No account-credential UI test cases have been written
// yet — the flow only exists today as raw-API prerequisite setup inside
// merchant.spec.ts's BLR-2722. The test below is a fixme scaffold showing how
// a real test would obtain its merchant prerequisite; fill in the actual
// UI/assertion steps (and a qase() id) once the scenarios are defined.
//
// Run: npx playwright test "tests/platform/Onboarding/account-credential.spec.ts"
//
// ==============================================================================

import { test } from '@playwright/test';
import { OnboardModulePage } from '../../../pages/blrAccountOnboardingPage/blrOnboardingModulePage';
import {
  registerOnboardingHooks,
  setQaseId,
  onbState,
  setupActivatedMerchant,
  cleanupMerchant,
} from './onboardingHelpers';

registerOnboardingHooks();

test.describe('Onboarding — Account Credential', () => {

  // Scaffold — replace with the real account-credential scenario + qase() id.
  test.fixme(
    'Account credential can be created for an activated merchant',
    { tag: ['@regression'] },
    async ({ page }) => {
      setQaseId(0);
      const onboardModulePage = new OnboardModulePage(page);

      // PREREQUISITE: activated merchant.
      const { merchantId, merchantEmail } = await setupActivatedMerchant(page, onboardModulePage);
      onbState.cleanupTasks.push(() => cleanupMerchant(page, merchantId, merchantEmail, onbState.authTokenForCleanup));

      // TODO: drive the Account Credential UI (create / view / activate /
      // deactivate / delete) and assert the outcome.
    }
  );

});
