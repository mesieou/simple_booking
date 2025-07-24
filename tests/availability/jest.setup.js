// Setup file for availability tests
import { jest } from '@jest/globals';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Suppress console output during tests unless there's an error
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  // Only show logs that contain [Test] or errors
  const message = args.join(' ');
  if (message.includes('[Test]') || message.includes('Error') || message.includes('✅') || message.includes('❌')) {
    originalLog(...args);
  }
};

console.error = (...args) => {
  // Always show errors
  originalError(...args);
};

// Set longer timeout for all tests
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  console.log('🚀 Starting Availability Tests');
});

afterAll(async () => {
  console.log('✅ Availability Tests Complete');
}); 