// Jest setup for onboarding tests
require('dotenv').config({ path: '../../.env.local' })

// Increase timeout for integration tests
jest.setTimeout(30000)

// Mock console methods to reduce noise during tests
const originalError = console.error
const originalWarn = console.warn
const originalLog = console.log

beforeAll(() => {
  // Only show critical errors during tests
  console.error = (...args) => {
    const message = args[0]
    if (typeof message === 'string' && (
      message.includes('Error') ||
      message.includes('Failed') ||
      message.includes('duplicate')
    )) {
      originalError(...args)
    }
  }
  
  console.warn = () => {} // Suppress warnings
  console.log = () => {} // Suppress regular logs
})

afterAll(() => {
  // Restore original console methods
  console.error = originalError
  console.warn = originalWarn
  console.log = originalLog
})