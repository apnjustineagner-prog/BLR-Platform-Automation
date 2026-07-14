// tests/platform/processorCredential.spec.ts
//
// ==============================================================================
// PROCESSOR CREDENTIAL TEST SUITE
// ==============================================================================
//
// FLOW:
//   Login → Onboarding → Merchant → Account Credential (activated) → Processor Credential
//
// PREREQUISITE:
//   Merchant "Test Business XORWL2" must exist with an active account credential
//   named "Processor Credential FlowB"
//
// TEST ORGANIZATION:
//   1. Access           — BLR-3084
//   2. Create           — BLR-3085 to BLR-3089
//   3. View             — BLR-3090
//   4. List             — BLR-3091 to BLR-3094
//   5. Update           — BLR-3095 to BLR-3096
//   6. Status           — BLR-3097 to BLR-3098
//   7. Delete           — BLR-3099
//
// ==============================================================================

import { test } from '@playwright/test';
import { OnboardModulePage } from '../../pages/blrAccountOnboardingPage/blrOnboardingModulePage';
import { ProcessorCredentialPage } from '../../pages/PLATFORM(SUPERADMIN)/processorCredentialPage';
import { qase } from 'playwright-qase-reporter';

// ==============================================================================
// TEST DATA
// ==============================================================================

const merchant = 'Test Business XORWL2';
const accountCredential = 'Processor Credential FlowB';

const processors = {
  ecpay: {
    searchTerm: 'ec',
    name: 'ECPAY',
    channel: 'Bills Payment',
    currencySearchTerm: 'ph',
    currency: 'Philippine Peso',
    fields: {
      accountID: '11555',
      branchID: '51362',
      userID: '213498',
      username: 'ALTPAYNET_TEST!',
      password: 'Altp@yn3t',
    },
  },
  sss: {
    searchTerm: 'sss',
    name: 'SSS',
    channel: 'SSS - Employer',
    currencySearchTerm: 'ph',
    currency: 'Philippine Peso',
    fields: {
      tokenID: '1rlLaf1B9RqICOfXUBLMjUQvYo0XEGk5k9EDZBYvZOj3TDLnLY',
      tokenIDForEmployer: 'ED044FD1D03FF7C97A3C85483DC4C2C74B7867134593544015DC5EC902E7CE3522549253CFADCAD6F2AF28022C2C13070923178013DA79BA7460077AD380712E',
      pttyp: 'ALC',
      newToken: '20221206152152MMMZY73EYNR6TTY8YVRYQG9WOGJVHS76LSEOH06T123F4ZUTAV',
    },
  },
  brn: {
    searchTerm: 'brn',
    name: 'BRN',
    channel: 'BRN',
    currencySearchTerm: 'ph',
    currency: 'Philippine Peso',
    fields: {
      token: 'BoLvMPuNBeyiG547hHR@F2FWvrFssPRthXZBJ3LxyHbNWmdbS0TFTI6up3iSMfOAqg7LAMu6fdQQr0HpQEUs64gCaxnmoDBeQO0oX8YF3/NxhQhQ==',
    },
  },
  paymentCollection: {
    searchTerm: 'payment',
    name: 'Payment Collection',
    channel: 'AltPayNet',
    currencySearchTerm: 'ph',
    currency: 'Philippine Peso',
    fields: {
      token: 'test',
    },
  },
  localGovDavao: {
    searchTerm: 'davao',
    name: 'Local Government of Davao',
    channel: 'Local Government of Davao',
    currencySearchTerm: 'ph',
    currency: 'Philippine Peso',
    fields: {
      provider: 'test',
      tokenid: 'test',
      qrHostUrl: 'test',
    },
  },
};

// ==============================================================================
// SETUP
// ==============================================================================

let processorCredential: ProcessorCredentialPage;
let currentQaseId = 0;

