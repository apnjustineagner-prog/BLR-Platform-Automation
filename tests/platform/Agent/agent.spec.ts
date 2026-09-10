// tests/platform/Agent/agent.spec.ts
//
// ==============================================================================
// AGENT TEST SUITE
// ==============================================================================
//
// Agent is its own top-level module (Management -> Agent in the sidebar),
// separate from Onboarding. Shared per-test setup lives in ./agentHelpers.ts;
// cross-module helpers (activateAgent, cleanupAgent) in utils/onboardingCommon.ts.
//
// TEST CASES COVERED:
//   BLR-2726  Agent creation is successful with valid data
//   BLR-2727  Agent update is successful with valid data
//   BLR-2728  Agent deletion is successful
//   BLR-2729  Agent creation fails when name is empty
//   BLR-2730  Agent creation fails when name exceeds maximum length
//   BLR-2731  Agent creation prevents duplicate names (commented out — needs
//             merchant+credential setup helper wired up)
//
// Run: npx playwright test "tests/platform/Agent/agent.spec.ts"
//
// ==============================================================================

import { test } from '@playwright/test';
import { qase } from 'playwright-qase-reporter';
import { faker } from '@faker-js/faker';
import { createDefaultAgentData } from '../../../utils/businessData';
import { errorMessages, agentTestMerchant } from '../../../utils/testData';
import { activateAgent, cleanupAgent } from '../../../utils/onboardingCommon';
import { registerAgentHooks, setQaseId, agentState } from './agentHelpers';

registerAgentHooks();

