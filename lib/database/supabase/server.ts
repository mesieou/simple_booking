import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Note: getServiceRoleClient should be imported directly from './service-role' 
// to avoid pulling in next/headers dependency in client contexts

// Environment-aware client (determines environment and uses appropriate config)
export const createClient = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return createProdServerClient();
  } else {
    return createDevServerClient();
  }
}

// Dev environment server client
export const createDevServerClient = () => {
  return createServerClient(
    process.env.SUPABASE_DEV_URL!,
    process.env.SUPABASE_DEV_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          return (await cookies()).get(name)?.value
        },
        set: async (name: string, value: string, options: CookieOptions) => {
          try {
            (await cookies()).set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove: async (name: string, options: CookieOptions) => {
          try {
            (await cookies()).set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Prod environment server client
export const createProdServerClient = () => {
  const url = process.env.SUPABASE_PROD_URL;
  const key = process.env.SUPABASE_PROD_ANON_KEY;
  
  console.log(`[Server Client] Creating prod client with URL: ${url ? url.substring(0, 30) + '...' : 'UNDEFINED'}`);
  console.log(`[Server Client] Creating prod client with Key: ${key ? key.substring(0, 30) + '...' : 'UNDEFINED'}`);
  
  if (!url || !key) {
    throw new Error(`Missing Supabase production server credentials: URL=${!!url}, KEY=${!!key}`);
  }
  
  return createServerClient(
    url,
    key,
    {
      cookies: {
        get: async (name: string) => {
          return (await cookies()).get(name)?.value
        },
        set: async (name: string, value: string, options: CookieOptions) => {
          try {
            (await cookies()).set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove: async (name: string, options: CookieOptions) => {
          try {
            (await cookies()).set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

