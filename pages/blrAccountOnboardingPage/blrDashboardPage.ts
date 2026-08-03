import { Page, expect } from '@playwright/test';

export class BlrDashboardPage {
  private readonly onboardingModule;
  private readonly addNewBusinessModalButton;

  constructor(private page: Page) {
    this.onboardingModule = page.locator('#merchant');
    this.addNewBusinessModalButton = page.locator('#addMerchantModalButton');
  }

  async goToOnboardingModule() {
    await this.onboardingModule.waitFor({ state: 'visible' });
    await this.onboardingModule.scrollIntoViewIfNeeded();
    // The click triggers a real page navigation, and this test env can take
    // up to a minute to render. Playwright's post-click "wait for navigation
    // to finish" step is bound to the global actionTimeout (10s), which is
    // too short here — give it the same budget as page.goto() elsewhere.
    await this.onboardingModule.click({ timeout: 60_000 });
    await expect(this.page).toHaveURL(/.*\/(merchant|business-category).*/, { timeout: 60_000 });
    console.log('[BlrDashboardPage] Navigated to Onboarding module');
    // Don't use waitForLoadState('networkidle') — the Billeroo SPA polls in the
    // background so the network never goes idle. Wait for the page's primary
    // action button instead as the readiness signal.
    await this.addNewBusinessModalButton.waitFor({ state: 'visible', timeout: 60_000 });
  }
  async clickAddNewBusinessModalButton() {
    // The button can render before the SPA attaches its click handler, so a
    // single click may land on a dead button. Retry the click until the modal
    // actually opens.
    const modal = this.page.locator('#addMerchantModal');
    await expect(async () => {
      await this.addNewBusinessModalButton.click();
      await expect(modal).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
    console.log('[BlrDashboardPage] Add New Business modal opened');
  }
}

export default BlrDashboardPage;
