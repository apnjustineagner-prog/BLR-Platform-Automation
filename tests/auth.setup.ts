// tests/auth.setup.ts
//
// ==============================================================================
// AUTH SETUP PROJECT - LOGIN WITH GMAIL OTP, SAVE SESSION
// ==============================================================================
//
// Runs as the 'setup' project before every browser project (see
// playwright.config.ts → dependencies: ['setup']). Logs in via the real
// Gmail OTP flow and saves the session to storageState.json, which all
// test contexts then reuse.
//
// This replaces the old globalSetup ('global-setup-gmail.ts'). A setup
// project runs everywhere — CLI, VS Code extension, and UI mode — whereas
// globalSetup is skipped by the VS Code extension / UI mode.
//
// ==============================================================================

import { test as setup } from '@playwright/test';
import path from 'path';
import { BlrLoginPage } from '../pages/blrAccountOnboardingPage/blrLoginPage';
import credentials from '../utils/decrypt';
import { cleanBillerooEmails } from '../utils/cleanInbox';

const STORAGE_FILE = path.resolve(process.cwd(), 'storageState.json');

// OTP fetch can retry up to 3 times (~80s each worst case) — don't let the
// default 90s test timeout kill the login mid-flight.
setup.setTimeout(240_000);

setup('authenticate', async ({ page }) => {
  // Clear out Billeroo emails from previous runs before login triggers a new
  // OTP — keeps the inbox from piling up. Best-effort: a cleanup hiccup must
  // never fail authentication.
  await cleanBillerooEmails().catch((err) =>
    console.warn('[auth.setup] Inbox cleanup failed (continuing):', err.message ?? err)
  );

  const loginPage = new BlrLoginPage(page);
  await loginPage.gotoLogin();
  await loginPage.loginIfNeeded(credentials);
  await page.context().storageState({ path: STORAGE_FILE });
  console.log('[auth.setup] Session saved to storageState.json');
});
