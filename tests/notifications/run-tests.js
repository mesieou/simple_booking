#!/usr/bin/env node

/**
 * Notification Test Runner
 * 
 * This script runs all notification tests and provides detailed output
 * Usage: node tests/notifications/run-tests.js [test-type]
 * 
 * Examples:
 * - node tests/notifications/run-tests.js          (run all tests)
 * - node tests/notifications/run-tests.js booking  (run only booking tests)
 * - node tests/notifications/run-tests.js escalation
 * - node tests/notifications/run-tests.js feedback
 */

const { execSync } = require('child_process');
const path = require('path');

const testTypes = {
  booking: 'booking-notification.test.ts',
  escalation: 'escalation-notification.test.ts', 
  feedback: 'feedback-notification.test.ts'
};

function runTests(testType = 'all') {
  console.log('🧪 Starting Notification Test Suite...\n');
  
  const projectRoot = path.resolve(__dirname, '../..');
  process.chdir(projectRoot);
  
  try {
    if (testType === 'all') {
      console.log('🔄 Running all notification tests...\n');
      
      // Run each test type
      Object.entries(testTypes).forEach(([type, file]) => {
        console.log(`\n📋 Running ${type} tests...`);
        console.log('='.repeat(50));
        
        try {
          const testFile = `tests/notifications/${file}`;
          const command = `npm test ${testFile} -- --verbose`;
          
          console.log(`Command: ${command}\n`);
          const result = execSync(command, { 
            stdio: 'inherit',
            encoding: 'utf8'
          });
          
          console.log(`\n✅ ${type} tests completed successfully!`);
        } catch (error) {
          console.error(`\n❌ ${type} tests failed:`, error.message);
        }
      });
      
    } else if (testTypes[testType]) {
      console.log(`🔄 Running ${testType} notification tests...\n`);
      
      const testFile = `tests/notifications/${testTypes[testType]}`;
      const command = `npm test ${testFile} -- --verbose`;
      
      console.log(`Command: ${command}\n`);
      execSync(command, { 
        stdio: 'inherit',
        encoding: 'utf8'
      });
      
      console.log(`\n✅ ${testType} tests completed successfully!`);
      
    } else {
      console.error(`❌ Unknown test type: ${testType}`);
      console.log(`Available types: ${Object.keys(testTypes).join(', ')}, all`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
  
  console.log('\n🎉 All notification tests completed!');
}

// Parse command line arguments
const testType = process.argv[2] || 'all';

// Show usage info
console.log(`
🧪 Notification Test Suite Runner
==================================

Running: ${testType === 'all' ? 'All notification tests' : `${testType} tests only`}

Available test types:
- booking:    Booking notification tests (UUID handling, recipient finding, etc.)
- escalation: Escalation notification tests (admin/super admin, proxy mode, etc.)
- feedback:   Feedback notification tests (system type, super admin only, etc.)
- all:        Run all notification tests

`);

// Run the tests
runTests(testType); 