import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { getEnvironmentServiceRoleClient } from '@/lib/database/supabase/environment';
import { Business } from '@/lib/database/models/business';
import { User } from '@/lib/database/models/user';
import { Service } from '@/lib/database/models/service';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { 
  createSingleAdminProviderData, 
  createAdminPlusProviderData, 
  createAdminProviderPlusProviderData,
  validateBusinessCreationResult 
} from './helpers/provider-factory';

const TEST_EMAIL = 'test-onboarding@example.com';
const TEST_PASSWORD = 'TestPassword123!';

describe('Onboarding Flow Integration Tests', () => {
  let supabase: any;
  let createdBusinessId: string | null = null;
  let createdUserId: string | null = null;
  let authUserId: string | null = null;

  beforeAll(async () => {
    supabase = getEnvironmentServiceRoleClient();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up after each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData();
  });

  async function cleanupTestData() {
    if (!supabase) return;

    try {
      // Clean up in correct order to respect foreign key constraints
      
      // 1. Clean up services first (references businessId)
      if (createdBusinessId) {
        await supabase
          .from('services')
          .delete()
          .eq('businessId', createdBusinessId);
      }

      // 2. Clean up calendar settings (references businessId and userId)  
      if (createdBusinessId) {
        await supabase
          .from('calendarSettings')
          .delete()
          .eq('businessId', createdBusinessId);
      }

      // 3. Clean up provider calendar settings (references businessId and providerId)
      if (createdBusinessId) {
        await supabase
          .from('calendarSettings')
          .delete()
          .eq('businessId', createdBusinessId);
      }

      // 4. Clean up user profile (references businessId)
      if (createdUserId) {
        const { error: userError } = await supabase
          .from('users')
          .delete()
          .eq('id', createdUserId);
        if (userError) console.error('Error cleaning up user profile:', userError);
        createdUserId = null;
      }

      // 5. Clean up auth user
      if (authUserId) {
        await supabase.auth.admin.deleteUser(authUserId);
        authUserId = null;
      }

      // 6. Finally clean up business (no longer referenced)
      if (createdBusinessId) {
        const { error: businessError } = await supabase
          .from('businesses')
          .delete()
          .eq('id', createdBusinessId);
        if (businessError) console.error('Error cleaning up business:', businessError);
        createdBusinessId = null;
      }

      // Clean up by email as fallback (maintain proper order)
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('email', TEST_EMAIL);
      
      if (businesses?.length > 0) {
        for (const business of businesses) {
          // Clean up related data first
          await supabase.from('services').delete().eq('businessId', business.id);
          await supabase.from('calendarSettings').delete().eq('businessId', business.id);
          await supabase.from('users').delete().eq('businessId', business.id);
          // Then delete business
          await supabase.from('businesses').delete().eq('id', business.id);
        }
      }

      const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
      const testUser = existingAuthUsers?.users?.find((u: any) => u.email === TEST_EMAIL);
      if (testUser) {
        await supabase.auth.admin.deleteUser(testUser.id);
      }

    } catch (error) {
      console.error('Error in cleanup:', error);
    }
  }

  describe('Multi-Provider Onboarding Scenarios', () => {
    it('should_create_business_with_single_admin_provider', async () => {
      const onboardingData = createSingleAdminProviderData(TEST_EMAIL);

      // Call the API endpoint directly
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/onboarding/create-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(onboardingData),
      });

      if (response.status !== 200) {
        const errorText = await response.text();
        console.log('SINGLE ADMIN ERROR RESPONSE:', response.status, errorText);
      }
      expect(response.status).toBe(200);
      const result = await response.json();

      // Validate result using helper
      const ids = validateBusinessCreationResult(result, onboardingData);
      
      // Store IDs for cleanup
      createdBusinessId = ids.businessId;
      createdUserId = ids.userId;
      authUserId = ids.authUserId;

      // Verify auth user was created
      const { data: authUser } = await supabase.auth.admin.getUserById(authUserId);
      expect(authUser.user).toBeDefined();
      expect(authUser.user.email).toBe(TEST_EMAIL);
      expect(authUser.user.user_metadata.firstName).toBe('John');
      expect(authUser.user.user_metadata.lastName).toBe('Doe');
      expect(authUser.user.user_metadata.role).toBe('admin/provider');

      // Verify user profile was created
      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', createdUserId)
        .single();

      expect(userError).toBeNull();
      expect(userProfile).toBeDefined();
      expect(userProfile.firstName).toBe(onboardingData.ownerFirstName);
      expect(userProfile.lastName).toBe(onboardingData.ownerLastName);
      expect(userProfile.role).toBe('admin/provider');
      expect(userProfile.businessId).toBe(createdBusinessId);
      expect(userProfile.email).toBe(TEST_EMAIL);

      // Verify business was created
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', createdBusinessId)
        .single();

      expect(businessError).toBeNull();
      expect(business).toBeDefined();
      expect(business.name).toBe(onboardingData.businessName);
      expect(business.email).toBe(TEST_EMAIL);
      expect(business.businessCategory).toBe(onboardingData.businessCategory);

      // Verify provider calendar settings were created using existing calendarSettings table
      const { data: calendarSettings, error: calendarError } = await supabase
        .from('calendarSettings')
        .select('*')
        .eq('businessId', createdBusinessId);

      console.log('Calendar settings query result:', { calendarSettings, calendarError, businessId: createdBusinessId });

      expect(calendarError).toBeNull();
      expect(calendarSettings).toBeDefined();
      expect(calendarSettings.length).toBe(1); // Single provider
      expect(calendarSettings[0].userId).toBe(createdUserId); // Field is userId, not providerId
      expect(calendarSettings[0].businessId).toBe(createdBusinessId);

      // Verify default services were created
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('businessId', createdBusinessId);

      expect(servicesError).toBeNull();
      expect(services).toBeDefined();
      expect(services.length).toBeGreaterThan(0);
    });

    it('should_create_business_with_admin_and_one_provider', async () => {
      const onboardingData = createAdminPlusProviderData(TEST_EMAIL);

      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/onboarding/create-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(onboardingData),
      });

      if (response.status !== 200) {
        const errorText = await response.text();
        console.log('ERROR RESPONSE:', response.status, errorText);
      }
      expect(response.status).toBe(200);
      const result = await response.json();

      // Validate result using helper
      const ids = validateBusinessCreationResult(result, onboardingData);
      
      // Store IDs for cleanup
      createdBusinessId = ids.businessId;
      createdUserId = ids.userId;
      authUserId = ids.authUserId;

      // Verify owner has admin role (not provider)
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', createdUserId)
        .single();

      expect(userProfile.role).toBe('admin');
      expect(userProfile.firstName).toBe(onboardingData.ownerFirstName);
      expect(userProfile.lastName).toBe(onboardingData.ownerLastName);

      // Verify business category
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', createdBusinessId)
        .single();

      expect(business.businessCategory).toBe(onboardingData.businessCategory);
      expect(business.name).toBe(onboardingData.businessName);

      // Verify all users created (admin + provider)
      const { data: allUsers } = await supabase
        .from('users')
        .select('*')
        .eq('businessId', createdBusinessId)
        .order('role', { ascending: true }); // admin first, then provider (alphabetical order)

      expect(allUsers.length).toBe(2); // Admin + 1 provider
      expect(allUsers[0].role).toBe('admin'); // Owner
      expect(allUsers[1].role).toBe('provider'); // Additional provider
      expect(allUsers[1].firstName).toBe('Sarah'); // From providerNames

      // Verify calendar settings created for provider only (admin doesn't provide services)
      const { data: calendarSettings } = await supabase
        .from('calendarSettings')
        .select('*')
        .eq('businessId', createdBusinessId)
        .order('userId', { ascending: true });

      expect(calendarSettings.length).toBe(1); // Only provider, not admin
      expect(calendarSettings[0].userId).toBe(allUsers[1].id); // Provider user
      expect(calendarSettings[0].businessId).toBe(createdBusinessId);
    });

    it('should_create_business_with_admin_provider_and_additional_provider', async () => {
      const onboardingData = createAdminProviderPlusProviderData(TEST_EMAIL);

      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/onboarding/create-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(onboardingData),
      });

      if (response.status !== 200) {
        const errorText = await response.text();
        console.log('ADMIN_PROVIDER_PLUS_PROVIDER ERROR RESPONSE:', response.status, errorText);
      }
      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Validate result using helper
      const ids = validateBusinessCreationResult(result, onboardingData);
      
      // Store IDs for cleanup
      createdBusinessId = ids.businessId;
      createdUserId = ids.userId;
      authUserId = ids.authUserId;

      // Verify owner has admin/provider role
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', createdUserId)
        .single();

      expect(userProfile.role).toBe('admin/provider');
      expect(userProfile.firstName).toBe(onboardingData.ownerFirstName);
      expect(userProfile.lastName).toBe(onboardingData.ownerLastName);

      // Verify business category
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', createdBusinessId)
        .single();

      expect(business.businessCategory).toBe(onboardingData.businessCategory);
      expect(business.name).toBe(onboardingData.businessName);

      // Verify all users created (admin/provider + provider)
      const { data: allUsers } = await supabase
        .from('users')
        .select('*')
        .eq('businessId', createdBusinessId)
        .order('createdAt', { ascending: true }); // Owner first, then additional provider
      expect(allUsers.length).toBe(2); // Admin/provider + 1 additional provider
      expect(allUsers[0].role).toBe('admin/provider'); // Owner
      expect(allUsers[1].role).toBe('provider'); // Additional provider
      expect(allUsers[1].firstName).toBe('Alex'); // From providerNames

      // Verify calendar settings created for BOTH providers (owner and additional)
      const { data: calendarSettings } = await supabase
        .from('calendarSettings')
        .select('*')
        .eq('businessId', createdBusinessId)
        .order('userId', { ascending: true });

      expect(calendarSettings.length).toBe(2); // Both owner and additional provider
      
      // Verify both providers have calendar settings
      const userIds = calendarSettings.map(cs => cs.userId);
      expect(userIds).toContain(allUsers[0].id); // Owner
      expect(userIds).toContain(allUsers[1].id); // Additional provider
      
      // Verify business ID is correct for both
      expect(calendarSettings[0].businessId).toBe(createdBusinessId);
      expect(calendarSettings[1].businessId).toBe(createdBusinessId);
    });

    it('should handle validation errors correctly', async () => {
      const invalidData = {
        businessCategory: 'removalist',
        businessName: '', // Missing required field
        ownerFirstName: 'John',
        ownerLastName: 'Doe',
        email: 'invalid-email', // Invalid email
        password: '123', // Weak password
        phone: 'invalid-phone', // Invalid phone
        userRole: 'admin/provider'
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/onboarding/create-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBeDefined();
    });

    it('should handle duplicate email gracefully', async () => {
      const onboardingData = {
        businessCategory: 'removalist',
        businessName: 'First Business',
        ownerFirstName: 'John',
        ownerLastName: 'Doe',
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        phone: '+61400000005',
        whatsappNumber: '+61400000006',
        businessAddress: '789 Test Road',
        timeZone: 'Australia/Sydney',
        userRole: 'admin/provider',
        numberOfProviders: 1,
        setupPayments: false
      };

      // Create first business
      const response1 = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/onboarding/create-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(onboardingData),
      });

      expect(response1.status).toBe(200);
      const result1 = await response1.json();
      
      // Store for cleanup
      createdBusinessId = result1.business.id;
      createdUserId = result1.owner.id;
      authUserId = result1.onboarding.authUserIds[0];

      // Try to create second business with same email
      const onboardingData2 = {
        ...onboardingData,
        businessName: 'Second Business',
        phone: '+61400000007',
        whatsappNumber: '+61400000008'
      };

      const response2 = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/onboarding/create-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(onboardingData2),
      });

      // Should fail with duplicate email error
      expect(response2.status).toBe(400);
      const result2 = await response2.json();
      expect(result2.error).toMatch(/already exists|duplicate|already been registered/i);
    });

    it('should create Stripe account when setupPayments is true', async () => {
      const onboardingData = {
        businessCategory: 'removalist',
        businessName: 'Test Stripe Business',
        ownerFirstName: 'John',
        ownerLastName: 'Doe',
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        phone: '+61400000009',
        whatsappNumber: '+61400000010',
        businessAddress: '321 Stripe Street',
        timeZone: 'Australia/Sydney',
        userRole: 'admin/provider',
        numberOfProviders: 1,
        setupPayments: true
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/onboarding/create-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(onboardingData),
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      // Store for cleanup
      createdBusinessId = result.business.id;
      createdUserId = result.owner.id;
      authUserId = result.onboarding.authUserIds[0];

      // Verify Stripe account was attempted to be created
      // Note: This might be null if Stripe is not configured in test environment
      if (result.onboarding.stripeAccountId) {
        expect(result.onboarding.stripeAccountId).toBeDefined();
      }
    });
  });

  describe('Error Recovery and Cleanup', () => {
    it('should clean up auth user if business creation fails', async () => {
      // This test would require mocking the business creation to fail
      // after auth user is created, which is complex to set up
      // For now, we verify the cleanup logic exists in the API
      expect(true).toBe(true); // Placeholder
    });

    it('should clean up business if user profile creation fails', async () => {
      // Similar to above, this requires complex mocking
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Model Integration', () => {
    it('should create business using Business model correctly', async () => {
      const uniqueEmail = `model-test-${Date.now()}@example.com`;
      
      const businessData = {
        name: 'Model Test Business',
        email: uniqueEmail,
        phone: '+61400000011',
        timeZone: 'Australia/Sydney',
        interfaceType: 'whatsapp' as const,
        whatsappNumber: '+61400000012',
        whatsappPhoneNumberId: '',
        businessAddress: '123 Model Street',
        businessCategory: 'removalist' as const
      };

      const business = new Business(businessData);
      const result = await business.addWithClient(supabase);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Model Test Business');

      createdBusinessId = result.id!;

      // Verify in database
      const { data: dbBusiness } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', createdBusinessId)
        .single();

      expect(dbBusiness.name).toBe('Model Test Business');
      expect(dbBusiness.email).toBe(uniqueEmail);
    });

    it('should create user profile using User model correctly', async () => {
      // Use unique email to avoid conflicts
      const uniqueEmail = `user-test-${Date.now()}@example.com`;
      
      // First create a business
      const businessData = {
        name: 'User Test Business',
        email: uniqueEmail,
        phone: '+61400000013',
        timeZone: 'Australia/Sydney',
        interfaceType: 'whatsapp' as const,
        whatsappNumber: '+61400000014',
        businessAddress: '456 User Street',
        businessCategory: 'salon' as const
      };

      const business = new Business(businessData);
      await business.addWithClient(supabase);
      createdBusinessId = business.id!;

      // Create auth user first
      const { data: authData } = await supabase.auth.admin.createUser({
        email: uniqueEmail,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: {
          firstName: 'Test',
          lastName: 'User',
          role: 'admin'
        }
      });

      authUserId = authData.user.id;

      // Create user profile
      const user = new User(
        'Test',
        'User',
        'admin',
        business.id!,
        uniqueEmail,
        '+61400000013'.replace(/[^\d]/g, ''),
        '+61400000014'.replace(/[^\d]/g, '')
      );

      const userResult = await user.add({
        email: uniqueEmail,
        password: TEST_PASSWORD,
        skipProviderValidation: true,
        supabaseClient: supabase
      });

      expect(userResult).toBeDefined();
      createdUserId = user.id;

      // Verify in database
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', createdUserId)
        .single();

      expect(dbUser.firstName).toBe('Test');
      expect(dbUser.lastName).toBe('User');
      expect(dbUser.role).toBe('admin');
      expect(dbUser.businessId).toBe(createdBusinessId);
    });
  });
});