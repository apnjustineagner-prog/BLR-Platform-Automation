// global-teardown.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL TEARDOWN - CLEANUP AFTER ALL TESTS
// ═══════════════════════════════════════════════════════════════════════════
//
// PURPOSE:
//   Runs ONCE after all test workers finish
//   Deletes the session file for security
//
// RUNS:
//   Automatically after all tests complete
//   Configured in playwright.config.ts → globalTeardown
//
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { activeAccount } from './utils/accounts';

// Delete the session file for the account this run used (TEST_ACCOUNT).
const STORAGE_FILE = path.resolve(process.cwd(), activeAccount().storageStateFile);

async function globalTeardown() {
  // KEEP_SESSION=1 preserves storageState.json so it can be reused by
  // `npx playwright codegen --load-storage=storageState.json <url>`
  if (process.env.KEEP_SESSION === '1') {
    console.log('[global-teardown] KEEP_SESSION=1 — storageState.json kept.');
    return;
  }
  if (fs.existsSync(STORAGE_FILE)) {
    fs.unlinkSync(STORAGE_FILE);
    console.log('[global-teardown] storageState.json deleted.');
  }
}

export default globalTeardown;
