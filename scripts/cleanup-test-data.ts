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

import { 
  cleanupAllTestData, 
  quickCleanupTestData, 
  cleanupAllTestAuthUsers,
  cleanupAllTestDataWithAuthUsers 
} from '../tests/availability/helpers/availability-test-factory';

const main = async () => {
  console.log('🧹 Starting manual test data cleanup...');
  
  const args = process.argv.slice(2);
  const useQuickCleanup = args.includes('--quick') || args.includes('-q');
  const authUsersOnly = args.includes('--auth-only') || args.includes('-a');
  const includeAuthUsers = args.includes('--with-auth') || args.includes('-w');
  
  try {
    if (authUsersOnly) {
      console.log('🔐 Auth users only mode - cleaning up test auth users');
      await cleanupAllTestAuthUsers();
    } else if (includeAuthUsers) {
      console.log('🔄 Comprehensive mode with auth users - cleaning up database + auth users');
      await cleanupAllTestDataWithAuthUsers();
    } else if (useQuickCleanup) {
      console.log('⚡ Quick cleanup mode (database only, faster but less detailed logging)');
      await quickCleanupTestData();
    } else {
      console.log('📊 Standard comprehensive mode (database only, detailed logging)');
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
🧹 Test Data Cleanup Script

Usage:
  npx tsx scripts/cleanup-test-data.ts [options]

Options:
  --quick, -q        Quick cleanup mode (database only, bulk deletions)
  --auth-only, -a    Clean up ONLY test auth users (no database records)
  --with-auth, -w    Comprehensive cleanup including auth users (RECOMMENDED)
  --help, -h         Show this help message

Cleanup Modes:
  📊 Standard (default)    Clean database records only (detailed logging)
  ⚡ Quick (--quick)       Clean database records only (faster, less logging)
  🔐 Auth Only (--auth-only)   Clean ONLY auth users (for the screenshot issue)
  🔄 Full (--with-auth)    Clean database + auth users (most thorough)

What gets cleaned:
  - Database: Businesses with "Test Business" in name or @test.com emails
  - Database: All related data (users, bookings, quotes, availability, etc.)
  - Auth Users: Users with @test.com emails, test metadata, or test names

Examples:
  npx tsx scripts/cleanup-test-data.ts --with-auth     # RECOMMENDED: Full cleanup
  npx tsx scripts/cleanup-test-data.ts --auth-only     # Fix your current auth issue
  npx tsx scripts/cleanup-test-data.ts --quick         # Quick database cleanup
  npx tsx scripts/cleanup-test-data.ts                 # Standard database cleanup
`);
  process.exit(0);
}

main(); 