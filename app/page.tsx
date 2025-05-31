import Hero from "@/components/hero";
import ConnectSupabaseSteps from "@/components/tutorial/connect-supabase-steps";
import SignUpUserSteps from "@/components/tutorial/sign-up-user-steps";
import { hasEnvVars } from "@/lib/database/supabase/check-env-vars";

export default async function Home() {
  return (
    <>
      <Hero />  
    </>
  );
}
