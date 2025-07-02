import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Re-export service role client for backward compatibility
export { getServiceRoleClient } from './service-role'

// Original working client (uses local/default env vars)
export const createClient = () => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  return createServerClient(
    process.env.SUPABASE_PROD_URL!,
    process.env.SUPABASE_PROD_ANON_KEY!,
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

