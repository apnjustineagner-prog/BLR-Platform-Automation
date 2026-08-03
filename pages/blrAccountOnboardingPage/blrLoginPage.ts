import { Page, expect } from '@playwright/test';
import { fetchOtpFromGmail } from '../../utils/fetchOtp';

type LoginCredentials = {
  username: string;
  password: string;
};

export class BlrLoginPage {
  private readonly emailInput;
  private readonly passwordInput;
  private readonly loginButton;

  constructor(private page: Page) {
    this.emailInput = page.getByRole('textbox', { name: 'Username' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password' });
    this.loginButton = page.getByRole('button', { name: 'Login' });
  }

  async gotoLogin() {
    // Don't wait for 'load' or networkidle here: with a saved session /login
    // redirects to the dashboard, which keeps a request pending indefinitely,
    // so neither event ever fires (observed 2026-07-04). Wait for a concrete
    // UI state instead — login form (logged out) or sidebar (logged in).
    await this.page.goto('https://test-web-admin.billeroo.com/login', {
      waitUntil: 'domcontentloaded',
    });
    await this.emailInput
      .or(this.page.getByRole('link', { name: 'Dashboard' }))
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });
  }

  async fillEmail(credentials: LoginCredentials) {
    await this.emailInput.waitFor({ state: 'visible' });
    await this.emailInput.fill(credentials.username);
  }

  async fillPassword(credentials: LoginCredentials) {
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.passwordInput.fill(credentials.password);
  }

  async submit() {
    await this.loginButton.waitFor({ state: 'visible' });
    await this.loginButton.click();
  }

  async handleOtp(code: string) {
    // Use pressSequentially so keydown/input events fire — plain fill() can silently no-op
    // on OTP inputs that rely on keyboard events to register each digit.
    for (let i = 1; i <= 6; i++) {
      const input = this.page.locator(`#otp${i}`);
      await input.waitFor({ state: 'visible' });
      await input.click();
      // Clear any digit left over from a rejected attempt before typing
      await input.fill('');
      await input.pressSequentially(code[i - 1], { delay: 50 });
    }
    // The submit button can render before the SPA attaches its click handler
    // (same class of bug already fixed for the "Add New Business" button in
    // blrDashboardPage.ts) — a single click can silently no-op: no error, no
    // navigation, no visible reaction at all, even with the correct code
    // (confirmed on video — the filled digits just sit there indefinitely).
    // Retry the click until the dashboard actually renders. noWaitAfter: this
    // app doesn't do a real page navigation on success (see the comment in
    // loginWithGmailOtp), so Playwright's own post-click nav wait would hang.
    // If the code is genuinely wrong, the dashboard never appears and this
    // silently gives up after the budget — the caller's own 30s success
    // check and resend/retry logic still runs normally in that case.
    const submitButton = this.page.getByRole('button', { name: /verify|submit|confirm/i });
    const dashboardLink = this.page.getByRole('link', { name: 'Dashboard' }).first();
    await expect(async () => {
      await submitButton.click({ noWaitAfter: true });
      await expect(dashboardLink).toBeVisible({ timeout: 3_000 });
    })
      .toPass({ timeout: 15_000 })
      .catch(() => {});
  }

  async loginAdmin(credentials: LoginCredentials) {
    await this.fillEmail(credentials);
    await this.fillPassword(credentials);
    await this.submit();
  }

  // Full login including Gmail OTP — use this when no storageState exists
  async loginWithGmailOtp(credentials: LoginCredentials) {
    const loginTime = new Date();

    // gotoLogin only waits for domcontentloaded, so fill() can land on the
    // pre-hydration inputs; when the SPA then mounts its controlled (empty)
    // inputs, both values are wiped and the click submits a blank form, which
    // client validation blocks — no request is sent and no OTP email goes out
    // (observed 2026-07-06: OTP wait timed out with both fields showing "This
    // field is required."). Retrying is safe in exactly that state, so retry
    // only when those validation errors are visible.
    const MAX_SUBMIT_ATTEMPTS = 3;
    let reachedOtp = false;
    for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt++) {
      await this.fillEmail(credentials);
      await this.fillPassword(credentials);
      await this.submit();

      reachedOtp = await this.page
        .waitForURL('**/otp', { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (reachedOtp) break;

      const fieldsWiped = await this.page
        .getByText('This field is required.')
        .first()
        .isVisible()
        .catch(() => false);
      if (!fieldsWiped) break;
      console.log(
        `[BlrLoginPage] Form submitted empty — SPA hydration wiped the inputs (attempt ${attempt}), re-filling...`
      );
    }
    if (!reachedOtp) {
      throw new Error(
        '[BlrLoginPage] OTP page never appeared after submitting credentials — check the screenshot for an app-side error'
      );
    }
    console.log('[BlrLoginPage] OTP page reached, fetching code from Gmail...');

    const MAX_OTP_ATTEMPTS = 3;
    let fetchAfter = loginTime;
    for (let attempt = 1; attempt <= MAX_OTP_ATTEMPTS; attempt++) {
      const otp = await fetchOtpFromGmail(fetchAfter);
      console.log(`[BlrLoginPage] Filling OTP (attempt ${attempt})...`);
      await this.handleOtp(otp);

      // The app renders the dashboard without a detectable URL change after
      // the code is verified, so URL-based checks (waitForURL) time out even
      // on success. Detect success by a logged-in-only element instead: the
      // sidebar "Dashboard" link exists on every authenticated page and never
      // on the OTP screen.
      const success = await this.page
        .getByRole('link', { name: 'Dashboard' })
        .first()
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => true)
        .catch(() => false);

      if (success) {
        // No networkidle wait here: the dashboard polls continuously, so the
        // network never goes idle. The visible sidebar is proof enough that
        // auth cookies are set, which is all storageState needs.
        console.log('[BlrLoginPage] Login successful');
        return;
      }

      if (attempt < MAX_OTP_ATTEMPTS) {
        console.log(`[BlrLoginPage] OTP rejected (attempt ${attempt}), requesting a fresh code...`);
        // Cutoff must be captured before the resend click so the new email
        // isn't filtered out as too old; the 10s slack absorbs clock skew
        // between this machine and the mail server (the rejected email is
        // ≥20s older, so it can't be re-picked).
        fetchAfter = new Date(Date.now() - 10_000);
        await this.requestOtpResend();
      }
    }

    throw new Error(`[BlrLoginPage] OTP login failed after ${MAX_OTP_ATTEMPTS} attempts`);
  }

  // A fresh OTP email only arrives if we ask for one — the app does not
  // auto-resend after a rejected code.
  private async requestOtpResend() {
    const resend = this.page
      .getByRole('button', { name: /resend/i })
      .or(this.page.getByText(/resend/i));
    try {
      await resend.first().click({ timeout: 10_000 });
    } catch {
      throw new Error(
        '[BlrLoginPage] Could not click a "Resend" control on the OTP page — without it no fresh code will ever arrive. Update requestOtpResend() with the real locator (or the control may be disabled behind a countdown).'
      );
    }
  }

  // Conditionally login (with OTP) only if the login form is visible
  async loginIfNeeded(credentials: LoginCredentials) {
    const isLoginPage = await this.emailInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (isLoginPage) {
      await this.loginWithGmailOtp(credentials);
    }
  }
}

export default BlrLoginPage;
