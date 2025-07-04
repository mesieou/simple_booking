import { getEnvironmentServerClient } from "@/lib/database/supabase/environment";
import { redirect } from "next/navigation";

export async function getSession() {
  const supabase = getEnvironmentServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getSession();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
}

export async function requireGuest() {
  const session = await getSession();
  if (session) {
    redirect("/protected");
  }
  return null;
} 