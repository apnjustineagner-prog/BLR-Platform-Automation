// pages/PLATFORM(SUPERADMIN)/processorCredentialPage.ts
//
// ==============================================================================
// PROCESSOR CREDENTIAL — PAGE OBJECT
// ==============================================================================
//
// FLOW:
//   Onboarding → Merchant → Account Credential (activated) → Processor Credential
//
// TEST CASES COVERED:
//
//   ACCESS
//     BLR-3084  Module is accessible successfully
//
//   CREATE
//     BLR-3085  ECPAY credential created with valid input
//     BLR-3086  SSS credential created with valid input
//     BLR-3087  BRN credential created with valid input
//     BLR-3088  Payment Collection credential created with valid input
//     BLR-3089  Local Gov of Davao credential created with valid input
//
//   VIEW
//     BLR-3090  Details modal displayed and closed
//
//   LIST
//     BLR-3091  List is searchable
//     BLR-3092  List sorted by column headers
//     BLR-3093  List filtered by page size
//     BLR-3094  Pagination works
//
//   UPDATE
//     BLR-3095  Update successful when value fields modified
//     BLR-3096  Update successful when processor is changed
//
//   STATUS
//     BLR-3097  Activation successful when status is inactive
//     BLR-3098  Deactivation successful when status is active
//
//   DELETE
//     BLR-3099  Deletion successful when inactive + valid confirmation key
//
// ==============================================================================

import { Page, expect, test } from '@playwright/test';

// ==============================================================================
// TYPES
// ==============================================================================

export interface EcpayFields {
  accountID: string;
  branchID: string;
  userID: string;
  username: string;
  password: string;
}

export interface EcpayCredentialData {
  searchTerm: string;
  name: string;
  channel: string;
  currencySearchTerm: string;
  currency: string;
  fields: EcpayFields;
}

export interface SssFields {
  tokenID: string;
  tokenIDForEmployer: string;
  pttyp: string;
  newToken: string;
  [key: string]: string;
}

export interface SssCredentialData {
  searchTerm: string;
  name: string;
  channel: string;
  currencySearchTerm: string;
  currency: string;
  fields: SssFields;
}

export interface BrnFields {
  token: string;
  [key: string]: string;
}

export interface BrnCredentialData {
  searchTerm: string;
  name: string;
  channel: string;
  currencySearchTerm: string;
  currency: string;
  fields: BrnFields;
}

export interface PaymentCollectionFields {
  token: string;
  [key: string]: string;
}

export interface LocalGovDavaoFields {
  provider: string;
  tokenid: string;
  qrHostUrl: string;
  [key: string]: string;
}

// ==============================================================================
// PAGE OBJECT
// ==============================================================================

export class ProcessorCredentialPage {
  // --- Locators ---------------------------------------------------------------

  private readonly onboardingNavLink;
  private readonly addAccountCredentialButton;
  private readonly accountCredentialNameInput;
  private readonly accountCredentialDescriptionInput;
  private readonly addButton;
  private readonly saveButton;
  private readonly addProcessorCredentialButton;
  private readonly processorSearchbox;
  private readonly activateAccountCredentialConfirmButton;
  private readonly tableRows;
  private readonly detailsModal;
  private readonly closeModalButton;
  private readonly searchInput;
  private readonly pageSizeSelect;
  private readonly paginationNext;
  private readonly successToast;
  private readonly confirmationKeyInput;
  private readonly confirmDeleteButton;

