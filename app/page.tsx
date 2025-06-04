import Hero from "@components/sections/hero";


import { hasEnvVars } from "@/lib/database/supabase/check-env-vars";

export default async function Home() {
  return (
    <>
      <Hero />  
    </>
  );
}
