import { User } from '@/lib/database/models/user';
import { getServiceRoleClient } from '@/lib/database/supabase/service-role';

describe('User Role Filtering Tests', () => {
  let supabase: any;
  let testUsers: { customer: User; superAdmin: User; provider: User };
  
  const TEST_PHONE = '61999888777';
  const TEST_BUSINESS_ID = '12345678-1234-1234-1234-123456789012';

  beforeAll(async () => {
    supabase = getServiceRoleClient();
    
    // Create test users with different roles but same phone number
    const customerUser = new User('John', 'Customer', 'customer', TEST_BUSINESS_ID);
    const superAdminUser = new User('John', 'Admin', 'super_admin', TEST_BUSINESS_ID);
    const providerUser = new User('John', 'Provider', 'provider', TEST_BUSINESS_ID);
    
    // Add users with same WhatsApp number but different roles
    await customerUser.add({ 
      whatsappNumber: TEST_PHONE,
      skipProviderValidation: true,
      supabaseClient: supabase
    });
    await superAdminUser.add({ 
      whatsappNumber: TEST_PHONE,
      skipProviderValidation: true,
      supabaseClient: supabase
    });
    await providerUser.add({ 
      whatsappNumber: TEST_PHONE,
      skipProviderValidation: true,
      supabaseClient: supabase
    });
    
    testUsers = {
      customer: customerUser,
      superAdmin: superAdminUser,
      provider: providerUser
    };
  });

  afterAll(async () => {
    // Clean up test users
    try {
      await supabase.from('users').delete().eq('whatsAppNumberNormalized', TEST_PHONE);
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('findUserByCustomerWhatsappNumber', () => {
    it('should ONLY return users with customer role', async () => {
      const result = await User.findUserByCustomerWhatsappNumber(TEST_PHONE);
      
      expect(result).not.toBeNull();
      expect(result?.role).toBe('customer');
      expect(result?.firstName).toBe('John');
      expect(result?.lastName).toBe('Customer');
    });

    it('should NOT return super_admin users even if they have the same phone', async () => {
      // Verify super admin exists with this phone
      const allUsers = await supabase
        .from('users')
        .select('*')
        .eq('whatsAppNumberNormalized', TEST_PHONE);
      
      const superAdminExists = allUsers.data?.some((u: any) => u.role === 'super_admin');
      expect(superAdminExists).toBe(true);
      
      // But customer lookup should not return it
      const result = await User.findUserByCustomerWhatsappNumber(TEST_PHONE);
      expect(result?.role).not.toBe('super_admin');
    });

    it('should NOT return provider users', async () => {
      const result = await User.findUserByCustomerWhatsappNumber(TEST_PHONE);
      expect(result?.role).not.toBe('provider');
    });

    it('should return null when no customer exists with that phone', async () => {
      const result = await User.findUserByCustomerWhatsappNumber('99999999999');
      expect(result).toBeNull();
    });

    it('should handle phone normalization correctly', async () => {
      // Test different phone formats
      const formats = [
        TEST_PHONE,
        `+${TEST_PHONE}`,
        TEST_PHONE.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '+$1 $2 $3 $4')
      ];

      for (const format of formats) {
        const result = await User.findUserByCustomerWhatsappNumber(format);
        expect(result).not.toBeNull();
        expect(result?.role).toBe('customer');
      }
    });
  });

  describe('Role-based User Queries', () => {
    it('should differentiate between customer and business user lookups', async () => {
      // Customer lookup should only find customers
      const customerResult = await User.findUserByCustomerWhatsappNumber(TEST_PHONE);
      expect(customerResult?.role).toBe('customer');

      // Business user lookup should find providers/admins (different method)
      const businessResult = await User.findUserByBusinessId(TEST_BUSINESS_ID);
      expect(businessResult?.role).toMatch(/provider|admin/);
    });

    it('should never mix up customer and admin lookups', async () => {
      // This test ensures the bug we fixed never happens again
      const customerLookup = await User.findUserByCustomerWhatsappNumber(TEST_PHONE);
      
      // Should be customer, never admin
      expect(customerLookup?.role).toBe('customer');
      expect(customerLookup?.role).not.toBe('super_admin');
      expect(customerLookup?.role).not.toBe('admin');
      expect(customerLookup?.role).not.toBe('provider');
    });
  });

  describe('Database State Verification', () => {
    it('should maintain data integrity with multiple users having same phone', async () => {
      // Verify all test users exist
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, role, whatsAppNumberNormalized')
        .eq('whatsAppNumberNormalized', TEST_PHONE);

      expect(allUsers).toHaveLength(3);
      
      const roles = allUsers.map((u: any) => u.role);
      expect(roles).toContain('customer');
      expect(roles).toContain('super_admin');
      expect(roles).toContain('provider');
    });

    it('should use proper role filtering in SQL queries', async () => {
      // Direct SQL test to verify the role filter works
      const { data: customersOnly } = await supabase
        .from('users')
        .select('*')
        .eq('whatsAppNumberNormalized', TEST_PHONE)
        .eq('role', 'customer');

      expect(customersOnly).toHaveLength(1);
      expect(customersOnly[0].role).toBe('customer');
    });
  });
}); 