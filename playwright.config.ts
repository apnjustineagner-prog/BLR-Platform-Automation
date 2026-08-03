// playwright.config.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// PLAYWRIGHT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
//
// KEY SETTINGS:
//   - workers: 2              → run tests in parallel (2 workers)
//   - maxFailures: 5          → stop after 5 failures (don't waste time on broken builds)
//   - video: 'on'             → record video for every test (uploaded to Qase)
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
  workers: 2,

  // Stop after 5 test failures — don't waste time on broken builds
  maxFailures: 5,

  retries: 3, // Retry failed tests up to 3 times

  // Per-test timeout — must cover beforeEach OTP login (up to ~25s) + test body
  timeout: 90_000,

  // Global timeout for all expect() assertions
  expect: {
    timeout: 10_000, // 10 seconds
  },

  use: {
    headless: true,

    // Reuse authenticated session saved by the 'setup' project
    storageState: 'storageState.json',

    // Record video for every test so each Qase result gets its own recording
    video: 'on',

    // Take screenshot only when a test fails
    screenshot: 'only-on-failure',

    // Max time to wait for a single action (click, fill, etc.). Clicks that
    // trigger a real page navigation block here (not on navigationTimeout)
    // until the navigation finishes, and this test env can take a while to
    // render — 10s was tripping that wait before the nav actually completed.
    actionTimeout: 30_000, // 30 seconds

    // Max time to wait for page.goto() to complete
    navigationTimeout: 30_000, // 30 seconds
  },

  // Reporters — where test results go
  reporter: [
    ['list'],
    ['playwright-qase-reporter', {
      mode: process.env.QASE_ENABLED === 'false' ? 'testops' : 'off',
      testops: {
        api: { token: process.env.QASE_TESTOPS_API_TOKEN },
        project: 'BLR',
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
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox',
      dependencies: ['setup'],
      use: {
        browserName: 'firefox',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'webkit',
      dependencies: ['setup'],
      use: {
        browserName: 'webkit',
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  // Running specific browser: npx playwright test --project=firefox
  // Running specific browser with Tags: npx playwright test --project=chromium --grep @smoke
});
