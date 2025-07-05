/** @type {import('ts-jest').JestConfigWithTsJest} **/
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(got|cheerio|normalize-url)/)'
  ],
  testMatch: [
    '<rootDir>/tests/**/*.(test|spec).[jt]s?(x)',
    '<rootDir>/lib/database/supabase/__mocks__/**/*.(test|spec).[jt]s?(x)'
  ],
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
};

module.exports = createJestConfig(customJestConfig);
