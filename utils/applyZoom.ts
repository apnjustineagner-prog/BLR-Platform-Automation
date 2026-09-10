// utils/applyZoom.ts
//
// Zooms the page content out (CSS zoom) so wide tables and tall modals fit in
// the viewport / a single screenshot. Applied per page in a beforeEach.
//
// Uses an init script so the zoom is re-applied on every navigation within the
// test, plus an immediate apply for the already-loaded page. CSS `zoom` is
// supported in Chromium and WebKit; Firefox ignores it gracefully (falls back
// to the larger viewport).
//
// USAGE (in a beforeEach):
//   await applyZoom(page, 0.6);   // 60%

import type { Page } from '@playwright/test';

export async function applyZoom(page: Page, factor = 0.6): Promise<void> {
  const css = `:root { zoom: ${factor}; }`;
  // Re-apply on every document (navigations within the test).
  await page.addInitScript((zoomCss) => {
    const apply = () => {
      const doc = (globalThis as any).document;
      if (!doc) return;
      let style = doc.getElementById('__test_zoom__');
      if (!style) {
        style = doc.createElement('style');
        style.id = '__test_zoom__';
        (doc.head || doc.documentElement).appendChild(style);
      }
      style.textContent = zoomCss;
    };
    apply();
    (globalThis as any).document?.addEventListener?.('DOMContentLoaded', apply);
  }, css);

  // Apply immediately to the page that's already loaded when this runs.
  await page.addStyleTag({ content: css }).catch(() => {});
}