test.describe.serial('Agent', () => {

  test(
    qase(2726, 'Agent creation is successful with valid data'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      setQaseId(2726);

      const merchantName = agentTestMerchant.name;
      let agentName = '';
      let agentEmail = '';
      let agentCreatedAt = new Date();

      agentState.cleanupTasks.push(async () => {
        if (agentName) await cleanupAgent(agentState.currentPage, agentName, agentEmail, agentCreatedAt);
      });

      const agentData2726 = createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`);

      await test.step('Navigate to the Agent module', async () => {
        await agentState.onboarding.goToAgentModule();
      });

      await test.step('Open Add Agent modal and fill form with valid data', async () => {
        await agentState.onboarding.openAddAgentModal();
        await agentState.onboarding.fillAddAgentForm({ ...agentData2726, merchant: merchantName, credential: agentTestMerchant.credential });
      });

      await test.step('Submit the Add Agent form', async () => {
        agentCreatedAt = new Date();
        await agentState.onboarding.submitAddAgent();
      });

      await test.step('Verify agent was created successfully', async () => {
        await agentState.onboarding.assertSuccessMessage('Agent added successfully');
        agentName = agentData2726.name;
        agentEmail = agentData2726.email;
      });
    }
  );

  test(
    qase(2727, 'Agent update is successful with valid data'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      setQaseId(2727);

      const merchantName = agentTestMerchant.name;
      let originalAgentName = '';
      let agentCurrentName  = '';
      let agentEmail = '';
      let agentCreatedAt = new Date();
      const updatedName = `Test Agent ${faker.string.alpha(6).toUpperCase()} UPDATED`;
      const updatedAddressLine1 = `${faker.location.streetAddress()} UPDATED`;
      const updatedState = `${faker.location.state()} UPDATED`;

      agentState.cleanupTasks.push(async () => {
        if (agentCurrentName) await cleanupAgent(agentState.currentPage, agentCurrentName, agentEmail, agentCreatedAt);
      });

      await test.step('Navigate to Agent module and create agent via UI', async () => {
        const agentData = createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`);
        originalAgentName = agentData.name;
        agentEmail = agentData.email;
        agentCreatedAt = new Date();
        await agentState.onboarding.goToAgentModule();
        await agentState.onboarding.addAgent({ ...agentData, merchant: merchantName, credential: agentTestMerchant.credential });
        await agentState.onboarding.assertSuccessMessage('Agent added successfully');
        agentCurrentName = agentData.name;
      });

      await test.step('Search for the agent', async () => {
        await agentState.onboarding.searchAgent(originalAgentName);
      });

      await test.step('Open edit form', async () => {
        await agentState.onboarding.clickAgentEdit();
      });

      await test.step('Verify Business and Account Credential are not editable', async () => {
        await agentState.onboarding.assertAgentBusinessAndCredentialNotEditable();
      });

      await test.step('Verify Address/Contact/Network Information fields are editable', async () => {
        await agentState.onboarding.assertAgentEditableFieldsAreEditable();
      });

      await test.step('Update agent name, address line 1, and state', async () => {
        await agentState.onboarding.fillAgentNameInEdit(updatedName);
        await agentState.onboarding.fillAgentAddressLine1InEdit(updatedAddressLine1);
        await agentState.onboarding.fillAgentStateInEdit(updatedState);
      });

      await test.step('Save the updated agent', async () => {
        await agentState.onboarding.saveAgent();
        agentCurrentName = updatedName;
      });

      await test.step('Verify agent name was updated successfully', async () => {
        await agentState.onboarding.searchAgent(updatedName);
        await agentState.onboarding.assertAgentVisible(updatedName);
      });
    }
  );

  test(
    qase(2728, 'Agent deletion is successful'),
    { tag: ['@smoke', '@regression'] },
    async () => {
      setQaseId(2728);

      const merchantName = agentTestMerchant.name;
      let agentName = '';
      let agentEmail = '';
      let agentCreatedAt = new Date();

      agentState.cleanupTasks.push(async () => {
        if (agentName) await cleanupAgent(agentState.currentPage, agentName, agentEmail, agentCreatedAt);
      });

      await test.step('Navigate to Agent module and create agent via UI', async () => {
        const agentData = createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`);
        agentCreatedAt = new Date();
        await agentState.onboarding.goToAgentModule();
        await agentState.onboarding.addAgent({ ...agentData, merchant: merchantName, credential: agentTestMerchant.credential });
        await agentState.onboarding.assertSuccessMessage('Agent added successfully');
        agentName = agentData.name;
        agentEmail = agentData.email;
      });

      await test.step('Activate the agent account', async () => {
        await activateAgent(agentState.currentPage, agentEmail, agentCreatedAt);
      });

      await test.step('Search for the agent', async () => {
        await agentState.onboarding.goToAgentModule();
        await agentState.onboarding.searchAgent(agentName);
      });

      await test.step('Deactivate the agent', async () => {
        await agentState.onboarding.deactivateAgent(agentName);
      });

      const deletedAgentName = agentName;

      await test.step('Delete the agent', async () => {
        await agentState.onboarding.clickAgentDelete(agentName);
        await agentState.onboarding.confirmAgentDelete();
        agentName = ''; // already deleted — skip redundant cleanup
      });

      await test.step('Verify agent is deleted', async () => {
        await agentState.onboarding.assertAgentDeleted(deletedAgentName);
      });
    }
  );

  test(
    qase(2729, 'Agent creation fails when name is empty'),
    { tag: ['@regression'] },
    async () => {
      setQaseId(2729);

      const merchantName = agentTestMerchant.name;

      await test.step('Navigate to the Agent module', async () => {
        await agentState.onboarding.goToAgentModule();
      });

      await test.step('Open Add Agent modal, fill all fields, then clear the name', async () => {
        const agentData = createDefaultAgentData(`apn.justineagner+${Date.now()}@gmail.com`);
        await agentState.onboarding.openAddAgentModal();
        await agentState.onboarding.fillAddAgentForm({ ...agentData, merchant: merchantName, credential: agentTestMerchant.credential });
        await agentState.onboarding.clearAgentNameInEdit();
      });

      await test.step('Submit the form', async () => {
        await agentState.onboarding.submitAddAgent();
      });

      await test.step('Verify required field error is shown for name', async () => {
        await agentState.onboarding.assertErrorMessage(errorMessages.REQUIRED_FIELD_MSG);
      });
    }
  );

  test(
    qase(2730, 'Agent creation fails when name exceeds maximum length'),
    { tag: ['@regression'] },
    async () => {
      setQaseId(2730);

      await test.step('Navigate to the Agent module', async () => {
        await agentState.onboarding.goToAgentModule();
      });

      await test.step('Open Add Agent modal and fill name with 101 characters', async () => {
        await agentState.onboarding.openAddAgentModal();
        await agentState.onboarding.fillAgentName(faker.string.alpha(101));
      });

      await test.step('Submit the form', async () => {
        await agentState.onboarding.submitAddAgent();
      });

      await test.step('Verify maximum length error is shown for name', async () => {
        await agentState.onboarding.assertErrorMessage(errorMessages.EXCEEDEDCHAR_100_MSG);
      });
    }
  );

  // BLR-2731 Agent creation prevents duplicate names — commented out in the
  // original suite: it needs a merchant + active account credential set up
  // first (the old setupMerchantAndCredential helper). Rewire it against
  // onboardingHelpers.setupMerchantWithAccountCredential when reinstating.
  // test(
  //   qase(2731, 'Agent creation prevents duplicate names'),
  //   { tag: ['@regression'] },
  //   async ({ page }) => {
  //     setQaseId(2731);
  //     // ... see git history for the original body ...
  //   }
  // );

});
