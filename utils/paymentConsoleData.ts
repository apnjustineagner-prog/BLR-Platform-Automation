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
import { activeAccount } from './accounts';

// ==============================================================================
// SHARED CONTEXT — the in-app business/credential/service the console uses.
// ==============================================================================
// Resolved from the account selected for this run (TEST_ACCOUNT — see
// utils/accounts.ts). Different roles may see different businesses/credentials
// in their dropdowns, so each account carries its own context. Defaults to the
// admin's AltPayNet Corp. III / AltPayNet Test Credential.

export const paymentConsoleContext = activeAccount().paymentConsoleContext;

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
  processor: 'ECPay' | 'Bayad' | 'SSS';
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
    // '99999200001' kept first as the stable default (confirmed working live
    // 2026-09-10). The rest are fallback test accounts — paySuccessfully()
    // swaps to the next untried one if a transaction is rejected as a duplicate
    // (ECPay's duplicate check is keyed by account number + amount).
    accountNumbers: ['99999200001', '99999100003', '99998067096'],
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
  // BAYAD "MANILA WATER" (Water Utility) — distinct from the ECPay "MANILA
  // WATER COMPANY" biller in the `billers` registry above. This one renders
  // the plain generic Bayad form (Account Number + Amount + Email(Optional),
  // no Account Name field), so it reuses the generic* helpers same as
  // Maynilad/Meralco. Stood up as the active Bayad pay-flow biller while
  // Meralco is hitting its monthly transaction limit (2026-09-09).
  // Account number, addOnFee (10), and full receipt confirmed live 2026-09-10
  // via the Payment Summary and on-screen receipt.
  manilaWater: {
    name: 'MANILA WATER',
    processor: 'Bayad',
    accountNumbers: ['12358959'],
    addOnFee: 10,
  },
  // MERALCO renders the plain generic Bayad form (Account Number + Amount +
  // Email(Optional), no Account Name field — confirmed live via the Payment
  // Console Transaction form), so it reuses the generic* helpers same as
  // Maynilad. Account number, add-on fee, and full receipt (incl. Account
  // Number rendering correctly, unlike ECPay) confirmed live 2026-09-08 via
  // the Payment Summary, on-screen/email receipt, and Transaction List.
  meralco: {
    name: 'MERALCO',
    processor: 'Bayad',
    // '3534336838' confirmed working live 2026-09-08 (full receipt + email +
    // Transaction List) — kept first as the stable default. The rest are
    // fallback test accounts to swap in if the default stops working.
    accountNumbers: [
      '3534336838',
      '0001026161',
      '0001037138',
      '0001062272',
      '0001102624',
      '0001172487',
      '1521485412',
      '1764147971',
      '1840507879',
      '1889810564',
    ],
    addOnFee: 0,
  },
};

// ==============================================================================
// SSS BILLERS — separate registry, separate suite (tests/platform/
// Payment Console/SSS/*.spec.ts)
// ==============================================================================
// Third processor alongside ECPay and Bayad. Two billers in the search
// directory — "SSS - Individual" and "SSS - Employer" — reached through the
// same Payment Console selection flow (business name -> biller account ->
// service type -> search -> select).
//
// NOTE: the biller-specific payment form fields for SSS are NOT captured yet
// (Individual and Employer likely differ, and both differ from Manila
// Water's ECPay form). accountNumbers/addOnFee are placeholders until the
// form is explored live — the current specs only navigate to and select the
// biller, they don't fill or submit the form.
export const sssBillers: Record<string, BillerConfig> = {
  individual: {
    name: 'SSS - Individual',
    processor: 'SSS',
    accountNumbers: [],
    addOnFee: 0,
  },
  employer: {
    name: 'SSS - Employer',
    processor: 'SSS',
    accountNumbers: [],
    addOnFee: 0,
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

// A low base peso (₱5–₱7) plus RANDOM CENTS (.00–.99), e.g. 5.23 / 6.41 / 7.08.
// ECPay's duplicate-transaction check is keyed by account number + amount, so
// the old fixed ₱6/₱11/₱13 pool collided easily and got runs rejected as
// duplicates (see paySuccessfully's retry-with-next-account fallback). The
// cents make each run's amount effectively unique (~300 combinations) so the
// same account number no longer trips that check. Base kept low because wallet
// balance is nearly exhausted (2026-08-10) — conserve what's left.
export const randomBillAmount = (): string => {
  const pesos = Math.floor(Math.random() * (7 - 5 + 1)) + 5; // 5..7
  const cents = Math.floor(Math.random() * 100);             // 0..99
  return (pesos + cents / 100).toFixed(2);
};

// Bayad enforces a Php20.00 minimum ("The minimum amount for payments must
// be at least Php20.00" — confirmed live 2026-09-01) — higher than ECPay's
// floor, so Bayad tests need their own random-amount helper. ₱20.00 up to
// ₱25.00 to stay minimal given the wallet balance constraint above.
export const randomBayadBillAmount = (): string =>
  (Math.floor(Math.random() * (25 - 20 + 1)) + 20).toFixed(2);
