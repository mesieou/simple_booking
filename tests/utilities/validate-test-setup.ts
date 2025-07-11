#!/usr/bin/env tsx

/**
 * Validates that the test environment is properly set up with required data
 * This script checks if the Luisa business and users exist in the database
 * Run this before running escalation tests to ensure proper setup
 */

import { getValidatedTestData } from '../config/escalation-test-config';

async function validateTestSetup() {
  console.log('🔍 Validating test environment setup...\n');
  
  try {
    // Try to get validated test data
    const testData = await getValidatedTestData();
    
    console.log('✅ Test environment validation successful!\n');
    console.log('📊 Found test data:');
    console.log(`  🏢 Business: ${testData.business.name}`);
    console.log(`     - ID: ${testData.business.id}`);
    console.log(`     - Phone: ${testData.business.phone}`);
    console.log(`     - WhatsApp: ${testData.business.whatsappNumber}`);
    console.log(`     - WhatsApp API ID: ${testData.business.whatsappPhoneNumberId}`);
    
    console.log(`\n  👨‍💼 Admin User: ${testData.adminUser.firstName} ${testData.adminUser.lastName}`);
    console.log(`     - ID: ${testData.adminUser.id}`);
    console.log(`     - Phone: ${testData.adminUser.phone}`);
    console.log(`     - WhatsApp: ${testData.adminUser.whatsappNumber}`);
    
    console.log(`\n  👤 Customer User: ${testData.customerUser.firstName} ${testData.customerUser.lastName}`);
    console.log(`     - ID: ${testData.customerUser.id}`);
    console.log(`     - Phone: ${testData.customerUser.phone}`);
    console.log(`     - WhatsApp: ${testData.customerUser.whatsappNumber}`);
    
    console.log('\n🎉 Test environment is ready for escalation tests!');
    
  } catch (error) {
    console.error('❌ Test environment validation failed:', error);
    console.log('\n📝 To fix this, you may need to:');
    console.log('   1. Ensure the business and users exist in the database');
    console.log('   2. Run the seed script if needed: tsx scripts/seed-luisa-business.ts');
    console.log('   3. Check that the business has proper WhatsApp configuration');
    
    process.exit(1);
  }
}

// Run the validation
validateTestSetup()
  .then(() => {
    console.log('\n✅ Validation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }); 