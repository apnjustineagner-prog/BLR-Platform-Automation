import { Page, expect } from '@playwright/test';
import { BlrDashboardPage } from './blrDashboardPage';
import { BusinessFormData } from '../../utils/businessData';
import { faker } from '@faker-js/faker';

// ==============================================================================
// TYPES
// ==============================================================================

/** Fields returned after reading the merchant row from the onboarding table */
export type MerchantDetails = {
  dateCreated: string;
  dateModified: string;
  lastModifiedBy: string;
  accountId: string;
  type: string;
  hierarchy: string;
  name: string;
  administratorEmail: string;
  walletAmount: string;
  country: string;
  status: string;
};

/** All fields needed to fill the Add New Business form */
export type BillerData = BusinessFormData & {
  accountType: string;
  level: string;
  countrySearch: string;
  countryOption: string;
};

/** Fields needed to add a sub-level (Sublevel) business linked to a parent merchant */
export type SubLevelBillerData = BillerData & {
  mainBusiness: string;
};

// ==============================================================================
// DEFAULT TEST DATA
// ==============================================================================

/**
 * Generates a fresh set of randomized biller data on every call.
 * businessName always starts with "Test Business" for easy identification.
 * Called automatically by onboardBiller() when no data is passed.
 */
export function createDefaultBillerData(): BillerData {
  return {
    accountType: 'Biller',
    level: 'Main Level',
    countrySearch: 'Philippines',
    countryOption: 'Philippines',
    businessName: `Test Business ${faker.string.alphanumeric(6).toUpperCase()}`,
    addressLine1: faker.location.streetAddress(),
    addressLine2: faker.location.secondaryAddress(),
    city: faker.location.city(),
    zipCode: faker.location.zipCode('#####'),
    state: faker.location.state(),
    adminEmail: faker.internet.email(),
    supportEmail: faker.internet.email(),
    businessEmail: faker.internet.email(),
    phoneNumber: faker.phone.number().replace(/\D/g, '').slice(0, 10),
  };
}

/**
 * Generates randomized data for a sub-level business linked to the given parent.
 */
export function createDefaultSubLevelBillerData(mainBusiness: string): SubLevelBillerData {
  return {
    ...createDefaultBillerData(),
    level: 'Sublevel',
    mainBusiness,
  };
}

/**
 * Same as createDefaultBillerData but uses a fixed, valid admin email.
 */
export function createBillerDataWithValidEmail(adminEmail: string): BillerData {
  return {
    ...createDefaultBillerData(),
    adminEmail,
  };
}

// ==============================================================================
// PAGE OBJECT
// ==============================================================================

export class OnboardModulePage {
  // --- Locators ---------------------------------------------------------------

  private readonly accountTypeSelect;
  private readonly levelSelect;
  private readonly businessNameInput;
  private readonly addressLine1Input;
  private readonly addressLine2Input;
  private readonly cityInput;
  private readonly zipCodeInput;
  private readonly stateInput;
  private readonly countryInput;
  private readonly countrySearchInput;
  private readonly adminEmailInput;
  private readonly supportEmailInput;
  private readonly businessEmailInput;
  private readonly phoneNumberInput;
  private readonly addButton;
  private readonly mainBusinessSelect;
  private readonly mainBusinessSearchInput;

  constructor(private page: Page) {
    this.accountTypeSelect = page.locator('#toTop').getByRole('combobox', { name: 'Select' });
    this.levelSelect = page.getByRole('combobox', { name: 'Select' }).first();
    this.businessNameInput = page
      .getByRole('textbox', { name: 'Business', exact: true })
      .or(page.getByRole('textbox', { name: 'Business Name', exact: true }));
    this.addressLine1Input = page.getByRole('textbox', { name: 'Line 1' });
    this.addressLine2Input = page.getByRole('textbox', {
      name: 'Line 2 (Optional)',
    });
    this.cityInput = page.getByRole('textbox', { name: 'City/Municipality' });
    this.zipCodeInput = page.getByRole('textbox', { name: 'Zip Code' });
    this.stateInput = page.getByRole('textbox', {
      name: 'State/Province/Region',
    });
    this.countryInput = page.getByRole('textbox', { name: 'Country' });
    this.countrySearchInput = page.getByRole('searchbox', {
      name: 'Search',
      exact: true,
    });
    this.adminEmailInput = page.getByRole('textbox', {
      name: 'Administrator Email Address',
    });
    this.supportEmailInput = page.getByRole('textbox', {
      name: 'Support Email Address',
    });
    this.businessEmailInput = page.getByRole('textbox', {
      name: 'Business Email Address (',
    });
    this.phoneNumberInput = page.getByRole('textbox', {
      name: 'Phone Number (Optional)',
    });
    this.addButton = page.getByRole('button', { name: 'Add', exact: true });
    // Appears only after "Sublevel" hierarchy is selected
    this.mainBusinessSelect = page.getByRole('combobox', { name: 'Select' }).nth(1);
    this.mainBusinessSearchInput = page.getByRole('searchbox', { name: 'Search', exact: true });
  }

