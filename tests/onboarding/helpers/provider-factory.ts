interface OnboardingTestData {
  businessCategory: 'removalist' | 'salon';
  businessName: string;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  password: string;
  phone: string;
  whatsappNumber: string;
  businessAddress: string;
  websiteUrl?: string;
  timeZone: string;
  userRole: 'admin' | 'admin/provider';
  numberOfProviders: number;
  providerNames?: string[];
  setupPayments: boolean;
}

export const createSingleAdminProviderData = (email: string = 'test@example.com'): OnboardingTestData => ({
  businessCategory: 'removalist',
  businessName: 'Single Admin Provider Removals',
  ownerFirstName: 'John',
  ownerLastName: 'Doe',
  email: email,
  password: 'TestPassword123!',
  phone: '+61400000001',
  whatsappNumber: '+61400000002',
  businessAddress: '123 Admin Provider Street, Sydney NSW 2000',
  websiteUrl: 'https://single-admin-provider.com',
  timeZone: 'Australia/Sydney',
  userRole: 'admin/provider',
  numberOfProviders: 1,
  setupPayments: false
});

export const createAdminPlusProviderData = (email: string = 'test@example.com'): OnboardingTestData => ({
  businessCategory: 'salon',
  businessName: 'Admin Plus Provider Salon',
  ownerFirstName: 'Jane',
  ownerLastName: 'Smith',
  email: email,
  password: 'TestPassword123!',
  phone: '+61400000003',
  whatsappNumber: '+61400000004',
  businessAddress: '456 Admin Manager Lane, Melbourne VIC 3000',
  timeZone: 'Australia/Melbourne',
  userRole: 'admin',
  numberOfProviders: 2,
  providerNames: ['Sarah Johnson'],
  setupPayments: false
});

export const createAdminProviderPlusProviderData = (email: string = 'test@example.com'): OnboardingTestData => ({
  businessCategory: 'removalist',
  businessName: 'Multi Provider Removals',
  ownerFirstName: 'Mike',
  ownerLastName: 'Wilson',
  email: email,
  password: 'TestPassword123!',
  phone: '+61400000005',
  whatsappNumber: '+61400000006',
  businessAddress: '789 Multi Provider Road, Brisbane QLD 4000',
  websiteUrl: 'https://multi-provider-removals.com',
  timeZone: 'Australia/Brisbane',
  userRole: 'admin/provider',
  numberOfProviders: 2,
  providerNames: ['Alex Thompson'],
  setupPayments: false
});

export const validateBusinessCreationResult = (result: any, expectedData: OnboardingTestData) => {
  // Basic structure validation
  expect(result.success).toBe(true);
  expect(result.business).toBeDefined();
  expect(result.business.id).toBeDefined();
  expect(result.business.name).toBe(expectedData.businessName);
  expect(result.owner).toBeDefined();
  expect(result.owner.id).toBeDefined();
  expect(result.owner.role).toBe(expectedData.userRole);
  expect(result.owner.firstName).toBe(expectedData.ownerFirstName);
  expect(result.owner.lastName).toBe(expectedData.ownerLastName);
  
  // Multi-provider specific validation
  expect(result.providers).toBeDefined();
  expect(result.providers.length).toBe(expectedData.numberOfProviders);
  
  // Calendar settings are created via existing calendarSettings table, so no special response validation needed
  
  return {
    businessId: result.business.id,
    userId: result.owner.id,
    authUserId: result.onboarding.authUserIds[0] // First auth user is the owner
  };
}; 