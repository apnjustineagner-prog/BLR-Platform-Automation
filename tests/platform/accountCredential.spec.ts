// tests/platform/accountCredential.spec.ts
//
// ==============================================================================
// ACCOUNT CREDENTIAL TEST SUITE
// ==============================================================================
//
// FLOW:
//   Login → Dashboard → Onboarding → Merchant → Account Credential
//
// PREREQUISITES:
//   Merchant "Test Business XORWL2" must exist. No pre-seeded credentials
//   are required — every test creates its own fresh timestamped credential.
//
// TEST ORGANIZATION:
//   1. Access           — BLR-3614
//   2. Create           — BLR-3615, BLR-3616, BLR-3617
//   3. List             — BLR-3618
//   4. Update           — BLR-3619, BLR-3620, BLR-3621
//   5. Status           — BLR-3622, BLR-3623
//   6. Delete           — BLR-3624, BLR-3625, BLR-3626
//
// STATE / LIFECYCLE NOTES:
//   Every test is self-contained: it creates a fresh timestamped
//   credential and walks it through the required lifecycle.
//   A new credential starts as NEW (no Deactivate/Delete actions);
//   ACTIVE has Deactivate but no Delete; only INACTIVE can be deleted,
//   and deletion requires typing the confirmation key "DELETE" — clicking
//   the confirm button with an empty key shows "This field is required."
//   and the deletion does not go through.
//
// ==============================================================================

import { test } from '@playwright/test';
import { AccountCredentialPage } from '../../pages/PLATFORM(SUPERADMIN)/accountCredentialPage';
import { BlrLoginPage } from '../../pages/blrAccountOnboardingPage/blrLoginPage';
import { qase } from 'playwright-qase-reporter';
import { attachScreenshot } from '../../utils/attachScreenshot';
import credentials from '../../utils/decrypt';

// ==============================================================================
// TEST DATA
// ==============================================================================

const merchant = 'Test Business XORWL2';

// ==============================================================================
// SETUP
// ==============================================================================

let accountCredential: AccountCredentialPage;
let currentQaseId = 0;

