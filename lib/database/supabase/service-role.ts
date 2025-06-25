import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ensure the environment variables are set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY");
}

// Create a singleton instance of the Supabase client ``
let supabase: SupabaseClient | null = null;

/**
 * Returns a Supabase client initialized with the service role key.
 * This client should only be used on the server-side for operations
 * that require admin-level privileges, bypassing RLS.
 * @returns {SupabaseClient} The service role Supabase client.
 */
export const getServiceRoleClient = (): SupabaseClient => {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        } 
      }
    );
  }
  return supabase;
}; 