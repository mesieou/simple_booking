#!/usr/bin/env tsx

/**
 * Manual cleanup script for test data
 * Run this to clean up accumulated test data from your database
 * 
 * Usage:
 * npx tsx scripts/cleanup-test-data.ts
 * or
 * npm run cleanup:test-data
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { cleanupAllTestData, quickCleanupTestData } from '../tests/availability/helpers/availability-test-factory';

const main = async () => {
  console.log('🧹 Starting manual test data cleanup...');
  console.log('This will remove all businesses with "Test Business" in the name or @test.com emails');
  
  const args = process.argv.slice(2);
  const useQuickCleanup = args.includes('--quick') || args.includes('-q');
  
  try {
    if (useQuickCleanup) {
      console.log('Using quick cleanup mode (faster but less detailed logging)');
      await quickCleanupTestData();
    } else {
      console.log('Using comprehensive cleanup mode (detailed logging)');
      await cleanupAllTestData();
    }
    
    console.log('✅ Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
};

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Test Data Cleanup Script

Usage:
  npx tsx scripts/cleanup-test-data.ts [options]

Options:
  --quick, -q    Use quick cleanup mode (bulk deletions)
  --help, -h     Show this help message

Description:
  This script removes all test data from the database, including:
  - Businesses with "Test Business" in the name
  - Businesses with @test.com email addresses
  - All related data (users, bookings, quotes, availability, etc.)
  - Auth users with @test.com email addresses

Examples:
  npx tsx scripts/cleanup-test-data.ts          # Comprehensive cleanup
  npx tsx scripts/cleanup-test-data.ts --quick  # Quick cleanup
`);
  process.exit(0);
}

main(); 