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

import { defineConfig } from '@playwright/test';
import 'dotenv/config';

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

    // Reuse authenticated session saved by the 'setup' project
    storageState: 'storageState.json',

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
  projects: [
    // Logs in via Gmail OTP and saves storageState.json. Declared as a
    // dependency of the browser projects so it runs everywhere — CLI,
    // VS Code extension, and UI mode (globalSetup is skipped by the latter two).
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        browserName: 'chromium',
        // Start from a clean session — storageState.json doesn't exist yet
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        browserName: 'chromium',
        // Fit-the-screen viewport (1080p). Larger than the old 1280x720 so
        // wide tables/modals fit; combined with the 60% page zoom applied in
        // the top-level `use` init script.
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'firefox',
      dependencies: ['setup'],
      use: {
        browserName: 'firefox',
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'webkit',
      dependencies: ['setup'],
      use: {
        browserName: 'webkit',
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
  // Running specific browser: npx playwright test --project=firefox
  // Running specific browser with Tags: npx playwright test --project=chromium --grep @smoke
});
