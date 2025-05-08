import { SupabaseClient } from '@supabase/supabase-js';

export async function clearExistingData(supabase: SupabaseClient) {
  const tables = ['events', 'bookings', 'quotes', 'calendarSettings', 'users', 'businesses', ];
  
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