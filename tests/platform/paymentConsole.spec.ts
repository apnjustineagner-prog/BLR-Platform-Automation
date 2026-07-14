// tests/platform/paymentConsole.spec.ts
//
// ==============================================================================
// PAYMENT CONSOLE TEST SUITE
// ==============================================================================
//
// PURPOSE:
//   All test cases for the Payment Console module under PLATFORM (SUPER ADMIN)
//
// TEST ORGANIZATION:
//   1. Preview Payment Category  — BLR-914 to BLR-917
//   2. Search & Select           — BLR-918 to BLR-920
//   3. Pay Bills                 — BLR-921 to BLR-930
//   4. PRN Generation            — BLR-312, BLR-313, BLR-314, BLR-316
//
// ==============================================================================

import { test } from '@playwright/test';
import { PaymentConsolePage } from '../../pages/PLATFORM(SUPERADMIN)/paymentConsolePage';
import { qase } from 'playwright-qase-reporter';

// ==============================================================================
// TEST DATA — Replace placeholders with real values from the UI
// ==============================================================================

const validData = {
  businessCategoryAccount: 'AltPayNet Billeroo - Business',
  accountCredential: 'TODO: valid account credential',
  serviceType: 'TODO: valid service type',
  agent: 'TODO: valid agent',
  billerAccount: 'TODO: valid biller account',
  paymentCategory: 'TODO: valid payment category',
  amount: '100',
  email: 'test@example.com',
};

const invalidData = {
  amount: 'abc',
  accountNumber: '0000000000',
};

// ==============================================================================
// SETUP
// ==============================================================================

let paymentConsole: PaymentConsolePage;
let currentQaseId = 0;

