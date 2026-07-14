// pages/PLATFORM(SUPERADMIN)/accountCredentialPage.ts
//
// ==============================================================================
// ACCOUNT CREDENTIAL — PAGE OBJECT
// ==============================================================================
//
// FLOW:
//   Onboarding → Merchant → Account Credential
//
// TEST CASES COVERED:
//
//   ACCESS
//     BLR-3614  Module is accessible successfully
//
//   CREATE
//     BLR-3615  Creation fails when required fields are empty
//     BLR-3616  Creation fails when name already exists
//     BLR-3617  Creation happy path with optional fields
//
//   LIST
//     BLR-3618  List is searchable
//
//   UPDATE
//     BLR-3619  Update fails when required fields are empty
//     BLR-3620  Update fails when name already exists
//     BLR-3621  Update happy path with optional fields
//
//   STATUS
//     BLR-3622  Deactivation successful when status is active
//     BLR-3623  Activation successful when status is inactive
//
//   DELETE
//     BLR-3624  Deletion fails when status is active
//     BLR-3625  Deletion fails when confirmation key is empty
//     BLR-3626  Deletion successful when inactive + valid confirmation key
//
// ==============================================================================

import { Page, Locator, expect } from '@playwright/test';

// ==============================================================================
// PAGE OBJECT
// ==============================================================================

export class AccountCredentialPage {
  // --- Locators ---------------------------------------------------------------

  private readonly onboardingNavLink:          Locator;
  private readonly addAccountCredentialButton: Locator;
  private readonly nameInput:                  Locator;
  private readonly descriptionInput:           Locator;
  private readonly webhookUrlInput:            Locator;
  private readonly voucherToggle:              Locator;
  private readonly editNameInput:              Locator;
  private readonly editDescriptionInput:       Locator;
  private readonly editWebhookUrlInput:        Locator;
  private readonly addButton:                  Locator;
  private readonly saveButton:                 Locator;
  private readonly tableRows:                  Locator;
  private readonly searchInput:                Locator;
  private readonly successToast:               Locator;
  private readonly confirmationKeyInput:       Locator;
  private readonly confirmDeleteButton:        Locator;

  constructor(private page: Page) {
    this.onboardingNavLink          = page.locator('#merchant');
    this.addAccountCredentialButton = page.getByRole('button', { name: 'Add Account Credential' });
    this.nameInput                  = page.locator('#addAccountCredentialName');
    this.descriptionInput           = page.locator('#addDescription');
    this.webhookUrlInput            = page.locator('#addUrl');
    this.voucherToggle              = page.locator('label').filter({ hasText: 'Voucher' }).first();
    this.editNameInput              = page.locator('#editAccountCredentialName');
    this.editDescriptionInput       = page.locator('#editDescription');
    this.editWebhookUrlInput        = page.locator('#editUrl');
    this.addButton                  = page.getByRole('button', { name: 'Add', exact: true });
    this.saveButton                 = page.getByRole('button', { name: 'Save', exact: true });
    this.tableRows                  = page.locator('table tbody tr');
    this.searchInput                = page.getByRole('searchbox', { name: 'Search:' });
    this.successToast               = page.locator('#toast.bg-success');
    this.confirmationKeyInput       = page.getByRole('dialog').getByRole('textbox');
    this.confirmDeleteButton        = page.getByRole('dialog').getByRole('button', { name: /delete account credential/i });
  }

  // --- Navigation -------------------------------------------------------------

  async goToOnboarding() {
    await this.onboardingNavLink.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[AccountCredentialPage] Navigated to Onboarding');
  }

