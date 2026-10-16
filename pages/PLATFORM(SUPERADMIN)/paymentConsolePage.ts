// pages/PLATFORM(SUPERADMIN)/paymentConsolePage.ts
//
// ==============================================================================
// PAYMENT CONSOLE — PAGE OBJECT
// ==============================================================================
//
// TEST CASES COVERED:
//
//   PREVIEW PAYMENT CATEGORY
//     BLR-914  Unsuccessfully preview — no account credential
//     BLR-915  Unsuccessfully preview — no service type
//     BLR-916  Successfully preview — without agent
//     BLR-917  Successfully preview — with agent
//
//   SEARCH & SELECT
//     BLR-918  Search a specific biller account
//     BLR-919  Select payment category using search option
//     BLR-920  Select a specific biller account
//
//   PAY BILLS
//     BLR-921  Cancel bills payment
//     BLR-922  Pay with empty fields
//     BLR-923  Pay with invalid input
//     BLR-924  Pay with invalid account number
//     BLR-925  Pay with insufficient balance
//     BLR-926  Pay with negative amount
//     BLR-927  Pay without email input
//     BLR-928  Pay with email input
//     BLR-929  Pay using business category account
//     BLR-930  Pay using agent account
//
//   PRN GENERATION
//     BLR-312  PRN Generation - Basic Flow
//     BLR-313  PRN Generation - Copy PRN
//     BLR-314  PRN Generation - Multiple Attempts
//     BLR-316  PRN Generation - Error Recovery
//
// FORM FIELD ORDER (from UI):
//   1. Business Category Account
//   2. Agent (optional)
//   3. Account Credential
//   4. Service Type
//   → Preview → Biller category list appears
//
// ==============================================================================

import { Page, expect } from '@playwright/test';

// ==============================================================================
// PAGE OBJECT
// ==============================================================================

export class PaymentConsolePage {
  // --- Locators ---------------------------------------------------------------

  private readonly businessCategoryAccountSelect;
  private readonly select2SearchBox;
  private readonly agentSelect;
  private readonly accountCredentialSelect;
  private readonly serviceTypeSelect;
  private readonly billerSearchInput;
  private readonly billerSearchResults;
  private readonly paymentCategorySelect;
  private readonly amountInput;
  private readonly emailInput;
  private readonly previewButton;
  private readonly payButton;
  private readonly cancelButton;
  private readonly confirmPayButton;
  private readonly billerCategoryList;
  private readonly prnDisplay;
  private readonly copyPrnButton;
  private readonly generatePrnButton;

  // MANILA WATER COMPANY biller payment form (ids captured live 2026-07-22).
  // id starts with a digit, so match by attribute rather than a #id selector.
  private readonly contractAccountNumberInput;
  private readonly billerAccountNameInput;
  private readonly billerAmountInput;
  private readonly billerEmailInput;
  // Labeled "Pay Now" in the UI; opens the #myModal confirmation dialog whose
  // real submit button is #submitPaymentFormButton ("Confirm" — see confirmPayButton).
  private readonly confirmPaymentButton;
  // Payment Summary modal content — shows back the values just entered
  // (plus computed Add-on Fee / Service Fee / Total Amount).
  private readonly paymentSummaryModalBody;

  // Bayad-style biller payment form (Maynilad Water; ids confirmed live
  // 2026-09-01) — a plain "Account Number" + "Amount" + "Email(Optional)",
  // no separate "Account Name" field like Manila Water's form. Matched by
  // role rather than id since no id was captured for these live.
  private readonly genericAccountNumberInput;
  private readonly genericAmountInput;
  private readonly genericEmailInput;
  private readonly genericPayNowButton;

  // SSS - Individual payment form + Generate PRN modal (ids captured live
  // 2026-10-12). PRN field (not account number), Country Code, and the
  // Generate PRN modal that mints a PRN from member details.
  private readonly sssPrnInput;
  private readonly sssGenerateReferenceLink;
  private readonly sssCountryCodeSelect;
  private readonly sssGenSsNumberInput;
  private readonly sssGenMemberTypeSelect;
  private readonly sssGenPensionBoosterAmount;
  private readonly sssGenPensionBoosterFlag;
  private readonly sssGenAmountInput;
  private readonly sssGenStartDateInput;
  private readonly sssGenEndDateInput;
  private readonly sssGenerateReferenceSubmit;

  // Post-Confirm rejection — the account number field isn't validated until
  // after Confirm; an invalid one (or a duplicate transaction) used to
  // redirect to payment-console-status-error with an "Oh no! Something went
  // wrong." heading (confirmed live 2026-08-05, BLR-3682). As of 2026-08-10
  // it no longer redirects — the Payment Summary modal stays open and shows
  // the reason inline as a red banner instead (confirmed live via BLR-3682/
  // 3683 failure screenshots). No fixed locator for the banner itself; match
  // by the reason text within the still-open modal.

  // Post-Confirm receipt ("Payment Successful!") — ids confirmed live 2026-07-23.
  private readonly receiptHeading;
  private readonly statusCodeValue;
  private readonly accountNumberValue;
  private readonly processorReferenceValue;
  private readonly transactionDateValue;
  private readonly agentNameValue;
  private readonly billAmountValue;
  private readonly addOnFeeValue;
  private readonly serviceFeeValue;
  private readonly totalAmountValue;
  private readonly serviceProviderValue;
  private readonly merchantReferenceValue;
  private readonly transactionReferenceValue;

