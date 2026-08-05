// utils/paymentConsoleData.ts
//
// ==============================================================================
// PAYMENT CONSOLE MODULE — TEST DATA
// ==============================================================================
//
// PURPOSE:
//   All test data specific to the Payment Console module: the shared
//   business/credential context, the pool of billers under regression, and
//   random-value helpers used to avoid duplicate-transaction rejections on
//   repeat runs.
//
// USAGE:
//   import { paymentConsoleContext, billers, randomBillerAccountNumber,
//            randomAccountName, randomBillAmount } from '../../utils/paymentConsoleData';
//
// ==============================================================================

import { faker } from '@faker-js/faker';

// ==============================================================================
// SHARED CONTEXT — same business/credential/service type regardless of biller
// ==============================================================================

export const paymentConsoleContext = {
  businessCategoryAccount: 'AltPayNet Corp. III -',
  billerAccount: 'AltPayNet Test Credential',
  serviceType: 'Bills Payment',
  email: 'apn.justineagner@gmail.com',
};

// ==============================================================================
// BILLERS UNDER REGRESSION
// ==============================================================================
// Each biller's payment form fields/ids still need confirming via codegen
// (Manila Water's form is captured — see paymentConsolePage.ts; Laguna Water
// and Visayan Electric are not wired up yet, only their valid test accounts).

export type BillerConfig = {
  name: string;
  accountNumbers: string[];
};

export const billers: Record<string, BillerConfig> = {
  manilaWater: {
    name: 'MANILA WATER COMPANY',
    accountNumbers: ['25202094', '24312673', '23621350', '23212060'],
  },
  lagunaWater: {
    name: 'LAGUNAWATER WATER CORPORATION',
    accountNumbers: ['31515361'],
  },
  visayanElectric: {
    name: 'VISAYAN ELECTRIC COMPANY',
    accountNumbers: ['99999200001'],
  },
};

// ==============================================================================
// RANDOM VALUE HELPERS
// ==============================================================================
// A fresh account number / name / amount per call so repeat payment runs
// don't resubmit the exact same combination (observed causing
// duplicate-transaction rejections on the biller side).

export const randomBillerAccountNumber = (biller: BillerConfig): string =>
  biller.accountNumbers[Math.floor(Math.random() * biller.accountNumbers.length)];

// Correctly-formatted (8-digit, numeric) but not a real account — the form
// accepts it through Pay Now same as a valid number; the backend only
// rejects it after Confirm (confirmed live 2026-08-05, BLR-3682: redirects
// to payment-console-status-error with statusCode ER.00.05, "Please enter a
// valid account number").
export const invalidBillerAccountNumber = '00000000';

// faker.person.fullName() frequently adds a prefix/suffix ("Mr.", "Dr.",
// "V") and first/last names can be hyphenated or contain apostrophes
// ("Jakubowski-Frami", "O'Kon") — the biller payment form rejects those with
// "Please use a valid identifier name" (confirmed live 2026-07-31, BLR-3680).
// Strip to letters/spaces only so every generated name is accepted.
export const randomAccountName = (): string =>
  `${faker.person.firstName()} ${faker.person.lastName()}`
    .replace(/[^A-Za-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ₱51.00 up to (but not including) ₱500.00
export const randomBillAmount = (): string =>
  (Math.floor(Math.random() * (499 - 51 + 1)) + 51).toFixed(2);
