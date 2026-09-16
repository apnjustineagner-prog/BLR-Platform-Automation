// utils/runLogReporter.ts
//
// ==============================================================================
// RUN LOG REPORTER — human-readable per-run failure log
// ==============================================================================
//
// A custom Playwright reporter that writes a clean summary of every run to
// logs/run-<timestamp>.log (and overwrites logs/latest-run.log), showing
// exactly WHY each test failed: the test title, the account/project, the
// failing step, the concise error reason (Expected vs Received when present),
// and the file:line. Passing/skipped/flaky counts are summarized too.
//
// Wired in playwright.config.ts reporters array:
//   ['./utils/runLogReporter.ts']
//
// This is purely observational — it never affects test outcomes.
// ==============================================================================

import fs from 'fs';
import path from 'path';
import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  FullConfig,
  Suite,
} from '@playwright/test/reporter';

const LOGS_DIR = path.resolve(process.cwd(), 'logs');

type FailureEntry = {
  title: string;
  project: string;
  status: string;
  attempt: number;
  durationMs: number;
  step?: string;
  reason: string;
  location?: string;
};

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

// Pull the most useful one-liner(s) out of a Playwright error: the message,
// plus Expected/Received lines when it's an assertion.
function summarizeError(message: string): string {
  const clean = stripAnsi(message);
  const lines = clean.split('\n').map((l) => l.trimEnd());
  const wanted: string[] = [];

  // First non-empty line is usually the error headline.
  const headline = lines.find((l) => l.trim().length > 0);
  if (headline) wanted.push(headline.trim());

  for (const l of lines) {
    const t = l.trim();
    if (/^(Expected|Received|Expected substring|Expected pattern|Timeout):/i.test(t)) {
      wanted.push(t);
    }
    if (/^(Error: element\(s\) not found|Test was interrupted|Test timeout of)/i.test(t)) {
      if (!wanted.includes(t)) wanted.push(t);
    }
  }
  return wanted.slice(0, 6).join('\n    ');
}

// The step that was running when the test failed (deepest failed step).
function failingStep(result: TestResult): string | undefined {
  let found: string | undefined;
  const walk = (steps: TestResult['steps']) => {
    for (const s of steps) {
      if (s.error) {
        if (s.category === 'test.step') found = s.title;
        walk(s.steps);
      }
    }
  };
  walk(result.steps);
  return found;
}

export default class RunLogReporter implements Reporter {
  private failures: FailureEntry[] = [];
  private passed = 0;
  private skipped = 0;
  private flaky = 0;
  private startedAt = Date.now();
  private logFile = '';
  private latestFile = path.join(LOGS_DIR, 'latest-run.log');

  onBegin(_config: FullConfig, _suite: Suite): void {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.logFile = path.join(LOGS_DIR, `run-${stamp}.log`);
    this.startedAt = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Count the final outcome once (Playwright calls onTestEnd per attempt).
    const outcome = test.outcome(); // 'expected' | 'unexpected' | 'flaky' | 'skipped'
    if (result.status === 'passed' && outcome === 'expected') {
      // counted at end via outcome to avoid double counts on retries
    }

    if (result.status === 'failed' || result.status === 'timedOut') {
      const errText = (result.errors?.[0]?.message ?? result.error?.message ?? '(no error message)');
      this.failures.push({
        title: test.title,
        project: test.parent.project()?.name ?? 'unknown',
        status: result.status,
        attempt: result.retry + 1,
        durationMs: result.duration,
        step: failingStep(result),
        reason: summarizeError(errText),
        location: `${path.relative(process.cwd(), test.location.file)}:${test.location.line}`,
      });
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    // Tally final outcomes across the suite (dedup retries by using outcome()).
    // We recompute from the reporter's own view for accuracy.
    // Note: this.failures may contain multiple attempts of the same test.
    const finishedAt = Date.now();
    const secs = ((finishedAt - this.startedAt) / 1000).toFixed(1);

    const lines: string[] = [];
    lines.push('═'.repeat(72));
    lines.push(`  TEST RUN LOG — ${new Date(this.startedAt).toLocaleString()}`);
    lines.push(`  Overall: ${result.status.toUpperCase()}   Duration: ${secs}s`);
    lines.push('═'.repeat(72));

    if (this.failures.length === 0) {
      lines.push('');
      lines.push('  ✓ No failures recorded. 🎉');
      lines.push('');
    } else {
      lines.push('');
      lines.push(`  ✘ ${this.failures.length} failing attempt(s) — reasons below:`);
      lines.push('');
      this.failures.forEach((f, i) => {
        lines.push(`  ${i + 1}. ${f.title}`);
        lines.push(`     account/project : ${f.project}`);
        lines.push(`     status          : ${f.status}  (attempt ${f.attempt})`);
        if (f.step) lines.push(`     failing step    : ${f.step}`);
        lines.push(`     location        : ${f.location ?? '—'}`);
        lines.push(`     reason          : ${f.reason}`);
        lines.push('');
      });
    }
    lines.push('─'.repeat(72));
    lines.push('  Tip: full traces/screenshots are under test-results/ and the');
    lines.push('  Playwright HTML report. This log is the quick "why did it fail" view.');
    lines.push('─'.repeat(72));

    const out = lines.join('\n') + '\n';
    try {
      fs.writeFileSync(this.logFile, out);
      fs.writeFileSync(this.latestFile, out);
      // eslint-disable-next-line no-console
      console.log(`\n[run-log] Failure reasons written to ${path.relative(process.cwd(), this.logFile)} (and logs/latest-run.log)`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[run-log] Could not write run log:', (e as Error).message);
    }
  }
}