  constructor(private page: Page) {
    this.onboardingNavLink                  = page.locator('#merchant');
    this.addAccountCredentialButton         = page.getByRole('button', { name: '+ Add Account Credential' });
    this.accountCredentialNameInput         = page.getByRole('textbox', { name: 'Name' });
    this.accountCredentialDescriptionInput  = page.getByRole('textbox', { name: 'Description (Optional)' });
    this.addButton                          = page.getByRole('button', { name: 'Add', exact: true });
    this.saveButton                         = page.getByRole('button', { name: 'Save', exact: true });
    this.addProcessorCredentialButton       = page.getByRole('button', { name: '+ Add Processor Credential' });
    this.processorSearchbox                 = page.getByRole('searchbox', { name: 'Search', exact: true });
    this.activateAccountCredentialConfirmButton = page.getByRole('button', { name: 'Activate Account credential' });
    this.tableRows                          = page.locator('table tbody tr');
    this.detailsModal                       = page.locator('.modal.show');
    this.closeModalButton                   = this.detailsModal.locator('.modal-footer button');
    this.searchInput                        = page.getByRole('searchbox', { name: 'Search:' });
    this.pageSizeSelect                     = page.getByRole('button', { name: /show.*rows/i });
    this.paginationNext                     = page.getByRole('link', { name: /next/i });
    this.successToast                       = page.locator('#toast.bg-success');
    this.confirmationKeyInput               = page.getByRole('dialog').getByRole('textbox');
    this.confirmDeleteButton                = page.getByRole('dialog').getByRole('button', { name: /delete processor credential/i });
  }

  // --- Navigation -------------------------------------------------------------

  async goToOnboarding() {
    await this.onboardingNavLink.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[ProcessorCredentialPage] Navigated to Onboarding');
  }

