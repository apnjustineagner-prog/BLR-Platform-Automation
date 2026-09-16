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
import { cleanBillerooEmails } from '../utils/cleanInbox';
import { accountForKey, accountKeyFromProjectName } from '../utils/accounts';

// OTP fetch can retry up to 3 times (~80s each worst case) — don't let the
// default 90s test timeout kill the login mid-flight.
setup.setTimeout(240_000);

setup('authenticate', async ({ page }, testInfo) => {
  // Each per-account setup project is named "setup-<accountKey>" (e.g.
  // "setup-mainMerchant"), so the account for this login is derived from the
  // project name. Its session is saved to that account's own file so runs
  // under different accounts don't clobber each other's session.
  const account = accountForKey(accountKeyFromProjectName(testInfo.project.name));
  const storageFile = path.resolve(process.cwd(), account.storageStateFile);

  console.log(`[auth.setup] Authenticating as: ${account.label} (${account.username})`);

  // Clear out Billeroo emails from previous runs before login triggers a new
  // OTP — keeps the inbox from piling up. Best-effort: a cleanup hiccup must
  // never fail authentication.
  await cleanBillerooEmails().catch((err) =>
    console.warn('[auth.setup] Inbox cleanup failed (continuing):', err.message ?? err)
  );

  const loginPage = new BlrLoginPage(page);
  await loginPage.gotoLogin();
  await loginPage.loginIfNeeded({ username: account.username, password: account.password });
  await page.context().storageState({ path: storageFile });
  console.log(`[auth.setup] Session saved to ${account.storageStateFile}`);
});
