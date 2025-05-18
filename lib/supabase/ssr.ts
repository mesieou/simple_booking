import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSSRClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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