  constructor(private page: Page) {
    // Recorded as textbox in one session and combobox in another (see bayadPage)
    this.businessCategoryAccountSelect = page
      .getByRole('combobox', { name: 'Select Business Name' })
      .or(page.getByRole('textbox', { name: 'Select Business Name' }))
      .first();
    this.select2SearchBox              = page.getByRole('searchbox', { name: 'Search' });
    this.agentSelect                   = page.locator('#select2-agentSelect-container');
    // Admin/super-admin console renders these Select2 dropdowns with ids;
    // the merchant/agent console renders the same dropdowns without those ids,
    // exposing only the placeholder title ("Select Biller Account" / "Select
    // Service Type"). Match either so the flow works for both roles (merchant
    // title locators confirmed live 2026-09-10).
    this.accountCredentialSelect       = page
      .locator('#select2-credentialSelect-container')
      .or(page.getByTitle('Select Biller Account'));
    this.serviceTypeSelect             = page
      .locator('#select2-serviceTypesSelect-container')
      .or(page.getByTitle('Select Service Type'));
    // Accessible name has leading whitespace from an embedded icon, so match
    // loosely (see bayadPage.ts for the same fix). Results render into #searchInput.
    // Admin console: search box has an accessible name "search biller".
    // Merchant/agent console: same box is #input-box (no matching name).
    // Match either (merchant locator confirmed live 2026-09-10).
    this.billerSearchInput             = page
      .getByRole('textbox', { name: /search biller/i })
      .or(page.locator('#input-box'));
    this.billerSearchResults           = page.locator('#searchInput');
    this.paymentCategorySelect         = page.locator('#paymentCategory');
    this.amountInput                   = page.locator('#amount');
    this.emailInput                    = page.locator('#email');
    this.previewButton                 = page.getByRole('button', { name: /preview/i });
    this.payButton                     = page.getByRole('button', { name: 'Pay', exact: true });
    this.cancelButton                  = page.getByRole('button', { name: 'Cancel', exact: true });
    this.confirmPayButton              = page.getByRole('button', { name: 'Confirm' });
    this.billerCategoryList            = page.locator('#billers');
    this.prnDisplay                    = page.locator('#prnDisplay');
    this.copyPrnButton                 = page.getByRole('button', { name: 'Copy' });
    this.generatePrnButton             = page.getByRole('button', { name: 'Generate PRN' });

    // The first field differs per biller: Manila Water Company's is labeled
    // "8 Digit Contract Account Number" (id "8_Digit_Contract_Account_Number_"),
    // VECO's is labeled "11 Digit Account ID". The rest of the ECPay form
    // (Account Name / Amount / Email) is identical. Match Manila Water's by id
    // and VECO's by its accessible name so the shared paySuccessfully() flow
    // works for both (VECO field confirmed live 2026-09-10).
    this.contractAccountNumberInput    = page
      .locator('[id="8_Digit_Contract_Account_Number_"]')
      .or(page.getByRole('textbox', { name: '11 Digit Account ID' }));
    // Manila Water Company matches these by id; VECO renders the same fields
    // but only exposes them by accessible name/role (no usable id), so match
    // either form so the shared paySuccessfully() flow works for both
    // (VECO field names confirmed live 2026-09-10).
    this.billerAccountNameInput        = page
      .locator('#Account_Name')
      .or(page.getByRole('textbox', { name: 'Account Name' }));
    this.billerAmountInput             = page
      .locator('#Amount')
      .or(page.getByRole('spinbutton', { name: 'Amount' }));
    this.billerEmailInput              = page
      .locator('#email-optional')
      .or(page.getByRole('textbox', { name: 'Email(Optional)' }));
    this.confirmPaymentButton          = page
      .locator('#confirmPaymentButton')
      .or(page.getByRole('button', { name: 'Pay Now' }));
    this.paymentSummaryModalBody       = page.locator('#dynamicModalBody');

    // Bayad billers label the account-number field differently (Maynilad:
    // "Account Number", Manila Water: "8 Digit Contract Account Number", etc.),
    // so match any textbox whose accessible name contains "Account Number"
    // rather than one exact string. The regex still excludes "Account Name"
    // since that doesn't contain "Number".
    this.genericAccountNumberInput     = page.getByRole('textbox', { name: /account number/i });
    this.genericAmountInput            = page.getByRole('spinbutton', { name: 'Amount' });
    this.genericEmailInput             = page.getByRole('textbox', { name: 'Email(Optional)' });
    this.genericPayNowButton           = page.getByRole('button', { name: 'Pay Now' });

    // SSS - Individual payment form (ids captured live 2026-10-12). The first
    // field is a PRN (not an account number); there's a Country Code <select>
    // and a "No PRN? Generate here" link that opens the Generate PRN modal.
    // The PRN field id contains slashes/spaces, so match by attribute.
    this.sssPrnInput                   = page.locator('[id="14_Digit_Individual_PRN_/_22_Digit_BRN"]');
    this.sssGenerateReferenceLink      = page.locator('#generateReference');
    this.sssCountryCodeSelect          = page.locator('#Country_Code');
    // Generate PRN modal fields.
    this.sssGenSsNumberInput           = page.locator('#SS_Number');
    this.sssGenMemberTypeSelect        = page.locator('[id="Member_Type[1/2/4/5]"]');
    this.sssGenPensionBoosterAmount    = page.locator('#Pension_Booster_Amount');
    this.sssGenPensionBoosterFlag      = page.locator('#Pension_Booster_Flag');
    this.sssGenAmountInput             = page.locator('#Amount');
    this.sssGenStartDateInput          = page.locator('#startDate');
    this.sssGenEndDateInput            = page.locator('#endDate');
    this.sssGenerateReferenceSubmit    = page.locator('#submitGenerateReferenceFormButton');

    this.receiptHeading                = page.getByText('Payment Successful!');
    this.statusCodeValue               = page.locator('#statusCodeValue');
    this.accountNumberValue            = page.locator('#accountNumberValue');
    this.processorReferenceValue       = page.locator('#processorReferenceValue');
    this.transactionDateValue          = page.locator('#transactionDateValue');
    this.agentNameValue                = page.locator('#agentNameValue');
    this.billAmountValue               = page.locator('#billAmountValue');
    this.addOnFeeValue                 = page.locator('#addOnFeeValue');
    this.serviceFeeValue               = page.locator('#serviceFeeValue');
    this.totalAmountValue              = page.locator('#totalAmountValue');
    this.serviceProviderValue          = page.locator('#serviceProviderValue');
    this.merchantReferenceValue        = page.locator('#merchantReferenceValue');
    this.transactionReferenceValue     = page.locator('#transactionReferenceValue');
  }

