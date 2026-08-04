// pages/PLATFORM(SUPERADMIN)/onboardingPage.ts
//
// ==============================================================================
// ONBOARDING — PAGE OBJECT
// ==============================================================================
//
// TEST CASES COVERED:
//
//   VIEW MODAL
//     BLR-3274  Merchant onboarding view modal does not display "Resend Activation" button
//
//   EPL LINK MANAGEMENT
//     BLR-3275  Merchant onboarding retains valid EPL link when editing merchant details
//     BLR-3286  Merchant update is successful when EPL URL remains unchanged and valid
//     BLR-3287  Merchant update fails when EPL URL format is invalid
//     BLR-3288  Merchant update allows modification of other fields while EPL URL remains valid
//     BLR-3289  Merchant update allows EPL URL to be saved and re-edited successfully
//     BLR-3290  Merchant update is successful when EPL URL is changed to a new valid URL
//
//   MERCHANT DELETION
//     BLR-3276  Merchant deletion is prevented when business has linked entities
//     BLR-3277  Merchant deletion proceeds successfully when no linked agents exist
//     BLR-3278  Merchant deletion fails when linked agents validation is triggered
//     BLR-3279  Merchant deletion validation message is displayed correctly
//     BLR-3280  Merchant deletion requires removal of linked agents before proceeding
//     BLR-3281  Merchant deletion supports partial removal of linked agents
//     BLR-3282  Merchant deletion handles multiple delete attempts correctly
//     BLR-3284  Merchant deletion access is restricted to admin role only
//
//   LINKED AGENTS
//     BLR-3285  Linked agents list is displayed successfully for a business
//
//   SSS CONTRIBUTION
//     BLR-3283  SSS contribution payment is processed successfully using valid PRN (full flow)
//
// ==============================================================================

import { Page, expect } from '@playwright/test';
import { AgentData } from '../../utils/businessData';

// ==============================================================================
// PAGE OBJECT
// ==============================================================================

export class OnboardingPage {
  // --- Locators ---------------------------------------------------------------

  private readonly onboardingLink;
  private readonly merchantTable;
  private readonly viewButton;
  private readonly viewModal;
  private readonly resendActivationButton;
  private readonly editButton;
  private readonly confirmDeleteActionField;
  private readonly cancelDeleteButton;
  private readonly deleteValidationMessage;
  private readonly eplUrlInput;
  private readonly saveButton;
  private readonly linkedAgentsList;
  private readonly prnInput;
  private readonly submitPrnButton;
  private readonly successMessage;
  private readonly errorMessage;
  private readonly searchMerchantInput;
  private readonly bussinessEditPage;
  private readonly editURLInput;
  private readonly systemUsermoduleLink;
  private readonly confirmDeleteButton;
  private readonly deactivateButton;
  private readonly confirmDeactivateButton;
  private readonly activateButton;
  private readonly confirmActivateButton;
  private readonly unsuccessfulDeletionMessagePrompt;
  private readonly businessNameEditInput;
  private readonly addressLine1EditInput;
  private readonly addressLine2EditInput;
  private readonly cityEditInput;
  private readonly zipCodeEditInput;
  private readonly stateEditInput;
  private readonly supportEmailEditInput;
  private readonly businessEmailEditInput;
  private readonly phoneNumberEditInput;
  private readonly accntSetupUsernameInput;
  private readonly accntSetupPasswordInput;
  private readonly accntSetupConfirmPasswordInput;
  private readonly accntSetupSubmitButton;
  private readonly agentAccntSetupSubmitButton;

  // --- Agent Locators ---------------------------------------------------------

  private readonly agentNavLink;
  private readonly addAgentButton;
  private readonly agentModal;
  private readonly agentMerchantSelect;
  private readonly agentCredentialSelect;
  private readonly agentTypeSelect;
  private readonly agentHierarchySelect;
  private readonly agentNameInput;
  private readonly agentAddressLine1Input;
  private readonly agentAddressLine2Input;
  private readonly agentCityInput;
  private readonly agentZipCodeInput;
  private readonly agentStateInput;
  private readonly agentCountryInput;
  private readonly agentCountrySearchInput;
  private readonly agentEmailInput;
  private readonly agentPhoneInput;
  private readonly agentMobileInput;
  private readonly agentWebsiteInput;
  private readonly agentAddButton;

