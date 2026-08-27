import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const STORAGE_FILE = path.resolve(process.cwd(), 'storageState.json');
const OUT_DIR = '/private/tmp/claude-502/-Users-jagner-Downloads-automation-template-main/23f3aaa2-ab3e-48d3-a130-9c814b56279f/scratchpad/payment-link-exploration';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: STORAGE_FILE });
  const page = await context.newPage();

  await page.goto('https://test-web-admin.billeroo.com/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  if (page.url().includes('/login')) {
    console.log('SESSION EXPIRED');
    await browser.close();
    return;
  }

  // Sidebar nav outerHTML — need the Payment Link parent li + its submenu items
  const sidebarHtml = await page.locator('ul.navbar-nav').first().evaluate((el) => el.outerHTML).catch(() => null);
  if (sidebarHtml) fs.writeFileSync(path.join(OUT_DIR, 'sidebar.html'), sidebarHtml);

  await page.goto('https://test-web-admin.billeroo.com/payment-link', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const listHtml = await page.locator('main, .container-fluid').first().evaluate((el) => el.outerHTML).catch(() => null);
  if (listHtml) fs.writeFileSync(path.join(OUT_DIR, 'list-page.html'), listHtml);

  const addBtn = page.getByRole('button', { name: /add payment link/i });
  await addBtn.waitFor({ timeout: 10000 });
  await addBtn.click();
  await page.waitForTimeout(1500);

  const modalHtml = await page.locator('.modal.show, .modal.in').first().evaluate((el) => el.outerHTML).catch(async () => {
    return page.locator('[role="dialog"]').first().evaluate((el) => el.outerHTML);
  });
  fs.writeFileSync(path.join(OUT_DIR, 'add-modal.html'), modalHtml);

  // Dynamic Web Biller page — check if table id / Add form differ from Static
  await page.goto('https://test-web-admin.billeroo.com/dwb-payment-link', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const dwbListHtml = await page.locator('main, .container-fluid').first().evaluate((el) => el.outerHTML).catch(() => null);
  if (dwbListHtml) fs.writeFileSync(path.join(OUT_DIR, 'dwb-list-page.html'), dwbListHtml);

  const dwbAddBtn = page.getByRole('button', { name: /add payment link/i });
  await dwbAddBtn.waitFor({ timeout: 10000 });
  await dwbAddBtn.click();
  await page.waitForTimeout(1500);
  const dwbModalHtml = await page.locator('.modal.show, .modal.in').first().evaluate((el) => el.outerHTML).catch(() => null);
  if (dwbModalHtml) fs.writeFileSync(path.join(OUT_DIR, 'dwb-add-modal.html'), dwbModalHtml);

  console.log('DONE');
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
