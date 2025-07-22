const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: '../../',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/**/*.test.ts',
    '<rootDir>/**/*.test.js'
  ],
  testTimeout: 30000, // 30 second timeout for integration tests
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)