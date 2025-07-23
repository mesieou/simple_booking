import { getEnvironmentServiceRoleClient } from '@/lib/database/supabase/environment';
import { Business } from '@/lib/database/models/business';
import { User } from '@/lib/database/models/user';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { Booking } from '@/lib/database/models/booking';
import { Quote } from '@/lib/database/models/quote';
import { v4 as uuidv4 } from 'uuid';
// Service model removed - using direct database insertion for tests

export interface TestBusiness {
  business: Business;
  providers: User[];
  calendarSettings: CalendarSettings[];
  services: any[]; // Using any for test services to match database schema
}

export interface TestProvider {
  user: User;
  calendarSettings: CalendarSettings;
}

export const createTestBusiness = async (name: string, numberOfProviders: number = 1): Promise<TestBusiness> => {
  const supabase = getEnvironmentServiceRoleClient();
  
  // Create unique identifier to avoid duplicate constraints
  const uniqueId = Date.now() + Math.random().toString(36).substr(2, 9);
  const basePhone = '+61400' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  
  // Create business
  const business = new Business({
    name: `${name} Test Business ${uniqueId}`,
    email: `${name.toLowerCase()}-${uniqueId}@test.com`,
    phone: basePhone,
    timeZone: 'Australia/Sydney',
    interfaceType: 'whatsapp',
    whatsappNumber: basePhone.replace('+61400', '+61401'),
    businessAddress: '123 Test Street',
    websiteUrl: '',
    businessCategory: 'removalist' as any,
    depositPercentage: 25,
    stripeConnectAccountId: undefined,
    stripeAccountStatus: 'pending' as const,
    preferredPaymentMethod: 'cash'
  });
  
  await business.addWithClient(supabase);
  
  if (!business.id) {
    throw new Error('Failed to create business - no ID returned');
  }
  
  // Create providers
  const providers: User[] = [];
  const calendarSettings: CalendarSettings[] = [];
  
  for (let i = 0; i < numberOfProviders; i++) {
    const role = i === 0 ? 'admin/provider' : 'provider';
    const firstName = i === 0 ? 'Owner' : `Provider${i}`;
    const lastName = 'Test';
    
    // Create auth user first
    const userEmail = `${name.toLowerCase()}-${uniqueId}-provider${i}@test.com`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userEmail,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        role,
        isTest: true
      }
    });
    
    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user for provider ${i}: ${authError?.message}`);
    }
    
    // Create user profile
    const user = new User(
      firstName,
      lastName,
      role,
      business.id,
      userEmail
    );
    user.id = authData.user.id;
    
    await user.add({
      email: userEmail,
      password: 'TestPassword123!',
      skipProviderValidation: true,
      supabaseClient: supabase
    });
    
    providers.push(user);
    
    // Create calendar settings for providers
    if (role === 'admin/provider' || role === 'provider') {
      const workingHours = {
        mon: { start: '09:00', end: '17:00' },
        tue: { start: '09:00', end: '17:00' },
        wed: { start: '09:00', end: '17:00' },
        thu: { start: '09:00', end: '17:00' },
        fri: { start: '09:00', end: '17:00' },
        sat: null,
        sun: null
      };
      
      const calendarSettingsData = {
        userId: user.id,
        businessId: business.id,
        workingHours: workingHours,
        manageCalendar: false,
        settings: {
          timezone: 'Australia/Sydney',
          bufferTime: 15
        }
      };
      
      const calendarSetting = await CalendarSettings.save(undefined, calendarSettingsData, {
        useServiceRole: true,
        supabaseClient: supabase
      });
      
      calendarSettings.push(calendarSetting);
    }
  }
  
  // Create a test service using the actual database schema
  const serviceId = uuidv4();
  const { data: serviceData, error: serviceError } = await supabase
    .from('services')
    .insert({
      id: serviceId,
      businessId: business.id,
      name: 'Test Moving Service',
      description: 'Test moving service for availability tests',
      pricingType: 'fixed',
      fixedPrice: 500,
      durationEstimate: 120, // 2 hours  
      mobile: true
    })
    .select()
    .single();
    
  if (serviceError || !serviceData) {
    throw new Error(`Failed to create test service: ${serviceError?.message}`);
  }
  
  // Create a service instance for compatibility
  const service = { id: serviceData.id, ...serviceData };
  
  return {
    business,
    providers,
    calendarSettings,
    services: [service]
  };
};

export const createTestBooking = async (
  providerId: string,
  businessId: string,
  serviceId: string,
  dateTime: Date,
  durationMinutes: number = 120,
  customerId?: string
): Promise<{ booking: Booking; quote: Quote }> => {
  const supabase = getEnvironmentServiceRoleClient();
  
  // Create a customer user if not provided
  let userId = customerId;
  if (!userId) {
    // Use timestamp + random suffix to avoid concurrent email collisions
    const uniqueId = Date.now() + Math.random().toString(36).substr(2, 9);
    const customerEmail = `customer-${uniqueId}@test.com`;
    
    // Retry logic for auth user creation to handle concurrent conflicts
    let authData;
    let authError;
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      const result = await supabase.auth.admin.createUser({
        email: customerEmail,
        password: 'TestPassword123!',
        email_confirm: true,
        user_metadata: {
          firstName: 'Test',
          lastName: 'Customer',
          role: 'customer',
          isTest: true
        }
      });
      
      authData = result.data;
      authError = result.error;
      
      if (!authError && authData.user) {
        break; // Success, exit retry loop
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        // Wait with exponential backoff before retrying
        const delay = Math.pow(2, retryCount) * 100; // 200ms, 400ms, 800ms
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (authError || !authData?.user) {
      throw new Error(`Failed to create customer user after ${maxRetries} retries: ${authError?.message}`);
    }
    
    // Create customer profile
    const customer = new User(
      'Test',
      'Customer',
      'customer',
      businessId, // Associate with business for testing
      customerEmail
    );
    customer.id = authData.user.id;
    
    await customer.add({
      email: customerEmail,
      password: 'TestPassword123!',
      skipProviderValidation: true,
      supabaseClient: supabase
    });
    
    userId = authData.user.id;
  }
  
  // Create a quote first with serviceIds array
  const quote = new Quote({
    userId: userId,
    businessId,
    serviceIds: [serviceId], // Required array of service IDs
    pickUp: 'Test Pickup Location',
    dropOff: 'Test Dropoff Location',
    proposedDateTime: dateTime.toISOString(),
    totalJobCostEstimation: 500,
    travelCostEstimate: 50,
    travelTimeEstimate: 30, // Add the missing property
    totalJobDurationEstimation: durationMinutes,
    status: 'confirmed'
  });
  await quote.add();
  
  if (!quote.id) {
    throw new Error('Failed to create quote - no ID returned');
  }
  
  // Create booking
  const booking = new Booking({
    userId: userId,
    providerId: providerId,
    businessId: businessId,
    quoteId: quote.id,
    dateTime: dateTime.toISOString(),
    status: 'Not Completed'
  });
  await booking.add();
  
  return { booking, quote };
};

export const cleanupTestData = async (businesses: TestBusiness[]): Promise<void> => {
  const supabase = getEnvironmentServiceRoleClient();
  
  for (const testBusiness of businesses) {
    try {
      await cleanupSingleBusiness(testBusiness.business.id!, supabase);
      console.log(`✅ Cleaned up test business: ${testBusiness.business.name}`);
    } catch (error) {
      console.error(`❌ Error cleaning up business ${testBusiness.business.name}:`, error);
      // Continue with other businesses even if one fails
    }
  }
};

/**
 * Cleans up a single business and all its related data
 * Handles foreign key constraints by deleting in the correct order
 */
const cleanupSingleBusiness = async (businessId: string, supabase: any): Promise<void> => {
  // Delete in the correct order to respect foreign key constraints
  
  // 1. Delete bookings first (they reference quotes and providers)
  const { error: bookingsError } = await supabase
    .from('bookings')
    .delete()
    .eq('businessId', businessId);
  if (bookingsError) console.warn(`Warning cleaning up bookings: ${bookingsError.message}`);

  // 2. Delete quotes (they reference services and users)
  const { error: quotesError } = await supabase
    .from('quotes')
    .delete()
    .eq('businessId', businessId);
  if (quotesError) console.warn(`Warning cleaning up quotes: ${quotesError.message}`);

  // 3. Delete availability slots
  const { error: slotsError } = await supabase
    .from('availabilitySlots')
    .delete()
    .eq('businessId', businessId);
  if (slotsError) console.warn(`Warning cleaning up availability slots: ${slotsError.message}`);

  // 4. Delete services
  const { error: servicesError } = await supabase
    .from('services')
    .delete()
    .eq('businessId', businessId);
  if (servicesError) console.warn(`Warning cleaning up services: ${servicesError.message}`);

  // 5. Delete calendar settings
  const { error: calendarError } = await supabase
    .from('calendarSettings')
    .delete()
    .eq('businessId', businessId);
  if (calendarError) console.warn(`Warning cleaning up calendar settings: ${calendarError.message}`);

  // 6. Get all users for this business before deleting
  const { data: businessUsers, error: usersQueryError } = await supabase
    .from('users')
    .select('id, email')
    .eq('businessId', businessId);

  if (usersQueryError) {
    console.warn(`Warning querying users: ${usersQueryError.message}`);
  } else if (businessUsers && businessUsers.length > 0) {
    // Delete user profiles first, then auth users
    const { error: userProfilesError } = await supabase
      .from('users')
      .delete()
      .eq('businessId', businessId);
    if (userProfilesError) console.warn(`Warning cleaning up user profiles: ${userProfilesError.message}`);

    // Delete auth users with retry logic (this is often flaky)
    for (const user of businessUsers) {
      await deleteAuthUserWithRetry(user.id, supabase);
    }
  }

  // 7. Delete business last
  const { error: businessError } = await supabase
    .from('businesses')
    .delete()
    .eq('id', businessId);
  if (businessError) throw businessError; // This is a critical error
};

/**
 * Deletes an auth user with retry logic since this operation is often flaky
 */
const deleteAuthUserWithRetry = async (userId: string, supabase: any, maxRetries: number = 3): Promise<void> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (!error) {
        return; // Success
      }
      if (attempt === maxRetries) {
        console.warn(`Failed to delete auth user ${userId} after ${maxRetries} attempts: ${error.message}`);
      }
    } catch (error) {
      if (attempt === maxRetries) {
        console.warn(`Failed to delete auth user ${userId} after ${maxRetries} attempts:`, error);
      }
    }
    
    if (attempt < maxRetries) {
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
    }
  }
};

/**
 * Comprehensive cleanup function that removes ALL test data
 * Use this when you want to clean up everything, not just specific businesses
 */
export const cleanupAllTestData = async (): Promise<void> => {
  const supabase = getEnvironmentServiceRoleClient();
  console.log('🧹 Starting comprehensive test data cleanup...');

  try {
    // Find all test businesses (they have "Test Business" in the name or test emails)
    const { data: testBusinesses, error: businessQueryError } = await supabase
      .from('businesses')
      .select('id, name, email')
      .or('name.ilike.%Test Business%,email.ilike.%@test.com');

    if (businessQueryError) {
      console.error('Error querying test businesses:', businessQueryError);
      return;
    }

    if (!testBusinesses || testBusinesses.length === 0) {
      console.log('No test businesses found to clean up');
      return;
    }

    console.log(`Found ${testBusinesses.length} test businesses to clean up`);

    // Clean up each business
    for (const business of testBusinesses) {
      try {
        await cleanupSingleBusiness(business.id, supabase);
        console.log(`✅ Cleaned up business: ${business.name}`);
      } catch (error) {
        console.error(`❌ Error cleaning up business ${business.name}:`, error);
      }
    }

    // Additional cleanup for orphaned test data
    await cleanupOrphanedTestData(supabase);

    console.log('🎉 Comprehensive cleanup completed');
  } catch (error) {
    console.error('❌ Error in comprehensive cleanup:', error);
  }
};

/**
 * Cleans up orphaned test data that might not be linked to test businesses
 */
const cleanupOrphanedTestData = async (supabase: any): Promise<void> => {
  console.log('🧹 Cleaning up orphaned test data...');

  // Clean up test customer users that might not be linked to businesses
  const { data: testCustomers } = await supabase
    .from('users')
    .select('id, email')
    .like('email', '%@test.com')
    .eq('role', 'customer');

  if (testCustomers && testCustomers.length > 0) {
    console.log(`Cleaning up ${testCustomers.length} orphaned test customers`);
    
    // Delete user profiles
    await supabase
      .from('users')
      .delete()
      .like('email', '%@test.com')
      .eq('role', 'customer');

    // Delete auth users
    for (const customer of testCustomers) {
      await deleteAuthUserWithRetry(customer.id, supabase);
    }
  }

  // Clean up any remaining auth users with test emails
  try {
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    if (authUsers?.users) {
      const testAuthUsers = authUsers.users.filter((user: any) => 
        user.email && user.email.includes('@test.com')
      );
      
      console.log(`Cleaning up ${testAuthUsers.length} orphaned auth users`);
      for (const user of testAuthUsers) {
        await deleteAuthUserWithRetry(user.id, supabase);
      }
    }
  } catch (error) {
    console.warn('Could not clean up auth users:', error);
  }
};

/**
 * Quick cleanup function for use in test teardown
 * This is more aggressive and faster than the comprehensive cleanup
 */
export const quickCleanupTestData = async (): Promise<void> => {
  const supabase = getEnvironmentServiceRoleClient();
  console.log('⚡ Quick test data cleanup...');

  try {
    // Delete in bulk without individual business tracking
    const tables = [
      'bookings',
      'quotes', 
      'availabilitySlots',
      'services',
      'calendarSettings'
    ];

    // Get test business IDs first
    const { data: testBusinesses } = await supabase
      .from('businesses')
      .select('id')
      .or('name.ilike.%Test Business%,email.ilike.%@test.com');

    if (testBusinesses && testBusinesses.length > 0) {
      const businessIds = testBusinesses.map(b => b.id);
      
      // Delete from tables that reference businesses with test data
      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .in('businessId', businessIds);
        
        if (error) {
          console.warn(`Warning cleaning up ${table}:`, error);
        }
      }
    }

    // Delete test users
    await supabase
      .from('users')
      .delete()
      .like('email', '%@test.com');

    // Delete test businesses
    await supabase
      .from('businesses')
      .delete()
      .or('name.ilike.%Test Business%,email.ilike.%@test.com');

    console.log('⚡ Quick cleanup completed');
  } catch (error) {
    console.error('❌ Error in quick cleanup:', error);
  }
};

export const expectAvailabilitySlots = (slots: AvailabilitySlots, expectedDate: string, expectedBusinessId: string) => {
  expect(slots.date).toBe(expectedDate);
  expect(slots.businessId).toBe(expectedBusinessId);
  expect(slots.slots).toBeDefined();
  expect(Object.keys(slots.slots).length).toBeGreaterThan(0);
};

export const expectNoAvailabilitySlots = (slots: AvailabilitySlots[] | null) => {
  expect(slots).toEqual([]);
}; 

/**
 * Aggressively cleans up ALL test auth users
 * This is more thorough than the business-specific cleanup
 */
export const cleanupAllTestAuthUsers = async (): Promise<void> => {
  const supabase = getEnvironmentServiceRoleClient();
  console.log('🧹 Starting aggressive test auth user cleanup...');

  try {
    // Get ALL auth users with pagination support
    let allUsers: any[] = [];
    let page = 1;
    const perPage = 1000; // Max per page for Supabase
    
    console.log('📄 Fetching all auth users with pagination...');
    
    while (true) {
      const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers({
        page: page,
        perPage: perPage
      });
      
      if (listError) {
        console.error(`Failed to list auth users (page ${page}):`, listError);
        break;
      }

      if (!authUsers?.users || authUsers.users.length === 0) {
        console.log(`📄 Page ${page}: No more users found`);
        break;
      }

      console.log(`📄 Page ${page}: Found ${authUsers.users.length} users`);
      allUsers.push(...authUsers.users);
      
      // If we got less than perPage users, we've reached the end
      if (authUsers.users.length < perPage) {
        break;
      }
      
      page++;
    }

    console.log(`📊 Total auth users found across all pages: ${allUsers.length}`);

    if (allUsers.length === 0) {
      console.log('No auth users found');
      return;
    }

    // Show sample of users for debugging
    console.log('📋 Sample of first 10 users found:');
    allUsers.slice(0, 10).forEach((user: any, index: number) => {
      console.log(`  ${index + 1}. ${user.email} (${user.user_metadata?.firstName || 'no-name'})`);
    });

    // Filter test users by email patterns and metadata
    const testUsers = allUsers.filter((user: any) => {
      const email = user.email || '';
      const metadata = user.user_metadata || {};
      const displayName = user.user_metadata?.firstName || '';
      
      // Skip real users (like Luisa)
      if (email === 'luisa.dev@beautyasiul.com' || email.includes('beautyasiul')) {
        return false;
      }
      
      return (
        // Email domain patterns
        email.includes('@test.com') ||
        
        // Email prefix patterns (from availability tests)
        email.includes('test-') ||
        email.includes('provider') ||
        email.includes('customer-') ||
        email.includes('multicalendarchanges') ||
        email.includes('calendarbusiness') ||
        email.includes('bookingbusiness') ||
        email.includes('singlerollover') ||
        email.includes('multirollover') ||
        email.includes('multibooking') ||
        email.includes('bookingimpact') ||
        email.includes('business-') ||
        email.includes('-provider') ||
        
        // Patterns with timestamps (like 175327492...)
        /[a-zA-Z]+-\d{13,}/.test(email) ||
        
        // Display name patterns
        displayName.includes('Test') ||
        displayName.includes('Provider') ||
        displayName.includes('Owner') ||
        displayName.includes('Customer') ||
        
        // Metadata patterns
        metadata.isTest === true ||
        metadata.role === 'provider' ||
        metadata.role === 'customer' ||
        metadata.role === 'admin/provider'
      );
    });

    console.log(`Found ${testUsers.length} test auth users to delete out of ${allUsers.length} total users`);

    if (testUsers.length === 0) {
      console.log('No test auth users found to clean up');
      return;
    }

    // Delete test users in batches to avoid overwhelming the API
    const batchSize = 10;
    let deletedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < testUsers.length; i += batchSize) {
      const batch = testUsers.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(testUsers.length/batchSize)} (${batch.length} users)`);

      const deletePromises = batch.map(async (user: any) => {
        try {
          const { error } = await supabase.auth.admin.deleteUser(user.id);
          if (error) {
            console.warn(`Failed to delete user ${user.email}: ${error.message}`);
            return { success: false, user: user.email };
          }
          return { success: true, user: user.email };
        } catch (error) {
          console.warn(`Exception deleting user ${user.email}:`, error);
          return { success: false, user: user.email };
        }
      });

      const results = await Promise.all(deletePromises);
      
      const batchSuccess = results.filter(r => r.success).length;
      const batchFailed = results.filter(r => !r.success).length;
      
      deletedCount += batchSuccess;
      failedCount += batchFailed;

      console.log(`✅ Batch completed: ${batchSuccess} deleted, ${batchFailed} failed`);

      // Wait between batches to avoid rate limiting
      if (i + batchSize < testUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`🎉 Auth user cleanup completed: ${deletedCount} deleted, ${failedCount} failed`);

    if (failedCount > 0) {
      console.warn(`⚠️ ${failedCount} auth users could not be deleted. They may need manual cleanup.`);
    }

  } catch (error) {
    console.error('❌ Error in auth user cleanup:', error);
    throw error;
  }
};

/**
 * Enhanced comprehensive cleanup that includes aggressive auth user cleanup
 */
export const cleanupAllTestDataWithAuthUsers = async (): Promise<void> => {
  console.log('🧹 Starting COMPREHENSIVE test data and auth user cleanup...');
  
  try {
    // First clean up database records
    await cleanupAllTestData();
    
    // Then aggressively clean up auth users
    await cleanupAllTestAuthUsers();
    
    console.log('🎉 Comprehensive cleanup with auth users completed!');
  } catch (error) {
    console.error('❌ Error in comprehensive cleanup:', error);
    throw error;
  }
}; 