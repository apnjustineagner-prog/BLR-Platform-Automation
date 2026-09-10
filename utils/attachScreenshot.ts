// utils/attachScreenshot.ts
//
// ==============================================================================
// SHARED SCREENSHOT + ATTACHMENT HELPER
// ==============================================================================
//
// Captures a screenshot (from a live Page or a pre-rendered PNG Buffer),
// bundles it into a PER-SPEC folder under screenshots/, and attaches it to
// BOTH the Playwright HTML report and Qase.
//
// BUNDLING: files are grouped by the spec file they came from, e.g. every
// screenshot taken by maynilad-water.spec.ts lands in:
//   screenshots/maynilad-water/
// The folder slug is derived from testInfo.file (the spec's filename) so no
// spec has to pass it explicitly.
//
// NAMING: <baseName>-<label>.png, where baseName is the Qase id (BLR-<id>)
// when one is provided, else the test title slug. label distinguishes multiple
// shots within one test (e.g. "final-page", "email-receipt").
//
// Qase attachment: the v2 reporter only reliably uploads attachments
// registered via qase.attach() — testInfo.attach() alone isn't picked up
// (confirmed 2026-09-09), so we do both.
//
// USAGE:
//   // full-page shot of the current page (typical afterEach)
//   await attachScreenshot(testInfo, { page, baseName: `BLR-${qaseId}` });
//
//   // a pre-rendered PNG buffer (e.g. the receipt email)
//   await attachScreenshot(testInfo, { buffer, baseName: `BLR-${qaseId}`, label: 'email-receipt' });
//
// ==============================================================================

import fs from 'fs';
import path from 'path';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';

const SCREENSHOTS_ROOT = path.resolve(process.cwd(), 'screenshots');

function slugify(value: string): string {
  return value
    .trim()
    .replace(/\.spec\.(ts|js)$/i, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// Folder slug from the spec filename, e.g.
// ".../Bayad/maynilad-water.spec.ts" -> "maynilad-water".
function specSlug(testInfo: TestInfo): string {
  const file = testInfo.file ? path.basename(testInfo.file) : testInfo.title;
  return slugify(file) || 'misc';
}

type AttachOptions = {
  // Provide exactly one of page/buffer/locator.
  page?: Page;
  buffer?: Buffer;
  // Screenshot a specific element — captures its FULL rendered size, including
  // content wider than the viewport (e.g. a wide, horizontally-scrolling
  // table), which page.screenshot({ fullPage }) can't reach.
  locator?: Locator;
  // Base file name without extension — typically `BLR-<qaseId>`. Falls back to
  // the test title slug when omitted.
  baseName?: string;
  // Distinguishes multiple shots within one test (e.g. "final-page",
  // "email-receipt"). Optional.
  label?: string;
  // Only used with `page` — full-page capture (default true).
  fullPage?: boolean;
};

/**
 * Writes a screenshot into screenshots/<spec-slug>/ and attaches it to both
 * the Playwright report and Qase. Never throws on attach failure — a
 * screenshot problem shouldn't fail the test.
 */
export async function attachScreenshot(testInfo: TestInfo, opts: AttachOptions): Promise<string> {
  const dir = path.join(SCREENSHOTS_ROOT, specSlug(testInfo));
  fs.mkdirSync(dir, { recursive: true });

  const base = opts.baseName?.trim() || slugify(testInfo.title) || 'screenshot';
  const name = opts.label ? `${base}-${slugify(opts.label)}` : base;
  const filePath = path.join(dir, `${name}.png`);

  if (opts.buffer) {
    fs.writeFileSync(filePath, opts.buffer);
  } else if (opts.locator) {
    // Element screenshot — captures the element's full rendered size, so a
    // wide table isn't clipped to the viewport width.
    await opts.locator.screenshot({ path: filePath });
  } else if (opts.page) {
    await opts.page.screenshot({ path: filePath, fullPage: opts.fullPage ?? true });
  } else {
    throw new Error('attachScreenshot: provide one of `page`, `buffer`, or `locator`.');
  }

  // Attach to the Playwright HTML report via a buffer (body) rather than
  // { path } — passing a path lets Playwright MOVE the file into its own
  // attachment store, which would empty our screenshots/<spec>/ folder on a
  // passing run. Reading the bytes and attaching the body leaves the original
  // file in place for the bundled folder.
  const bytes = fs.readFileSync(filePath);
  await testInfo.attach(name, { body: bytes, contentType: 'image/png' });
  // Attach to Qase (v2 reporter uploads only what's registered via qase.attach).
  try {
    qase.attach({ paths: filePath });
  } catch {
    // Reporter not active (e.g. QASE_ENABLED=false) — ignore.
  }

  return filePath;
}

/**
 * Renders an email's HTML in the given page and screenshots it (full-page),
 * bundling it alongside the test's other screenshots. Falls back to a plain
 * pre-formatted text render when no HTML is available.
 */
export async function attachEmailScreenshot(
  testInfo: TestInfo,
  page: Page,
  email: { html?: string; body?: string },
  opts: { baseName?: string; label?: string } = {},
): Promise<string> {
  const html =
    email.html && email.html.trim().length > 0
      ? email.html
      : `<pre style="font:14px/1.5 monospace;white-space:pre-wrap;padding:16px">${(email.body ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</pre>`;

  // Render into a throwaway page so we don't disturb the app page.
  const renderPage = await page.context().newPage();
  try {
    await renderPage.setContent(html, { waitUntil: 'load' });
    return await attachScreenshot(testInfo, {
      page: renderPage,
      baseName: opts.baseName,
      label: opts.label ?? 'email-receipt',
      fullPage: true,
    });
  } finally {
    await renderPage.close();
  }
}