test.beforeEach(async ({ page }, testInfo) => {
  processorCredential = new ProcessorCredentialPage(page);
  await page.goto('https://test-web-admin.billeroo.com/dashboard');
  await page.waitForLoadState('networkidle');

  // BLR-3085, BLR-3086, and BLR-3087 onboard their own fresh merchant + account credential, so
  // they don't depend on the shared "Processor Credential FlowA" fixture used by the rest of the suite.
  // That full onboard + credential setup + create flow doesn't reliably fit the global 90s budget
  // on the slow test env (BLR-3086 was timing out with the create already succeeded server-side),
  // so give these three a larger per-test timeout.
  const selfOnboardingQaseIds = ['Qase ID: 3085', 'Qase ID: 3086', 'Qase ID: 3087'];
  if (selfOnboardingQaseIds.some((id) => testInfo.title.includes(id))) {
    testInfo.setTimeout(180_000);
    return;
  }

  await processorCredential.goToOnboarding();
  await processorCredential.selectMerchant(merchant);
  await processorCredential.navigateIntoAccountCredential(accountCredential);
});

test.afterEach(async ({ page }, testInfo) => {
  const screenshotName = currentQaseId
    ? `BLR-${currentQaseId}`
    : testInfo.title.replace(/\s+/g, '_');

  const screenshotPath = `screenshots/${screenshotName}.png`;

  await page.screenshot({ path: screenshotPath });

  await testInfo.attach(screenshotName, {
    path: screenshotPath,
    contentType: 'image/png',
  });

  if (testInfo.status === 'passed') {
    console.log(`[PASSED] qase.id ${currentQaseId} - ${testInfo.title}`);
  }
});

// ==============================================================================
// TESTS
// ==============================================================================

