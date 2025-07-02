"use client";

import { createBrowserClient } from "@supabase/ssr";

// Environment-aware client (determines environment and uses appropriate config)
export function createClient() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return createProdClient();
  } else {
    return createDevClient();
  }
}

// Dev environment client
export function createDevClient() {
  // Use NEXT_PUBLIC_ variables for client-side access, with fallback to standard variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_DEV_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Client] Missing Supabase credentials for development:', {
      url: !!supabaseUrl,
      key: !!supabaseKey,
      availableEnvVars: {
        NEXT_PUBLIC_SUPABASE_DEV_URL: !!process.env.NEXT_PUBLIC_SUPABASE_DEV_URL,
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
    });
    throw new Error('Missing Supabase development client credentials. Please set NEXT_PUBLIC_SUPABASE_DEV_URL and NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY environment variables.');
  }
  
  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}

// Prod environment client
export function createProdClient() {
  // Use NEXT_PUBLIC_ variables for client-side access, with fallback to standard variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_PROD_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Client] Missing Supabase credentials for production:', {
      url: !!supabaseUrl,
      key: !!supabaseKey,
      availableEnvVars: {
        NEXT_PUBLIC_SUPABASE_PROD_URL: !!process.env.NEXT_PUBLIC_SUPABASE_PROD_URL,
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
    });
    throw new Error('Missing Supabase production client credentials. Please set NEXT_PUBLIC_SUPABASE_PROD_URL and NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY environment variables.');
  }
  
  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}