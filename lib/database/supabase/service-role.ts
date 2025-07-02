import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCurrentEnvironment } from './environment';

// Create singleton instances for each environment
let supabase: SupabaseClient | null = null;
let devSupabase: SupabaseClient | null = null;
let prodSupabase: SupabaseClient | null = null;

/**
 * Returns a Supabase client initialized with the service role key (environment-aware).
 * This client should only be used on the server-side for operations
 * that require admin-level privileges, bypassing RLS.
 */
export const getServiceRoleClient = (): SupabaseClient => {
  const environment = getCurrentEnvironment();
  
  // Use environment-appropriate service role client
  if (environment === 'production') {
    return getProdServiceRoleClient();
  } else {
    return getDevServiceRoleClient();
  }
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
    const url = process.env.SUPABASE_PROD_URL;
    const key = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY;
    
    console.log(`[Service Role Client] Creating prod client with URL: ${url ? url.substring(0, 30) + '...' : 'UNDEFINED'}`);
    console.log(`[Service Role Client] Creating prod client with Key: ${key ? key.substring(0, 30) + '...' : 'UNDEFINED'}`);
    
    if (!url || !key) {
      throw new Error(`Missing Supabase production credentials: URL=${!!url}, KEY=${!!key}`);
    }
    
    prodSupabase = createClient(
      url,
      key,
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