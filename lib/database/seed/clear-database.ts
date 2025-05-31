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