#!/usr/bin/env node

/**
 * Check all businesses in the database
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function checkBusinesses() {
  try {
    console.log('🔍 Checking all businesses in PRODUCTION database...');
    
    const supabaseUrl = process.env.SUPABASE_PROD_URL;
    const serviceRoleKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing PRODUCTION environment variables');
      console.error('   SUPABASE_PROD_URL:', !!supabaseUrl);
      console.error('   SUPABASE_PROD_SERVICE_ROLE_KEY:', !!serviceRoleKey);
      return;
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('✅ Connected to PRODUCTION Supabase');
    
    // Get all businesses
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('❌ Error fetching businesses:', error);
      return;
    }
    
    console.log(`\n📋 Found ${businesses.length} business(es):`);
    console.log('═'.repeat(80));
    
    businesses.forEach((business, index) => {
      console.log(`\n${index + 1}. ${business.name}`);
      console.log(`   ID: ${business.id}`);
      console.log(`   Phone: ${business.phone || 'NOT SET'}`);
      console.log(`   WhatsApp Number: ${business.whatsappNumber || 'NOT SET'}`);
      console.log(`   WhatsApp Phone Number ID: ${business.whatsappPhoneNumberId || 'NOT SET'}`);
      console.log(`   Email: ${business.email || 'NOT SET'}`);
      console.log(`   Interface Type: ${business.interfaceType || 'NOT SET'}`);
    });
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

checkBusinesses()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }); 