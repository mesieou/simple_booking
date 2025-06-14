import { SupabaseClient } from '@supabase/supabase-js';

export async function clearExistingData(supabase: SupabaseClient) {
  const tables = [
    'embeddings',
    'documents',
    'events',
    'bookings',
    'quotes',
    'calendarSettings',
    'availabilitySlots', // add this before users
    'users',
    'businesses',
  ];
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        throw new Error(`Failed to clear ${table}: ${error.message}`);
      }
    }
  }

export async function clearBusinessDataById(supabase: SupabaseClient, businessId: string) {
  console.log(`[SEED] Starting cleanup for business ID: ${businessId}...`);

  // Get all users for this business (we'll need their auth IDs)
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('businessId', businessId);

  const userIds = users?.map(u => u.id) || [];

  // Following the correct deletion order
  const { error: documentsError } = await supabase.from('documents').delete().eq('businessId', businessId);
  if (documentsError) console.log(`[SEED] Note: Error deleting documents for business ${businessId}:`, documentsError.message);

  if (userIds.length > 0) {
    const { error: eventsError } = await supabase.from('events').delete().in('userId', userIds);
    if (eventsError) console.log(`[SEED] Note: Error deleting events for business ${businessId}:`, eventsError.message);
  }

  const { error: bookingsError } = await supabase.from('bookings').delete().eq('businessId', businessId);
  if (bookingsError) console.log(`[SEED] Note: Error deleting bookings for business ${businessId}:`, bookingsError.message);

  const { error: quotesError } = await supabase.from('quotes').delete().eq('businessId', businessId);
  if (quotesError) console.log(`[SEED] Note: Error deleting quotes for business ${businessId}:`, quotesError.message);

  const { error: calendarError } = await supabase.from('calendarSettings').delete().eq('businessId', businessId);
  if (calendarError) console.log(`[SEED] Note: Error deleting calendar settings for business ${businessId}:`, calendarError.message);

  if (userIds.length > 0) {
    const { error: availabilityError } = await supabase.from('availabilitySlots').delete().in('providerId', userIds);
    if (availabilityError) console.log(`[SEED] Note: Error deleting availability slots for business ${businessId}:`, availabilityError.message);
  }

  const { error: servicesError } = await supabase.from('services').delete().eq('businessId', businessId);
  if (servicesError) console.log(`[SEED] Note: Error deleting services for business ${businessId}:`, servicesError.message);

  const { error: crawlSessionsError } = await supabase.from('crawlSessions').delete().eq('businessId', businessId);
  if (crawlSessionsError) console.log(`[SEED] Note: Error deleting crawl sessions for business ${businessId}:`, crawlSessionsError.message);

  const { error: chatSessionsError } = await supabase.from('chatSessions').delete().eq('businessId', businessId);
  if (chatSessionsError) console.log(`[SEED] Note: Error deleting chat sessions for business ${businessId}:`, chatSessionsError.message);

  for (const userId of userIds) {
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) console.log(`[SEED] Note: Error deleting auth user ${userId}:`, authError.message);
    } catch (error) {
      console.log(`[SEED] Note: Could not delete auth user ${userId}`);
    }
  }

  const { error: businessDeleteError } = await supabase.from('businesses').delete().eq('id', businessId);
  if (businessDeleteError) {
    throw new Error(`[SEED] Failed to delete business ${businessId}: ${businessDeleteError.message}`);
  }

  console.log(`[SEED] Successfully cleaned up business ${businessId} and all related data.`);
}