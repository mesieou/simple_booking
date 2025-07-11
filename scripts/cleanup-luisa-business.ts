import { getServiceRoleClient } from '../lib/database/supabase/service-role';
import { clearBusinessDataById } from '../lib/database/seed/clear-database';

async function cleanupLuisaBusinessData() {
  console.log('[CLEANUP] Starting cleanup of Luisa\'s test business data...');
  
  try {
    const supabase = getServiceRoleClient();
    
    // Find all businesses that match Luisa's data (both dev and prod)
    console.log('[CLEANUP] Searching for existing Luisa business data...');
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, email, phone, whatsappNumber')
      .or('name.ilike.%Beauty Asiul%,email.eq.luisa.bernal7826@gmail.com,email.eq.luisa.dev@beautyasiul.com,phone.eq.+61473164581,phone.eq.+61452490450,whatsappNumber.eq.+61411851098,whatsappNumber.eq.+15551890570');

    if (businessError) {
      console.error('[CLEANUP] Error searching for businesses:', businessError);
      throw businessError;
    }

    if (!businesses || businesses.length === 0) {
      console.log('[CLEANUP] ✅ No Luisa business data found to clean up.');
      return;
    }

    console.log(`[CLEANUP] Found ${businesses.length} business(es) to clean up:`);
    businesses.forEach(business => {
      console.log(`  - ${business.name} (${business.email}) - ID: ${business.id}`);
    });

    // Clean up each business
    for (const business of businesses) {
      console.log(`[CLEANUP] 🧹 Cleaning up business: ${business.name} - ID: ${business.id}`);
      await clearBusinessDataById(supabase, business.id);
      console.log(`[CLEANUP] ✅ Successfully cleaned up business: ${business.name}`);
    }

    console.log('[CLEANUP] 🎉 All Luisa business data cleaned up successfully!');
    
  } catch (error) {
    console.error('[CLEANUP] ❌ Error during cleanup:', error);
    throw error;
  }
}

export { cleanupLuisaBusinessData };

// Run the cleanup when this script is executed directly (not imported)
if (require.main === module) {
  cleanupLuisaBusinessData()
    .then(() => {
      console.log('[CLEANUP] Cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[CLEANUP] Cleanup failed:', error);
      process.exit(1);
    });
} 