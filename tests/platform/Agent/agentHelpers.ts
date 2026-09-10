// tests/platform/Agent/agentHelpers.ts
//
// ==============================================================================
// AGENT MODULE — SHARED HELPERS
// ==============================================================================
//
// Shared setup for the Agent module spec(s) in this folder (agent.spec.ts).
// Agent is a separate top-level module from Onboarding (see the sidebar:
// Management -> Onboarding, Management -> Agent), so it gets its own folder and
// helper file rather than living under Onboarding.
//
// Cross-module helpers shared with Onboarding (activateAgent, cleanupAgent,
// completeAccountSetup) live in utils/onboardingCommon.ts and are imported
// directly by the agent spec.
//
// USAGE (in a spec):
//   import { registerAgentHooks, agentState, setQaseId } from './agentHelpers';
//   registerAgentHooks();   // wires beforeEach/afterEach
//
// ==============================================================================

import { test, type Page } from '@playwright/test';
import { attachScreenshot } from '../../../utils/attachScreenshot';
import { BlrLoginPage } from '../../../pages/blrAccountOnboardingPage/blrLoginPage';
import { OnboardingPage } from '../../../pages/PLATFORM(SUPERADMIN)/onboardingPage';

// Shared per-test state, mirroring the original onboarding.spec.ts module-level
// vars. currentPage is needed by cleanup tasks that run in afterEach (the test
// fixture's `page` isn't in scope there for closures created in the test body).
export const agentState: {
  loginPage: BlrLoginPage;
  onboarding: OnboardingPage;
  currentPage: Page;
  currentQaseId: number;
  cleanupTasks: Array<() => Promise<void>>;
} = {
  loginPage: undefined as unknown as BlrLoginPage,
  onboarding: undefined as unknown as OnboardingPage,
  currentPage: undefined as unknown as Page,
  currentQaseId: 0,
  cleanupTasks: [],
};

export function setQaseId(id: number) {
  agentState.currentQaseId = id;
}

// Wires the shared per-test setup/teardown. Call once at the top of each Agent
// spec (before the describe block).
export function registerAgentHooks() {
  test.beforeEach(async ({ page }) => {
    agentState.currentPage = page;
    agentState.loginPage = new BlrLoginPage(page);
    agentState.onboarding = new OnboardingPage(page);
    agentState.currentQaseId = 0;
    agentState.cleanupTasks = [];

    // Test env pages can take upwards of a minute to render, so every test in
    // this module gets the extended timeout the slowest tests already used.
    test.setTimeout(180_000);

    // domcontentloaded + sidebar wait, not 'load'/networkidle: the dashboard
    // keeps polling indefinitely, so networkidle never fires.
    await page.goto('https://test-web-admin.billeroo.com/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.getByRole('link', { name: 'Dashboard' }).first().waitFor({ state: 'visible', timeout: 60_000 });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Screenshot first — before cleanup — so the capture shows the test's
    // final UI state, not the post-deletion state after cleanup runs.
    // Bundled under screenshots/<spec-slug>/ and attached to Playwright + Qase.
    const baseName = agentState.currentQaseId ? `BLR-${agentState.currentQaseId}` : undefined;
    await attachScreenshot(testInfo, { page, baseName, label: 'final-page' });

    for (const task of agentState.cleanupTasks) {
      try { await task(); } catch (e) { console.warn('[cleanup] failed:', e); }
    }
  });
}
