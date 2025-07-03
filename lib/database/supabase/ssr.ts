import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSSRClient() {
  const cookieStore = await cookies();
  
  // Use environment-specific variables
  const isProduction = process.env.NODE_ENV === 'production';
  
  const supabaseUrl = isProduction 
    ? (process.env.SUPABASE_PROD_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
    : process.env.NEXT_PUBLIC_SUPABASE_URL;
    
  const supabaseKey = isProduction 
    ? (process.env.SUPABASE_PROD_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[SSR Client] Missing Supabase credentials:', {
      environment: isProduction ? 'production' : 'development',
      url: !!supabaseUrl,
      key: !!supabaseKey,
      variables: {
        SUPABASE_PROD_URL: !!process.env.SUPABASE_PROD_URL,
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_PROD_ANON_KEY: !!process.env.SUPABASE_PROD_ANON_KEY,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
    });
    throw new Error(`Missing Supabase SSR credentials for ${isProduction ? 'production' : 'development'}`);
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore;
          return cookie.get(name)?.value;
        },
        async set(name: string, value: string, options: any) {
          const cookie = await cookieStore;
          cookie.set({ name, value, ...options });
        },
        async remove(name: string, options: any) {
          const cookie = await cookieStore;
          cookie.delete({ name, ...options });
        },
      },
    }
  );
} 