  async selectMerchant(merchantName: string) {
    await this.page.getByRole('searchbox', { name: 'Search:' }).fill(merchantName);
    const merchantLink = this.page.getByRole('link', { name: merchantName, exact: true });
    await merchantLink.waitFor({ state: 'visible' });
    await merchantLink.click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[AccountCredentialPage] Selected merchant: ${merchantName}`);
  }

  async assertOnAccountCredentialModule() {
    await expect(
      this.addAccountCredentialButton,
      'Account Credential module should be accessible'
    ).toBeVisible();
  }

  // --- Create -----------------------------------------------------------------

  async clickAddAccountCredential() {
    await this.addAccountCredentialButton.click();
    console.log('[AccountCredentialPage] Add Account Credential modal opened');
  }

  async fillName(name: string) {
    await this.nameInput.fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionInput.fill(description);
  }

  async fillWebhookUrl(url: string) {
    await this.webhookUrlInput.fill(url);
  }

  async toggleVoucher() {
    await this.voucherToggle.click();
    console.log('[AccountCredentialPage] Voucher toggled');
  }

  async clickAdd() {
    await this.addButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[AccountCredentialPage] Add clicked');
  }

  // --- Verify -----------------------------------------------------------------

  // The table is paginated (10 rows/page); accumulated test data can push a
  // credential onto page 2+, so always filter by name before targeting a row.
  private async filterTableByName(name: string) {
    await this.searchInput.fill(name);
    await this.page.waitForLoadState('networkidle');
  }

  async assertCredentialInTable(name: string) {
    await this.filterTableByName(name);
    await expect(
      this.page.getByRole('cell', { name, exact: true }).first(),
      `${name} should appear in the table`
    ).toBeVisible();
  }

  async assertNameRequiredError() {
    await expect(
      this.page.getByText('This field is required.').first(),
      'Name required error should be visible'
    ).toBeVisible();
  }

  async assertDuplicateNameError() {
    await expect(
      this.page.getByText(/name '.*' already exists/i),
      'Duplicate name inline error should be visible'
    ).toBeVisible();
  }

  async assertSuccessToast() {
    await expect(this.successToast, 'Success toast should be visible').toBeVisible();
  }

  // --- List -------------------------------------------------------------------

  async searchFor(term: string) {
    await this.searchInput.fill(term);
    await this.page.waitForLoadState('networkidle');
    console.log(`[AccountCredentialPage] Searched: ${term}`);
  }

  async assertRowContains(text: string) {
    const match = this.tableRows.filter({ hasText: text });
    await expect(match.first(), `Table should contain row with: ${text}`).toBeVisible();
  }

  // --- Update -----------------------------------------------------------------

  async clickEditByName(credentialName: string) {
    await this.filterTableByName(credentialName);
    const row = this.tableRows.filter({ hasText: credentialName });
    await row.getByTitle('Edit').click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[AccountCredentialPage] Edit opened for: ${credentialName}`);
  }

  async clearEditName() {
    await this.editNameInput.clear();
    console.log('[AccountCredentialPage] Edit name field cleared');
  }

  async fillEditName(name: string) {
    await this.editNameInput.fill(name);
  }

  async fillEditDescription(description: string) {
    await this.editDescriptionInput.fill(description);
  }

  async fillEditWebhookUrl(url: string) {
    await this.editWebhookUrlInput.fill(url);
  }

  async clickSave() {
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[AccountCredentialPage] Save clicked');
  }

  // --- Status -----------------------------------------------------------------

  async activateByName(credentialName: string) {
    await this.filterTableByName(credentialName);
    const row = this.tableRows.filter({ hasText: credentialName });
    await row.getByTitle('Activate').click();
    await this.page.getByRole('button', { name: 'Activate Account credential' }).click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[AccountCredentialPage] Activated: ${credentialName}`);
  }

  async deactivateByName(credentialName: string) {
    await this.filterTableByName(credentialName);
    const row = this.tableRows.filter({ hasText: credentialName });
    await row.getByTitle('Deactivate').click();
    await this.page.getByRole('button', { name: 'Deactivate Account credential' }).click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[AccountCredentialPage] Deactivated: ${credentialName}`);
  }

  async assertRowStatus(credentialName: string, status: string) {
    await this.filterTableByName(credentialName);
    const row = this.tableRows.filter({ hasText: credentialName });
    await expect(
      row.locator('[class*="status"], td').filter({ hasText: status }).first(),
      `${credentialName} status should be ${status}`
    ).toBeVisible();
  }

  // --- Delete -----------------------------------------------------------------

  async assertDeleteButtonHidden(credentialName: string) {
    await this.filterTableByName(credentialName);
    const row = this.tableRows.filter({ hasText: credentialName });
    await expect(
      row.getByTitle('Delete'),
      `Delete button should not be visible for active credential: ${credentialName}`
    ).toBeHidden();
  }

  async clickDeleteByName(credentialName: string) {
    await this.filterTableByName(credentialName);
    const row = this.tableRows.filter({ hasText: credentialName });
    await row.getByTitle('Delete').click();
    await this.page.waitForLoadState('networkidle');
    console.log(`[AccountCredentialPage] Delete initiated for: ${credentialName}`);
  }

  async fillConfirmationKey(key: string) {
    await this.confirmationKeyInput.fill(key);
  }

  // The confirm button stays enabled with an empty key — clicking it shows an
  // inline "This field is required." error and the deletion does not go through.
  async assertDeleteBlockedWithEmptyKey() {
    await this.confirmDeleteButton.click();
    await expect(
      this.page.getByRole('dialog').getByText('This field is required.'),
      'Required-key error should be shown when confirming delete with an empty key'
    ).toBeVisible();
    await expect(
      this.confirmDeleteButton,
      'Delete modal should stay open — deletion must not go through'
    ).toBeVisible();
    console.log('[AccountCredentialPage] Delete blocked with empty confirmation key');
  }

  async confirmDelete() {
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log('[AccountCredentialPage] Delete confirmed');
  }

  async assertCredentialNotInTable(name: string) {
    await this.filterTableByName(name);
    await expect(
      this.page.getByRole('cell', { name, exact: true }),
      `${name} should no longer appear in the table`
    ).toHaveCount(0);
  }
}

export default AccountCredentialPage;
