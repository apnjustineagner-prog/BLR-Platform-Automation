// tests/platform/Payment Link/SWB/sss-input-prn.benchmark.spec.ts
//
// ==============================================================================
// PAYMENT LINK — SWB — SSS — MANUAL PRN INPUT — E2E SPEED BENCHMARK (V1 vs V2)
// ==============================================================================
//
// Runs the FULL payment flow and times each step, so the current deployment
// (V1) can be compared against the new one (V2). Each run uses a fresh browser
// context (cold visitor) and is recorded (video + a screenshot per page).
//
// STEPS TIMED (each = action -> next page ready; typing/filling NOT timed):
//   1. Open PRN input page      goto /inputprn          -> PRN field visible
//   2. PRN lookup               Next                    -> Checkout Summary
//   3. Open consent             Next                    -> CONSENT modal shown
//   4. Consent -> TLPE          Proceed                 -> TLPE Customer Details
//   5. TLPE -> Confirm Payment  Next (Visa selected)    -> card form
//   6. Pay -> 3DS               PAY <amount>            -> 3DS Simulator
//   7. 3DS -> Payment Result    Approve + Submit        -> TRANSACTION SUCCESSFUL
//   8. Result -> Receipt        click "here"            -> SWB receipt status banner
// If the receipt reads anything other than "Payment has been posted
// successfully" (e.g. "Payment Posting Failed"), that PRN is logged as used and
// the run is retried with the next PRN — up to BENCH_MAX_ATTEMPTS PRNs per run
// (default 3), so a systemic posting outage can't burn the whole pool.
// For page navigations the server response time (TTFB) is also recorded.
//
// !! EACH RUN PAYS ONE PRN !! PRNs come from swbSssPaymentPrnPool in order;
// paid (or found already-paid) ones are logged to used-prns.json and skipped
// next time. Must run HEADED (TLPE fails before 3DS in headless).
//
// Output (benchmarks/swb-sss-input-prn/):
//   <BENCH_LABEL>-history.jsonl every run ever recorded for that label (appended)
//   <BENCH_LABEL>.json          averages over ALL posted runs in that history
//   used-prns.json              PRNs consumed so far
//   videos/<label>-run<n>-<prn>.webm
//
// Run (skipped unless BENCH_LABEL is set):
//   BENCH_LABEL=V1 npx playwright test "sss-input-prn.benchmark" --project=chromium-admin --no-deps --retries=0
//   BENCH_LABEL=V2 SWB_SSS_INPUT_PRN_URL=<v2 url> npx playwright test ...   (once V2 is deployed)
// Optional: BENCH_RUNS=<n> (default 1 — every run uses up a PRN),
//           BENCH_MAX_ATTEMPTS=<n> PRNs to try per run on posting failure (default 3).
//
// ==============================================================================

import { test, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { SwbSssPage } from '../../../../pages/PLATFORM(SUPERADMIN)/swbSssPage';
import { TlpeCheckoutPage } from '../../../../pages/PLATFORM(SUPERADMIN)/tlpeCheckoutPage';
import {
  swbSssInputPrnUrl,
  swbSssPaymentPrnPool,
  tlpeCustomerDetails,
  tlpeTestVisaCard,
} from '../../../../utils/paymentLinkData';
import { accountForProject } from '../../../../utils/accounts';
import { attachScreenshot } from '../../../../utils/attachScreenshot';

const LABEL = process.env.BENCH_LABEL;
const RUNS = Number(process.env.BENCH_RUNS ?? 1);
const MAX_ATTEMPTS = Number(process.env.BENCH_MAX_ATTEMPTS ?? 3);
const URL = process.env.SWB_SSS_INPUT_PRN_URL ?? swbSssInputPrnUrl;
const OUT_DIR = path.resolve(process.cwd(), 'benchmarks/swb-sss-input-prn');
const USED_PRNS_FILE = path.join(OUT_DIR, 'used-prns.json');
const VIDEO_DIR = path.join(OUT_DIR, 'videos');

const STEPS = [
  'openInputPrnPage',
  'prnLookup',
  'openConsent',
  'consentToTlpe',
  'tlpeToConfirmPayment',
  'payTo3ds',
  'threeDsToResult',
  'resultToReceipt',
] as const;
const POSTED_OK = 'Payment has been posted successfully';
type StepName = typeof STEPS[number];
// serverMs is null for steps that don't load a new page (e.g. the modal).
type StepTiming = { totalMs: number; serverMs: number | null };
type FailedAttempt = { prn: string; transactionReference: string; postingStatus: string };
type Run = {
  prn: string;
  transactionReference: string;
  postingStatus: string;
  steps: Record<StepName, StepTiming>;
  // Earlier PRNs in this run that were paid but did NOT post (then retried).
  postingFailedAttempts: FailedAttempt[];
};
type UsedPrn = { prn: string; at: string; label: string; result: string };

// Time from the current document's request start to its first response byte.
async function serverMs(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const nav = (globalThis as any).performance.getEntriesByType('navigation')[0];
    return nav ? Math.round(nav.responseStart - nav.requestStart) : null;
  });
}

