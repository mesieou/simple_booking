"use client";

import { createBrowserClient } from "@supabase/ssr";

// Original working client (uses local/default env vars)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
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