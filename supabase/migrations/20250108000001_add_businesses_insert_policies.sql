-- Add missing INSERT policies for businesses table
-- This fixes the RLS violation when service role tries to create businesses

-- Service role INSERT policy for seeding operations
CREATE POLICY "service_role_businesses_insert" ON "businesses" 
  FOR INSERT TO "service_role" 
  WITH CHECK (true);

-- Admin INSERT policy for business creation
CREATE POLICY "admin_businesses_insert" ON "businesses" 
  FOR INSERT TO "authenticated" 
  WITH CHECK (get_my_role() = 'admin'); 