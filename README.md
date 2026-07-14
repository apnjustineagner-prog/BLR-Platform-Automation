# QA Automation Framework - Quick Reference

Modern Playwright test automation framework with TypeScript, encrypted credentials, Faker.js data generation, and Qase integration.

---

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npx playwright test

# Run with retries
npx playwright test --retries=3

# Run specific file
npx playwright test tests/franchisee/franchisee.spec.ts

# View report
npx playwright show-report
```
---

## Running Tagged Tests
```bash
# Run smoke tests
npx playwright test --grep @smoke

# Run regression tests
npx playwright test --grep @regression

# Run multiple tags (OR)
npx playwright test --grep "@smoke|@critical"

# Exclude tags
npx playwright test --grep-invert @slow
```

---

## Common Commands
```bash
# Run all tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run in headed mode
npx playwright test --headed

# Debug mode
npx playwright test --debug

# Run specific test
npx playwright test -g "Add franchisee"

# Run with retries
npx playwright test --retries=3

# List all tests
npx playwright test --list

# View configuration
npx playwright show-config
```
---

## Resources

- **Playwright Docs:** https://playwright.dev
- **Faker.js Docs:** https://fakerjs.dev
- **Qase Docs:** https://help.qase.io
- **TypeScript Docs:** https://www.typescriptlang.org/docs

---


**Happy Testing! 🎭**
*(from Playwright reference, iykyk)*

    