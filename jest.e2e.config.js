module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // Use node environment for Puppeteer
  roots: ['<rootDir>/tests/e2e'],
  testMatch: [
    '**/e2e/**/*.(test|spec).+(ts|tsx|js)'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/helpers/'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tests/tsconfig.json'
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testTimeout: 30000, // 30 seconds for E2E tests
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.ts']
}; 