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
import { urls } from '../utils/testData';

// OTP fetch can retry up to 3 times (~80s each worst case) — don't let the
// default 90s test timeout kill the login mid-flight.
setup.setTimeout(240_000);

// Fast reachability probe before we attempt a browser login. The test env is
// intermittently slow/unreachable (we've seen ERR_NAME_NOT_RESOLVED and
// multi-minute hangs). Without this, a down backend makes auth — and then
// every dependent test — crawl to a timeout and burn 10+ minutes before
// anyone sees "it's just down." Here we fail FAST and LOUD instead.
//
// Throws with a clear message if the host doesn't answer within the budget.
async function assertEnvReachable(url: string, timeoutMs = 15_000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    // HEAD is enough — we only care that DNS resolves and the server answers.
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    const ms = Date.now() - start;
    console.log(`[auth.setup] Env reachable: ${url} → HTTP ${res.status} in ${ms}ms`);
  } catch (err: unknown) {
    const reason = (err as Error)?.name === 'AbortError'
      ? `no response within ${timeoutMs / 1000}s (slow or down)`
      : `${(err as Error)?.message ?? err}`;
    throw new Error(
      `[auth.setup] Test environment is UNREACHABLE: ${url}\n` +
      `  Reason: ${reason}\n` +
      `  This is an environment/network problem, not a test failure. ` +
      `Check VPN/connectivity and that the test env is up, then re-run.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

setup('authenticate', async ({ page }, testInfo) => {
  // Fail fast if the environment isn't reachable, before the slow login flow.
  await assertEnvReachable(urls.TEST_URL);

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