// Runs `action`, then `ready`, and returns how long both took.
async function timed(page: Page, isNavigation: boolean, action: () => Promise<unknown>, ready: () => Promise<unknown>): Promise<StepTiming> {
  const t = Date.now();
  await action();
  await ready();
  return { totalMs: Date.now() - t, serverMs: isNavigation ? await serverMs(page) : null };
}

function readUsedPrns(): UsedPrn[] {
  try { return JSON.parse(fs.readFileSync(USED_PRNS_FILE, 'utf8')); } catch { return []; }
}

function markPrnUsed(entry: UsedPrn) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(USED_PRNS_FILE, JSON.stringify([...readUsedPrns(), entry], null, 2));
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { avg, median: sorted[Math.floor(sorted.length / 2)], min: sorted[0], max: sorted[sorted.length - 1] };
}

test.describe('Payment Link — SWB — SSS — Manual PRN input — E2E Benchmark', () => {
  test.skip(!LABEL, 'Set BENCH_LABEL (e.g. V1 / V2) to run the benchmark — it PAYS a PRN per run');

  test('Benchmark full manual-PRN payment flow', { tag: ['@benchmark'] }, async ({ browser }, testInfo) => {
    test.setTimeout(RUNS * MAX_ATTEMPTS * 300_000);
    const email = accountForProject(testInfo.project.name).paymentConsoleContext.email;
    const runs: Run[] = [];

    for (let i = 1; i <= RUNS; i++) {
      const used = new Set(readUsedPrns().map((u) => u.prn));
      const candidates = swbSssPaymentPrnPool.filter((p) => !used.has(p));
      if (candidates.length === 0) throw new Error('No unpaid PRNs left in swbSssPaymentPrnPool — add fresh ones.');

      let run: Run | undefined;
      const postingFailedAttempts: FailedAttempt[] = [];
      for (const prn of candidates) {
        if (postingFailedAttempts.length >= MAX_ATTEMPTS) break;
        // Fresh context per attempt = cold visitor, recorded on video.
        const context = await browser.newContext({
          storageState: { cookies: [], origins: [] },
          viewport: testInfo.project.use.viewport ?? undefined,
          recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
        });
        const page = await context.newPage();
        const swb = new SwbSssPage(page);
        const tlpe = new TlpeCheckoutPage(page);
        const steps = {} as Record<StepName, StepTiming>;
        const shot = (label: string) => attachScreenshot(testInfo, { page, label: `run${i}-${label}` });
        // Widened with `as` — it's reassigned inside the test.step callback, which TS doesn't track.
        let outcome = 'posted' as 'posted' | 'posting-failed' | 'already-paid';
        let transactionReference = '';
        let postingStatus = '';

        await test.step(`Run ${i}/${RUNS} — PRN ${prn}`, async () => {
          steps.openInputPrnPage = await timed(page, true,
            () => page.goto(URL, { waitUntil: 'domcontentloaded' }),
            () => swb.prnInput.waitFor({ state: 'visible', timeout: 60_000 }));
          await swb.dismissStartupModals();
          await shot('1-input-prn');

          await swb.fillPrn(prn);
          steps.prnLookup = await timed(page, true,
            () => swb.clickNext(),
            () => swb.checkoutSummaryHeading.or(swb.prnAlert).first().waitFor({ state: 'visible', timeout: 60_000 }));
          await shot('2-checkout-summary');
          if (!(await swb.checkoutSummaryHeading.isVisible())) {
            // Someone paid it since the pool was checked — log and try the next one.
            outcome = 'already-paid';
            console.log(`[benchmark ${LABEL}] PRN ${prn} rejected: "${(await swb.prnAlert.innerText()).trim()}" — skipping`);
            return;
          }

          await swb.waitForSummaryReady();
          steps.openConsent = await timed(page, false,
            () => swb.goToPaymentButton.click(),
            () => swb.consentModal.and(page.locator('.show')).waitFor({ state: 'visible', timeout: 30_000 }));
          await swb.acceptRequiredConsent();
          await shot('3-consent');

          steps.consentToTlpe = await timed(page, true,
            () => swb.clickConsentProceed(),
            () => tlpe.waitForTransactionInfo());
          await tlpe.fillCustomerDetails({ email, ...tlpeCustomerDetails });
          await tlpe.selectVisa();
          await shot('4-tlpe-transaction-info');

          steps.tlpeToConfirmPayment = await timed(page, true,
            () => tlpe.clickTransactionInfoNext(),
            () => tlpe.waitForConfirmPayment());
          await tlpe.fillCard(tlpeTestVisaCard);
          await shot('5-tlpe-confirm-payment');

          steps.payTo3ds = await timed(page, true,
            () => tlpe.clickPay(),
            () => tlpe.waitFor3ds());
          await shot('6-3ds-simulator');

          steps.threeDsToResult = await timed(page, true,
            () => tlpe.approve3ds(),
            () => tlpe.waitForPaymentResult());
          await shot('7-payment-result');
          transactionReference = await tlpe.getResultTransactionReference();

          const t = Date.now();
          await tlpe.clickHereToReturn();
          postingStatus = await swb.waitForReceipt();
          steps.resultToReceipt = { totalMs: Date.now() - t, serverMs: await serverMs(page) };
          await swb.dismissStartupModals();
          await shot('8-receipt');
          console.log(`[benchmark ${LABEL}] receipt: "${postingStatus}"`);
          if (postingStatus !== POSTED_OK) outcome = 'posting-failed';
        });

        markPrnUsed({
          prn, at: new Date().toISOString(), label: LABEL!,
          result: outcome === 'already-paid' ? 'already paid before this run' : `paid (txn ${transactionReference}) — ${postingStatus}`,
        });
        const video = page.video();
        await context.close();
        if (video) await video.saveAs(path.join(VIDEO_DIR, `${LABEL}-run${i}-${prn}${outcome === 'posted' ? '' : `-${outcome}`}.webm`)).catch(() => {});
        await video?.delete().catch(() => {});

        if (outcome === 'posted') {
          run = { prn, transactionReference, postingStatus, steps, postingFailedAttempts };
          break;
        }
        if (outcome === 'posting-failed') {
          postingFailedAttempts.push({ prn, transactionReference, postingStatus });
          console.log(`[benchmark ${LABEL}] PRN ${prn} paid but "${postingStatus}" — retrying with the next PRN`);
        }
      }
      if (!run) {
        throw new Error(postingFailedAttempts.length
          ? `Posting failed for ${postingFailedAttempts.length} PRN(s) in a row: ` +
            postingFailedAttempts.map((a) => `${a.prn} (txn ${a.transactionReference})`).join(', ') +
            ' — stopping so the pool isn\'t used up. Check SSS posting.'
          : 'Every remaining PRN in swbSssPaymentPrnPool is already paid — add fresh ones.');
      }

      console.log(`[benchmark ${LABEL}] run ${i} (PRN ${run.prn}, txn ${run.transactionReference}): ` +
        STEPS.map((s) => `${s}=${run!.steps[s].totalMs}ms`).join(', '));
      runs.push(run);
    }

    // 1) Append this invocation's runs to the label's history.
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const historyFile = path.join(OUT_DIR, `${LABEL}-history.jsonl`);
    const measuredAt = new Date().toISOString();
    for (const r of runs) {
      fs.appendFileSync(historyFile, JSON.stringify({ label: LABEL, url: URL, measuredAt, ...r }) + '\n');
    }

    // 2) Average over EVERY valid run in the history (so repeated invocations
    //    build up one baseline). Valid = payment posted + all steps timed.
    type HistoryRun = Run & { measuredAt: string; url: string };
    const history: HistoryRun[] = fs.readFileSync(historyFile, 'utf8')
      .split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const valid = history.filter((r) => r.postingStatus === POSTED_OK && STEPS.every((s) => r.steps?.[s]));
    const summary = Object.fromEntries(STEPS.map((s) => {
      const server = valid.map((r) => r.steps[s].serverMs).filter((v): v is number => v !== null);
      return [s, { total: stats(valid.map((r) => r.steps[s].totalMs)), server: server.length ? stats(server) : null }];
    }));
    const totals = valid.map((r) => STEPS.reduce((sum, s) => sum + r.steps[s].totalMs, 0));
    const result = {
      label: LABEL,
      url: URL,
      updatedAt: measuredAt,
      runsAveraged: valid.length,
      runsExcluded: history.length - valid.length,
      summary,
      totalFlow: stats(totals),
      rawRuns: valid,
    };
    const file = path.join(OUT_DIR, `${LABEL}.json`);
    fs.writeFileSync(file, JSON.stringify(result, null, 2));

    console.log(`\n[benchmark ${LABEL}] averages over ${valid.length} posted run(s) in history ` +
      `(${history.length - valid.length} excluded — posting failed or incomplete):`);
    for (const s of STEPS) {
      const { total, server } = summary[s] as { total: ReturnType<typeof stats>; server: ReturnType<typeof stats> | null };
      console.log(`  ${s.padEnd(22)} ${String(total.avg).padStart(6)}ms${server ? `  (server ${server.avg}ms)` : ''}`);
    }
    console.log(`  ${'TOTAL'.padEnd(22)} ${String(result.totalFlow.avg).padStart(6)}ms`);
    console.log(`[benchmark ${LABEL}] saved -> ${path.relative(process.cwd(), file)}`);

  });
});
