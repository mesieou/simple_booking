/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
};
