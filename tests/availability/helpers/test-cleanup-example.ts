/**
 * Example of improved test cleanup patterns
 * 
 * This file shows how to update your test files to use the improved cleanup functions
 * and avoid accumulating test data.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { 
  createTestBusiness, 
  cleanupTestData,
  cleanupAllTestData,
  quickCleanupTestData,
  TestBusiness
} from './availability-test-factory';

// ✅ IMPROVED PATTERN - More robust cleanup
describe('Example Test with Improved Cleanup', () => {
  let testBusiness: TestBusiness;

  beforeAll(async () => {
    jest.setTimeout(30000);
    
    // Clean up any existing test data before starting
    // This handles cases where previous test runs failed to clean up
    await quickCleanupTestData();
  });

  afterAll(async () => {
    // Comprehensive cleanup at the end
    // This catches any test data that might have been missed
    await cleanupAllTestData();
  });

  beforeEach(async () => {
    // Create fresh test data for each test
    testBusiness = await createTestBusiness('ImprovedTest', 1);
  });

  afterEach(async () => {
    // Clean up after each test - but wrap in try-catch so tests don't fail due to cleanup issues
    try {
      if (testBusiness) {
        await cleanupTestData([testBusiness]);
      }
    } catch (error) {
      console.warn('Cleanup warning (not a test failure):', error);
      // The afterAll cleanup will catch anything missed here
    }
  });

  it('should work correctly', async () => {
    expect(testBusiness).toBeDefined();
    expect(testBusiness.business.id).toBeDefined();
  });
});

// ✅ ALTERNATIVE PATTERN - For test suites that create many businesses
describe('Example Test Suite with Multiple Businesses', () => {
  beforeAll(async () => {
    jest.setTimeout(45000);
    await quickCleanupTestData(); // Clean slate
  });

  afterAll(async () => {
    // Clean up everything at the end - this is more reliable than tracking individual businesses
    await cleanupAllTestData();
  });

  beforeEach(async () => {
    // No individual tracking needed - rely on comprehensive cleanup
  });

  afterEach(async () => {
    // Optional: Clean up just current test data for faster test runs
    // But don't worry if it fails - afterAll will catch everything
    try {
      await quickCleanupTestData();
    } catch (error) {
      console.warn('Quick cleanup warning:', error);
    }
  });

  it('should handle multiple businesses', async () => {
    const businessA = await createTestBusiness('TestA', 1);
    const businessB = await createTestBusiness('TestB', 2);
    const businessC = await createTestBusiness('TestC', 3);

    // Do your tests...
    expect(businessA.business.id).toBeDefined();
    expect(businessB.business.id).toBeDefined();
    expect(businessC.business.id).toBeDefined();

    // No need to track these - afterAll cleanup will handle them
  });
});

// ❌ OLD PROBLEMATIC PATTERN - Don't use this
describe('Example of Problematic Pattern (DO NOT USE)', () => {
  let createdBusinesses: TestBusiness[] = [];

  afterAll(async () => {
    // Problem: If a test fails before adding business to array, it won't be cleaned up
    if (createdBusinesses.length > 0) {
      await cleanupTestData(createdBusinesses);
    }
  });

  beforeEach(async () => {
    const testBusiness = await createTestBusiness('ProblematicTest', 1);
    // Problem: If this line fails, business is created but not tracked
    createdBusinesses.push(testBusiness);
  });

  afterEach(async () => {
    // Problem: Complex array manipulation that can go wrong
    if (createdBusinesses.length > 0) {
      const business = createdBusinesses.pop();
      if (business) {
        await cleanupTestData([business]);
      }
    }
  });
});

/**
 * Manual cleanup commands you can run:
 * 
 * # RECOMMENDED: Full cleanup (database + auth users)
 * npm run cleanup:test-data:full
 * 
 * # Clean up ONLY auth users (for the screenshot issue)
 * npm run cleanup:test-data:auth-only
 * 
 * # Clean up all test data (database only, detailed logging)
 * npm run cleanup:test-data
 * 
 * # Quick cleanup (database only, faster, less detailed)
 * npm run cleanup:test-data:quick
 * 
 * # Direct script usage
 * npx tsx scripts/cleanup-test-data.ts --with-auth     # Full cleanup
 * npx tsx scripts/cleanup-test-data.ts --auth-only     # Auth users only
 * npx tsx scripts/cleanup-test-data.ts --quick         # Quick database cleanup
 * npx tsx scripts/cleanup-test-data.ts --help          # Show all options
 */ 