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
//
// Payment Console routes a payment through one of two processors depending
// on the biller: ECPay or Bayad. Every biller below is ECPay — Manila
// Water, Laguna Water, and Visayan Electric (VECO) are all ECPay billers.
// Bayad billers (Meralco, Maynilad Water — BLR-3671–3676) live in the
// separate `bayadBillers` registry below and their own spec file
// (tests/platform/Payment Console/bayad.spec.ts) — don't assume they share
// this registry or ecpay.spec.ts's helpers.

export type BillerConfig = {
  name: string;
  processor: 'ECPay' | 'Bayad';
  accountNumbers: string[];
  // Flat add-on fee (₱) charged on top of the bill amount, per the Payment
  // Summary breakdown (confirmed live 2026-08-10). Service fee is always
  // ₱0.00 for every biller — payment console has no payment gateway
  // implementation — so it isn't tracked per-biller (see SERVICE_FEE below).
  addOnFee: number;
};

export const billers: Record<string, BillerConfig> = {
  manilaWater: {
    name: 'MANILA WATER COMPANY',
    processor: 'ECPay',
    // '26412953' removed (2026-09-02) — permanently flagged as a double
    // transaction backend-side, regardless of amount: 5 retries with 5
    // different amounts (6.00, 8.00, 5.00, 5.00, 10.00) all rejected it, and
    // a manual retry afterward with yet another amount (10.00) still got
    // rejected. Not a per-amount or time-windowed block, so no retry logic
    // can work around it — just don't use it.
    accountNumbers: ['24312673', '23621350', '23212060'],
    addOnFee: 10,
  },
  lagunaWater: {
    name: 'LAGUNAWATER WATER CORPORATION',
    processor: 'ECPay',
    accountNumbers: ['31515361'],
    addOnFee: 10,
  },
  visayanElectric: {
    name: 'VISAYAN ELECTRIC COMPANY',
    processor: 'ECPay',
    accountNumbers: ['99999200001'],
    addOnFee: 9,
  },
};

// ==============================================================================
// BAYAD BILLERS — separate registry, separate suite (tests/platform/
// Payment Console/bayad.spec.ts)
// ==============================================================================
// Kept apart from `billers` above on purpose — that registry/ecpay.spec.ts's
// helpers are ECPay-only by design (see that file's header comment).
// Confirmed live 2026-09-01: Bayad billers render through the same
// Payment Console modal/receipt (#dynamicModalBody / #dynamicReceiptContent,
// same ids as ECPay), so they reuse PaymentConsolePage rather than the
// older, unfinished bayadPage.ts — only the biller-specific payment form
// differs (Maynilad Water has a plain "Account Number" + "Amount" +
// "Email(Optional)", no separate "Account Name" field like Manila Water).
export const bayadBillers: Record<string, BillerConfig> = {
  mayniladWater: {
    name: 'MAYNILAD WATER',
    processor: 'Bayad',
    accountNumbers: ['62725870'],
    addOnFee: 10,
  },
};

// ==============================================================================
// PAYMENT SUMMARY BREAKDOWN — Add-on Fee / Service Fee / Total Amount
// ==============================================================================
// Confirmed live 2026-08-10 (Manila Water Payment Summary modal): Total
// Amount = Bill Amount + Add-on Fee + Service Fee.

// Service fee is always ₱0.00 for every biller — payment console has no
// payment gateway implementation.
export const SERVICE_FEE = '0.00';

export const computeTotalAmount = (amount: string, biller: BillerConfig): string =>
  (parseFloat(amount) + biller.addOnFee).toFixed(2);

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

// ₱5.00 up to ₱10.00 — wallet balance is nearly exhausted (2026-08-10), so
// keep test payment amounts minimal to conserve what's left.
export const randomBillAmount = (): string =>
  (Math.floor(Math.random() * (10 - 5 + 1)) + 5).toFixed(2);

// Bayad enforces a Php20.00 minimum ("The minimum amount for payments must
// be at least Php20.00" — confirmed live 2026-09-01) — higher than ECPay's
// floor, so Bayad tests need their own random-amount helper. ₱20.00 up to
// ₱25.00 to stay minimal given the wallet balance constraint above.
export const randomBayadBillAmount = (): string =>
  (Math.floor(Math.random() * (25 - 20 + 1)) + 20).toFixed(2);
