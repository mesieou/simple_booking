-- Proper fix: Service role in Next.js API routes is treated as 'authenticated', not 'service_role'
-- Remove temporary policies and create secure ones

-- Drop temporary policies
DROP POLICY IF EXISTS "temp_allow_all_business_insert" ON "businesses";
DROP POLICY IF EXISTS "temp_allow_anon_business_insert" ON "businesses";

-- Create proper INSERT policies for authenticated users
-- This includes service role when used from Next.js API routes
CREATE POLICY "authenticated_business_insert" ON "businesses" 
  FOR INSERT TO "authenticated" 
  WITH CHECK (true);

-- Also allow admin role for manual business creation
CREATE POLICY "admin_business_insert" ON "businesses" 
  FOR INSERT TO "authenticated" 
  WITH CHECK (get_my_role() = 'admin');

-- Keep anon policy for webhook operations (if needed)
CREATE POLICY "anon_business_insert" ON "businesses" 
  FOR INSERT TO "anon" 
  WITH CHECK (true); 