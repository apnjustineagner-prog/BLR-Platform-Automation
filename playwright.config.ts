// playwright.config.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// PLAYWRIGHT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
//
// KEY SETTINGS:
//   - workers: 2              → run tests in parallel (2 workers)
//   - maxFailures: 5          → stop after 5 failures (don't waste time on broken builds)
//   - video: 'off'             → disabled while Qase TestOps storage is full
//   - screenshot: 'only-on-failure' → take screenshot when test fails
//
// QASE REPORTER:
//   - mode: 'off' by default   → change to 'testops' to send results to Qase
//   - Set QASEAPI env variable → export QASE_TESTOPS_API_TOKEN=your_api_token
//   - Update project code      → project: 'TLPE'
//   - Update run ID            → run: { id: 237 }
//
// ═══════════════════════════════════════════════════════════════════════════

import { defineConfig, type Project } from '@playwright/test';
import 'dotenv/config';
import { accounts, ACCOUNT_KEYS } from './utils/accounts';

const VIEWPORT = { width: 1920, height: 1080 };

// Build one setup project + one chromium browser project PER ACCOUNT so each
// account is independently runnable (and clickable in the VS Code Test
// Explorer). Naming: "setup-<key>" and "chromium-<key>" (e.g.
// "chromium-mainMerchant") — auth.setup.ts / the specs derive the account from
// the project name via accountKeyFromProjectName().
//
// Each browser project depends ONLY on its own setup, so running a single
// account (e.g. --project=chromium-mainMerchant, or clicking it in the Test
// Explorer) triggers exactly one login — no other accounts.
//
// NOTE: running ALL accounts at once would fire multiple OTP logins that could
// race for codes in the single shared Gmail inbox. If you run everything,
// serialize the logins with --workers=1 (the OTP fetcher also matches by
// recency + retries, which absorbs mild overlap). Running one account at a
// time — the normal case — is unaffected.
function buildAccountProjects(): Project[] {
  const projects: Project[] = [];

  for (const key of ACCOUNT_KEYS) {
    const account = accounts[key];
    const setupName = `setup-${key}`;
    const browserName = `chromium-${key}`;

    projects.push({
      name: setupName,
      testMatch: /auth\.setup\.ts/,
      use: {
        browserName: 'chromium',
        // Start clean — the account's storageState file doesn't exist yet.
        storageState: { cookies: [], origins: [] },
      },
    });

    projects.push({
      name: browserName,
      dependencies: [setupName],
      use: {
        browserName: 'chromium',
        viewport: VIEWPORT,
        // Load this account's saved session.
        storageState: account.storageStateFile,
      },
    });
  }

  return projects;
}

// Bumped from the original 10s/10s/30s (30s/30s/90s) — this test env is
// intermittently slow enough to trip those on otherwise-passing runs.
// Centralized here so the next bump is a one-line change, not a hunt
// through `use`/top-level config for scattered magic numbers.
const ACTION_TIMEOUT_MS     = 45_000;
const NAVIGATION_TIMEOUT_MS = 45_000;   
const EXPECT_TIMEOUT_MS     = 15_000;
const TEST_TIMEOUT_MS       = 120_000;

function buildRunTitle(): string {
  const specArg = process.argv.find(arg => arg.endsWith('.spec.ts'));
  const specName = specArg
    ? (specArg.split('/').pop() ?? '').replace('.spec.ts', '')
    : '';
  const label = specName
    ? specName.charAt(0).toUpperCase() + specName.slice(1)
    : '';
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  return label ? `Automated Run - ${label} ${dateStr}` : `Automated Run ${dateStr}`;
}

export default defineConfig({
  // Global teardown (login is handled by the 'setup' project — see projects below)
  globalTeardown: './global-teardown.ts',
  // Where your test files are located
  testDir: './tests',

  // Run all tests in parallel across and within files
  fullyParallel: true,
  workers: 3,

  // Stop after 5 test failures — don't waste time on broken builds
  maxFailures: 5,

  retries: 2, // Retry failed tests up to 2 times

  // Per-test timeout — must cover beforeEach OTP login (up to ~25s) + test body
  timeout: TEST_TIMEOUT_MS,

  // Global timeout for all expect() assertions
  expect: {
    timeout: EXPECT_TIMEOUT_MS,
  },

  use: {
    headless: false,

    // storageState is set PER PROJECT (each chromium-<account> loads its own
    // account's session — see buildAccountProjects below), so it's not set
    // globally here.

    // Video recording off entirely while Qase TestOps storage is full —
    // re-enable ('retain-on-failure') once space is cleared/upgraded
    video: 'off',

    // Take a full-page screenshot only when a test fails. fullPage captures
    // the entire scrollable page (not just the viewport) so long views like
    // the Payment Summary / receipt / transaction list are captured whole.
    screenshot: { mode: 'only-on-failure', fullPage: true },

    // Max time to wait for a single action (click, fill, etc.). Clicks that
    // trigger a real page navigation block here (not on navigationTimeout)
    // until the navigation finishes, and this test env can take a while to
    // render — 10s was tripping that wait before the nav actually completed.
    actionTimeout: ACTION_TIMEOUT_MS,

    // Max time to wait for page.goto() to complete
    navigationTimeout: NAVIGATION_TIMEOUT_MS,
  },

  // Reporters — where test results go
  reporter: [
    ['list'],
    // Writes a human-readable "why did it fail" summary per run to
    // logs/run-<timestamp>.log and logs/latest-run.log.
    ['./utils/runLogReporter.ts'],
    ['playwright-qase-reporter', {
      mode: process.env.QASE_ENABLED === 'true' ? 'testops' : 'off',
      testops: {
        api: { token: process.env.QASE_TESTOPS_API_TOKEN },
        project: 'BLR',
        // Attachment upload is off while Qase account storage is full (507
        // "Storage is full" on upload). Results/steps still report; screenshots
        // won't be pushed. Flip back to true once storage is cleared/upgraded.
        uploadAttachments: false,
        run: {
          title: buildRunTitle(),
          complete: true,
        },
      },
    }],
  ],
  // One setup-<account> + one chromium-<account> project per account.
  projects: buildAccountProjects(),
  // Run a single account:   npx playwright test --project=chromium-mainMerchant
  // Run the admin account:  npx playwright test --project=chromium-admin
  // Run one spec, one acct: npx playwright test "tests/platform/Payment Console/ECPay/manila-water-company.spec.ts" --project=chromium-admin
  // In the VS Code Test Explorer each chromium-<account> is listed/clickable.
});
