// utils/accounts.ts
//
// ==============================================================================
// TEST ACCOUNTS — MULTI-ACCOUNT SUPPORT
// ==============================================================================
//
// The Payment Console suite can run under several user roles. Which account a
// run uses is chosen by the TEST_ACCOUNT env var (defaults to `admin`):
//
//   TEST_ACCOUNT=mainMerchant npx playwright test "tests/platform/Payment Console"
//   TEST_ACCOUNT=subAgent     npx playwright test ...
//
// Each account has:
//   - login credentials (username/password),
//   - its own storageState file (so sessions don't clobber each other),
//   - the in-app Payment Console context it uses (which business / credential
//     / service type to select inside the console).
//
// OTP: every account's login OTP is delivered to the same Gmail inbox
// (GMAIL_USER in .env), so the existing fetchOtpFromGmail flow works for all.
//
// NOTE (2026-09-10): credentials are stored in PLAINTEXT here for now (test
// environment only). The admin account still reads its credentials from the
// encrypted credentials.enc via utils/decrypt. Move the rest to encryption
// (utils/encrypt) or env vars later if these need to be secret.
//
// ==============================================================================

import adminCredentials from './decrypt';

export type PaymentConsoleContext = {
  // The "Business Name" selector — only the admin/super-admin console has it.
  // Merchant/agent consoles are already scoped to their own business, so this
  // step is absent for them. When undefined, the flow SKIPS the business-name
  // selection and goes straight to Biller Account → Service Type.
  businessCategoryAccount?: string;
  billerAccount: string;
  serviceType: string;
  email: string;
};

export type Processor = 'ECPay' | 'Bayad' | 'SSS';

export type TestAccount = {
  // Short key used for TEST_ACCOUNT and the storageState filename.
  key: string;
  // Human label for logs.
  label: string;
  username: string;
  password: string;
  // Per-account session file, e.g. storageState.mainMerchant.json.
  storageStateFile: string;
  // In-app Payment Console selections for this account. Different roles may
  // see different businesses/credentials in their dropdowns.
  paymentConsoleContext: PaymentConsoleContext;
  // Which payment processors this account's Biller Account credential can run.
  // Determined by the credentials visible in the account's Biller Account
  // dropdown — e.g. Main Merchant only has ECPAY CREDS, so it's ECPay-only.
  // Suites for a processor the account doesn't support are skipped.
  processors: Processor[];
};

// The email the receipts/OTP go to — shared across accounts for now.
const RECEIPT_EMAIL = 'apn.justineagner@gmail.com';

// Default in-app context (the admin's business/credential). Override per
// account below once each role's visible business/credential is confirmed live.
const DEFAULT_CONTEXT: PaymentConsoleContext = {
  businessCategoryAccount: 'AltPayNet Corp. III -',
  billerAccount: 'AltPayNet Test Credential',
  serviceType: 'Bills Payment',
  email: RECEIPT_EMAIL,
};

export const accounts: Record<string, TestAccount> = {
  admin: {
    key: 'admin',
    label: 'Admin (Super Admin)',
    // Admin creds come from the encrypted credentials.enc (unchanged).
    username: adminCredentials.username,
    password: adminCredentials.password,
    storageStateFile: 'storageState.json',
    paymentConsoleContext: { ...DEFAULT_CONTEXT },
    // Admin has ECPay, Bayad, and SSS credentials.
    processors: ['ECPay', 'Bayad', 'SSS'],
  },
  mainMerchant: {
    key: 'mainMerchant',
    label: 'Main Merchant',
    username: 'mainlevel2',
    password: 'Qwertymeow!2',
    storageStateFile: 'storageState.mainMerchant.json',
    // Merchant console has NO Business Name selector (already scoped to its
    // own business) — omit businessCategoryAccount so the flow skips that step.
    // Only Biller Account (ECPAY CREDS) + Service Type, then search the biller.
    // Confirmed live 2026-09-10.
    paymentConsoleContext: {
      billerAccount: 'ECPAY CREDS',
      serviceType: 'Bills Payment',
      email: RECEIPT_EMAIL,
    },
    // Main Merchant's Biller Account dropdown shows only ECPAY CREDS — no Bayad
    // or SSS credential — so it can only run ECPay billers (confirmed live
    // 2026-09-15). Bayad/SSS suites are skipped for this account.
    processors: ['ECPay'],
  },
  subMerchant: {
    key: 'subMerchant',
    label: 'Sub Merchant',
    username: 'Sublevel',
    password: 'SubLevel01Password321!1',
    storageStateFile: 'storageState.subMerchant.json',
    paymentConsoleContext: { ...DEFAULT_CONTEXT },
    // TODO: confirm which credentials Sub Merchant has; assume ECPay for now.
    processors: ['ECPay'],
  },
  mainAgent: {
    key: 'mainAgent',
    label: 'Main Agent',
    username: 'resty.MainAgent',
    password: 'Qwertymeow!2',
    storageStateFile: 'storageState.mainAgent.json',
    paymentConsoleContext: { ...DEFAULT_CONTEXT },
    // TODO: confirm which credentials Main Agent has; assume ECPay for now.
    processors: ['ECPay'],
  },
  subAgent: {
    key: 'subAgent',
    label: 'Sub Agent',
    username: 'resty.SubAgent',
    password: 'Qwertymeow!2',
    storageStateFile: 'storageState.subAgent.json',
    paymentConsoleContext: { ...DEFAULT_CONTEXT },
    // TODO: confirm which credentials Sub Agent has; assume ECPay for now.
    processors: ['ECPay'],
  },
};

// Ordered list of account keys — drives the per-account projects in
// playwright.config.ts.
export const ACCOUNT_KEYS = Object.keys(accounts) as Array<keyof typeof accounts>;

// Look up an account by key; throws with the valid list on a bad key.
export function accountForKey(key: string): TestAccount {
  const account = accounts[key];
  if (!account) {
    throw new Error(
      `Unknown account "${key}". Valid values: ${ACCOUNT_KEYS.join(', ')}.`,
    );
  }
  return account;
}

// Derive the account key from a project name. Per-account projects are named
// "<prefix>-<accountKey>" (e.g. "chromium-mainMerchant", "setup-subAgent").
// Falls back to admin when the name has no recognizable account suffix.
export function accountKeyFromProjectName(projectName: string): string {
  for (const key of ACCOUNT_KEYS) {
    if (projectName === key || projectName.endsWith(`-${key}`)) return key as string;
  }
  return 'admin';
}

// The account selected for this run. Prefers TEST_ACCOUNT (terminal runs);
// otherwise defaults to admin. Per-account PROJECT runs resolve the account
// from the project name instead (see accountForProject / auth.setup.ts).
export function activeAccount(): TestAccount {
  const key = process.env.TEST_ACCOUNT?.trim() || 'admin';
  return accountForKey(key);
}

// Resolve the account for a running test from its project name (per-account
// projects are "chromium-<key>"). Use inside a beforeEach:
//   const account = accountForProject(test.info().project.name);
export function accountForProject(projectName: string): TestAccount {
  return accountForKey(accountKeyFromProjectName(projectName));
}

// Whether the account running under this project supports a given processor.
// Use to skip a processor's suite for accounts that lack its credential:
//   test.skip(!projectSupports(test.info().project.name, 'Bayad'), 'reason');
export function projectSupports(projectName: string, processor: Processor): boolean {
  return accountForProject(projectName).processors.includes(processor);
}
