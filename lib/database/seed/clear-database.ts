import { SupabaseClient } from '@supabase/supabase-js';

export async function clearExistingData(supabase: SupabaseClient) {
  const tables = [
    'notifications', // Delete notifications first (has foreign keys to chatSessions and businesses)
    'embeddings',
    'documents',
    'events',
    'bookings',
    'quotes',
    'calendarSettings',
    'availabilitySlots', // add this before users
    'chatSessions', // Add chat sessions in proper order
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
    
    const { error: availabilityError } = await supabase.from('availabilitySlots').delete().in('providerId', userIds);
    if (availabilityError) console.log(`[SEED] Note: Error deleting availability slots for business ${businessId}:`, availabilityError.message);
  }

  const { error: bookingsError } = await supabase.from('bookings').delete().eq('businessId', businessId);
  if (bookingsError) console.log(`[SEED] Note: Error deleting bookings for business ${businessId}:`, bookingsError.message);

  const { error: quotesError } = await supabase.from('quotes').delete().eq('businessId', businessId);
  if (quotesError) console.log(`[SEED] Note: Error deleting quotes for business ${businessId}:`, quotesError.message);

  const { error: calendarError } = await supabase.from('calendarSettings').delete().eq('businessId', businessId);
  if (calendarError) console.log(`[SEED] Note: Error deleting calendar settings for business ${businessId}:`, calendarError.message);

  const { error: servicesError } = await supabase.from('services').delete().eq('businessId', businessId);
  if (servicesError) console.log(`[SEED] Note: Error deleting services for business ${businessId}:`, servicesError.message);

  const { error: crawlSessionsError } = await supabase.from('crawlSessions').delete().eq('businessId', businessId);
  if (crawlSessionsError) console.log(`[SEED] Note: Error deleting crawl sessions for business ${businessId}:`, crawlSessionsError.message);

  // Get chat sessions before deleting (for notification cleanup)
  const { data: chatSessions } = await supabase.from('chatSessions').select('id').eq('businessId', businessId);
  const chatSessionIds = chatSessions?.map(cs => cs.id) || [];

  // Delete notifications first (they have foreign keys to chatSessions and businesses)
  const { error: notificationsError } = await supabase.from('notifications').delete().eq('businessId', businessId);
  if (notificationsError) console.log(`[SEED] Note: Error deleting notifications for business ${businessId}:`, notificationsError.message);

  // Also delete notifications linked to chat sessions
  if (chatSessionIds.length > 0) {
    const { error: chatNotificationsError } = await supabase.from('notifications').delete().in('chatSessionId', chatSessionIds);
    if (chatNotificationsError) console.log(`[SEED] Note: Error deleting chat session notifications for business ${businessId}:`, chatNotificationsError.message);
  }

  const { error: chatSessionsError } = await supabase.from('chatSessions').delete().eq('businessId', businessId);
  if (chatSessionsError) console.log(`[SEED] Note: Error deleting chat sessions for business ${businessId}:`, chatSessionsError.message);

  for (const userId of userIds) {
    try {
      // Must delete the user from public.users table before deleting from auth.users
      const { error: publicUserError } = await supabase.from('users').delete().eq('id', userId);
      if(publicUserError) console.log(`[SEED] Note: Error deleting public user ${userId}:`, publicUserError.message);

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