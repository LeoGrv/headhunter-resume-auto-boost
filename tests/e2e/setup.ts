// E2E Test Setup
// This file runs before each E2E test

// Increase timeout for E2E tests
jest.setTimeout(30000);

// Global test configuration
beforeAll(() => {
  // Any global setup for E2E tests
  console.log('Starting E2E test suite...');
});

afterAll(() => {
  // Any global cleanup for E2E tests
  console.log('E2E test suite completed.');
});
