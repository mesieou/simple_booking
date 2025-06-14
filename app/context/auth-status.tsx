import { createClient } from "@/lib/database/supabase/server";
import { redirect } from "next/navigation";

export async function getSession() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

export async function requireGuest() {
  const session = await getSession();
  if (session) {
    redirect("/protected");
  }
  return null;
} 