  // --- Agent Edit-Form Locators (scoped to #editAgentForm, a separate modal) --

  private readonly agentEditModal;
  private readonly agentBusinessEditField;
  private readonly agentCredentialEditField;
  private readonly agentNameEditInput;
  private readonly agentAddressLine1EditInput;
  private readonly agentAddressLine2EditInput;
  private readonly agentCityEditInput;
  private readonly agentZipCodeEditInput;
  private readonly agentStateEditInput;
  private readonly agentEmailEditInput;
  private readonly agentPhoneEditInput;
  private readonly agentMobileEditInput;
  private readonly agentWebsiteEditInput;

  constructor(private page: Page) {
    this.onboardingLink        = page.getByRole('link', { name: /onboarding/i });
    // Same underlying table as blrOnboardingModulePage.ts's getMerchantDetails
    // — this page object drives the same /business-category page, just via a
    // different set of flows (view/edit/delete/activate rather than create).
    this.merchantTable         = page.locator('#business-CategoryTable');
    this.viewButton            = page.locator('button.viewButton');
    this.editButton            = page.getByRole('button', { name: /edit/i });
    this.confirmDeleteActionField = page.locator('#deleteInput');
    this.confirmDeleteButton   = page.locator('.modal-submit-button.btn.btn-user.btn-danger');
    this.deactivateButton      = page.locator('button.deactivateButton');
    this.confirmDeactivateButton = page.locator('.modal-submit-button.btn.btn-user.btn-danger');
    this.activateButton        = page.locator('button.activateButton');
    this.confirmActivateButton = page.locator('.modal-submit-button.btn.btn-user.btn-success');
    this.businessNameEditInput    = page
      .getByRole('textbox', { name: 'Business', exact: true })
      .or(page.getByRole('textbox', { name: 'Business Name', exact: true }));
    this.addressLine1EditInput    = page.getByRole('textbox', { name: 'Line 1' });
    this.addressLine2EditInput    = page.getByRole('textbox', { name: 'Line 2 (Optional)' });
    this.cityEditInput            = page.getByRole('textbox', { name: 'City/Municipality' });
    this.zipCodeEditInput         = page.getByRole('textbox', { name: 'Zip Code' });
    this.stateEditInput           = page.getByRole('textbox', { name: 'State/Province/Region' });
    this.supportEmailEditInput    = page.getByRole('textbox', { name: 'Support Email Address' });
    this.businessEmailEditInput   = page.getByRole('textbox', { name: 'Business Email Address (' });
    this.phoneNumberEditInput     = page.getByRole('textbox', { name: 'Phone Number (Optional)' });
    this.cancelDeleteButton    = page.getByRole('button', { name: /cancel/i });
    this.deleteValidationMessage = page.locator('TODO: delete validation message locator');
    this.eplUrlInput           = page.locator('TODO: EPL URL input locator');
    this.saveButton            = page.getByRole('button', { name: /save/i });
    this.linkedAgentsList      = page.locator('TODO: linked agents list locator');
    this.prnInput              = page.locator('TODO: PRN input locator');
    this.submitPrnButton       = page.getByRole('button', { name: /submit/i });
    this.successMessage        = page.getByRole('alert');
    this.errorMessage          = page.locator('#addAdminEmail-error');
    this.searchMerchantInput   = page.getByRole('searchbox', { name: /search/i });
    this.bussinessEditPage     = page.locator("button[title='Edit']");
    this.viewModal             = page.locator('.modal:visible');
    this.resendActivationButton = page.locator("#resendActivation")
    this.editURLInput = page.locator('#editUrl');
    this.systemUsermoduleLink = page.locator('#user');
    this.unsuccessfulDeletionMessagePrompt = page.locator('.toast-body');

    //Set Up account activation
    this.accntSetupUsernameInput = page.getByPlaceholder('Username');
    this.accntSetupPasswordInput = page.getByPlaceholder('New Password', { exact: true });
    this.accntSetupConfirmPasswordInput = page.getByPlaceholder('Confirm New Password');
    this.accntSetupSubmitButton = page.locator('#activateMerchantButton');
    this.agentAccntSetupSubmitButton = page.getByRole('button', { name: 'Submit' });

    // Agent locators
    this.agentNavLink              = page.locator('a#agent');
    this.addAgentButton            = page.getByRole('button', { name: '+ Add New Agent' });
    this.agentModal                = page.locator('#addAgentModal');
    // All add-form inputs are scoped inside the modal to avoid matching elements outside it
    const modal = this.agentModal;
    this.agentMerchantSelect       = modal.locator('#select2-addMerchantSelect-container');
    this.agentCredentialSelect     = modal.locator('#select2-addAccountCredentialSelect-container');
    this.agentTypeSelect           = modal.locator('#select2-addTypeSelect-container');
    this.agentHierarchySelect      = modal.getByRole('combobox', { name: 'Select' });
    this.agentNameInput            = modal.getByRole('textbox', { name: 'Agent Name' });
    this.agentAddressLine1Input    = modal.getByRole('textbox', { name: 'Line 1' });
    this.agentAddressLine2Input    = modal.getByRole('textbox', { name: 'Line 2 (Optional)' });
    this.agentCityInput            = modal.getByRole('textbox', { name: 'City/Municipality' });
    this.agentZipCodeInput         = modal.getByRole('textbox', { name: 'Zip Code' });
    this.agentStateInput           = modal.getByRole('textbox', { name: 'State/Province/Region' });
    this.agentCountryInput         = modal.getByRole('textbox', { name: 'Country' });
    this.agentCountrySearchInput   = modal.getByRole('searchbox', { name: 'Search', exact: true });
    this.agentEmailInput           = modal.getByRole('textbox', { name: 'Email' });
    this.agentPhoneInput           = modal.getByRole('textbox', { name: 'Phone Number (Optional)' });
    this.agentMobileInput          = modal.getByRole('textbox', { name: 'Mobile Number (Optional)' });
    this.agentWebsiteInput         = modal.getByRole('textbox', { name: "Agent's Website" });
    this.agentAddButton            = modal.getByRole('button', { name: 'Add', exact: true });

    // Agent Edit Form locators — a separate modal (#editAgentForm), not #addAgentModal
    this.agentEditModal               = page.locator('#editAgentForm');
    const editModal = this.agentEditModal;
    this.agentBusinessEditField       = editModal.getByRole('textbox', { name: 'Business' });
    this.agentCredentialEditField     = editModal.locator('#editAccountCredential');
    this.agentNameEditInput           = editModal.getByRole('textbox', { name: 'Agent Name' });
    this.agentAddressLine1EditInput   = editModal.getByRole('textbox', { name: 'Line 1' });
    this.agentAddressLine2EditInput   = editModal.getByRole('textbox', { name: 'Line 2 (Optional)' });
    this.agentCityEditInput           = editModal.getByRole('textbox', { name: 'City/Municipality' });
    this.agentZipCodeEditInput        = editModal.getByRole('textbox', { name: 'Zip Code' });
    this.agentStateEditInput          = editModal.getByRole('textbox', { name: 'State/Province/Region' });
    this.agentEmailEditInput          = editModal.getByRole('textbox', { name: 'Email' });
    this.agentPhoneEditInput          = editModal.getByRole('textbox', { name: 'Phone Number (Optional)' });
    this.agentMobileEditInput         = editModal.getByRole('textbox', { name: 'Mobile Number (Optional)' });
    this.agentWebsiteEditInput        = editModal.getByRole('textbox', { name: "Agent's Website" });
  }

