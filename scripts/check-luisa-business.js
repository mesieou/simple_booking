#!/usr/bin/env node

/**
 * Check Luisa business details from database
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function checkLuisaBusiness() {
  try {
    console.log('🔍 Checking Luisa business in database...');
    
    // Import Supabase client
    const { createClient } = require('@supabase/supabase-js');
    
    // Create client with service role key (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing environment variables:');
      console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
      console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
      return;
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('✅ Connected to Supabase');
    
    // First, let's see all businesses
    console.log('\n📋 All businesses in database:');
    const { data: allBusinesses, error: allError } = await supabase
      .from('businesses')
      .select('id, name, whatsappNumber, whatsappPhoneNumberId, interfaceType')
      .order('name');
    
    if (allError) {
      console.error('❌ Error fetching all businesses:', allError);
      return;
    }
    
    console.log(`Found ${allBusinesses.length} business(es):`);
    allBusinesses.forEach((business, index) => {
      console.log(`\n${index + 1}. ${business.name}`);
      console.log(`   ID: ${business.id}`);
      console.log(`   Interface: ${business.interfaceType}`);
      console.log(`   WhatsApp Number: ${business.whatsappNumber || 'NOT SET'}`);
      console.log(`   Phone Number ID: ${business.whatsappPhoneNumberId || 'NOT SET'}`);
    });
    
    // Now check specifically for Luisa
    console.log('\n🎯 Looking for Luisa business...');
    const { data: luisaBusiness, error: luisaError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', '228c7e8e-ec15-4eeb-a766-d1ebee07104f')
      .single();
    
    if (luisaError) {
      if (luisaError.code === 'PGRST116') {
        console.log('❌ Luisa business not found with that ID');
      } else {
        console.error('❌ Error fetching Luisa business:', luisaError);
      }
      return;
    }
    
    console.log('\n🏢 Luisa Business Details:');
    console.log('═'.repeat(50));
    Object.keys(luisaBusiness).forEach(key => {
      console.log(`${key}: ${luisaBusiness[key] || 'NULL'}`);
    });
    
    // Analysis for webhook routing
    console.log('\n🔍 Webhook Routing Analysis:');
    if (luisaBusiness.whatsappPhoneNumberId) {
      console.log(`✅ Has Phone Number ID: ${luisaBusiness.whatsappPhoneNumberId}`);
      console.log('   → Webhook routing will work');
    } else {
      console.log('❌ Missing whatsappPhoneNumberId');
      console.log('   → This is why webhook tests fail with 404');
      console.log('   → You need to set this field for webhook routing');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkLuisaBusiness(); 