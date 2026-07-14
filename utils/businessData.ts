// utils/businessData.ts
//
// ==============================================================================
// BUSINESS ONBOARDING MODULE — TEST DATA
// ==============================================================================
//
// PURPOSE:
//   All test data specific to the Add New Business / Onboarding module.
//   Imports shared types and factory from testData.ts.
//
// USAGE:
//   import { getBusinessTestData, existingBusiness, businessUi } from '../../utils/businessData';
//   import { ScenarioSet, errorMessages } from '../../utils/testData';
//
//   const { scenarios } = getBusinessTestData();        // frozen
//   const { scenarios } = getBusinessTestData(true);    // fresh
//
// ==============================================================================

import { faker } from '@faker-js/faker';
import { FieldVariants, FormData, ScenarioSet, createTestDataFactory } from './testData';

// ==============================================================================
// FIELD DEFINITIONS
// ==============================================================================

export type BusinessFields = {
  businessName: FieldVariants;
  adminEmail: FieldVariants;
  supportEmail: FieldVariants;
  businessEmail: FieldVariants;
  addressLine1: FieldVariants;
  addressLine2: FieldVariants;
  city: FieldVariants;
  zipCode: FieldVariants;
  state: FieldVariants;
  phoneNumber: FieldVariants;
};

export type BusinessFormData = FormData<BusinessFields>;
export type BusinessScenarioSet = ScenarioSet<BusinessFields>;

// ==============================================================================
// DATA GENERATOR
// ==============================================================================

export const getBusinessTestData = createTestDataFactory<BusinessFields>(() => ({
  businessName: {
    valid: faker.company.name().replace(/[^a-zA-Z0-9 .-]/g, ''),
    long: faker.string.alpha({ length: 200, casing: 'upper' }),
    invalid: '12345!@#$%^,',
    missing: '',
  },

  adminEmail: {
    valid: faker.internet.email(),
    long: faker.internet.email().repeat(3),
    invalid: 'invalid-email',
    missing: '',
  },

  supportEmail: {
    valid: faker.internet.email(),
    long: faker.internet.email().repeat(3),
    invalid: 'invalid-email',
    missing: '',
  },

  businessEmail: {
    valid: faker.internet.email(),
    long: faker.internet.email().repeat(3),
    invalid: 'invalid-email',
    missing: '',
  },

  addressLine1: {
    valid: faker.location.streetAddress(),
    long: faker.location.streetAddress().repeat(20),
    invalid: '12345!@#$%^',
    missing: '',
  },

  addressLine2: {
    valid: faker.location.streetAddress(),
    long: faker.location.streetAddress().repeat(20),
    invalid: '12345!@#$%^',
    missing: '',
  },

  city: {
    valid: faker.location.city(),
    long: faker.location.city().repeat(20),
    invalid: '12345!@#$%^',
    missing: '',
  },

  zipCode: {
    valid: faker.location.zipCode(),
    long: faker.location.zipCode().repeat(10),
    invalid: '12345!@#$%^',
    missing: '',
  },

  state: {
    valid: faker.location.state(),
    long: faker.location.state().repeat(50),
    invalid: '12345!@#$%^',
    missing: '',
  },

  phoneNumber: {
    valid: faker.phone.number().replace(/\D/g, ''),
    long: faker.string.numeric(20),
    invalid: '!@#$%^&*()',
    missing: '',
  },
}));

// ==============================================================================
// EXISTING RECORDS — Pre-existing data for duplicate/conflict testing
// ==============================================================================

export const existingBusiness = {
  BUSINESS_NAME: '',
  ADMIN_EMAIL: '',
};

// ==============================================================================
// UI CONSTANTS — Expected UI text for assertions
// ==============================================================================

export const businessUi = {
  ONBOARDING_HEADING: 'Onboarding',
  ADD_NEW_BUSINESS_BTN: '+ Add New Business',
};

// ==============================================================================
// AGENT DATA — Types and factory for agent onboarding tests
// ==============================================================================

export type AgentData = {
  merchant?:     string;
  credential?:   string;
  type:          string;
  hierarchy:     string;
  name:          string;
  addressLine1:  string;
  addressLine2?: string;
  city:          string;
  zipCode:       string;
  state:         string;
  country:       string;
  countrySearch: string;
  email:         string;
  phone?:        string;
  mobile?:       string;
  website?:      string;
};

export function createDefaultAgentData(emailOverride?: string): AgentData {
  return {
    type:          'Individual',
    hierarchy:     'Main Agent',
    name:          `Test Agent ${faker.string.alpha(6).toUpperCase()}`,
    addressLine1:  faker.location.streetAddress(),
    city:          faker.location.city(),
    zipCode:       faker.location.zipCode('#####'),
    state:         faker.location.state(),
    country:       'Philippines',
    countrySearch: 'Philippines',
    email:         emailOverride ?? faker.internet.email(),
    website:       'https://' + faker.internet.domainName(),
  };
}