test.beforeEach(async ({ page }) => {
  paymentConsole = new PaymentConsolePage(page);
  await page.goto('https://test-web-admin.billeroo.com/dashboard');
  await page.waitForLoadState('networkidle');
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
// TEST GROUP 1: PREVIEW PAYMENT CATEGORY
// ==============================================================================

test.describe('Preview Payment Category', () => {
  test(
    qase(1950, 'Unsuccessfully preview payment category by not selecting account credential'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 1950;
      
      await test.step('Navigate to Payment Console', async () => {
        await paymentConsole.goToPaymentConsole();
        await paymentConsole.assertOnPaymentConsolePage();
      });

      await test.step('Select business category account', async () => {
        await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      });

      await test.step('Verify agent, account credential, and service type are empty', async () => {
        await paymentConsole.assertAgentEmpty();
        await paymentConsole.assertAccountCredentialEmpty();
        await paymentConsole.assertServiceTypeEmpty();
      });

      await test.step('Verify biller list is not displayed', async () => {
        await paymentConsole.assertBillerCategoryListHidden();
      });
    }
  );

  test(
    qase(1951, 'Unsuccessfully preview payment category by not selecting service type'),
    { tag: ['@regression'] },
    async () => {
      currentQaseId = 1951;

      await test.step('Navigate to Payment Console', async () => {
        await paymentConsole.goToPaymentConsole();
        await paymentConsole.assertOnPaymentConsolePage();
      });

      await test.step('Select business category account', async () => {
        await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      });

      await test.step('Verify agent, account credential, and service type are empty', async () => {
        await paymentConsole.assertAgentEmpty();
        await paymentConsole.assertAccountCredentialEmpty();
        await paymentConsole.assertServiceTypeEmpty();
      });

      await test.step('Verify biller list is not displayed', async () => {
        await paymentConsole.assertBillerCategoryListHidden();
      });

    }
  );

  test(
    qase(1952, 'Successfully preview payment category without selecting agent'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 1952;

      await test.step('Navigate to Payment Console', async () => {
        await paymentConsole.goToPaymentConsole();
      });

      await test.step('Select business category account', async () => {
        await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      });

      await test.step('Select account credential', async () => {
        await paymentConsole.selectAccountCredential(validData.accountCredential);
      });

      await test.step('Leave service type selection empty', async () => {
        // intentionally skipped
      });

      await test.step('Click Preview', async () => {
        await paymentConsole.clickPreview();
      });

      await test.step('Verify biller category list is not displayed', async () => {
        await paymentConsole.assertBillerCategoryListHidden();
      });
    }
  );

  test(
    qase(1953, 'Successfully preview payment category with agent account'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 1953;

      await test.step('Navigate to Payment Console', async () => {
        await paymentConsole.goToPaymentConsole();
      });

      await test.step('Select business category account', async () => {
        await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      });

      await test.step('Select agent account', async () => {
        await paymentConsole.selectAgent(validData.agent);
      });

      await test.step('Select account credential', async () => {
        await paymentConsole.selectAccountCredential(validData.accountCredential);
      });

      await test.step('Select service type', async () => {
        await paymentConsole.selectServiceType(validData.serviceType);
      });

      await test.step('Click Preview', async () => {
        await paymentConsole.clickPreview();
      });

      await test.step('Verify biller category list is displayed', async () => {
        await paymentConsole.assertBillerCategoryListVisible();
      });
    }
  );
});

// ==============================================================================
// TEST GROUP 2: SEARCH & SELECT
// ==============================================================================

test.describe('Search and Select', () => {
  test(
    qase(1954, 'Successfully search a specific biller account'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 1954;

      await test.step('Navigate to Payment Console', async () => {
        await paymentConsole.goToPaymentConsole();
      });

      await test.step('Preview payment category', async () => {
        await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
        await paymentConsole.selectAccountCredential(validData.accountCredential);
        await paymentConsole.selectServiceType(validData.serviceType);
        await paymentConsole.clickPreview();
      });

      await test.step('Search for a specific biller account', async () => {
        await paymentConsole.searchBillerAccount(validData.billerAccount);
      });

      await test.step('Verify biller account appears in results', async () => {
        await paymentConsole.assertBillerCategoryListVisible();
      });
    }
  );

  test(
    qase(1955, 'Successfully select payment category using search option'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 1955;

      await test.step('Navigate to Payment Console', async () => {
        await paymentConsole.goToPaymentConsole();
      });

      await test.step('Preview payment category', async () => {
        await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
        await paymentConsole.selectAccountCredential(validData.accountCredential);
        await paymentConsole.selectServiceType(validData.serviceType);
        await paymentConsole.clickPreview();
      });

      await test.step('Select payment category using search', async () => {
        await paymentConsole.searchBillerAccount(validData.billerAccount);
        await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      });

      await test.step('Verify payment category is selected', async () => {
        await paymentConsole.assertBillerCategoryListVisible();
      });
    }
  );

  test(
    qase(1956, 'Successfully select a specific biller account'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 1956;

      await test.step('Navigate to Payment Console', async () => {
        await paymentConsole.goToPaymentConsole();
      });

      await test.step('Preview payment category', async () => {
        await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
        await paymentConsole.selectAccountCredential(validData.accountCredential);
        await paymentConsole.selectServiceType(validData.serviceType);
        await paymentConsole.clickPreview();
      });

      await test.step('Select a specific biller account', async () => {
        await paymentConsole.selectBillerAccount(validData.billerAccount);
      });

      await test.step('Verify biller account is selected', async () => {
        await paymentConsole.assertBillerCategoryListVisible();
      });
    }
  );
});

// ==============================================================================
// TEST GROUP 3: PAY BILLS
// ==============================================================================

test.describe('Pay Bills', () => {
  test(qase(1957, 'Successfully cancel the bills payment'), { tag: ['@smoke', '@regression'] }, async () => {
    currentQaseId = 1957;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Select biller and fill payment details', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount(validData.amount);
    });

    await test.step('Cancel the payment', async () => {
      await paymentConsole.clickCancel();
    });

    await test.step('Verify payment is cancelled', async () => {
      await paymentConsole.assertPaymentCancelled();
    });
  });

  test(qase(1958, 'Pay specific bills using empty fields'), { tag: ['@regression'] }, async () => {
    currentQaseId = 1958;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Leave payment fields empty and click Pay', async () => {
      await paymentConsole.clickPay();
    });

    await test.step('Verify validation errors are displayed', async () => {
      await paymentConsole.assertErrorMessage('TODO: expected empty field error message');
    });
  });

  test(qase(1959, 'Pay specific bills using invalid input'), { tag: ['@regression'] }, async () => {
    currentQaseId = 1959;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Fill payment details with invalid input', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount(invalidData.amount);
    });

    await test.step('Click Pay', async () => {
      await paymentConsole.clickPay();
    });

    await test.step('Verify validation error is displayed', async () => {
      await paymentConsole.assertErrorMessage('TODO: expected invalid input error message');
    });
  });

  test(qase(1960, 'Pay specific bills using invalid account number'), { tag: ['@regression'] }, async () => {
    currentQaseId = 1960;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Fill payment details with invalid account number', async () => {
      await paymentConsole.selectBillerAccount(invalidData.accountNumber);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount(validData.amount);
    });

    await test.step('Click Pay', async () => {
      await paymentConsole.clickPay();
    });

    await test.step('Verify error for invalid account number', async () => {
      await paymentConsole.assertErrorMessage(
        'TODO: expected invalid account number error message'
      );
    });
  });

  test(qase(1961, 'Pay specific bills with insufficient balance'), { tag: ['@regression'] }, async () => {
    currentQaseId = 1961;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Fill payment details with amount exceeding balance', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount('999999999');
    });

    await test.step('Click Pay and Confirm', async () => {
      await paymentConsole.clickPay();
      await paymentConsole.clickConfirm();
    });

    await test.step('Verify insufficient balance error is displayed', async () => {
      await paymentConsole.assertErrorMessage('TODO: expected insufficient balance error message');
    });
  });

  test(qase(1962, 'Pay specific bills using negative amount'), { tag: ['@regression'] }, async () => {
    currentQaseId = 1962;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Fill payment details with negative amount', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount('-100');
    });

    await test.step('Click Pay', async () => {
      await paymentConsole.clickPay();
    });

    await test.step('Verify error for negative amount', async () => {
      await paymentConsole.assertErrorMessage('TODO: expected negative amount error message');
    });
  });

  test(qase(1963, 'Pay specific bills without email input'), { tag: ['@regression'] }, async () => {
    currentQaseId = 1963;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Fill payment details without email', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount(validData.amount);
    });

    await test.step('Click Pay and Confirm', async () => {
      await paymentConsole.clickPay();
      await paymentConsole.clickConfirm();
    });

    await test.step('Verify payment proceeded without email', async () => {
      await paymentConsole.assertPaymentCancelled();
    });
  });

  test(qase(1964, 'Pay specific bills with email input'), { tag: ['@regression'] }, async () => {
    currentQaseId = 1964;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Fill payment details with email', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount(validData.amount);
      await paymentConsole.fillEmail(validData.email);
    });

    await test.step('Click Pay and Confirm', async () => {
      await paymentConsole.clickPay();
      await paymentConsole.clickConfirm();
    });

    await test.step('Verify payment succeeded with email', async () => {
      await paymentConsole.assertPaymentCancelled();
    });
  });

  test(
    qase(1965, 'Pay specific bills using business category account'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      currentQaseId = 1965;

      await test.step('Navigate to Payment Console', async () => {
        await paymentConsole.goToPaymentConsole();
      });

      await test.step('Select business category account and preview', async () => {
        await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
        await paymentConsole.selectAccountCredential(validData.accountCredential);
        await paymentConsole.selectServiceType(validData.serviceType);
        await paymentConsole.clickPreview();
      });

      await test.step('Fill payment details', async () => {
        await paymentConsole.selectBillerAccount(validData.billerAccount);
        await paymentConsole.selectPaymentCategory(validData.paymentCategory);
        await paymentConsole.fillAmount(validData.amount);
      });

      await test.step('Click Pay and Confirm', async () => {
        await paymentConsole.clickPay();
        await paymentConsole.clickConfirm();
      });

      await test.step('Verify payment is successful', async () => {
        await paymentConsole.assertPaymentCancelled();
      });
    }
  );

  test(qase(1966, 'Pay specific bills using agent account'), { tag: ['@smoke', '@regression'] }, async () => {
    currentQaseId = 1966;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Select business category account and agent, then preview', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAgent(validData.agent);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Fill payment details', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount(validData.amount);
    });

    await test.step('Click Pay and Confirm', async () => {
      await paymentConsole.clickPay();
      await paymentConsole.clickConfirm();
    });

    await test.step('Verify payment is successful', async () => {
      await paymentConsole.assertPaymentCancelled();
    });
  });
});