  // --- Navigation -------------------------------------------------------------

  // Sidebar link name includes an icon glyph and varies between sessions, so
  // match loosely (same as bayadPage). networkidle is unreliable on this SPA.
  //
  // The console loads different lookup data per role (confirmed live
  // 2026-09-15): the ADMIN console fetches /lookup/merchants (the business-name
  // list); the MERCHANT/AGENT console has no business-name selector and instead
  // fetches /lookup/payment-console/options/account-credentials. Waiting only
  // on /lookup/merchants hung for 45s on the merchant console (it never fires).
  // So wait on WHICHEVER lookup response the current role actually makes, then
  // confirm readiness via the Biller Account dropdown (present on both roles).
  async goToPaymentConsole() {
    const lookupLoaded = this.page
      .waitForResponse(
        (res) =>
          res.url().includes('/lookup/merchants') ||
          res.url().includes('/payment-console/options/account-credentials'),
        { timeout: 30_000 },
      )
      .catch(() => undefined); // best-effort — dropdown readiness is the real gate
    await this.page.getByRole('link', { name: /payment console/i }).first().click();
    // The Biller Account select2 exists on every role's console once it's ready.
    await this.accountCredentialSelect.waitFor({ state: 'visible', timeout: 30_000 });
    await lookupLoaded;
    console.log('[PaymentConsolePage] Navigated to Payment Console');
  }

  async assertOnPaymentConsolePage() {
    // The admin console shows a "Payment Console Category" heading; the
    // merchant/agent console doesn't. Assert on the Biller Account dropdown,
    // which is present on all roles.
    await expect(
      this.accountCredentialSelect,
      'Should be on Payment Console page (Biller Account selector visible)'
    ).toBeVisible();
  }

  // --- Form Actions -----------------------------------------------------------

  // The options load asynchronously after the page renders; filling the select2
  // search box forces a re-query, so this doesn't race the initial load. The
  // option text can be longer than the searched value, so match non-exact.
  // Selecting the business triggers an AJAX call that populates the Biller
  // Account dropdown; wait on that specific response (networkidle proved
  // flaky — the option list can still be empty for a moment after the
  // network settles, see bayadPage.ts for the same fix).
  async selectBusinessCategoryAccount(value: string) {
    await this.businessCategoryAccountSelect.click();
    await this.select2SearchBox.pressSequentially(value, { delay: 100 });
    const credentialsLoaded = this.page.waitForResponse((res) =>
      res.url().includes('/lookup/payment-console/options/account-credentials')
    );
    await this.page.getByRole('option', { name: value }).first().click();
    await credentialsLoaded;
  }

  async selectAgent(value: string) {
    await this.agentSelect.click();
    await this.page.getByRole('option', { name: value }).click();
    await this.page.waitForLoadState('networkidle');
  }

