// utils/testData.ts
//
// ==============================================================================
// SHARED TEST DATA CORE
// ==============================================================================
//
// PURPOSE:
//   Provides shared types, a generic data factory, and global constants.
//   Module-specific data lives in separate files
//
// FROZEN VS FRESH DATA:
//   FROZEN (default): Data generated ONCE, reused across all tests
//     - Use for: Tests that don't modify data (validation, error checking)
//     - Benefit: Faster execution, avoids database conflicts
//
//   FRESH (on demand): New data generated each time
//     - Use for: Tests that CREATE records
//     - Benefit: Avoids duplicate key conflicts
//
// ADDING A NEW MODULE:
//   1. Create utils/<moduleName>Data.ts
//   2. Define your fields type (each field must have FieldVariants)
//   3. Export getXxxTestData = createTestDataFactory<YourFields>(() => ({ ... }))
//   4. Add module-specific ui constants and existing record constants
//
// ==============================================================================

// ==============================================================================
// SHARED TYPES
// ==============================================================================

// Each field must have these 4 variants
export type FieldVariants = {
  valid: string; // Should pass validation
  long: string; // Exceeds max length
  invalid: string; // Contains forbidden characters
  missing: string; // Empty string (required field test)
};

// The final form data type — one value per field (generic over any field map)
export type FormData<T> = { [K in keyof T]: string };

// Four complete scenarios — one per variant type
export type ScenarioSet<T> = {
  valid: FormData<T>;
  long: FormData<T>;
  invalid: FormData<T>;
  missing: FormData<T>;
};

// ==============================================================================
// GENERIC TEST DATA FACTORY
// ==============================================================================
// Returns a getTestData() function scoped to a specific module.
// Each module calls createTestDataFactory() with its own generator function.
//
// Usage:
//   export const getTestData = createTestDataFactory<MyFields>(() => ({ ... }));
//
//   const { scenarios } = getTestData();         // frozen
//   const { scenarios } = getTestData(true);     // fresh

export function createTestDataFactory<T extends Record<string, FieldVariants>>(generator: () => T) {
  let frozen: { raw: T; scenarios: ScenarioSet<T> } | null = null;

  function buildScenarios(raw: T): ScenarioSet<T> {
    const buildScenario = (key: keyof FieldVariants): FormData<T> => {
      const result = {} as Record<keyof T, string>;
      for (const field in raw) {
        result[field as keyof T] = raw[field as keyof T][key];
      }
      return result as FormData<T>;
    };
    return {
      valid: buildScenario('valid'),
      long: buildScenario('long'),
      invalid: buildScenario('invalid'),
      missing: buildScenario('missing'),
    };
  }

  return function getTestData(fresh = false): {
    raw: T;
    scenarios: ScenarioSet<T>;
  } {
    if (fresh) {
      const raw = generator();
      return { raw, scenarios: buildScenarios(raw) };
    }
    if (!frozen) {
      const raw = generator();
      frozen = { raw, scenarios: buildScenarios(raw) };
    }
    return frozen;
  };
}

// ==============================================================================
// URL CONSTANTS — Environment URLs
// ==============================================================================

export const urls = {
  TEST_URL: 'https://test-web-admin.billeroo.com/login',
  SIMUL_URL: 'https://sapp.tlpe.io',
  PROD_URL: 'https://app.tlpe.io',
};

// ==============================================================================
// ERROR MESSAGES — Expected Validation Error Text
// ==============================================================================

export const errorMessages = {
  // Field-specific validation errors
  INVALID_COMPANY_NAME_MSG: 'Must be composed of alphanumeric, spaces, dots and dashes only.',
  INVALID_EMAIL_MSG: 'Invalid email format',
  INVALID_URL_MSG: 'Invalid URL format',
  INVALID_ADDRESS_MSG: 'Invalid value.',
  INVALID_CONTACT_MSG: 'Invalid contact number.',

  // Generic errors
  REQUIRED_FIELD_MSG: 'This field is required.',

  // Length limit errors
  EXCEEDEDCHAR_10_MSG: 'Only a maximum of 10 characters is allowed',
  EXCEEDEDCHAR_80_MSG: 'Only a maximum of 80 characters is allowed',
  EXCEEDEDCHAR_100_MSG: 'Please enter no more than 100 characters.',

  // Business rule errors
  EXISTING_EMAIL_MSG: 'Email already exists',
  DUPLICATE_AGENT_NAME_MSG: 'Agent name already exists',
};

// ==============================================================================
// SHARED TEST CREDENTIALS
// ==============================================================================

export const testCredentials = {
  defaultPassword:      'TestPassword123!',
  merchantUsername:     () => `testuser${Math.random().toString(36).slice(2, 9)}`,
  agentUsername:        () => `agent${Date.now()}`,
};

// ==============================================================================
// RANDOM BILL AMOUNT — ₱51.00–₱500.00
// ==============================================================================
// A fresh amount per call so repeat payment runs don't submit the exact same
// account + amount combination (observed causing duplicate-transaction
// rejections on the biller side).

export const randomBillAmount = (): string =>
  (Math.floor(Math.random() * (500 - 51 + 1)) + 51).toFixed(2);

// ==============================================================================
// MANILA WATER — Valid test account numbers
// ==============================================================================
// Rotate randomly across a pool of valid accounts, same reason as
// randomBillAmount — avoids resubmitting the same account+amount pair.

export const manilaWaterAccountNumbers = [
  '25202094',
  '24312673',
  '23621350',
  '23212060',
];

export const randomManilaWaterAccountNumber = (): string =>
  manilaWaterAccountNumbers[Math.floor(Math.random() * manilaWaterAccountNumbers.length)];

// ==============================================================================
// ONBOARDING — Merchant test data
// ==============================================================================

export const merchantData = {
  merchantWithLinkedAgents:            'Test Business SMQDEM',  // BLR-2721: has existing system users
  merchantForEdit:                     'SBR20113',              // DO NOT EDIT
  merchantDeletionUnsuccessfulMessage: 'invalid status : This business cannot be deleted because there are agents linked to it.',
  merchantSystemUsersMessage:          'invalid status : Merchant has existing system users.',
  merchantValidEmailToBeDeleted:       'apn.justineagner+1@gmail.com',
  merchantValidEmail:                  'apn.justineagner@gmail.com',
  existingMerchantEmail:               'apn.justineagner@gmail.com', // already-onboarded email for duplicate test
};

export const agentTestMerchant = {
  name:       'AltPayNet Corp. III - Operator',
  credential: 'AltpayNet Test Credential',
};
