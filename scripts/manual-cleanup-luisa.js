#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function manualCleanupLuisa() {
  console.log('🧹 Manually cleaning up orphaned Luisa business...\n');

  const url = process.env.SUPABASE_PROD_URL;
  const serviceRoleKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { 
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    }
  });

  const businessIdToClean = 'cce537b7-8fcc-4fa7-9c53-4658c35827c7';

  try {
    // Delete in order (foreign key dependencies)
    
    console.log('🗑️  Deleting availability slots...');
    const { error: slotsError } = await supabase
      .from('availabilitySlots')
      .delete()
      .eq('businessId', businessIdToClean);
    if (slotsError) console.warn('Slots error:', slotsError.message);
    
    console.log('🗑️  Deleting services...');
    const { error: servicesError } = await supabase
      .from('services')
      .delete()
      .eq('businessId', businessIdToClean);
    if (servicesError) console.warn('Services error:', servicesError.message);
    
    console.log('🗑️  Deleting calendar settings...');
    const { error: calendarError } = await supabase
      .from('calendarSettings')
      .delete()
      .eq('businessId', businessIdToClean);
    if (calendarError) console.warn('Calendar error:', calendarError.message);
    
    console.log('🗑️  Deleting documents...');
    const { error: docsError } = await supabase
      .from('documents')
      .delete()
      .eq('businessId', businessIdToClean);
    if (docsError) console.warn('Docs error:', docsError.message);
    
    console.log('🗑️  Deleting embeddings...');
    const { error: embeddingsError } = await supabase
      .from('embeddings')
      .delete()
      .eq('businessId', businessIdToClean);
    if (embeddingsError) console.warn('Embeddings error:', embeddingsError.message);
    
    console.log('🗑️  Deleting users...');
    const { error: usersError } = await supabase
      .from('users')
      .delete()
      .eq('businessId', businessIdToClean);
    if (usersError) console.warn('Users error:', usersError.message);
    
    console.log('🗑️  Deleting business...');
    const { error: businessError } = await supabase
      .from('businesses')
      .delete()
      .eq('id', businessIdToClean);
    if (businessError) {
      throw new Error(`Failed to delete business: ${businessError.message}`);
    }
    
    console.log('✅ Manual cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during manual cleanup:', error.message);
    process.exit(1);
  }
}

manualCleanupLuisa().catch(console.error); 