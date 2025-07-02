#!/usr/bin/env node

/**
 * Update Beauty Asiul business with WhatsApp Phone Number ID for webhook testing
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function updateBeautyAsiulPhoneId() {
  try {
    console.log('🔧 Updating Beauty Asiul business with WhatsApp Phone Number ID...');
    
    // Import Supabase client
    const { createClient } = require('@supabase/supabase-js');
    
    // Create client with service role key (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing environment variables');
      return;
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // For testing, we'll use one of the phone number IDs from your test script
    const testPhoneNumberId = "108123456789"; // This matches your production test
    const beautyAsiulId = "228c7e8e-ec15-4eeb-a766-d1ebee07104f";
    
    console.log(`📞 Setting Phone Number ID to: ${testPhoneNumberId}`);
    
    // Update the business
    const { data: updatedBusiness, error: updateError } = await supabase
      .from('businesses')
      .update({ 
        whatsappPhoneNumberId: testPhoneNumberId,
        updatedAt: new Date().toISOString()
      })
      .eq('id', beautyAsiulId)
      .select('id, name, whatsappNumber, whatsappPhoneNumberId')
      .single();
    
    if (updateError) {
      console.error('❌ Error updating business:', updateError);
      return;
    }
    
    console.log('\n✅ Successfully updated Beauty Asiul business!');
    console.log('Business Details:');
    console.log(`  Name: ${updatedBusiness.name}`);
    console.log(`  WhatsApp Number: ${updatedBusiness.whatsappNumber}`);
    console.log(`  Phone Number ID: ${updatedBusiness.whatsappPhoneNumberId}`);
    
    console.log('\n🎯 Now you can test with:');
    console.log(`  1. Run: node scripts/webhook-dev-tester.js`);
    console.log(`  2. Choose option 2 (PRODUCTION number)`);
    console.log(`  3. The webhook should now find your business instead of returning 404`);
    
    console.log('\n📝 What happens now:');
    console.log(`  - Webhook receives phone_number_id: ${testPhoneNumberId}`);
    console.log(`  - Looks up business with that phone_number_id`);
    console.log(`  - Finds Beauty Asiul business`);
    console.log(`  - Processes the message instead of returning 404`);
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

updateBeautyAsiulPhoneId(); 