// ==============================================================================
// TEST GROUP 4: PRN GENERATION
// ==============================================================================

test.describe('PRN Generation', () => {
  test(qase(1967, 'PRN Generation - Basic Flow'), { tag: ['@smoke', '@regression'] }, async () => {
    currentQaseId = 1967;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Select biller and payment details', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount(validData.amount);
    });

    await test.step('Generate PRN', async () => {
      await paymentConsole.generatePRN();
    });

    await test.step('Verify PRN is generated', async () => {
      await paymentConsole.assertPRNGenerated();
    });
  });

  test(qase(313, 'PRN Generation - Copy PRN'), { tag: ['@regression'] }, async () => {
    currentQaseId = 313;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Select biller and payment details', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount(validData.amount);
    });

    await test.step('Generate PRN', async () => {
      await paymentConsole.generatePRN();
    });

    await test.step('Copy PRN', async () => {
      await paymentConsole.copyPRN();
    });

    await test.step('Verify PRN is copied', async () => {
      await paymentConsole.assertPRNCopied();
    });
  });

  test(qase(314, 'PRN Generation - Multiple Attempts'), { tag: ['@regression'] }, async () => {
    currentQaseId = 314;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Select biller and payment details', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount(validData.amount);
    });

    await test.step('Generate PRN first time', async () => {
      await paymentConsole.generatePRN();
      await paymentConsole.assertPRNGenerated();
    });

    await test.step('Generate PRN second time', async () => {
      await paymentConsole.generatePRN();
      await paymentConsole.assertPRNGenerated();
    });
  });

  test(qase(316, 'PRN Generation - Error Recovery'), { tag: ['@regression'] }, async () => {
    currentQaseId = 316;

    await test.step('Navigate to Payment Console', async () => {
      await paymentConsole.goToPaymentConsole();
    });

    await test.step('Preview payment category', async () => {
      await paymentConsole.selectBusinessCategoryAccount(validData.businessCategoryAccount);
      await paymentConsole.selectAccountCredential(validData.accountCredential);
      await paymentConsole.selectServiceType(validData.serviceType);
      await paymentConsole.clickPreview();
    });

    await test.step('Fill invalid details to trigger error', async () => {
      await paymentConsole.selectBillerAccount(validData.billerAccount);
      await paymentConsole.selectPaymentCategory(validData.paymentCategory);
      await paymentConsole.fillAmount(invalidData.amount);
    });

    await test.step('Attempt PRN generation with invalid data', async () => {
      await paymentConsole.generatePRN();
    });

    await test.step('Correct the amount and retry PRN generation', async () => {
      await paymentConsole.fillAmount(validData.amount);
      await paymentConsole.generatePRN();
    });

    await test.step('Verify PRN is successfully generated after recovery', async () => {
      await paymentConsole.assertPRNGenerated();
    });
  });
});
