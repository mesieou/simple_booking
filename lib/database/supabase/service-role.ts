import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ensure the environment variables are set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY");
}

// Create singleton instances for each environment
let supabase: SupabaseClient | null = null;
let devSupabase: SupabaseClient | null = null;
let prodSupabase: SupabaseClient | null = null;

/**
 * Returns a Supabase client initialized with the service role key (local/default).
 * This client should only be used on the server-side for operations
 * that require admin-level privileges, bypassing RLS.
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

/**
 * Returns a Supabase service role client for dev environment.
 */
export const getDevServiceRoleClient = (): SupabaseClient => {
  if (!devSupabase) {
    devSupabase = createClient(
      process.env.SUPABASE_DEV_URL!,
      process.env.SUPABASE_DEV_SERVICE_ROLE_KEY!,
      { auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        } 
      }
    );
  }
  return devSupabase;
};

/**
 * Returns a Supabase service role client for prod environment.
 */
export const getProdServiceRoleClient = (): SupabaseClient => {
  if (!prodSupabase) {
    prodSupabase = createClient(
      process.env.SUPABASE_PROD_URL!,
      process.env.SUPABASE_PROD_SERVICE_ROLE_KEY!,
      { auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        } 
      }
    );
  }
  return prodSupabase;
}; 