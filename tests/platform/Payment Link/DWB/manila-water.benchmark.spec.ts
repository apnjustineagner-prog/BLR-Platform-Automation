// tests/platform/Payment Link/DWB/manila-water.benchmark.spec.ts
//
// ==============================================================================
// PAYMENT LINK — DWB — MANILA WATER COMPANY — E2E SPEED BENCHMARK
// ==============================================================================
//
// Runs the FULL payment flow and times each step, for before/after comparisons
// (e.g. V1 baseline vs V1 after a code enhancement). Each run uses a fresh
// browser context (cold visitor), is recorded on video, and screenshots every
// page. Same step layout as the SWB benchmark so the two compare directly.
//
// STEPS TIMED (each = action -> next page ready; typing/filling NOT timed):
//   1. Open payment page        goto /payment            -> form visible
//   2. Form to Payment Summary  Next                     -> Payment Summary
//   3. Open consent             Next                     -> CONSENT modal shown
//   4. Consent -> TLPE          Proceed                  -> TLPE Customer Details
//   5. TLPE -> Confirm Payment  Next (Visa selected)     -> card form
//   6. Pay -> 3DS               PAY <amount>             -> 3DS Simulator     (gateway)
//   7. 3DS -> Payment Result    Approve + Submit         -> TRANSACTION SUCCESSFUL (gateway)
//   8. Result -> Receipt        click "here"             -> receipt status banner
// BLR Platform runtime = steps 1–5 and 8; steps 6–7 are the payment gateway.
// For page navigations the server response time (TTFB) is also recorded.
//
// Each run pays the reusable Manila Water account with its own random amount
// (the biller rejects the same account + amount twice in a day). If the
// receipt is not "Payment has been posted successfully", the run is repeated
// with a new amount, up to BENCH_MAX_ATTEMPTS times. Must run HEADED.
//
// Output (benchmarks/dwb-manila-water/):
//   <BENCH_LABEL>-history.jsonl every run recorded for that label (appended)
//   <BENCH_LABEL>.json          averages over ALL posted runs in that history
//   videos/<label>-run<n>-<amount>.webm
//
// Run (skipped unless BENCH_LABEL is set):
//   BENCH_LABEL=V1 BENCH_RUNS=4 npx playwright test "manila-water.benchmark" --project=chromium-admin --no-deps --retries=0 --headed
//
// ==============================================================================

import { test, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { DwbPaymentPage } from '../../../../pages/PLATFORM(SUPERADMIN)/dwbPaymentPage';
import { TlpeCheckoutPage } from '../../../../pages/PLATFORM(SUPERADMIN)/tlpeCheckoutPage';
import {
  dwbManilaWaterUrl,
  dwbManilaWaterAccount,
  tlpeCustomerDetails,
  tlpeTestVisaCard,
} from '../../../../utils/paymentLinkData';
import { accountForProject } from '../../../../utils/accounts';
import { attachScreenshot } from '../../../../utils/attachScreenshot';

const LABEL = process.env.BENCH_LABEL;
const RUNS = Number(process.env.BENCH_RUNS ?? 1);
const MAX_ATTEMPTS = Number(process.env.BENCH_MAX_ATTEMPTS ?? 3);
const URL = process.env.DWB_URL ?? dwbManilaWaterUrl;
const OUT_DIR = path.resolve(process.cwd(), 'benchmarks/dwb-manila-water');
const VIDEO_DIR = path.join(OUT_DIR, 'videos');
const ACCOUNT_NAME = 'Justine Agner';
const POSTED_OK = 'Payment has been posted successfully';
const randomAmount = () => ((1001 + Math.floor(Math.random() * 8999)) / 100).toFixed(2);

const STEPS = [
  'openPaymentPage',
  'formToSummary',
  'openConsent',
  'consentToTlpe',
  'tlpeToConfirmPayment',
  'payTo3ds',
  'threeDsToResult',
  'resultToReceipt',
] as const;
type StepName = typeof STEPS[number];
type StepTiming = { totalMs: number; serverMs: number | null };
type Run = {
  amount: string;
  transactionReference: string;
  postingStatus: string;
  steps: Record<StepName, StepTiming>;
  postingFailedAttempts: { amount: string; transactionReference: string; postingStatus: string }[];
};

async function serverMs(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const nav = (globalThis as any).performance.getEntriesByType('navigation')[0];
    return nav ? Math.round(nav.responseStart - nav.requestStart) : null;
  });
}

async function timed(page: Page, isNavigation: boolean, action: () => Promise<unknown>, ready: () => Promise<unknown>): Promise<StepTiming> {
  const t = Date.now();
  await action();
  await ready();
  return { totalMs: Date.now() - t, serverMs: isNavigation ? await serverMs(page) : null };
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { avg, median: sorted[Math.floor(sorted.length / 2)], min: sorted[0], max: sorted[sorted.length - 1] };
}

