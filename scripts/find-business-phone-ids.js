/**
 * Find business phone number IDs
 */

async function findBusinessPhoneIds() {
  try {
    // Import the Business model (this works in a script context)
    const { getEnvironmentServiceRoleClient } = await import('../lib/database/supabase/environment.ts');
    
    const supabase = getEnvironmentServiceRoleClient();
    
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, name, whatsappNumber, whatsappPhoneNumberId')
      .order('name');
    
    if (error) {
      console.error('❌ Error fetching businesses:', error);
      return;
    }
    
    console.log('\n📋 Your Businesses and Phone Number IDs:');
    console.log('═'.repeat(80));
    
    businesses.forEach(business => {
      console.log(`🏢 ${business.name}`);
      console.log(`   WhatsApp Number: ${business.whatsappNumber || 'NOT SET'}`);
      console.log(`   Phone Number ID: ${business.whatsappPhoneNumberId || 'NOT SET'}`);
      console.log(`   Database ID: ${business.id}`);
      console.log('─'.repeat(60));
    });
    
    // Find the one that matches "Beauty Asiul" from your logs
    const beautyAsiul = businesses.find(b => b.name === 'Beauty Asiul');
    if (beautyAsiul) {
      console.log('\n🎯 Found the business from your logs:');
      console.log(`   Business: ${beautyAsiul.name}`);
      console.log(`   Phone Number ID: ${beautyAsiul.whatsappPhoneNumberId || 'NOT SET'}`);
      
      if (beautyAsiul.whatsappPhoneNumberId) {
        console.log(`\n✅ Use this phone_number_id for testing: ${beautyAsiul.whatsappPhoneNumberId}`);
      } else {
        console.log('\n⚠️  This business has no phone_number_id set!');
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

findBusinessPhoneIds(); 