  // Selecting the credential triggers an AJAX call that populates the Service
  // Type dropdown — same wait requirement as above. The option list itself can
  // also lag its own backing AJAX response by a couple seconds before it
  // actually renders (same class of race documented on selectServiceType
  // below), so re-toggle the dropdown until the real option shows up instead
  // of clicking whatever's there — confirmed via error-context.md showing the
  // listbox stuck on its disabled placeholder while this raced.
  async selectAccountCredential(value: string) {
    const option = this.page.getByRole('option', { name: value }).first();
    await expect(async () => {
      if (!(await option.isVisible())) {
        await this.accountCredentialSelect.click();
      }
      await expect(option).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    const serviceTypesLoaded = this.page.waitForResponse((res) =>
      res.url().includes('/payment-console/service-type')
    );
    await option.click();
    await serviceTypesLoaded;
  }

  // Same option-list-lags-the-response race as selectAccountCredential above
  // (confirmed live 2026-08-05, BLR-3682: dropdown opens showing only the
  // disabled "Select Service Type" placeholder, no real options, because the
  // list hasn't rendered yet even though its backing response already
  // landed) — re-toggle until the real option shows up instead of clicking
  // whatever's there.
  //
  // Selecting the service type triggers the biller category directory to
  // render (a large DOM — 300KB+ of HTML across every category), which takes
  // noticeably longer than the AJAX response backing it (confirmed live:
  // ~2.8s render gap after the response lands). searchBillerAccount() types
  // into the search box immediately after this returns; if the directory
  // hasn't finished rendering yet, #searchInput's autocomplete box never
  // populates (its filter logic isn't wired up yet) and the stale unfiltered
  // #billers directory is left showing underneath — looks like a search
  // filter that "doesn't work", but it's really this race. Wait for the
  // directory (#billers) to render before returning.
  async selectServiceType(value: string) {
    const option = this.page.getByRole('option', { name: value }).first();
    await expect(async () => {
      if (!(await option.isVisible())) {
        await this.serviceTypeSelect.click();
      }
      await expect(option).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await option.click();
    await this.billerCategoryList.waitFor({ state: 'visible' });
  }

  async assertAgentEmpty() {
    await expect(this.agentSelect, 'Agent field should have no selection').toHaveText('Select Agent');
  }

  async assertAccountCredentialEmpty() {
    await expect(this.accountCredentialSelect, 'Biller Account field should have no selection').toHaveText('Select Biller Account');
  }

  async assertServiceTypeEmpty() {
    await expect(this.serviceTypeSelect, 'Service Type field should have no selection').toHaveText('Select Service Type');
  }

  // The biller list is already loaded client-side (fetched when the service
  // type was selected); this search filters it locally via a keyup handler,
  // so fill() — which doesn't dispatch real key events — silently produces no
  // results. Type it out for real (see bayadPage.ts for the equivalent fix).
  //
  // Results differ by role (confirmed live 2026-09-15/16):
  //   - Admin console renders filtered results inside #searchInput, and the
  //     link text equals the biller name EXACTLY. Crucially, the directory has
  //     BOTH a Bayad "MANILA WATER" and an ECPay "MANILA WATER COMPANY", so a
  //     loose substring match on "MANILA WATER" wrongly grabs the ECPay one
  //     (regression seen 2026-09-16).
  //   - Merchant/agent console renders billers as directory links whose text
  //     is the fuller OFFICIAL name (search "MAYNILAD WATER" → link
  //     "MAYNILAD WATER SERVICES"; "MANILA WATER" → "MANILA WATER COMPANY").
  // So: prefer an EXACT link match; only fall back to substring when no exact
  // link exists. This keeps admin's Bayad "MANILA WATER" distinct from ECPay's
  // "MANILA WATER COMPANY", while still resolving the merchant's fuller names.
  private async resolveBillerLink(name: string) {
    const exact = this.page.getByRole('link', { name, exact: true }).first();
    if (await exact.count().then((c) => c > 0).catch(() => false)) {
      return exact;
    }
    return this.page.getByRole('link', { name, exact: false }).first();
  }

  async searchBillerAccount(searchTerm: string) {
    await this.billerSearchInput.pressSequentially(searchTerm, { delay: 80 });
    // The autocomplete can render a longer superset name first (e.g. searching
    // "MANILA WATER" shows "MANILA WATER COMPANY" before the exact "MANILA
    // WATER" link appears). Falling through to the substring match at that
    // moment wrongly grabs the ECPay "...COMPANY" biller (regression seen
    // 2026-09-16, and again live). So first give the EXACT link a chance to
    // render before resolveBillerLink's substring fallback can kick in.
    const exactLink = this.page.getByRole('link', { name: searchTerm, exact: true }).first();
    const gotExact = await exactLink
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!gotExact) {
      // No exact link in this directory (e.g. merchant/agent console renders
      // only fuller official names) — fall back to waiting for any match.
      await expect(async () => {
        const link = await this.resolveBillerLink(searchTerm);
        await expect(link).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 45_000 });
    }
    console.log(`[PaymentConsolePage] Searched for biller: ${searchTerm}`);
  }

  async selectBillerAccount(billerName: string) {
    const link = await this.resolveBillerLink(billerName);
    await link.click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[PaymentConsolePage] Selected biller: ${billerName}`);
  }

  // --- MANILA WATER COMPANY biller payment form --------------------------------

  async fillContractAccountNumber(value: string) {
    await this.contractAccountNumberInput.fill(value);
  }

  async fillBillerAccountName(value: string) {
    // ECPay's Account Name field intermittently doesn't retain the typed value
    // on the first fill (observed live: all other fields populate but Account
    // Name submits blank → "This field is required"). Fill, then verify the
    // value actually landed and re-fill once if it didn't.
    const field = this.billerAccountNameInput;
    await field.click();
    await field.fill(value);
    if ((await field.inputValue()) !== value) {
      await field.fill('');
      await field.pressSequentially(value);
    }
    await expect(field, 'Account Name should be populated before submit').toHaveValue(value);
  }

  async fillBillerAmount(value: string) {
    await this.billerAmountInput.fill(value);
  }

  async fillBillerEmail(value: string) {
    await this.billerEmailInput.fill(value);
  }

  // Labeled "Pay Now"; opens the #myModal confirmation dialog (submitted via
  // clickConfirm(), which already targets the modal's "Confirm" button).
  async clickPayNow() {
    await this.confirmPaymentButton.click();
    await this.page.locator('#myModal').waitFor({ state: 'visible' });
    console.log('[PaymentConsolePage] Pay Now clicked');
  }

  // --- Bayad-style biller payment form (Maynilad Water) ------------------------
  // No separate Account Name field — Account Number + Amount + Email(Optional)
  // only (confirmed live 2026-09-01).

  async fillGenericAccountNumber(value: string) {
    await this.genericAccountNumberInput.fill(value);
  }

  async fillGenericAmount(value: string) {
    await this.genericAmountInput.fill(value);
  }

  async fillGenericEmail(value: string) {
    await this.genericEmailInput.fill(value);
  }

  async clickGenericPayNow() {
    await this.genericPayNowButton.click();
    await this.page.locator('#myModal').waitFor({ state: 'visible' });
    console.log('[PaymentConsolePage] Pay Now clicked (generic Bayad-style form)');
  }

  // --- SSS - Individual payment form -------------------------------------------

  private static readonly SSS_MONTHS = [
    'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
  ];

  // The Applicable Month fields are a read-only bootstrap-datepicker in month
  // view — only the picker can set them (fill/type is a no-op). Open the picker
  // on the field, click the year nav (.next/.prev) until it reads the target
  // year, then click the 3-letter month cell.
  private async pickSssMonth(field: typeof this.sssGenStartDateInput, monthIdx: number, year: number) {
    await field.click();
    const picker = this.page.locator('.datepicker-dropdown');
    await picker.waitFor({ state: 'visible', timeout: 10_000 });
    const monthsView = picker.locator('.datepicker-months');
    const yearSwitch = monthsView.locator('.datepicker-switch');
    for (let i = 0; i < 120; i++) {
      const cur = parseInt((await yearSwitch.innerText()).trim(), 10);
      if (cur === year) break;
      await monthsView.locator(cur < year ? '.next' : '.prev').click();
    }
    await monthsView
      .locator('span.month', { hasText: new RegExp(`^${PaymentConsolePage.SSS_MONTHS[monthIdx]}$`) })
      .click();
  }

  // Opens the "No PRN? Generate here" modal, fills the member details, and
  // scans forward through Applicable Months (startYear..endYear) until one
  // generates successfully. SSS rejects an already-paid month inline with
  // "Unsuccessful generation of reference. Applicable month MMYYYY is already
  // paid." (modal stays open) — on that banner, advance to the next month. On
  // success the banner reads "Successfully generated reference", the modal
  // closes, and the minted PRN auto-populates the main form's PRN field, which
  // this returns. Throws if every month in the window is already paid.
  async generateIndividualPRN(opts: {
    ssNumber: string;
    memberTypeLabel: string;
    amount: string;
    startYear: number;
    endYear: number;
  }): Promise<string> {
    await this.sssGenerateReferenceLink.click();
    await this.sssGenSsNumberInput.waitFor({ state: 'visible', timeout: 15_000 });

    await this.sssGenSsNumberInput.fill(opts.ssNumber);
    await this.sssGenMemberTypeSelect.selectOption({ label: opts.memberTypeLabel });
    await this.sssGenPensionBoosterAmount.fill('0').catch(() => {});
    await this.sssGenPensionBoosterFlag.fill('0').catch(() => {});
    await this.sssGenAmountInput.fill(opts.amount);

    for (let year = opts.startYear; year <= opts.endYear; year++) {
      for (let m = 0; m < 12; m++) {
        await this.pickSssMonth(this.sssGenStartDateInput, m, year);
        await this.pickSssMonth(this.sssGenEndDateInput, m, year);
        await this.sssGenerateReferenceSubmit.click();

        // Match on the message TEXT, not a generic .alert locator — the page
        // has empty/close-button alert nodes that a `.first()` grabs (read as
        // ""). The "already paid" message names the month as MMYYYY, so match
        // that exact month: a banner left over from the previous attempt
        // names a different month and won't be mistaken for this one.
        const label = `${PaymentConsolePage.SSS_MONTHS[m]}-${year}`;
        const mmyyyy = `${String(m + 1).padStart(2, '0')}${year}`;
        const success = this.page.getByText(/Successfully generated reference/i).first();
        const paidThisMonth = this.page
          .getByText(new RegExp(`Applicable month ${mmyyyy} is already paid`, 'i'))
          .first();

        let outcome: 'success' | 'paid' | 'unknown' = 'unknown';
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline) {
          if (await success.isVisible().catch(() => false)) { outcome = 'success'; break; }
          if (await paidThisMonth.isVisible().catch(() => false)) { outcome = 'paid'; break; }
          await this.page.waitForTimeout(250);
        }

        if (outcome === 'paid') {
          console.log(`[PaymentConsolePage] Generate PRN ${label}: already paid, trying next month`);
          continue;
        }
        if (outcome === 'success') {
          // The PRN auto-fills the main form once the modal closes.
          await expect(this.sssPrnInput, 'Generated PRN should auto-fill the PRN field').not.toHaveValue('', {
            timeout: 10_000,
          });
          const prn = (await this.sssPrnInput.inputValue()).trim();
          console.log(`[PaymentConsolePage] Generate PRN ${label}: success, PRN=${prn}`);
          return prn;
        }
        // Neither outcome within 20s — surface whatever the modal is showing.
        const modalText = (await this.sssGenSsNumberInput
          .locator('xpath=ancestor::*[contains(@class,"modal")][1]')
          .innerText()
          .catch(() => '')).replace(/\s+/g, ' ').trim();
        throw new Error(
          `[PaymentConsolePage] Generate PRN ${label}: no success/already-paid result within 20s. Modal: "${modalText.slice(0, 200)}"`,
        );
      }
    }
    throw new Error(
      `[PaymentConsolePage] Could not generate an SSS PRN — every month ${opts.startYear}-${opts.endYear} is already paid for SS ${opts.ssNumber}.`,
    );
  }

  async fillSssPrn(value: string) {
    await this.sssPrnInput.fill(value);
  }

  async getSssPrn(): Promise<string> {
    return (await this.sssPrnInput.inputValue()).trim();
  }

  // Country Code is an ISO <select> (value = 2-letter code, e.g. "PH").
  async selectCountryCode(code: string) {
    await this.sssCountryCodeSelect.selectOption(code);
  }

  // Click Pay Now WITHOUT waiting for the Payment Summary — for negative tests,
  // where validation is expected to reject instead.
  async submitSssPayNow() {
    await this.confirmPaymentButton.click();
    console.log('[PaymentConsolePage] Pay Now clicked (SSS, expecting rejection)');
  }

  // SSS rejects a bad PRN/email after Pay Now with a small modal showing the
  // reason and a "Try Again" button — no Payment Summary (confirmed live from
  // QA screenshots 2026-10-12).
  async assertSssRejection(expectedMessage: string | RegExp) {
    await expect(
      this.page.getByText(expectedMessage).first(),
      `SSS rejection modal should show: ${expectedMessage}`,
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      this.page.getByRole('button', { name: 'Try Again' }),
      'Rejection modal should offer Try Again',
    ).toBeVisible();
    await expect(
      this.page.getByText('Payment Summary', { exact: true }),
      'No Payment Summary should be shown on rejection',
    ).toBeHidden();
    console.log('[PaymentConsolePage] SSS rejection verified:', expectedMessage);
  }

  // Blank PRN + no Country Code: client-side "This field is required." under
  // both fields, no modal.
  async assertSssRequiredFieldErrors() {
    await expect(
      this.page.getByText('This field is required.'),
      'PRN and Country Code should both show "This field is required."',
    ).toHaveCount(2);
    await expect(
      this.page.getByText('Payment Summary', { exact: true }),
      'No Payment Summary should be shown when required fields are blank',
    ).toBeHidden();
    console.log('[PaymentConsolePage] SSS required-field errors verified');
  }

  // SSS - Individual's "Pay Now" shares the same id as ECPay's
  // (#confirmPaymentButton) and opens the same #myModal Payment Summary.
  async clickSssPayNow() {
    await this.confirmPaymentButton.click();
    await this.page.locator('#myModal').waitFor({ state: 'visible' });
    console.log('[PaymentConsolePage] Pay Now clicked (SSS form)');
  }

  // Verifies the Payment Summary modal echoes back what was actually typed
  // into the form, plus the biller's computed fee/total rows (addOnFee,
  // serviceFee, totalAmount) when the caller wants those pinned down too —
  // they're server-computed, not user input, so they're optional.
  // accountName is likewise optional — Bayad billers like Maynilad Water
  // have no Account Name field to echo back (confirmed live 2026-09-01).
  async assertPaymentSummaryDetails(details: {
    billerName: string;
    accountNumber: string;
    accountName?: string;
    amount: string;
    email: string;
    addOnFee?: string;
    serviceFee?: string;
    totalAmount?: string;
  }) {
    await this.paymentSummaryModalBody.waitFor({ state: 'visible' });
    // The biller name/category header sits in #myModal outside #dynamicModalBody
    // (observed 2026-07-22: #dynamicModalBody only contains the field rows).
    await expect(this.page.locator('#myModal'), 'Payment summary should show biller name').toContainText(details.billerName);
    await expect(this.paymentSummaryModalBody, 'Payment summary should show contract account number').toContainText(details.accountNumber);
    if (details.accountName !== undefined) {
      await expect(this.paymentSummaryModalBody, 'Payment summary should show account name').toContainText(details.accountName);
    }
    await expect(this.paymentSummaryModalBody, 'Payment summary should show bill amount').toContainText(details.amount);
    await expect(this.paymentSummaryModalBody, 'Payment summary should show email').toContainText(details.email);
    if (details.addOnFee !== undefined) {
      await expect(this.paymentSummaryModalBody, 'Payment summary should show add-on fee').toContainText(details.addOnFee);
    }
    if (details.serviceFee !== undefined) {
      await expect(this.paymentSummaryModalBody, 'Payment summary should show service fee').toContainText(details.serviceFee);
    }
    if (details.totalAmount !== undefined) {
      await expect(this.paymentSummaryModalBody, 'Payment summary should show total amount').toContainText(details.totalAmount);
    }
    console.log('[PaymentConsolePage] Payment summary details verified against input');
  }

  async selectPaymentCategory(value: string) {
    await this.paymentCategorySelect.selectOption(value);
  }

  async fillAmount(value: string) {
    await this.amountInput.fill(value);
  }

  async fillEmail(value: string) {
    await this.emailInput.fill(value);
  }

  async clickPreview() {
    await this.previewButton.scrollIntoViewIfNeeded();
    await this.previewButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[PaymentConsolePage] Preview clicked');
  }

  async clickPay() {
    await this.payButton.click();
  }

  async clickCancel() {
    await this.cancelButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[PaymentConsolePage] Payment cancelled');
  }

  async clickConfirm() {
    await this.confirmPayButton.waitFor({ state: 'visible' });
    await this.confirmPayButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[PaymentConsolePage] Payment confirmed');
  }

  // --- Receipt (post-Confirm) --------------------------------------------------

  // The backend has been observed to hang after Confirm instead of ever
  // rendering the receipt (see BLR-3681 fixme note in ecpay.spec.ts), so
  // this waits explicitly on the heading with a generous timeout rather
  // than relying on the default actionTimeout — makes "still stuck loading"
  // fail clearly here instead of surfacing as a confusing timeout later.
  //
  // Verifies the receipt echoes back what was actually paid (ids confirmed
  // live 2026-09-01 via #dynamicReceiptContent) — mirrors
  // assertPaymentSummaryDetails() one step later in the flow. Fee/total rows
  // are confirmed to equal Bill Amount + Add-on Fee + Service Fee, same as
  // the Payment Summary modal. accountNumber is asserted as a plain
  // equality check — pass what the receipt should actually show, which
  // isn't always what was submitted (ECPay's receipt currently renders
  // Account Number blank; see the accountNumber: '' comment in
  // ecpay.spec.ts's paySuccessfully()).
  async assertPaymentReceipt(details: {
    billerName: string;
    accountNumber: string;
    amount: string;
    addOnFee: string;
    serviceFee: string;
    totalAmount: string;
  }) {
    // The backend is intermittently slow to process the payment after Confirm
    // — the receipt sits on a disabled "Loading..." spinner well past 30s
    // (confirmed live 2026-09-16). Wait up to 75s for the receipt to render
    // before treating it as a genuine hang.
    await expect(this.receiptHeading, 'Payment Successful! receipt should render').toBeVisible({ timeout: 75_000 });
    await expect(this.serviceProviderValue, 'Receipt should show the biller name').toHaveText(details.billerName);
    await expect(this.statusCodeValue, 'Receipt should show Payment Posted status').toHaveText('Payment Posted');
    await expect(this.accountNumberValue, 'Receipt should show the contract account number').toHaveText(details.accountNumber);
    await expect(this.processorReferenceValue, 'Receipt should show a processor reference').not.toBeEmpty();
    await expect(this.transactionDateValue, 'Receipt should show a transaction date').not.toBeEmpty();
    await expect(this.billAmountValue, 'Receipt should show the bill amount').toHaveText(details.amount);
    await expect(this.addOnFeeValue, 'Receipt should show the add-on fee').toHaveText(details.addOnFee);
    await expect(this.serviceFeeValue, 'Receipt should show the service fee').toHaveText(details.serviceFee);
    await expect(this.totalAmountValue, 'Receipt should show the total amount').toHaveText(details.totalAmount);
    await expect(this.merchantReferenceValue, 'Receipt should show a merchant reference number').not.toBeEmpty();
    await expect(this.transactionReferenceValue, 'Receipt should show a transaction reference number').not.toBeEmpty();
    console.log('[PaymentConsolePage] Payment receipt verified');
  }

  // Waits for the #myModal fade-in to fully finish (opacity settled at 1) so a
  // screenshot isn't captured mid-transition — that's what makes the modal
  // look ghosted/blurry over the page behind it. Falls back to a short fixed
  // wait if opacity can't be read.
  async waitForModalSettled() {
    const modal = this.page.locator('#myModal');
    await modal.waitFor({ state: 'visible' });
    try {
      await this.page.waitForFunction(
        () => {
          const el = (globalThis as any).document?.getElementById('myModal');
          if (!el) return false;
          const op = parseFloat((globalThis as any).getComputedStyle(el).opacity || '1');
          return op >= 1;
        },
        undefined,
        { timeout: 3000 },
      );
    } catch {
      // opacity never reported 1 — fall through to a small settle wait.
    }
    await this.page.waitForTimeout(300);
  }

  // --- Screenshot targets ------------------------------------------------------
  // Element locators for capturing just the relevant surface (used with
  // attachScreenshot({ locator })), so screenshots are scoped and not clipped
  // by the viewport.

  // The Payment Summary modal (biller header + field rows incl. the fee
  // breakdown: Bill Amount / Add-on Fee / Service Fee / Total Amount).
  paymentSummaryLocator() {
    return this.page.locator('#myModal');
  }

  // The post-Confirm "Payment Successful!" Transaction Receipt content.
  receiptLocator() {
    return this.page.locator('#dynamicReceiptContent');
  }

  // Confirming an invalid account number or a duplicate transaction keeps
  // the Payment Summary modal open and shows the reason inline as a red
  // banner (confirmed live 2026-08-10, BLR-3682/3683 — no redirect anymore).
  async assertPaymentRejected(expectedReason: string | RegExp) {
    await expect(this.page.locator('#myModal'), 'Payment Summary modal should stay open on rejection').toBeVisible();
    await expect(
      this.page.locator('#myModal').getByText(expectedReason),
      `Rejection banner should show reason: ${expectedReason}`
    ).toBeVisible({ timeout: 30000 });
    console.log('[PaymentConsolePage] Payment rejection verified:', expectedReason);
  }

  // The backend's duplicate-transaction check is keyed by account number and
  // isn't scoped to a single test run — a fresh run can occasionally land on
  // an account number the biller side already flagged, showing this same
  // "Transaction cannot be processed. System detects this to be a double
  // transaction." banner on an otherwise-valid payment (confirmed live
  // 2026-09-02, BLR-3681). Callers that just want a successful payment (as
  // opposed to BLR-3683, which deliberately asserts this rejection) use this
  // to detect it and retry with a different account number instead of
  // failing. Short timeout since the rejection banner renders immediately on
  // Confirm — it's the success path (the receipt) that can be slow.
  async isDuplicateTransactionRejection(): Promise<boolean> {
    // The app has TWO wordings for a duplicate rejection (both confirmed live):
    //   1. "Transaction cannot be processed. System detects this to be a
    //      double transaction." (BLR-3683)
    //   2. "System detects double transaction for this account with the same
    //      amount. To avoid duplicate payments please try again tomorrow or
    //      try with a different amount." (confirmed live 2026-09-10)
    // Match either — a regex on the common "double transaction" phrasing.
    try {
      await expect(
        this.page.locator('#myModal').getByText(/double transaction/i).first()
      ).toBeVisible({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // Post-Confirm, some rejections don't stay inline — the app REDIRECTS to
  // /payment-console-status-error (e.g. statusCode ER.00.05 "Kindly check if
  // the account number …"), confirmed live 2026-09-16 when an account number
  // gets flagged mid-run. This is a real rejection, not the backend hang, and
  // like the duplicate banner it means "retry with a different account". Detect
  // it by the URL so paySuccessfully can fall back instead of waiting out the
  // 30s receipt timeout.
  async isErrorPageRejection(): Promise<boolean> {
    try {
      await this.page.waitForURL(/payment-console-status-error/, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // After Confirm, wait for WHICHEVER of the three outcomes lands first:
  //   'receipt'    — the success receipt rendered
  //   'duplicate'  — inline duplicate-transaction banner (retry next account)
  //   'error-page' — redirect to /payment-console-status-error (retry next)
  //   'unknown'    — none within the timeout (the backend post-Confirm hang)
  async awaitPostConfirmOutcome(): Promise<'receipt' | 'duplicate' | 'error-page' | 'unknown'> {
    // The backend can be slow to render the receipt (stuck on a "Loading..."
    // spinner) — wait up to 75s for the success path. Duplicate banner and the
    // error-page redirect still resolve within the loop as soon as they appear,
    // so this longer deadline only affects how long we're patient for success.
    const deadline = Date.now() + 75_000;
    while (Date.now() < deadline) {
      if (await this.receiptHeading.isVisible().catch(() => false)) return 'receipt';
      if (this.page.url().includes('payment-console-status-error')) return 'error-page';
      if (
        await this.page
          .locator('#myModal')
          .getByText(/double transaction/i)
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        return 'duplicate';
      }
      await this.page.waitForTimeout(500);
    }
    return 'unknown';
  }

  async getMerchantReferenceNumber(): Promise<string> {
    return (await this.merchantReferenceValue.innerText()).trim();
  }

  async getTransactionReferenceNumber(): Promise<string> {
    return (await this.transactionReferenceValue.innerText()).trim();
  }

  // --- PRN Actions ------------------------------------------------------------

  async generatePRN() {
    await this.generatePrnButton.click();
    await this.prnDisplay.waitFor({ state: 'visible' });
    const prn = (await this.prnDisplay.innerText()).trim();
    console.log(`[PaymentConsolePage] PRN generated: ${prn}`);
    return prn;
  }

  async copyPRN() {
    await this.copyPrnButton.click();
    console.log('[PaymentConsolePage] PRN copied');
  }

  // --- Verifications ----------------------------------------------------------

  async assertBillerCategoryListVisible() {
    await expect(this.billerCategoryList, 'Biller category list should be visible').toBeVisible();
  }

  async assertBillerCategoryListHidden() {
    await expect(this.billerCategoryList, 'Biller category list should not be displayed').toBeHidden();
  }

  async assertErrorMessage(expectedMessage: string) {
    const error = this.page.locator('.error-message, [class*="error"], [class*="invalid"]').first();
    await expect(error, `Expected error: ${expectedMessage}`).toContainText(expectedMessage);
  }

  async assertPaymentCancelled() {
    await expect(this.cancelButton, 'Cancel button should be hidden after cancel').toBeHidden();
  }

  async assertPRNGenerated() {
    await expect(this.prnDisplay, 'PRN should be displayed').toBeVisible();
    const prn = (await this.prnDisplay.innerText()).trim();
    expect(prn, 'PRN should not be empty').not.toBe('');
  }

  async assertPRNCopied() {
    await expect(
      this.page.locator('[class*="copied"], [aria-label*="Copied"]'),
      'Copy confirmation should appear'
    ).toBeVisible();
  }
}

export default PaymentConsolePage;