  async selectMerchant(merchantName: string) {
    await this.page.getByRole('searchbox', { name: 'Search:' }).fill(merchantName);
    const merchantLink = this.page.getByRole('link', { name: merchantName, exact: true });
    await merchantLink.waitFor({ state: 'visible' });
    await merchantLink.click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Selected merchant: ${merchantName}`);
  }

  async navigateIntoAccountCredential(accountCredentialName: string) {
    await this.page.getByRole('link', { name: accountCredentialName }).click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Navigated into account credential: ${accountCredentialName}`);
  }

  async assertOnProcessorCredentialModule() {
    await expect(
      this.addProcessorCredentialButton,
      'Processor Credential module should be accessible'
    ).toBeVisible();
  }

  // --- Account Credential Setup -----------------------------------------------

  async addAccountCredential(name: string, description?: string) {
    await this.addAccountCredentialButton.click();
    await this.accountCredentialNameInput.fill(name);
    if (description) {
      await this.accountCredentialDescriptionInput.fill(description);
    }
    await this.addButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Account credential added: ${name}`);
  }

  async activateAccountCredential(rowIndex = 1) {
    await this.page.getByTitle('Activate').nth(rowIndex).click();
    await this.activateAccountCredentialConfirmButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[ProcessorCredentialPage] Account credential activated');
  }

  // --- Create Processor Credential --------------------------------------------

  async clickAddProcessorCredential() {
    await this.addProcessorCredentialButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[ProcessorCredentialPage] Add Processor Credential form opened');
  }

  /** The Add and Edit forms render separate select2 widgets with "add"/"edit" prefixed
   *  container IDs (#select2-addProcessorSelect-container vs #select2-editProcessorSelect-container). */
  async selectProcessor(searchTerm: string, processorName: string, mode: 'add' | 'edit' = 'add') {
    const select = this.page.locator(`#select2-${mode}ProcessorSelect-container`);
    await select.click();
    await this.processorSearchbox.fill(searchTerm);
    await this.page.getByRole('option', { name: processorName }).click();
    await this.page.waitForLoadState('networkidle');
    await this.page.locator(`#select2-${mode}ChannelSelect-container`).waitFor({ state: 'visible' });
    console.log(`[ProcessorCredentialPage] Processor selected: ${processorName}`);
  }

  /** Channel options are AJAX-loaded after the processor is picked, and select2 only
   *  renders what the underlying <select> holds at the moment the dropdown opens —
   *  opening too early shows just the "Select" placeholder and the typed channel
   *  silently matches nothing, so the form later fails validation with no channel.
   *  Wait for the real <option> to exist in the hidden <select> before opening. */
  async selectChannel(channelName: string, mode: 'add' | 'edit' = 'add') {
    await this.page
      .locator(`#${mode}ChannelSelect option`, { hasText: channelName })
      .first()
      .waitFor({ state: 'attached', timeout: 30_000 });

    const select = this.page.locator(`#select2-${mode}ChannelSelect-container`);
    await select.click();
    await this.processorSearchbox.fill(channelName);
    await this.page.getByRole('option', { name: channelName }).click();
    await expect(select, `Channel should show as selected: ${channelName}`).toContainText(channelName);
    console.log(`[ProcessorCredentialPage] Channel selected: ${channelName}`);
  }

  async selectCurrency(searchTerm: string, currencyName: string, mode: 'add' | 'edit' = 'add') {
    const select = this.page.locator(`#select2-${mode}CurrencySelect-container`);
    await select.click();
    await this.processorSearchbox.fill(searchTerm);
    await this.page.getByRole('option', { name: currencyName, exact: true }).click();
    console.log(`[ProcessorCredentialPage] Currency selected: ${currencyName}`);
  }

  async fillEcpayFields(fields: EcpayFields) {
    await this.page.getByRole('textbox', { name: 'accountID' }).fill(fields.accountID);
    await this.page.getByRole('textbox', { name: 'branchID' }).fill(fields.branchID);
    await this.page.getByRole('textbox', { name: 'userID' }).fill(fields.userID);
    await this.page.getByRole('textbox', { name: 'username' }).fill(fields.username);
    await this.page.getByRole('textbox', { name: 'password' }).fill(fields.password);
  }

  async fillGenericFields(fields: Record<string, string>) {
    for (const [fieldName, value] of Object.entries(fields)) {
      await this.page.getByRole('textbox', { name: fieldName, exact: true }).fill(value);
    }
  }

  /** Fills fields whose inputs are identified by id (#value-0, #value-1, ...) rather than accessible name.
   *  Uses .last() because switching processor type while editing can leave a stale,
   *  duplicate-id input behind from the previous processor's form before it's removed. */
  async fillFieldsByValueId(fields: Record<string, string>) {
    const values = Object.values(fields);
    for (let i = 0; i < values.length; i++) {
      await this.page.locator(`#value-${i}`).last().fill(values[i]);
    }
  }

  /** The app only hides the modal after the create POST and table refresh complete,
   *  which can exceed the 10s action timeout under load — hence the explicit 30s. */
  async clickAdd() {
    await this.addButton.click();
    await this.page.waitForLoadState('networkidle');
    await this.page.locator('#addProcessorCredentialModal').waitFor({ state: 'hidden', timeout: 30_000 });
    console.log('[ProcessorCredentialPage] Add clicked');
  }

  /** The edit form's submit button is labeled "Save", not "Add". */
  async clickSave() {
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[ProcessorCredentialPage] Save clicked');
  }

  // --- Verify -----------------------------------------------------------------

  /** 30s: the table refresh after an add can still be spinning well past the 10s expect timeout. */
  async assertProcessorInTable(processorName: string) {
    await expect(
      this.page.getByRole('cell', { name: processorName }).first(),
      `${processorName} should appear in the table`
    ).toBeVisible({ timeout: 30_000 });
  }

  // --- Flows --------------------------------------------------------------------

  async createEcpayCredential(merchant: string, freshCredName: string, data: EcpayCredentialData) {
    await test.step('Create a fresh account credential', async () => {
      await this.goToOnboarding();
      await this.selectMerchant(merchant);
      await this.addAccountCredential(freshCredName);
      await this.activateAccountCredential(0);
      await this.navigateIntoAccountCredential(freshCredName);
    });

    await test.step('Click Add Processor Credential', async () => {
      await this.clickAddProcessorCredential();
    });

    await test.step('Select ECPAY processor', async () => {
      await this.selectProcessor(data.searchTerm, data.name);
    });

    await test.step('Select currency', async () => {
      await this.selectCurrency(data.currencySearchTerm, data.currency);
    });

    await test.step('Select channel', async () => {
      await this.selectChannel(data.channel);
    });

    await test.step('Fill ECPAY credential fields', async () => {
      await this.fillEcpayFields(data.fields);
    });

    await test.step('Submit', async () => {
      await this.clickAdd();
    });

    await test.step('Verify ECPAY credential appears in the list', async () => {
      await this.assertProcessorInTable(data.name);
    });
  }

  async createSssCredential(merchant: string, freshCredName: string, data: SssCredentialData) {
    await test.step('Create a fresh account credential', async () => {
      await this.goToOnboarding();
      await this.selectMerchant(merchant);
      await this.addAccountCredential(freshCredName);
      await this.activateAccountCredential(0);
      await this.navigateIntoAccountCredential(freshCredName);
    });

    await test.step('Click Add Processor Credential', async () => {
      await this.clickAddProcessorCredential();
    });

    await test.step('Select SSS processor', async () => {
      await this.selectProcessor(data.searchTerm, data.name);
    });

    await test.step('Select currency', async () => {
      await this.selectCurrency(data.currencySearchTerm, data.currency);
    });

    await test.step('Select channel', async () => {
      await this.selectChannel(data.channel);
    });

    await test.step('Fill SSS credential fields', async () => {
      await this.fillFieldsByValueId(data.fields);
    });

    await test.step('Submit', async () => {
      await this.clickAdd();
    });

    await test.step('Verify SSS credential appears in the list', async () => {
      await this.assertProcessorInTable(data.name);
    });
  }

  async createBrnCredential(merchant: string, freshCredName: string, data: BrnCredentialData) {
    await test.step('Create a fresh account credential', async () => {
      await this.goToOnboarding();
      await this.selectMerchant(merchant);
      await this.addAccountCredential(freshCredName);
      await this.activateAccountCredential(0);
      await this.navigateIntoAccountCredential(freshCredName);
    });

    await test.step('Click Add Processor Credential', async () => {
      await this.clickAddProcessorCredential();
    });

    await test.step('Select BRN processor', async () => {
      await this.selectProcessor(data.searchTerm, data.name);
    });

    await test.step('Select currency', async () => {
      await this.selectCurrency(data.currencySearchTerm, data.currency);
    });

    await test.step('Select channel', async () => {
      await this.selectChannel(data.channel);
    });

    await test.step('Fill BRN credential fields', async () => {
      await this.fillFieldsByValueId(data.fields);
    });

    await test.step('Submit', async () => {
      await this.clickAdd();
    });

    await test.step('Verify BRN credential appears in the list', async () => {
      await this.assertProcessorInTable(data.name);
    });
  }

  // --- View -------------------------------------------------------------------

  async clickViewOnRow(rowIndex = 0) {
    const viewBtn = this.tableRows.nth(rowIndex).getByTitle('View');
    await viewBtn.click();
    await this.detailsModal.waitFor({ state: 'visible' });
    console.log(`[ProcessorCredentialPage] View modal opened for row ${rowIndex}`);
  }

  async assertDetailsModalVisible() {
    await expect(this.detailsModal, 'Details modal should be visible').toBeVisible();
  }

  async closeModal() {
    await this.closeModalButton.click();
    await this.detailsModal.waitFor({ state: 'hidden' });
    console.log('[ProcessorCredentialPage] Modal closed');
  }

  async assertDetailsModalHidden() {
    await expect(this.detailsModal, 'Details modal should be hidden').toBeHidden();
  }

  // --- List -------------------------------------------------------------------

  async searchFor(term: string) {
    await this.searchInput.fill(term);
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Searched: ${term}`);
  }

  async assertRowContains(text: string) {
    const match = this.tableRows.filter({ hasText: text });
    await expect(match.first(), `Table should contain row with: ${text}`).toBeVisible();
  }

  async sortByColumn(columnHeader: string) {
    await this.page.getByRole('columnheader', { name: columnHeader }).first().click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Sorted by: ${columnHeader}`);
  }

  /** Verifies a sort was applied by checking for the aria-sort attribute DataTables sets on the active column header.
   *  Checking row data is unreliable when parallel tests are concurrently adding rows to the same table. */
  async assertTableSorted() {
    const sortedHeader = this.page.locator('th[aria-sort]').first();
    await expect(sortedHeader, 'A column header should have an active sort indicator (aria-sort)').toBeVisible();
  }

  /** Page size is a DataTables Buttons collection (10/25/50/100/All), not a native <select>. */
  async setPageSize(size: string) {
    await this.pageSizeSelect.click();
    await this.page.locator('.dt-button-collection a.button-page-length', { hasText: size }).first().click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Page size set to: ${size}`);
  }

  /** Verifies the page-length button reflects the chosen size (row count alone isn't a reliable signal when the table has fewer rows than any available page size). */
  async assertPageSizeSelected(size: string) {
    await expect(
      this.pageSizeSelect,
      `Page size control should reflect selection: ${size}`
    ).toHaveText(new RegExp(`Show ${size} rows`, 'i'));
  }

  async clickNextPage() {
    await this.paginationNext.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[ProcessorCredentialPage] Navigated to next page');
  }

  /** Parses the "Showing X to Y of N entries" DataTables info text. */
  async getTotalEntries(): Promise<number> {
    const text = await this.page.locator('.dataTables_info').innerText();
    const match = text.match(/of (\d+) entries/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async assertNextPageLoaded() {
    await expect(this.tableRows.first(), 'Table should show rows on next page').toBeVisible();
  }

  // --- Update -----------------------------------------------------------------

  async clickEditOnRow(rowIndex = 0) {
    const editBtn = this.tableRows.nth(rowIndex).getByTitle('Edit');
    await editBtn.click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Edit opened for row ${rowIndex}`);
  }

  /** Targets the row by processor name rather than position, since row order
   *  depends on whatever sort state persisted from earlier tests. The list
   *  spans multiple pages once BLR-3094's pagination seeds are in place and
   *  filter() only sees the rendered page, so surface the row through the
   *  table search first. */
  async clickEditOnProcessor(processorName: string) {
    await this.searchFor(processorName);
    const row = this.tableRows.filter({ hasText: processorName });
    await row.getByTitle('Edit').click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Edit opened for processor: ${processorName}`);
  }

  /** Same as clickEditOnProcessor, but narrows by every field given (e.g. name + currency)
   *  for fixtures where multiple rows share the same processor name. */
  async clickEditOnProcessorRow(...texts: string[]) {
    await this.searchFor(texts[0]);
    await this.rowByFields(...texts).getByTitle('Edit').click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Edit opened for: ${texts.join(' / ')}`);
  }

  /** Narrows to a single row by every text fragment given, e.g. processor name + currency,
   *  for fixtures where multiple rows share the same processor name. */
  rowByFields(...texts: string[]) {
    return texts.reduce((rows, text) => rows.filter({ hasText: text }), this.tableRows);
  }

  // --- Status -----------------------------------------------------------------

  async clickActivateOnRow(rowIndex = 0) {
    const activateBtn = this.tableRows.nth(rowIndex).getByTitle('Activate');
    await activateBtn.click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Activate Processor credential' }).click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Activated row ${rowIndex}`);
  }

  async clickDeactivateOnRow(rowIndex = 0) {
    const deactivateBtn = this.tableRows.nth(rowIndex).getByTitle('Deactivate');
    await deactivateBtn.click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Deactivate Processor credential' }).click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Deactivated row ${rowIndex}`);
  }

  /** Runs a credential through NEW → ACTIVE → INACTIVE → deleted, targeting the row
   *  by field text rather than position, so self-cleanup doesn't depend on row order. */
  async deleteCredentialByFields(...texts: string[]) {
    // The target row can sit past page 1, or be hidden by a search term left
    // over from an earlier step (e.g. the pre-edit processor name after
    // clickEditOnProcessorRow) — re-search on the row's current first field.
    await this.searchFor(texts[0]);
    const row = () => this.rowByFields(...texts);

    await row().getByTitle('Activate').click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Activate Processor credential' }).click();
    await this.page.waitForLoadState('networkidle');

    await row().getByTitle('Deactivate').click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Deactivate Processor credential' }).click();
    await this.page.waitForLoadState('networkidle');

    await row().getByTitle('Delete').click();
    await this.confirmationKeyInput.fill('DELETE');
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Cleaned up credential: ${texts.join(' / ')}`);
  }

  /** Deletes a credential matching the given fields if one exists, regardless of its
   *  current status (NEW/ACTIVE/INACTIVE). Used as a precondition so "create" tests
   *  are idempotent against a fixture that already has their target row from a
   *  previous run. No-ops if no matching row is found. */
  async deleteCredentialIfExists(...texts: string[]) {
    // A leftover row from a previous run can sit past page 1, where count()
    // would miss it and the caller's create would then hit the duplicate
    // validation error — search first so every page is considered.
    await this.searchFor(texts[0]);
    const row = this.rowByFields(...texts);
    if ((await row.count()) === 0) {
      await this.searchFor('');
      return;
    }

    if ((await row.getByTitle('Deactivate').count()) > 0) {
      // ACTIVE
      await row.getByTitle('Deactivate').click();
      await this.page.getByRole('dialog').getByRole('button', { name: 'Deactivate Processor credential' }).click();
      await this.page.waitForLoadState('networkidle');
    } else if ((await row.getByTitle('Delete').count()) === 0) {
      // NEW
      await row.getByTitle('Activate').click();
      await this.page.getByRole('dialog').getByRole('button', { name: 'Activate Processor credential' }).click();
      await this.page.waitForLoadState('networkidle');

      await row.getByTitle('Deactivate').click();
      await this.page.getByRole('dialog').getByRole('button', { name: 'Deactivate Processor credential' }).click();
      await this.page.waitForLoadState('networkidle');
    }
    // now INACTIVE

    await row.getByTitle('Delete').click();
    await this.confirmationKeyInput.fill('DELETE');
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
    await this.searchFor('');
    console.log(`[ProcessorCredentialPage] Deleted pre-existing credential: ${texts.join(' / ')}`);
  }

  async assertRowStatus(rowIndex: number, status: string) {
    const statusCell = this.tableRows.nth(rowIndex).locator('[class*="status"], td').filter({ hasText: status });
    await expect(statusCell.first(), `Row ${rowIndex} status should be ${status}`).toBeVisible();
  }

  // --- Delete -----------------------------------------------------------------

  async clickDeleteOnRow(rowIndex = 0) {
    const deleteBtn = this.tableRows.nth(rowIndex).getByTitle('Delete');
    await deleteBtn.click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[ProcessorCredentialPage] Delete initiated for row ${rowIndex}`);
  }

  /** Clicks Delete on the first row that has a Delete button visible (i.e. first inactive row).
   *  Safer than clickDeleteOnRow(0) when parallel tests may have shifted which row is at index 0. */
  async clickDeleteOnFirstAvailableRow() {
    const rowWithDelete = this.tableRows.filter({ has: this.page.getByTitle('Delete') }).first();
    await rowWithDelete.getByTitle('Delete').click();
    await this.page.waitForLoadState('networkidle');
    console.log('[ProcessorCredentialPage] Delete initiated for first available inactive row');
  }

  async fillConfirmationKey(key: string) {
    await this.confirmationKeyInput.fill(key);
  }

  async confirmDelete() {
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[ProcessorCredentialPage] Delete confirmed');
  }

  async assertSuccessToast() {
    await expect(this.successToast, 'Success toast should be visible').toBeVisible();
  }
}

export default ProcessorCredentialPage;