  async fillAccountSetupDetails(username: string, newPassword: string, confirmPassword: string) {
    await this.accntSetupUsernameInput.fill(username);
    await this.accntSetupPasswordInput.fill(newPassword);
    await this.accntSetupConfirmPasswordInput.fill(confirmPassword);
    await this.accntSetupSubmitButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async fillAgentAccountSetupDetails(username: string, newPassword: string, confirmPassword: string) {
    await this.accntSetupUsernameInput.fill(username);
    await this.accntSetupPasswordInput.fill(newPassword);
    await this.accntSetupConfirmPasswordInput.fill(confirmPassword);
    await this.agentAccntSetupSubmitButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // --- Navigation -------------------------------------------------------------

  async goToOnboarding() {
    const openModal = this.page.locator('.modal.show');
    if (await openModal.isVisible().catch(() => false)) {
      await this.page.keyboard.press('Escape');
      await openModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
    // This click triggers a real page navigation, and this test env can take
    // up to a minute to render — give it the same budget as the load/element
    // waits below instead of the default actionTimeout.
    await this.onboardingLink.click({ timeout: 60_000 });
    await this.page.waitForLoadState('load', { timeout: 60_000 });
    await this.searchMerchantInput.waitFor({ state: 'visible', timeout: 60_000 });
  }

  async goToSystemUser(){
    await this.systemUsermoduleLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  async assertOnOnboardingPage() {
    await expect(
      this.page.getByText('TODO: onboarding page heading text'),
      'Should be on Onboarding page'
    ).toBeVisible();
  }

  // fill() fires an `input` event, which the DataTables search box listens on —
  // no need to type character-by-character anymore.
  //
  // Don't wait on networkidle here (previously did, via a `merchantTable`
  // locator that was still a literal 'TODO' placeholder and never actually
  // used): this page polls continuously in the background, same as
  // blrDashboardPage.ts/blrOnboardingModulePage.ts already document, so
  // networkidle never resolves — it was hanging until the *test's* timeout,
  // not its own, which also broke cleanupMerchant() (it calls this method
  // too) and cascaded into unrelated tests' teardown. Wait on the filtered
  // row directly instead, matching getMerchantDetails()'s approach.
  //
  // Retry the search itself (not just the row wait): the backend search
  // index can lag a few seconds behind a just-completed state change
  // (deactivate/activate/delete), returning a genuine zero-result "No
  // Merchants" response right after the action's success toast — the same
  // class of async lag already handled for deletion in
  // assertMerchantDeleted(). A single search can race that lag; re-issuing
  // it after a short pause absorbs it instead of failing immediately.
  async searchMerchant(businessName: string) {
    await this.searchForMerchantRow(businessName);
  }

  async searchSpecificMerchant(businessName: string) {
    await this.searchForMerchantRow(businessName);
  }

  private async searchForMerchantRow(businessName: string) {
    const row = this.merchantTable.locator('tbody tr').filter({ hasText: businessName }).first();
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.searchMerchantInput.fill(businessName);
      const found = await row.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
      if (found) return;
      await this.page.waitForTimeout(3000);
    }
    await row.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async openViewModal(){
    await this.viewButton.click();
    await this.viewModal.waitFor({ state: 'visible' });
  }

  async resendActivationEmail() {
    await this.resendActivationButton.click();
    await this.page.waitForLoadState('networkidle');
  }


  // --- Merchant Actions -------------------------------------------------------


  async openEditModal() {
    await this.editButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async deactivateMerchant() {
    await this.deactivateButton.click();
    await this.confirmDeactivateButton.waitFor({ state: 'visible' });
    await this.confirmDeactivateButton.click();
    // Assert the toast before it auto-dismisses — networkidle + button wait below
    // give it enough time to disappear if we check afterwards.
    await expect(this.successMessage).toContainText('Business Category deactivated successfully.', { timeout: 8000 });
    await this.page.waitForLoadState('networkidle');
  }

  async activateMerchant() {
    await this.activateButton.click();
    await this.confirmActivateButton.waitFor({ state: 'visible' });
    await this.confirmActivateButton.click();
    // Assert the toast before it auto-dismisses — same timing issue as deactivateMerchant.
    await expect(this.successMessage).toContainText('Business Category activated successfully.', { timeout: 8000 });
    await this.page.waitForLoadState('networkidle');
  }

  async clearBusinessNameInEdit() {
    await this.businessNameEditInput.clear();
  }

  async fillMerchantEditForm(data: {
    businessName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    zipCode: string;
    state: string;
    supportEmail: string;
    businessEmail: string;
    phoneNumber: string;
  }) {
    await this.businessNameEditInput.clear();
    await this.businessNameEditInput.fill(data.businessName);
    await this.addressLine1EditInput.clear();
    await this.addressLine1EditInput.fill(data.addressLine1);
    if (data.addressLine2) {
      await this.addressLine2EditInput.clear();
      await this.addressLine2EditInput.fill(data.addressLine2);
    }
    await this.cityEditInput.clear();
    await this.cityEditInput.fill(data.city);
    await this.zipCodeEditInput.clear();
    await this.zipCodeEditInput.fill(data.zipCode);
    await this.stateEditInput.clear();
    await this.stateEditInput.fill(data.state);
    await this.supportEmailEditInput.clear();
    await this.supportEmailEditInput.fill(data.supportEmail);
    await this.businessEmailEditInput.clear();
    await this.businessEmailEditInput.fill(data.businessEmail);
    await this.phoneNumberEditInput.clear();
    await this.phoneNumberEditInput.fill(data.phoneNumber);
  }

  async clickDelete(merchantName: string) {
    await this.page.getByRole('row', { name: merchantName }).getByTitle('Delete').click();
  }

  async confirmDelete() {
    await this.confirmDeleteActionField.waitFor({ state: 'visible' });
    await this.confirmDeleteActionField.fill('DELETE');
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async cancelDelete() {
    await this.cancelDeleteButton.click();
  }

  async clickBusinessEdit() {
   await this.bussinessEditPage.click();
    await this.page.waitForLoadState('networkidle');
  }

  async saveMerchantDetails() {
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // --- EPL URL Actions --------------------------------------------------------

  async fillEplUrl(url: string) {
    await this.eplUrlInput.fill(url);
  }

  async clearEplUrl() {
    await this.eplUrlInput.clear();
  }

  async saveChanges() {
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // --- SSS Contribution -------------------------------------------------------

  async fillPrn(prn: string) {
    await this.prnInput.fill(prn);
  }

  async submitPrn() {
    await this.submitPrnButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // --- Verifications ----------------------------------------------------------

  async assertViewModalVisible() {
    await expect(this.viewModal, 'View modal should be visible').toBeVisible();
  }

  async assertMerchantStillListed(merchantName: string) {
    await expect(
      this.page.getByRole('row', { name: merchantName }),
      `Merchant "${merchantName}" should still appear in the table`
    ).toBeVisible();
  }

  async assertResendActivationButtonHidden() {
    await expect(this.resendActivationButton, '"Resend Activation" button should not be visible').toBeHidden();
  }

  async assertResendActivationButtonVisible() {
    await expect(this.resendActivationButton, '"Resend Activation" button should be visible').toBeVisible();
  }

  async assertEplUrlDisplayed(EPLUrl: string) {
    await this.editURLInput.waitFor({ state: 'visible' });
    const actualValue = await this.editURLInput.inputValue();
    expect(actualValue.trim()).toBe(decodeURIComponent(EPLUrl).trim());
  }

  async assertMerchantDeleted(merchantName: string) {
    const row = this.page.getByRole('row', { name: merchantName });

    // Deletion is processed async server-side, so the row can still show up
    // for a while after the confirm click returns. Re-search and poll.
    //
    // Deliberately NOT using searchSpecificMerchant/searchForMerchantRow here:
    // that helper retries up to 3x (~49s worst case) because it assumes the
    // row *should* exist. Here the row is expected to become absent, so every
    // poll would pay close to that full 49s failing to find it before falling
    // through — 5 polls could approach/exceed this flow's 180s test budget.
    // A plain fill + short settle is enough to let the table re-filter.
    for (let attempt = 1; attempt <= 5; attempt++) {
      await this.searchMerchantInput.fill(merchantName);
      await this.page.waitForTimeout(2000);
      const stillVisible = await row.isVisible().catch(() => false);
      if (!stillVisible) return;
      await this.page.waitForTimeout(3000);
    }

    await expect(
      row,
      `Merchant "${merchantName}" should no longer appear in the table`
    ).toBeHidden();
  }

  async assertMerchantNotDeleted(expectedMessage: string) {
    await expect(
      this.unsuccessfulDeletionMessagePrompt,
      `Expected deletion error: ${expectedMessage}`
    ).toContainText(expectedMessage, { timeout: 10000 });
  }

  async assertDeleteValidationMessage(expectedMessage: string) {
    await expect(this.deleteValidationMessage, `Expected validation: ${expectedMessage}`).toContainText(expectedMessage);
  }

  async assertLinkedAgentsListVisible() {
    await expect(this.linkedAgentsList, 'Linked agents list should be visible').toBeVisible();
  }

  async assertSuccessMessage(expectedMessage: string) {
    await expect(this.successMessage, `Expected success: ${expectedMessage}`).toContainText(expectedMessage);
  }

  async assertErrorMessage(expectedMessage: string) {
    const errorEl = this.page
      .locator('[id$="-error"], .toast-body, [role="alert"]')
      .filter({ hasText: expectedMessage })
      .first();
    await expect(errorEl, `Expected error: ${expectedMessage}`).toBeVisible();
  }

  async assertNoErrorMessage() {
    await expect(this.errorMessage, 'Invalid Format').toBeHidden();
  }

  async assertSssPaymentSuccess() {
    await expect(this.successMessage, 'SSS payment should succeed').toBeVisible();
  }

  // ===========================================================================
  // AGENT — Navigation, CRUD, Assertions
  // ===========================================================================

  async closeOpenDeleteModal() {
    const modal = this.page.locator('.modal.show');
    if (await modal.isVisible().catch(() => false)) {
      await modal.getByRole('button', { name: 'Close' }).click().catch(() => {});
      await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  }

  async goToAgentModule() {
    await this.agentNavLink.click();
    await this.page.waitForURL('**/agent', { timeout: 15000 });
    await this.searchMerchantInput.waitFor({ state: 'visible', timeout: 30000 });
  }

  async getFirstAgentInfo(): Promise<{ name: string; merchant: string }> {
    const headers = await this.page.locator('table thead th').allTextContents();
    const nameIdx     = headers.findIndex(h => /name/i.test(h.trim()));
    const merchantIdx = headers.findIndex(h => /business/i.test(h.trim()));
    const firstRow    = this.page.locator('table tbody tr').first();
    const cells       = await firstRow.locator('td').allTextContents();
    return {
      name:     cells[nameIdx]?.trim()     ?? '',
      merchant: cells[merchantIdx]?.trim() ?? '',
    };
  }

  async searchAgent(name: string) {
    await this.searchMerchantInput.clear();
    await this.searchMerchantInput.pressSequentially(name, { delay: 100 });
    await this.page.waitForLoadState('networkidle');
  }

  async openAddAgentModal() {
    await this.addAgentButton.click();
    await this.agentModal.waitFor({ state: 'visible' });
  }

  async selectAgentMerchant(merchantName: string) {
    const option = this.page.locator('.select2-results__option', { hasText: merchantName });

    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.agentMerchantSelect.click();
      const searchField = this.page.locator('.select2-container--open .select2-search__field');
      await searchField.waitFor({ state: 'visible', timeout: 5000 });
      await searchField.fill('');
      await searchField.pressSequentially(merchantName, { delay: 100 });
      await this.page.waitForLoadState('networkidle');

      const found = await option.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (found) {
        await option.click();
        return;
      }

      // Results not yet ready — close dropdown and wait before retrying
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(2000);
    }

    throw new Error(`[OnboardingPage] Could not find merchant option: ${merchantName}`);
  }

  async selectAgentCredential(credentialName: string) {
    const option = this.page.locator('.select2-results__option', { hasText: credentialName });

    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.agentCredentialSelect.click();
      const searchField = this.page.locator('.select2-container--open .select2-search__field');
      await searchField.waitFor({ state: 'visible', timeout: 5000 });
      await searchField.fill('');
      await searchField.pressSequentially(credentialName, { delay: 50 });
      await this.page.waitForLoadState('networkidle');

      const found = await option.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (found) {
        await option.click();
        return;
      }

      // Credential not indexed yet — close dropdown and wait before retrying
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(2000);
    }

    throw new Error(`[OnboardingPage] Could not find credential option: ${credentialName}`);
  }

  async selectFirstAvailableAgentCredential() {
    await this.agentCredentialSelect.click();
    const firstOption = this.page.locator('.select2-results__option').first();
    await firstOption.waitFor({ state: 'visible', timeout: 5000 });
    await firstOption.click();
  }

  async selectAgentType(type: string) {
    await this.agentTypeSelect.click();
    await this.page.getByRole('option', { name: type }).click();
  }

  async selectAgentHierarchy(hierarchy: string) {
    await this.agentHierarchySelect.click();
    await this.page.getByRole('option', { name: hierarchy }).click();
  }

  async selectAgentCountry(searchTerm: string, option: string) {
    await this.agentCountryInput.click();
    const searchField = this.page.locator('.select2-container--open .select2-search__field');
    await searchField.waitFor({ state: 'visible', timeout: 5000 });
    await searchField.pressSequentially(searchTerm, { delay: 50 });
    await this.page.waitForLoadState('networkidle');
    const countryOption = this.page.locator('.select2-results__option', { hasText: option });
    await countryOption.waitFor({ state: 'visible', timeout: 10000 });
    await countryOption.click();
  }

  async fillAddAgentForm(data: AgentData) {
    if (data.merchant)   await this.selectAgentMerchant(data.merchant);
    if (data.credential) {
      await this.selectAgentCredential(data.credential);
    } else {
      await this.selectFirstAvailableAgentCredential();
    }
    await this.selectAgentType(data.type);
    await this.selectAgentHierarchy(data.hierarchy);
    await this.agentNameInput.fill(data.name);
    await this.agentAddressLine1Input.fill(data.addressLine1);
    if (data.addressLine2) await this.agentAddressLine2Input.fill(data.addressLine2);
    await this.agentCityInput.fill(data.city);
    await this.agentZipCodeInput.fill(data.zipCode);
    await this.agentStateInput.fill(data.state);
    await this.selectAgentCountry(data.countrySearch, data.country);
    await this.agentEmailInput.fill(data.email);
    if (data.phone)   await this.agentPhoneInput.fill(data.phone);
    if (data.mobile)  await this.agentMobileInput.fill(data.mobile);
    if (data.website) await this.agentWebsiteInput.fill(data.website);
  }

  async submitAddAgent() {
    await this.agentAddButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async addAgent(data: AgentData) {
    await this.openAddAgentModal();
    await this.fillAddAgentForm(data);
    await this.submitAddAgent();
    return data;
  }

  async clickAgentEdit() {
    await this.bussinessEditPage.click();
    await this.page.waitForLoadState('networkidle');
  }

  async fillAgentNameInEdit(name: string) {
    await this.agentNameEditInput.fill(name);
  }

  async fillAgentName(name: string) {
    await this.agentNameInput.fill(name);
  }

  async clearAgentNameInEdit() {
    await this.agentNameInput.clear();
  }

  async fillAgentAddressLine1InEdit(value: string) {
    await this.agentAddressLine1EditInput.fill(value);
  }

  async fillAgentStateInEdit(value: string) {
    await this.agentStateEditInput.fill(value);
  }

  async assertAgentBusinessAndCredentialNotEditable() {
    await expect(this.agentBusinessEditField, 'Business field should not be editable').not.toBeEditable();
    await expect(this.agentCredentialEditField, 'Account Credential field should not be editable').not.toBeEditable();
  }

  async assertAgentEditableFieldsAreEditable() {
    const fields = [
      this.agentAddressLine1EditInput,
      this.agentAddressLine2EditInput,
      this.agentCityEditInput,
      this.agentZipCodeEditInput,
      this.agentStateEditInput,
      this.agentEmailEditInput,
      this.agentPhoneEditInput,
      this.agentMobileEditInput,
      this.agentWebsiteEditInput,
    ];
    for (const field of fields) await expect(field).toBeEditable();
  }

  async saveAgent() {
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async deactivateAgent(name: string) {
    const rows = this.page.locator('table tbody tr').filter({ hasText: name });
    await expect(rows, `Expected exactly one row matching agent "${name}" before deactivating`).toHaveCount(1);
    await rows.getByTitle('Deactivate').click();
    await this.page.getByRole('button', { name: 'Deactivate Agent' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickAgentDelete(name: string) {
    const rows = this.page.locator('table tbody tr').filter({ hasText: name });
    await expect(rows, `Expected exactly one row matching agent "${name}" before deleting`).toHaveCount(1);
    await rows.getByTitle('Delete').click();
  }

  async confirmAgentDelete() {
    await this.confirmDeleteActionField.waitFor({ state: 'visible' });
    await this.confirmDeleteActionField.fill('DELETE');
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async assertAgentVisible(name: string) {
    await expect(
      this.page.locator('table tbody tr').filter({ hasText: name }),
      `Agent "${name}" should appear in the table`
    ).toBeVisible();
  }

  async assertAgentDeleted(name: string) {
    await expect(
      this.page.locator('table tbody tr').filter({ hasText: name }),
      `Agent "${name}" should no longer appear in the table`
    ).toBeHidden();
  }

  async assertAgentNotDeleted(expectedMessage: string) {
    await expect(
      this.unsuccessfulDeletionMessagePrompt,
      `Expected deletion error: ${expectedMessage}`
    ).toContainText(expectedMessage, { timeout: 10000 });
  }
}

export default OnboardingPage;