test.beforeEach(async ({ page }) => {
  accountCredential = new AccountCredentialPage(page);
  const loginPage = new BlrLoginPage(page);
  await loginPage.gotoLogin();
  await loginPage.loginIfNeeded(credentials);
  // domcontentloaded + sidebar wait, not 'load'/networkidle: the dashboard
  // keeps a request pending indefinitely, so those events never fire.
  await page.goto('https://test-web-admin.billeroo.com/dashboard', {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('link', { name: 'Dashboard' }).first().waitFor({ state: 'visible' });
  await accountCredential.goToOnboarding();
  await accountCredential.selectMerchant(merchant);
});

test.afterEach(async ({ page }, testInfo) => {
  // Bundled under screenshots/<spec-slug>/ and attached to Playwright + Qase.
  const baseName = currentQaseId ? `BLR-${currentQaseId}` : undefined;
  await attachScreenshot(testInfo, { page, baseName, label: 'final-page' });

  if (testInfo.status === 'passed') {
    console.log(`[PASSED] qase.id ${currentQaseId} - ${testInfo.title}`);
  }
});

// ==============================================================================
// TESTS
// ==============================================================================

test.describe('Account Credential', () => {

  // --- Access -----------------------------------------------------------------

  test(
    qase(3614, 'Account credential module is accessible successfully'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3614;

      await test.step('Verify Account Credential module is accessible', async () => {
        await accountCredential.assertOnAccountCredentialModule();
      });
    }
  );

  // --- Create -----------------------------------------------------------------

  test(
    qase(3615, 'Account credential creation fails when required fields are empty'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3615;

      await test.step('Open Add Account Credential modal', async () => {
        await accountCredential.clickAddAccountCredential();
      });

      await test.step('Submit without filling required Name field', async () => {
        await accountCredential.clickAdd();
      });

      await test.step('Verify required field error is shown', async () => {
        await accountCredential.assertNameRequiredError();
      });
    }
  );

  test(
    qase(3616, 'Account credential creation fails when account credential name already exists'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3616;

      const freshName = `Account Credential ${Date.now()}`;

      await test.step('Create a credential to collide with', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(freshName);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(freshName);
      });

      await test.step('Open Add Account Credential modal and fill the already-existing name', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(freshName);
      });

      await test.step('Submit the form', async () => {
        await accountCredential.clickAdd();
      });

      await test.step('Verify duplicate name inline error is shown', async () => {
        await accountCredential.assertDuplicateNameError();
      });
    }
  );

  test(
    qase(3617, 'Account credential is created successfully with optional field inputs'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3617;

      const freshName = `Account Credential ${Date.now()}`;

      await test.step('Open Add Account Credential modal', async () => {
        await accountCredential.clickAddAccountCredential();
      });

      await test.step('Fill all fields including optional ones', async () => {
        await accountCredential.fillName(freshName);
        await accountCredential.fillDescription('Automated test credential');
        await accountCredential.fillWebhookUrl('https://webhook.example.com/notify');
      });

      await test.step('Submit the form', async () => {
        await accountCredential.clickAdd();
      });

      await test.step('Verify new credential appears in the list', async () => {
        await accountCredential.assertCredentialInTable(freshName);
      });
    }
  );

  // --- List -------------------------------------------------------------------

  test(
    qase(3618, 'Account credential list is searchable using valid keywords'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3618;

      const freshName = `Account Credential ${Date.now()}`;

      await test.step('Create a credential to search for', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(freshName);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(freshName);
      });

      await test.step('Search for the credential by name', async () => {
        await accountCredential.searchFor(freshName);
      });

      await test.step('Verify the credential appears in search results', async () => {
        await accountCredential.assertRowContains(freshName);
      });
    }
  );

  // --- Update -----------------------------------------------------------------

  test(
    qase(3619, 'Account credential update fails when required fields are empty'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3619;

      const freshName = `Account Credential ${Date.now()}`;

      await test.step('Create a credential to edit', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(freshName);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(freshName);
      });

      await test.step('Open edit form for the credential', async () => {
        await accountCredential.clickEditByName(freshName);
      });

      await test.step('Clear the required Name field', async () => {
        await accountCredential.clearEditName();
      });

      await test.step('Submit the form', async () => {
        await accountCredential.clickSave();
      });

      await test.step('Verify required field error is shown', async () => {
        await accountCredential.assertNameRequiredError();
      });
    }
  );

  test(
    qase(3620, 'Account credential update fails when account credential name already exists'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3620;

      const credentialOne = `Account Credential ${Date.now()}`;
      const credentialTwo = `Account Credential ${Date.now() + 1}`;

      await test.step('Create first account credential', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(credentialOne);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(credentialOne);
      });

      await test.step('Create second account credential', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(credentialTwo);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(credentialTwo);
      });

      await test.step('Open edit form for the first credential', async () => {
        await accountCredential.clickEditByName(credentialOne);
      });

      await test.step('Change name to the already-existing second credential name', async () => {
        await accountCredential.clearEditName();
        await accountCredential.fillEditName(credentialTwo);
      });

      await test.step('Submit the form', async () => {
        await accountCredential.clickSave();
      });

      await test.step('Verify duplicate name inline error is shown', async () => {
        await accountCredential.assertDuplicateNameError();
      });
    }
  );

  test(
    qase(3621, 'Account credential update is successful with optional field inputs'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3621;

      const freshName = `Account Credential ${Date.now()}`;

      await test.step('Create a fresh credential to update', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(freshName);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(freshName);
      });

      await test.step('Open edit form for the credential', async () => {
        await accountCredential.clickEditByName(freshName);
      });

      await test.step('Update optional fields', async () => {
        await accountCredential.fillEditDescription(`Updated at ${Date.now()}`);
        await accountCredential.fillEditWebhookUrl('https://webhook.example.com/updated');
      });

      await test.step('Save the changes', async () => {
        await accountCredential.clickSave();
      });

      await test.step('Verify update was successful', async () => {
        await accountCredential.assertSuccessToast();
      });
    }
  );

  // --- Status -----------------------------------------------------------------

  test(
    qase(3622, 'Account credential deactivation is successful when status is active'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3622;

      const freshName = `Account Credential ${Date.now()}`;

      await test.step('Create a fresh credential', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(freshName);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(freshName);
      });

      await test.step('Activate the credential', async () => {
        await accountCredential.activateByName(freshName);
        await accountCredential.assertSuccessToast();
      });

      await test.step('Deactivate the active credential', async () => {
        await accountCredential.deactivateByName(freshName);
      });

      await test.step('Verify credential is now inactive', async () => {
        await accountCredential.assertSuccessToast();
        await accountCredential.assertRowStatus(freshName, 'Inactive');
      });
    }
  );

  test(
    qase(3623, 'Account credential activation is successful when status is inactive'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3623;

      const freshName = `Account Credential ${Date.now()}`;

      await test.step('Create a fresh credential and deactivate it to set up inactive state', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(freshName);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(freshName);
        // A NEW credential has no Deactivate action; it must be activated first
        await accountCredential.activateByName(freshName);
        await accountCredential.deactivateByName(freshName);
        await accountCredential.assertRowStatus(freshName, 'Inactive');
      });

      await test.step('Activate the inactive credential', async () => {
        await accountCredential.activateByName(freshName);
      });

      await test.step('Verify credential is now active', async () => {
        await accountCredential.assertSuccessToast();
        await accountCredential.assertRowStatus(freshName, 'Active');
      });
    }
  );

  // --- Delete -----------------------------------------------------------------

  test(
    qase(3624, 'Account credential deletion fails when account credential status is active'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3624;

      const freshName = `Account Credential ${Date.now()}`;

      await test.step('Create a fresh credential and activate it', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(freshName);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(freshName);
        await accountCredential.activateByName(freshName);
      });

      await test.step('Verify Delete button is not available for active credential', async () => {
        await accountCredential.assertDeleteButtonHidden(freshName);
      });
    }
  );

  test(
    qase(3625, 'Account credential deletion fails when confirmation key is empty'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3625;

      const freshName = `Account Credential ${Date.now()}`;

      await test.step('Create a fresh credential and deactivate it so Delete is available', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(freshName);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(freshName);
        await accountCredential.activateByName(freshName);
        await accountCredential.deactivateByName(freshName);
      });

      await test.step('Initiate deletion of the inactive credential', async () => {
        await accountCredential.clickDeleteByName(freshName);
      });

      await test.step('Verify delete is blocked without typing DELETE', async () => {
        await accountCredential.assertDeleteBlockedWithEmptyKey();
      });
    }
  );

  test(
    qase(3626, 'Account credential is deleted successfully when status is inactive and confirmation key is valid'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3626;

      const freshName = `Account Credential ${Date.now()}`;

      await test.step('Create a fresh credential and deactivate it so Delete is available', async () => {
        await accountCredential.clickAddAccountCredential();
        await accountCredential.fillName(freshName);
        await accountCredential.clickAdd();
        await accountCredential.assertCredentialInTable(freshName);
        await accountCredential.activateByName(freshName);
        await accountCredential.deactivateByName(freshName);
      });

      await test.step('Initiate deletion of the inactive credential', async () => {
        await accountCredential.clickDeleteByName(freshName);
      });

      await test.step('Enter valid confirmation key', async () => {
        await accountCredential.fillConfirmationKey('DELETE');
      });

      await test.step('Confirm deletion', async () => {
        await accountCredential.confirmDelete();
      });

      await test.step('Verify deletion was successful', async () => {
        await accountCredential.assertSuccessToast();
        await accountCredential.assertCredentialNotInTable(freshName);
      });
    }
  );

});