test.describe('Payment Link — DWB — Manila Water — E2E Benchmark', () => {
  test.skip(!LABEL, 'Set BENCH_LABEL (e.g. V1) to run the benchmark — it makes real test payments');

  test('Benchmark full DWB payment flow', { tag: ['@benchmark'] }, async ({ browser }, testInfo) => {
    test.setTimeout(RUNS * MAX_ATTEMPTS * 300_000);
    const email = accountForProject(testInfo.project.name).paymentConsoleContext.email;
    const [firstName, ...rest] = ACCOUNT_NAME.split(' ');
    const runs: Run[] = [];

    for (let i = 1; i <= RUNS; i++) {
      let run: Run | undefined;
      const postingFailedAttempts: Run['postingFailedAttempts'] = [];

      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !run; attempt++) {
        const context = await browser.newContext({
          storageState: { cookies: [], origins: [] },
          viewport: testInfo.project.use.viewport ?? undefined,
          recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
        });
        const page = await context.newPage();
        const dwb = new DwbPaymentPage(page);
        const tlpe = new TlpeCheckoutPage(page);
        const steps = {} as Record<StepName, StepTiming>;
        const shot = (label: string) => attachScreenshot(testInfo, { page, label: `run${i}-${label}` });
        let amount = '';
        let transactionReference = '';
        let postingStatus = '';

        await test.step(`Run ${i}/${RUNS}, attempt ${attempt}`, async () => {
          steps.openPaymentPage = await timed(page, true,
            () => page.goto(URL, { waitUntil: 'domcontentloaded' }),
            () => dwb.accountNumberInput.waitFor({ state: 'visible', timeout: 60_000 }));
          await shot('1-payment-page');

          // A random amount can (rarely) repeat one already paid today — then
          // the biller rejects it on Next; re-time with a fresh amount.
          for (let tries = 1; ; tries++) {
            amount = randomAmount();
            await dwb.fillManilaWaterForm({ accountNumber: dwbManilaWaterAccount, accountName: ACCOUNT_NAME, amount, email });
            steps.formToSummary = await timed(page, true,
              () => dwb.clickNext(),
              () => dwb.summaryHeading.or(dwb.duplicateTransactionMessage).first().waitFor({ state: 'visible', timeout: 60_000 }));
            if (await dwb.summaryHeading.isVisible()) break;
            if (tries >= 3) throw new Error(`Double-transaction rejection on 3 amounts for ${dwbManilaWaterAccount}`);
            console.log(`[benchmark ${LABEL}] amount ${amount} already paid today — retrying`);
            await page.goto(URL, { waitUntil: 'domcontentloaded' });
            await dwb.accountNumberInput.waitFor({ state: 'visible', timeout: 60_000 });
          }
          await shot('2-payment-summary');

          await dwb.waitForSummaryReady();
          steps.openConsent = await timed(page, false,
            () => dwb.goToPaymentButton.click(),
            () => dwb.consentModal.and(page.locator('.show')).waitFor({ state: 'visible', timeout: 30_000 }));
          await dwb.acceptRequiredConsent();
          await shot('3-consent');

          steps.consentToTlpe = await timed(page, true,
            () => dwb.clickConsentProceed(),
            () => tlpe.waitForTransactionInfo());
          await tlpe.fillCustomerDetails({ firstName, lastName: rest.join(' '), email, ...tlpeCustomerDetails });
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
          postingStatus = await dwb.waitForReceipt();
          steps.resultToReceipt = { totalMs: Date.now() - t, serverMs: await serverMs(page) };
          await shot('8-receipt');
          console.log(`[benchmark ${LABEL}] run ${i} amount ${amount} txn ${transactionReference}: "${postingStatus}"`);
        });

        const posted = postingStatus === POSTED_OK;
        const video = page.video();
        await context.close();
        if (video) await video.saveAs(path.join(VIDEO_DIR, `${LABEL}-run${i}-${amount}${posted ? '' : '-posting-failed'}.webm`)).catch(() => {});
        await video?.delete().catch(() => {});

        if (posted) run = { amount, transactionReference, postingStatus, steps, postingFailedAttempts };
        else postingFailedAttempts.push({ amount, transactionReference, postingStatus });
      }
      if (!run) {
        throw new Error(`Posting failed on ${MAX_ATTEMPTS} attempts: ` +
          postingFailedAttempts.map((a) => `${a.amount} PHP (txn ${a.transactionReference})`).join(', ') + ' — check posting.');
      }
      console.log(`[benchmark ${LABEL}] run ${i}: ` + STEPS.map((s) => `${s}=${run!.steps[s].totalMs}ms`).join(', '));
      runs.push(run);
    }

    // History (appended) -> averages over every posted, complete run.
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const historyFile = path.join(OUT_DIR, `${LABEL}-history.jsonl`);
    const measuredAt = new Date().toISOString();
    for (const r of runs) fs.appendFileSync(historyFile, JSON.stringify({ label: LABEL, url: URL, measuredAt, ...r }) + '\n');

    type HistoryRun = Run & { measuredAt: string; url: string };
    const history: HistoryRun[] = fs.readFileSync(historyFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const valid = history.filter((r) => r.postingStatus === POSTED_OK && STEPS.every((s) => r.steps?.[s]));
    const summary = Object.fromEntries(STEPS.map((s) => {
      const server = valid.map((r) => r.steps[s].serverMs).filter((v): v is number => v !== null);
      return [s, { total: stats(valid.map((r) => r.steps[s].totalMs)), server: server.length ? stats(server) : null }];
    }));
    const totals = valid.map((r) => STEPS.reduce((sum, s) => sum + r.steps[s].totalMs, 0));
    const file = path.join(OUT_DIR, `${LABEL}.json`);
    fs.writeFileSync(file, JSON.stringify({
      label: LABEL, url: URL, updatedAt: measuredAt,
      runsAveraged: valid.length, runsExcluded: history.length - valid.length,
      summary, totalFlow: stats(totals), rawRuns: valid,
    }, null, 2));

    console.log(`\n[benchmark ${LABEL}] averages over ${valid.length} posted run(s):`);
    for (const s of STEPS) {
      const { total, server } = summary[s] as { total: ReturnType<typeof stats>; server: ReturnType<typeof stats> | null };
      console.log(`  ${s.padEnd(22)} ${String(total.avg).padStart(6)}ms${server ? `  (server ${server.avg}ms)` : ''}`);
    }
    console.log(`[benchmark ${LABEL}] saved -> ${path.relative(process.cwd(), file)}`);
  });
});
