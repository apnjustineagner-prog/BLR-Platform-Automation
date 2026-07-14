// global-setup-gmail.ts
//
// ==============================================================================
// GLOBAL SETUP - LOGIN WITH REAL OTP FETCHED FROM GMAIL
// ==============================================================================
//
// PURPOSE:
//   Logs in to the app and handles the OTP step by fetching the 6-digit
//   code from Gmail via IMAP using just email + App Password.
//
// REQUIRED .env VARIABLES:
//   CREDENTIAL_KEY     → AES key to decrypt credentials.enc
//   CREDENTIAL_IV      → AES IV to decrypt credentials.enc
//   GMAIL_USER         → Gmail address that receives the OTP emails
//   GMAIL_APP_PASSWORD → 16-character App Password from Google Account
//
// HOW TO GET AN APP PASSWORD:
//   1. Go to myaccount.google.com → Security
//   2. Enable 2-Step Verification (required)
//   3. Search "App Passwords" → create one → copy the 16-char password
//   4. Add to .env:
//        GMAIL_USER=you@gmail.com
//        GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
//
// TO USE THIS SETUP:
//   playwright.config.ts → globalSetup: './global-setup-gmail.ts'
//
// ==============================================================================

import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { ImapFlow } from 'imapflow';
import { urls } from './utils/testData';
import credentials from './utils/decrypt';

// ==============================================================================
// CONFIGURATION
// ==============================================================================

const STORAGE_FILE = path.resolve(process.cwd(), 'storageState.json');

// How long to wait for the OTP email to arrive (ms)
const OTP_EMAIL_TIMEOUT_MS = 60_000;

// How often to poll Gmail for the OTP email (ms)
const OTP_POLL_INTERVAL_MS = 3_000;

// ==============================================================================
// MIME HELPER - Extract plain text body from raw email source
// ==============================================================================

