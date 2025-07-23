const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: '../../',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  testMatch: [
    '**/*.test.ts',
    '**/*.test.tsx'
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../$1',
  },
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  testTimeout: 30000, // 30 second timeout for availability tests
  collectCoverageFrom: [
    '../../lib/general-helpers/availability.ts',
    '../../lib/database/models/availability-slots.ts',
    '../../lib/database/models/calendar-settings.ts'
  ],
  coverageReporters: ['text', 'lcov'],
  verbose: true
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig) 