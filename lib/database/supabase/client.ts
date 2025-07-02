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
  return createBrowserClient(
    process.env.SUPABASE_DEV_URL!,
    process.env.SUPABASE_DEV_ANON_KEY!,
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
  return createBrowserClient(
    process.env.SUPABASE_PROD_URL!,
    process.env.SUPABASE_PROD_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}