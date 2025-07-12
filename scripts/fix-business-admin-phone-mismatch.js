#!/usr/bin/env node

/**
 * Fix Business Admin Phone Number Mismatch
 * 
 * This script updates the business phone number to match the admin's phone number
 * so that proxy sessions work correctly.
 */

const { createClient } = require('@supabase/supabase-js');

async function fixBusinessAdminPhoneMismatch() {
  try {
    console.log('🔧 Fixing business admin phone number mismatch...');
    
    // Import Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing environment variables');
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
    
    // Find the Beauty Asiul business
    console.log('\n🔍 Looking for Beauty Asiul business...');
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('name', 'Beauty Asiul (DEV)')
      .single();
    
    if (businessError) {
      console.error('❌ Error finding Beauty Asiul business:', businessError);
      return;
    }
    
    if (!business) {
      console.error('❌ Beauty Asiul business not found');
      return;
    }
    
    console.log('\n🏢 Current Business Details:');
    console.log('═'.repeat(50));
    console.log(`ID: ${business.id}`);
    console.log(`Name: ${business.name}`);
    console.log(`Current Phone: ${business.phone}`);
    console.log(`WhatsApp Number: ${business.whatsappNumber}`);
    console.log(`WhatsApp Phone Number ID: ${business.whatsappPhoneNumberId}`);
    
    // Check if phone number needs to be updated
    const currentPhone = business.phone;
    const adminPhone = '+61452490450'; // Admin's phone from logs
    
    if (currentPhone === adminPhone) {
      console.log('\n✅ Business phone already matches admin phone!');
      console.log(`   Business Phone: ${currentPhone}`);
      console.log(`   Admin Phone: ${adminPhone}`);
      return;
    }
    
    console.log('\n🔧 Updating business phone number...');
    console.log(`   From: ${currentPhone}`);
    console.log(`   To: ${adminPhone}`);
    
    // Update the business phone number
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ 
        phone: adminPhone,
        updatedAt: new Date().toISOString()
      })
      .eq('id', business.id);
    
    if (updateError) {
      console.error('❌ Error updating business phone:', updateError);
      return;
    }
    
    console.log('\n✅ Business phone updated successfully!');
    
    // Verify the update
    const { data: updatedBusiness, error: verifyError } = await supabase
      .from('businesses')
      .select('phone')
      .eq('id', business.id)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      return;
    }
    
    console.log('\n✅ Verification:');
    console.log(`   Updated Phone: ${updatedBusiness.phone}`);
    console.log(`   Admin Phone: ${adminPhone}`);
    console.log(`   Match: ${updatedBusiness.phone === adminPhone ? '✅' : '❌'}`);
    
    console.log('\n🎉 Proxy session issue should now be fixed!');
    console.log('   Admin messages will now be recognized as admin messages');
    console.log('   Proxy sessions will work correctly');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
fixBusinessAdminPhoneMismatch()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }); 