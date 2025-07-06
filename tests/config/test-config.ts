/**
 * Test Configuration
 * 
 * This file contains centralized configuration for integration tests.
 * 
 * ⚠️  IMPORTANT: Change TEST_PHONE_NUMBER to YOUR phone number to receive 
 *    real WhatsApp messages during testing and verify the system works correctly.
 * 
 * 📱 Format: Use your 10-digit phone number without country code
 */

export const TEST_CONFIG = {
  // 📱 CHANGE THIS TO YOUR PHONE NUMBER TO RECEIVE TEST MESSAGES
  TEST_PHONE_NUMBER: '61450549485',
  
  // 🏢 Test business ID (DO NOT CHANGE - this is the real business in the database)
  BUSINESS_ID: '7c98818f-2b01-4fa4-bbca-0d59922a50f7', // Beauty Asiul
  
  // 🤖 Test user name for name collection tests
  TEST_USER_NAME: 'LukitasTestName',
  
  // ⏱️ Timeout settings for LLM-dependent tests
  TIMEOUT_SECONDS: 30,
} as const;

/**
 * Helper function to get normalized phone number (without + prefix)
 */
export function getNormalizedTestPhone(): string {
  return TEST_CONFIG.TEST_PHONE_NUMBER.replace(/[^\d]/g, '');
}
