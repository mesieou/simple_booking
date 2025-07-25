import { describe, it, expect } from '@jest/globals';
import { 
  businessInfoSchema, 
  userRoleSchema, 
  businessCategorySchema,
  completeOnboardingSchema 
} from '@/lib/validations/onboarding';

describe('Onboarding Validation Schemas', () => {
  describe('businessCategorySchema', () => {
    it('should accept valid business categories', () => {
      expect(businessCategorySchema.parse('removalist')).toBe('removalist');
      expect(businessCategorySchema.parse('salon')).toBe('salon');
    });

    it('should reject invalid business categories', () => {
      expect(() => businessCategorySchema.parse('invalid')).toThrow();
      expect(() => businessCategorySchema.parse('')).toThrow();
      expect(() => businessCategorySchema.parse(null)).toThrow();
    });
  });

  describe('userRoleSchema', () => {
    it('should accept valid user roles', () => {
      expect(userRoleSchema.parse('admin')).toBe('admin');
      expect(userRoleSchema.parse('admin/provider')).toBe('admin/provider');
    });

    it('should reject invalid user roles', () => {
      expect(() => userRoleSchema.parse('customer')).toThrow();
      expect(() => userRoleSchema.parse('provider')).toThrow();
      expect(() => userRoleSchema.parse('super_admin')).toThrow();
      expect(() => userRoleSchema.parse('')).toThrow();
    });
  });

  describe('businessInfoSchema', () => {
    const validBusinessInfo = {
      businessCategory: 'removalist' as const,
      businessName: 'Test Removals',
      ownerFirstName: 'John',
      ownerLastName: 'Doe',
      email: 'john@example.com',
      phone: '+61400000001',
      whatsappNumber: '+61400000002',
      businessAddress: '123 Test Street, Sydney NSW 2000',
      websiteUrl: 'https://test.com',
      timeZone: 'Australia/Sydney',
      userRole: 'admin/provider' as const,
      numberOfProviders: 1
    };

    it('should accept valid business info', () => {
      const result = businessInfoSchema.parse(validBusinessInfo);
      expect(result.businessName).toBe('Test Removals');
      expect(result.userRole).toBe('admin/provider');
    });

    it('should reject invalid email', () => {
      const invalid = { ...validBusinessInfo, email: 'invalid-email' };
      expect(() => businessInfoSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhone = { ...validBusinessInfo, phone: 'invalid-phone' };
      expect(() => businessInfoSchema.parse(invalidPhone)).toThrow();
      
      const invalidWhatsApp = { ...validBusinessInfo, whatsappNumber: '123' };
      expect(() => businessInfoSchema.parse(invalidWhatsApp)).toThrow();
    });

    it('should reject short names', () => {
      const shortBusinessName = { ...validBusinessInfo, businessName: 'A' };
      expect(() => businessInfoSchema.parse(shortBusinessName)).toThrow();
      
      const shortFirstName = { ...validBusinessInfo, ownerFirstName: 'A' };
      expect(() => businessInfoSchema.parse(shortFirstName)).toThrow();
    });

    it('should accept optional website URL', () => {
      const withoutWebsite = { ...validBusinessInfo, websiteUrl: '' };
      const result = businessInfoSchema.parse(withoutWebsite);
      expect(result.websiteUrl).toBe('');

      const withWebsite = { ...validBusinessInfo, websiteUrl: 'https://example.com' };
      const result2 = businessInfoSchema.parse(withWebsite);
      expect(result2.websiteUrl).toBe('https://example.com');
    });

    it('should reject invalid website URLs', () => {
      const invalid = { ...validBusinessInfo, websiteUrl: 'not-a-url' };
      expect(() => businessInfoSchema.parse(invalid)).toThrow();
    });

    it('should require business address', () => {
      const invalid = { ...validBusinessInfo, businessAddress: '' };
      expect(() => businessInfoSchema.parse(invalid)).toThrow();
      
      const tooShort = { ...validBusinessInfo, businessAddress: 'ABC' };
      expect(() => businessInfoSchema.parse(tooShort)).toThrow();
    });

    it('should accept valid single provider setup', () => {
      const singleProvider = { ...validBusinessInfo, numberOfProviders: 1 };
      const result = businessInfoSchema.parse(singleProvider);
      expect(result.numberOfProviders).toBe(1);
      expect(result.providerNames).toBeUndefined();
    });

    it('should accept valid multi-provider setup with provider names', () => {
      const multiProvider = { 
        ...validBusinessInfo, 
        numberOfProviders: 3,
        providerNames: ['Provider Two', 'Provider Three']
      };
      const result = businessInfoSchema.parse(multiProvider);
      expect(result.numberOfProviders).toBe(3);
      expect(result.providerNames).toHaveLength(2);
      expect(result.providerNames).toEqual(['Provider Two', 'Provider Three']);
    });

    it('should reject numberOfProviders outside valid range', () => {
      const tooFew = { ...validBusinessInfo, numberOfProviders: 0 };
      expect(() => businessInfoSchema.parse(tooFew)).toThrow();
      
      const tooMany = { ...validBusinessInfo, numberOfProviders: 11 };
      expect(() => businessInfoSchema.parse(tooMany)).toThrow();
      
      const notInteger = { ...validBusinessInfo, numberOfProviders: 2.5 };
      expect(() => businessInfoSchema.parse(notInteger)).toThrow();
    });

    it('should require provider names when numberOfProviders > 1', () => {
      const missingNames = { ...validBusinessInfo, numberOfProviders: 2 };
      expect(() => businessInfoSchema.parse(missingNames)).toThrow();
      
      const wrongNameCount = { 
        ...validBusinessInfo, 
        numberOfProviders: 3,
        providerNames: ['Provider Two'] // Should have 2 names for 3 providers
      };
      expect(() => businessInfoSchema.parse(wrongNameCount)).toThrow();
    });

    it('should reject invalid provider names', () => {
      const shortName = { 
        ...validBusinessInfo, 
        numberOfProviders: 2,
        providerNames: ['A'] // Too short
      };
      expect(() => businessInfoSchema.parse(shortName)).toThrow();
      
      const longName = { 
        ...validBusinessInfo, 
        numberOfProviders: 2,
        providerNames: ['A'.repeat(51)] // Too long
      };
      expect(() => businessInfoSchema.parse(longName)).toThrow();
    });
  });

  describe('completeOnboardingSchema', () => {
    const validOnboardingData = {
      // Business info
      businessCategory: 'removalist' as const,
      businessName: 'Test Removals',
      ownerFirstName: 'John',
      ownerLastName: 'Doe',
      email: 'john@example.com',
      phone: '+61400000001',
      whatsappNumber: '+61400000002',
      businessAddress: '123 Test Street, Sydney NSW 2000',
      websiteUrl: 'https://test.com',
      timeZone: 'Australia/Sydney',
      userRole: 'admin/provider' as const,
      numberOfProviders: 1,
      
      // Services
      services: [{
        name: 'House Move',
        description: 'Complete house relocation service',
        basePrice: 500,
        durationMinutes: 240,
        category: 'moving',
        pricingType: 'fixed' as const
      }],
      
      // Calendar
      calendarSettings: {
        timeZone: 'Australia/Sydney',
        workDays: [1, 2, 3, 4, 5],
        workHoursStart: '09:00',
        workHoursEnd: '17:00',
        slotDuration: 60,
        bufferTime: 15,
        maxAdvanceDays: 30,
        minAdvanceHours: 24
      },
      
      // Payment
      paymentSetup: {
        setupPayments: false
      },
      
      // Auth
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
      agreeToTerms: true
    };

    it('should accept valid complete onboarding data', () => {
      const result = completeOnboardingSchema.parse(validOnboardingData);
      expect(result.businessName).toBe('Test Removals');
      expect(result.services).toHaveLength(1);
      expect(result.password).toBe('TestPassword123!');
    });

    it('should reject mismatched passwords', () => {
      const invalid = { 
        ...validOnboardingData, 
        confirmPassword: 'DifferentPassword123!' 
      };
      expect(() => completeOnboardingSchema.parse(invalid)).toThrow();
    });

    it('should reject weak passwords', () => {
      const weakPassword = { 
        ...validOnboardingData, 
        password: '123',
        confirmPassword: '123'
      };
      expect(() => completeOnboardingSchema.parse(weakPassword)).toThrow();
      
      const noUppercase = { 
        ...validOnboardingData, 
        password: 'testpassword123',
        confirmPassword: 'testpassword123'
      };
      expect(() => completeOnboardingSchema.parse(noUppercase)).toThrow();
    });

    it('should require agreement to terms', () => {
      const invalid = { ...validOnboardingData, agreeToTerms: false };
      expect(() => completeOnboardingSchema.parse(invalid)).toThrow();
    });

    it('should require at least one service', () => {
      const invalid = { ...validOnboardingData, services: [] };
      expect(() => completeOnboardingSchema.parse(invalid)).toThrow();
    });

    it('should validate calendar working hours', () => {
      const invalidHours = { 
        ...validOnboardingData, 
        calendarSettings: {
          ...validOnboardingData.calendarSettings,
          workHoursStart: '18:00',
          workHoursEnd: '09:00' // End before start
        }
      };
      expect(() => completeOnboardingSchema.parse(invalidHours)).toThrow();
    });

    it('should accept multi-provider onboarding data', () => {
      const multiProviderData = {
        ...validOnboardingData,
        numberOfProviders: 2,
        providerNames: ['Provider Two']
      };
      const result = completeOnboardingSchema.parse(multiProviderData);
      expect(result.numberOfProviders).toBe(2);
      expect(result.providerNames).toEqual(['Provider Two']);
    });

    it('should validate provider names in complete onboarding', () => {
      const invalidMultiProvider = {
        ...validOnboardingData,
        numberOfProviders: 3,
        providerNames: ['Provider Two'] // Missing one name
      };
      expect(() => completeOnboardingSchema.parse(invalidMultiProvider)).toThrow();
    });
  });
});