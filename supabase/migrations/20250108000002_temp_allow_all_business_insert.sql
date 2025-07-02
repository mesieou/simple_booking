-- Temporary fix: Allow ALL users to INSERT businesses
-- This will help us identify if the issue is with service role recognition

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "service_role_businesses_insert" ON "businesses";
DROP POLICY IF EXISTS "admin_businesses_insert" ON "businesses";

-- Create a temporary policy that allows ALL authenticated users to INSERT
CREATE POLICY "temp_allow_all_business_insert" ON "businesses" 
  FOR INSERT TO "authenticated" 
  WITH CHECK (true);

-- Also allow anonymous users (service role often appears as anon in some contexts)
CREATE POLICY "temp_allow_anon_business_insert" ON "businesses" 
  FOR INSERT TO "anon" 
  WITH CHECK (true); 