test.describe('Processor Credential', () => {
  test(
    qase(3084, 'Module is accessible successfully'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3084;

      await test.step('Verify Processor Credential module is accessible', async () => {
        await processorCredential.assertOnProcessorCredentialModule();
      });
    }
  );

  test(
    qase(3085, 'ECPAY credential created with valid input'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      currentQaseId = 3085;

      const freshCredName = `ECPAY Test ${Date.now()}`;

      const onboardModulePage = new OnboardModulePage(page);
      const { saved } = await test.step('Onboard a fresh merchant', async () => {
        return onboardModulePage.onboardBiller();
      });

      await processorCredential.createEcpayCredential(saved.name, freshCredName, processors.ecpay);
    }
  );

  test(
    qase(3086, 'SSS credential created with valid input'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      currentQaseId = 3086;

      const freshCredName = `SSS Test ${Date.now()}`;

      const onboardModulePage = new OnboardModulePage(page);
      const { saved } = await test.step('Onboard a fresh merchant', async () => {
        return onboardModulePage.onboardBiller();
      });

      await processorCredential.createSssCredential(saved.name, freshCredName, processors.sss);
    }
  );

  test(
    qase(3087, 'BRN credential created with valid input'),
    { tag: ['@smoke', '@regression'] },
    async ({ page }) => {
      currentQaseId = 3087;

      const freshCredName = `BRN Test ${Date.now()}`;

      const onboardModulePage = new OnboardModulePage(page);
      const { saved } = await test.step('Onboard a fresh merchant', async () => {
        return onboardModulePage.onboardBiller();
      });

      await processorCredential.createBrnCredential(saved.name, freshCredName, processors.brn);
    }
  );

  test(
    qase(3088, 'Payment Collection credential created with valid input'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3088;

      // Idempotency precondition: if a prior run's credential is still here
      // (e.g. BLR-3096 didn't reach its own cleanup step), remove it first so
      // creating a fresh one below doesn't hit a duplicate-credential error.
      await test.step('Ensure no pre-existing Payment Collection credential', async () => {
        await processorCredential.deleteCredentialIfExists(
          processors.paymentCollection.name,
          processors.paymentCollection.currency
        );
      });

      await test.step('Click Add Processor Credential', async () => {
        await processorCredential.clickAddProcessorCredential();
      });

      await test.step('Select Payment Collection processor', async () => {
        await processorCredential.selectProcessor(
          processors.paymentCollection.searchTerm,
          processors.paymentCollection.name
        );
      });

      await test.step('Select currency', async () => {
        await processorCredential.selectCurrency(
          processors.paymentCollection.currencySearchTerm,
          processors.paymentCollection.currency
        );
      });

      await test.step('Select channel', async () => {
        await processorCredential.selectChannel(processors.paymentCollection.channel);
      });

      await test.step('Fill Payment Collection credential fields', async () => {
        await processorCredential.fillGenericFields(processors.paymentCollection.fields);
      });

      await test.step('Submit', async () => {
        await processorCredential.clickAdd();
      });

      await test.step('Verify Payment Collection credential appears in the list', async () => {
        await processorCredential.assertProcessorInTable(processors.paymentCollection.name);
      });
    }
  );

  test(
    qase(3089, 'Local Gov of Davao credential created with valid input'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3089;

      // Idempotency precondition: a previous successful run of this test leaves its
      // credential behind permanently (nothing else consumes/deletes it), which then
      // collides with this same creation on the next run. Clear it first.
      await test.step('Ensure no pre-existing Local Gov of Davao credential', async () => {
        await processorCredential.deleteCredentialIfExists(
          processors.localGovDavao.name,
          processors.localGovDavao.currency
        );
      });

      await test.step('Click Add Processor Credential', async () => {
        await processorCredential.clickAddProcessorCredential();
      });

      await test.step('Select Local Gov of Davao processor', async () => {
        await processorCredential.selectProcessor(
          processors.localGovDavao.searchTerm,
          processors.localGovDavao.name
        );
      });

      await test.step('Select currency', async () => {
        await processorCredential.selectCurrency(
          processors.localGovDavao.currencySearchTerm,
          processors.localGovDavao.currency
        );
      });

      await test.step('Select channel', async () => {
        await processorCredential.selectChannel(processors.localGovDavao.channel);
      });

      await test.step('Fill Local Gov of Davao credential fields', async () => {
        await processorCredential.fillGenericFields(processors.localGovDavao.fields);
      });

      await test.step('Submit', async () => {
        await processorCredential.clickAdd();
      });

      await test.step('Verify Local Gov of Davao credential appears in the list', async () => {
        await processorCredential.assertProcessorInTable(processors.localGovDavao.name);
      });
    }
  );

  test(
    qase(3090, 'Details modal displayed and closed'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3090;

      await test.step('Click view on first processor credential', async () => {
        await processorCredential.clickViewOnRow(0);
      });

      await test.step('Verify details modal is displayed', async () => {
        await processorCredential.assertDetailsModalVisible();
      });

      await test.step('Close the details modal', async () => {
        await processorCredential.closeModal();
      });

      await test.step('Verify details modal is no longer displayed', async () => {
        await processorCredential.assertDetailsModalHidden();
      });
    }
  );

  test(
    qase(3091, 'List is searchable'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3091;

      await test.step('Search for ECPAY in the list', async () => {
        await processorCredential.searchFor(processors.ecpay.name);
      });

      await test.step('Verify ECPAY appears in search results', async () => {
        await processorCredential.assertRowContains(processors.ecpay.name);
      });
    }
  );

  test(
    qase(3092, 'List sorted by column headers'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3092;

      await test.step('Sort list by clicking a column header', async () => {
        await processorCredential.sortByColumn('Processor');
      });

      await test.step('Verify list is sorted', async () => {
        await processorCredential.assertTableSorted();
      });
    }
  );

  test(
    qase(3093, 'List filtered by page size'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3093;

      await test.step('Set page size to 25', async () => {
        await processorCredential.setPageSize('25');
      });

      await test.step('Verify page size selection took effect', async () => {
        await processorCredential.assertPageSizeSelected('25');
      });
    }
  );

  test(
    qase(3094, 'Pagination works'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3094;

      // Pagination only kicks in once the list exceeds the default page size (10).
      // The shared fixture doesn't guarantee that on its own, so this test seeds
      // however many extra rows it's short by, each with a distinct currency
      // (same processor/channel) to avoid the "credential already exists" validation.
      const extraCurrencies = [
        'US Dollar', 'Euro', 'British Pound Sterling', 'Japanese Yen',
        'Australian Dollar', 'Canadian Dollar', 'Swiss Franc', 'New Zealand Dollar',
      ];

      await test.step('Seed extra rows until the list requires a second page', async () => {
        const targetTotal = 11;
        let total = await processorCredential.getTotalEntries();
        let i = 0;
        while (total < targetTotal && i < extraCurrencies.length) {
          const currency = extraCurrencies[i++];

          // Earlier runs (including failed ones) leave their seeds behind, and a
          // duplicate (processor, channel, currency) combo is rejected with the
          // modal held open on a validation error — so skip currencies that
          // already have a row. The row can sit past page 1, so check through
          // the table search rather than the visible rows.
          await processorCredential.searchFor(currency);
          const alreadySeeded =
            (await processorCredential
              .rowByFields(processors.paymentCollection.name, currency)
              .count()) > 0;
          await processorCredential.searchFor('');
          if (alreadySeeded) continue;

          await processorCredential.clickAddProcessorCredential();
          await processorCredential.selectProcessor(
            processors.paymentCollection.searchTerm,
            processors.paymentCollection.name
          );
          await processorCredential.selectCurrency(currency, currency);
          await processorCredential.selectChannel(processors.paymentCollection.channel);
          await processorCredential.fillGenericFields({ token: `pagination-seed-${i}` });
          await processorCredential.clickAdd();
          total = await processorCredential.getTotalEntries();
        }
      });

      await test.step('Navigate to next page', async () => {
        await processorCredential.clickNextPage();
      });

      await test.step('Verify next page is loaded with records', async () => {
        await processorCredential.assertNextPageLoaded();
      });
    }
  );

  test(
    qase(3095, 'Update successful when value fields modified'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3095;

      await test.step('Open edit form for the ECPAY processor credential', async () => {
        await processorCredential.clickEditOnProcessor(processors.ecpay.name);
      });

      await test.step('Update the credential fields', async () => {
        await processorCredential.fillEcpayFields({
          ...processors.ecpay.fields,
          accountID: `${Date.now()}`,
        });
      });

      await test.step('Save the changes', async () => {
        await processorCredential.clickSave();
      });

      await test.step('Verify update was successful', async () => {
        await processorCredential.assertSuccessToast();
      });
    }
  );

  test(
    qase(3096, 'Update successful when processor is changed'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 3096;

      // Converting Payment Collection -> BRN/Philippine Peso leaves that exact combo
      // behind after a successful run, colliding with itself on every run after that.
      // This test cleans up the row it converts at the end, so the fixture's
      // "Payment Collection" credential (recreated each full-suite run by BLR-3088)
      // is left exactly as it was found.

      await test.step('Open edit form for the Payment Collection processor credential', async () => {
        await processorCredential.clickEditOnProcessorRow(
          processors.paymentCollection.name,
          processors.paymentCollection.currency
        );
      });

      await test.step('Change the processor type', async () => {
        await processorCredential.selectProcessor(processors.brn.searchTerm, processors.brn.name, 'edit');
        await processorCredential.selectCurrency(processors.brn.currencySearchTerm, processors.brn.currency, 'edit');
        await processorCredential.selectChannel(processors.brn.channel, 'edit');
        await processorCredential.fillFieldsByValueId(processors.brn.fields);
      });

      await test.step('Save the changes', async () => {
        await processorCredential.clickSave();
      });

      await test.step('Verify update was successful', async () => {
        await processorCredential.assertSuccessToast();
      });

      await test.step('Clean up the disposable credential', async () => {
        await processorCredential.deleteCredentialByFields(processors.brn.name, processors.brn.currency);
      });
    }
  );

  test(
    qase(3097, 'Activation successful when status is inactive'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3097;

      await test.step('Activate an inactive processor credential', async () => {
        await processorCredential.clickActivateOnRow(0);
      });

      await test.step('Verify credential is now active', async () => {
        await processorCredential.assertSuccessToast();
        await processorCredential.assertRowStatus(0, 'Active');
      });
    }
  );

  test(
    qase(3098, 'Deactivation successful when status is active'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3098;

      await test.step('Deactivate an active processor credential', async () => {
        await processorCredential.clickDeactivateOnRow(0);
      });

      await test.step('Verify credential is now inactive', async () => {
        await processorCredential.assertSuccessToast();
        await processorCredential.assertRowStatus(0, 'Inactive');
      });
    }
  );

  test(
    qase(3099, 'Deletion successful when inactive + valid confirmation key'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 3099;

      await test.step('Initiate deletion of an inactive processor credential', async () => {
        await processorCredential.clickDeleteOnFirstAvailableRow();
      });

      await test.step('Enter valid confirmation key', async () => {
        await processorCredential.fillConfirmationKey('DELETE');
      });

      await test.step('Confirm deletion', async () => {
        await processorCredential.confirmDelete();
      });

      await test.step('Verify deletion was successful', async () => {
        await processorCredential.assertSuccessToast();
      });
    }
  );

});