function extractPlainText(raw: string): string {
  // Split on MIME boundaries and find text/plain parts
  const parts = raw.split(/--[^\r\n]+/);
  for (const part of parts) {
    if (!/content-type:\s*text\/plain/i.test(part)) continue;

    // Find the encoding
    const encodingMatch = part.match(/content-transfer-encoding:\s*(\S+)/i);
    const encoding = encodingMatch?.[1]?.toLowerCase() ?? 'none';

    // Body starts after the blank line separating headers from content
    const bodyStart = part.indexOf('\r\n\r\n');
    const body = bodyStart !== -1 ? part.slice(bodyStart + 4) : part;

    if (encoding === 'base64') {
      return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8');
    }
    if (encoding === 'quoted-printable') {
      return body
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
    return body;
  }
  return '';
}

// ==============================================================================
// GMAIL IMAP HELPER - Fetch OTP from inbox
// ==============================================================================

async function fetchOtpFromGmail(afterTimestamp: Date): Promise<string> {
  const deadline = Date.now() + OTP_EMAIL_TIMEOUT_MS;

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  });

  await client.connect();
  await client.mailboxOpen('INBOX');

  try {
    while (Date.now() < deadline) {
      // Search all emails from today — we'll filter by exact time below
      const uids = await client.search({ since: afterTimestamp });

      // Fetch envelope (headers) + body for each, newest first
      const uidList = Array.isArray(uids) ? [...uids].reverse() : [];

      for (const uid of uidList) {
        const msg = await client.fetchOne(String(uid), {
          envelope: true,
          source: true,
        });

        if (!msg) continue;
        if (!msg.envelope?.date) continue;

        // Skip emails that arrived before we triggered the OTP
        const emailDate = new Date(msg.envelope.date);
        if (emailDate < afterTimestamp) continue;

        const raw = msg.source?.toString('utf8') ?? '';

        // Debug: dump raw email to file for inspection
        require('fs').writeFileSync('/tmp/otp_email_debug.txt', raw);
        console.log(
          `[global-setup-gmail] Raw email dumped to /tmp/otp_email_debug.txt (${raw.length} bytes)`
        );

        // Extract plain text part from MIME — most reliable source for the OTP
        const plainText = extractPlainText(raw);
        const searchIn = plainText || raw;

        // Look for 6-digit number near OTP-related keywords
        const contextMatch = searchIn.match(
          /(?:otp|code|verification|verify|token|digit)[^a-z\d]{0,60}(\d{6})|(\d{6})[^a-z\d]{0,60}(?:otp|code|verification|verify|expired|minutes)/i
        );
        if (contextMatch) {
          const otp = contextMatch[1] ?? contextMatch[2];
          console.log(`[global-setup-gmail] OTP found by context: ${otp}`);
          return otp;
        }

        // Fallback: first 6-digit number that isn't a CSS color (#xxxxxx) or all-zeros
        const fallback = searchIn.match(/(?<!#)\b([1-9]\d{5}|\d{5}[1-9])\b/);
        if (fallback) {
          console.log(`[global-setup-gmail] OTP found (fallback): ${fallback[1]}`);
          return fallback[1];
        }

        console.log(`[global-setup-gmail] No OTP found in email dated ${msg.envelope.date}`);
      }

      console.log('[global-setup-gmail] OTP email not yet received, retrying...');
      await new Promise((r) => setTimeout(r, OTP_POLL_INTERVAL_MS));
    }
  } finally {
    await client.logout();
  }

  throw new Error(`OTP email not received within ${OTP_EMAIL_TIMEOUT_MS / 1000}s`);
}

// ==============================================================================
// GLOBAL SETUP FUNCTION
// ==============================================================================

async function globalSetup(config: FullConfig) {
  console.log('[global-setup-gmail] Starting login with Gmail OTP...');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
      'Missing Gmail credentials in .env\n' +
        'Required: GMAIL_USER and GMAIL_APP_PASSWORD\n' +
        'See: myaccount.google.com → Security → App Passwords'
    );
  }

  // Remove any stale session so workers never load an expired storageState
  if (fs.existsSync(STORAGE_FILE)) {
    fs.unlinkSync(STORAGE_FILE);
    console.log('[global-setup-gmail] Removed stale storageState.json');
  }

  const headless = config.projects[0]?.use?.headless ?? true;
  const browser = await chromium.launch({ headless: headless as boolean });
  const context = await browser.newContext({ baseURL: urls.TEST_URL });
  const page = await context.newPage();

  try {
    // ------------------------------------------------------------------
    // STEP 1: Load credentials
    // ------------------------------------------------------------------
    const { username, password } = credentials;

    if (!username || !password) {
      throw new Error('USERNAME or PASSWORD missing from decrypted credentials');
    }

    // ------------------------------------------------------------------
    // STEP 2: Navigate to login page
    // ------------------------------------------------------------------
    await page.goto(urls.TEST_URL);

    // ------------------------------------------------------------------
    // STEP 3: Fill login credentials
    // ------------------------------------------------------------------
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);

    // Record timestamp just before submitting — only want emails after this
    const loginTime = new Date();

    await page.getByRole('button', { name: 'Login' }).click();

    // ------------------------------------------------------------------
    // STEP 4: Wait for OTP page
    // ------------------------------------------------------------------
    await page.waitForURL('**/otp', { timeout: 15_000 });
    console.log('[global-setup-gmail] OTP page reached, fetching code from Gmail...');

    // ------------------------------------------------------------------
    // STEP 5: Fetch the real OTP from Gmail
    // ------------------------------------------------------------------
    const otp = await fetchOtpFromGmail(loginTime);
    console.log('[global-setup-gmail] Filling OTP...');

    // ------------------------------------------------------------------
    // STEP 6: Fill the 6 individual OTP digit inputs
    // ------------------------------------------------------------------
    for (let i = 1; i <= 6; i++) {
      const input = page.locator(`#otp${i}`);
      await input.click();
      await input.fill(otp[i - 1]);
      await page.waitForTimeout(100);
    }

    // Screenshot after filling OTP — to verify inputs are populated
    await page.screenshot({ path: '/tmp/otp_filled.png' });
    console.log('[global-setup-gmail] OTP filled — screenshot at /tmp/otp_filled.png');

    // Log what buttons are visible on the page
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      console.log(
        `[global-setup-gmail] Button found: "${await btn.textContent()}" visible=${await btn.isVisible()}`
      );
    }

    // ------------------------------------------------------------------
    // STEP 7: Submit OTP
    // ------------------------------------------------------------------
    await page.getByRole('button', { name: /verify|submit|confirm/i }).click();
    console.log('[global-setup-gmail] OTP submit button clicked');

    // ------------------------------------------------------------------
    // STEP 8: Wait for successful login and verify sidebar is accessible
    // ------------------------------------------------------------------
    await page.waitForURL('https://test-web-admin.billeroo.com/dashboard', {
      timeout: 30_000,
    });
    await page.waitForLoadState('networkidle');
    await page.locator('#merchant').waitFor({ state: 'visible', timeout: 15_000 });
    console.log('[global-setup-gmail] Dashboard verified — #merchant sidebar item is visible');

    // ------------------------------------------------------------------
    // STEP 9: Save authenticated session
    // ------------------------------------------------------------------
    await context.storageState({ path: STORAGE_FILE });

    console.log('[global-setup-gmail] Login successful');
    console.log('[global-setup-gmail] Session saved to storageState.json');
  } catch (error) {
    console.error('[global-setup-gmail] Login FAILED');
    console.error('[global-setup-gmail] Error details:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