  // --- Dropdown Actions -------------------------------------------------------

  async selectAccountType(type: string) {
    // Category options load async after the modal opens; a dropdown opened too
    // early shows only its disabled "Select" placeholder and never refreshes
    // in place, so close and reopen until the real option renders.
    const option = this.page.getByRole('option', { name: type });
    await expect(async () => {
      if (!(await option.isVisible())) {
        await this.accountTypeSelect.click();
      }
      await expect(option).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await option.click();
  }

  async selectLevel(level: string) {
    await this.levelSelect.click();
    await this.page.getByRole('option', { name: level, exact: true }).waitFor({ state: 'visible' });
    await this.page.getByRole('option', { name: level, exact: true }).click();
  }

  /** Opens the country dropdown, searches, then selects the matching option */
  async selectCountry(searchTerm: string, countryOption: string) {
    await this.countryInput.click();
    await this.countrySearchInput.fill(searchTerm);
    await this.page.getByRole('option', { name: countryOption }).click();
  }

  /** Opens the Main Business dropdown (visible only for Sublevel hierarchy), searches, and selects the parent */
  async selectMainBusiness(name: string) {
    await this.mainBusinessSelect.click();
    await this.mainBusinessSearchInput.fill(name);
    await this.page.getByRole('option', { name }).first().click();
  }

  // --- Text Input Actions -----------------------------------------------------

  async fillBusinessName(name: string) {
    await this.businessNameInput.pressSequentially(name);
  }
  async fillAddressLine1(address: string) {
    await this.addressLine1Input.fill(address);
  }
  async fillAddressLine2(address: string) {
    await this.addressLine2Input.fill(address);
  }
  async fillCity(city: string) {
    await this.cityInput.fill(city);
  }
  async fillZipCode(zip: string) {
    await this.zipCodeInput.fill(zip);
  }
  async fillState(state: string) {
    await this.stateInput.fill(state);
  }
  async fillAdminEmail(email: string) {
    await this.adminEmailInput.fill(email);
  }
  async fillSupportEmail(email: string) {
    await this.supportEmailInput.fill(email);
  }
  async fillBusinessEmail(email: string) {
    await this.businessEmailInput.fill(email);
  }
  async fillPhoneNumber(phone: string) {
    await this.phoneNumberInput.fill(phone);
  }

  // --- Main Flow --------------------------------------------------------------

  /**
   * Full onboarding flow:
   *   1. Navigate to the Onboarding module
   *   2. Open Add New Business modal
   *   3. Fill all form fields
   *   4. Submit and wait for the modal to close
   *   5. Read and return the new merchant's details from the table
   *
   * Pass a custom BillerData object to override specific fields,
   * or call with no arguments to use randomized defaults.
   */
  async onboardBiller(
    data: BillerData = createDefaultBillerData()
  ): Promise<{ input: BillerData; saved: MerchantDetails }> {
    const dashboard = new BlrDashboardPage(this.page);
    await dashboard.goToOnboardingModule();
    await dashboard.clickAddNewBusinessModalButton();

    // Fill the form
    await this.selectAccountType(data.accountType);
    await this.selectLevel(data.level);
    await this.fillBusinessName(data.businessName);
    await this.fillAddressLine1(data.addressLine1);
    if (data.addressLine2) await this.fillAddressLine2(data.addressLine2);
    await this.fillCity(data.city);
    await this.fillZipCode(data.zipCode);
    await this.fillState(data.state);
    await this.selectCountry(data.countrySearch, data.countryOption);
    await this.fillAdminEmail(data.adminEmail);
    await this.fillSupportEmail(data.supportEmail);
    await this.fillBusinessEmail(data.businessEmail);
    if (data.phoneNumber) await this.fillPhoneNumber(data.phoneNumber);

    // Submit and wait for the create-business request to complete before checking
    // the modal — clicking and waiting for "hidden" alone race against backend
    // latency and can time out even though the request is still in flight.
    await Promise.all([
      this.page.waitForResponse(
        (res) => res.request().method() === 'POST' && res.status() < 400,
        { timeout: 60000 }
      ),
      this.addButton.click(),
    ]);
    await this.page.locator('#addMerchantModal').waitFor({ state: 'hidden', timeout: 45000 });
    // No networkidle wait — the SPA polls continuously so it never fires;
    // getMerchantDetails waits on the table and row directly.

    const saved = await this.getMerchantDetails(data.businessName);
    return { input: data, saved };
  }

  async fillNewBusinessForm(adminEmail: string) {
    const data = createBillerDataWithValidEmail(adminEmail);
    await this.selectAccountType(data.accountType);
    await this.selectLevel(data.level);
    await this.fillBusinessName(data.businessName);
    await this.fillAddressLine1(data.addressLine1);
    if (data.addressLine2) await this.fillAddressLine2(data.addressLine2);
    await this.fillCity(data.city);
    await this.fillZipCode(data.zipCode);
    await this.fillState(data.state);
    await this.selectCountry(data.countrySearch, data.countryOption);
    await this.fillAdminEmail(data.adminEmail);
    await this.fillSupportEmail(data.supportEmail);
    await this.fillBusinessEmail(data.businessEmail);
    if (data.phoneNumber) await this.fillPhoneNumber(data.phoneNumber);
    console.log(`[OnboardModulePage] Filled new business form with email: ${adminEmail}`);
  }

  async openAddNewBusinessModal() {
    const dashboard = new BlrDashboardPage(this.page);
    await dashboard.goToOnboardingModule();
    await dashboard.clickAddNewBusinessModalButton();
    console.log('[OnboardModulePage] Add New Business modal opened');
  }

  async submitAddNewBusiness() {
    // No networkidle wait — callers assert on validation/error messages, which
    // auto-wait for the UI to react (and a client-side validation failure
    // produces no network traffic at all).
    await this.addButton.click();
    console.log('[OnboardModulePage] Submitted Add New Business form');
  }

  async onboardBillerWithValidEmail(adminEmail: string): Promise<{ input: BillerData; saved: MerchantDetails }> {
    const data = createBillerDataWithValidEmail(adminEmail);
    return this.onboardBiller(data);
  }

  /**
   * Onboards a sub-level business linked to an existing parent merchant.
   * Selects "Sublevel" hierarchy, picks the parent via the Main Business dropdown,
   * then fills and submits the rest of the form identically to onboardBiller.
   */
  async onboardSubLevelBiller(
    data: SubLevelBillerData = createDefaultSubLevelBillerData('')
  ): Promise<{ input: SubLevelBillerData; saved: MerchantDetails }> {
    const dashboard = new BlrDashboardPage(this.page);
    await dashboard.goToOnboardingModule();
    await dashboard.clickAddNewBusinessModalButton();

    await this.selectAccountType(data.accountType);
    await this.selectLevel(data.level);
    await this.selectMainBusiness(data.mainBusiness);
    await this.fillBusinessName(data.businessName);
    await this.fillAddressLine1(data.addressLine1);
    if (data.addressLine2) await this.fillAddressLine2(data.addressLine2);
    await this.fillCity(data.city);
    await this.fillZipCode(data.zipCode);
    await this.fillState(data.state);
    await this.selectCountry(data.countrySearch, data.countryOption);
    await this.fillAdminEmail(data.adminEmail);
    await this.fillSupportEmail(data.supportEmail);
    await this.fillBusinessEmail(data.businessEmail);
    if (data.phoneNumber) await this.fillPhoneNumber(data.phoneNumber);

    await Promise.all([
      this.page.waitForResponse(
        (res) => res.request().method() === 'POST' && res.status() < 400,
        { timeout: 60000 }
      ),
      this.addButton.click(),
    ]);
    await this.page.locator('#addMerchantModal').waitFor({ state: 'hidden', timeout: 45000 });

    const saved = await this.getMerchantDetails(data.businessName);
    return { input: data, saved };
  }

  // --- Table Read -------------------------------------------------------------

  /**
   * Finds the row in the onboarding table matching the given business name
   * and maps each cell to a MerchantDetails field by matching column headers.
   */
  async getMerchantDetails(businessName: string): Promise<MerchantDetails> {
    const table = this.page.locator('#business-CategoryTable');
    const searchBox = this.page.getByRole('searchbox', { name: /search/i });
    // Filter the table down to the new row instead of relying on it staying on
    // page 1 of the unfiltered, date-sorted list — other activity in the shared
    // environment can otherwise push it off the page before we read it.
    const targetRow = table.locator('tbody tr').filter({ hasText: businessName });

    // Reload before searching: right after creation the merchant is often not
    // yet queryable on the slow test env, and a filtered "no results" table
    // never refreshes on its own — only a reload + fresh search picks the new
    // row up once the backend catches up.
    let rowVisible = false;
    for (let attempt = 1; attempt <= 3 && !rowVisible; attempt++) {
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await table.waitFor({ state: 'visible', timeout: 60_000 });
      // pressSequentially, not fill(): the table search listens on keystrokes,
      // and fill() dispatches none — the value lands without running a search.
      await searchBox.clear();
      await searchBox.pressSequentially(businessName, { delay: 100 });
      rowVisible = await targetRow
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
    }
    if (!rowVisible) {
      throw new Error(`Merchant "${businessName}" not found in onboarding table after 3 reload attempts`);
    }

    // Build a header → column index map
    const rawHeaders = await table.locator('thead th').allTextContents();
    const headers = rawHeaders.map((h) => h.trim().toLowerCase());
    const col = (keyword: string) => headers.findIndex((h) => h.includes(keyword.toLowerCase()));

    const cells = targetRow.locator('td');
    const cellCount = await cells.count();
    const values: string[] = [];
    for (let i = 0; i < cellCount; i++) {
      values.push((await cells.nth(i).innerText()).trim());
    }

    // Helper to get a cell value by header keyword
    const get = (keyword: string) => values[col(keyword)] ?? '';

    return {
      dateCreated: get('date created'),
      dateModified: get('date modified'),
      lastModifiedBy: get('last modified'),
      accountId: get('account id'),
      type: get('type'),
      hierarchy: get('hierarchy'),
      name: get('name'),
      administratorEmail: get('administrator'),
      walletAmount: get('wallet'),
      country: get('country'),
      status: get('status'),
    };
  }

  // --- Reporting --------------------------------------------------------------

  /** Prints all merchant details to the console in a readable format */
  logMerchantDetails(details: MerchantDetails) {
    console.log('=== Onboarded Merchant Details ===');
    console.log('Date Created:       ', details.dateCreated);
    console.log('Date Modified:      ', details.dateModified);
    console.log('Last Modified By:   ', details.lastModifiedBy);
    console.log('Account ID:         ', details.accountId);
    console.log('Type:               ', details.type);
    console.log('Hierarchy:          ', details.hierarchy);
    console.log('Name:               ', details.name);
    console.log('Administrator Email:', details.administratorEmail);
    console.log('Wallet Amount:      ', details.walletAmount);
    console.log('Country:            ', details.country);
    console.log('Status:             ', details.status);
    console.log('==================================');
  }

  // --- Verification -----------------------------------------------------------

  /**
   * Asserts that the saved merchant details match what was submitted in the form.
   * Compares the fields that are directly user-supplied (name, email, type, hierarchy).
   * Fields like accountId, walletAmount, dateCreated are system-generated — not verified here.
   */
  verifyMerchantDetails(input: BillerData, saved: MerchantDetails) {
    expect(saved.name, 'Business Name mismatch').toBe(input.businessName);

    expect(saved.type.toLowerCase(), 'Account Type mismatch').toBe(input.accountType.toLowerCase());

    expect(saved.hierarchy, 'Hierarchy / Level mismatch').toBe(input.level);

    expect(saved.administratorEmail, 'Administrator Email mismatch').toBe(input.adminEmail);

    // Country is stored as a 2-letter code (e.g. "US") — verify it is not empty
    expect(saved.country, 'Country must not be empty').not.toBe('');

    // Status should be "NEW" immediately after onboarding
    expect(saved.status, 'Status should be NEW after onboarding').toBe('NEW'); 

    console.log('[verifyMerchantDetails] All assertions passed for:', saved.name);
  }

  async assertRequiredFieldErrors() {
    const errors = this.page.getByText('This field is required.');
    await expect(errors.first(), 'At least one required field error should be visible').toBeVisible();
    const count = await errors.count();
    // 10 required fields: Business Category, Hierarchy, Business Name,
    // Line 1, City/Municipality, Zip Code, State/Province/Region,
    // Country, Administrator Email Address, Support Email Address
    expect(count, 'All 10 required field errors should be shown').toBe(10);
    console.log(`[OnboardModulePage] All ${count} required field errors are shown`);
  }

  async assertBusinessNameRequiredError() {
    await expect(
      this.page.locator('#addMerchantName-error'),
      'Business Name required field error should be visible'
    ).toContainText('This field is required.');
  }
}

export default OnboardModulePage;
