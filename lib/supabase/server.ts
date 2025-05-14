
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = cookies();

  console.log("Creando cliente Supabase con URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("Usando Anon Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) + "...");

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

