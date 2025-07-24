import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { 
  regenerateAllBusinessAvailability,
  computeAggregatedAvailability 
} from '@/lib/general-helpers/availability';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { addProviderToBusiness, removeProviderFromBusiness } from '@/lib/provider-management/provider-lifecycle';
import { 
  createTestBusiness, 
  cleanupTestData, 
  TestBusiness
} from '../helpers/availability-test-factory';

describe('Business Provider Changes - Performance Tests', () => {
  let testBusiness: TestBusiness;
  let createdBusinesses: TestBusiness[] = [];

  beforeAll(async () => {
    jest.setTimeout(120000); // 2 minutes for performance tests
  });

  afterAll(async () => {
    if (createdBusinesses.length > 0) {
      await cleanupTestData(createdBusinesses);
    }
  });

  beforeEach(async () => {
    // Start with a minimal business for scaling up
    testBusiness = await createTestBusiness('PerfTest', 1);
    createdBusinesses.push(testBusiness);
  });

  afterEach(async () => {
    if (testBusiness) {
      await cleanupTestData([testBusiness]);
      createdBusinesses = createdBusinesses.filter(b => b.business.id !== testBusiness.business.id);
    }
  });

  describe('Large Provider Operations', () => {
    it('should_handle_adding_multiple_providers_sequentially', async () => {
      const business = testBusiness.business;
      const targetProviderCount = 6; // Start with 1, add 5 more
      const initialCount = testBusiness.providers.length;
      
      console.log(`[Performance Test] Adding ${targetProviderCount - initialCount} providers sequentially`);
      
      const startTime = Date.now();
      
      for (let i = initialCount; i < targetProviderCount; i++) {
        const providerIndex = i + 1;
        console.log(`[Performance Test] Adding provider ${providerIndex}/${targetProviderCount}`);
        
        const result = await addProviderToBusiness(business.id, {
          firstName: `Provider`,
          lastName: `${providerIndex}`,
          email: `provider${providerIndex}-${Date.now()}@perftest.com`
        });
        
        expect(result.success).toBe(true);
        
        // Verify provider count after each addition
        const currentProviders = await CalendarSettings.getByBusiness(business.id, { useServiceRole: true });
        expect(currentProviders.length).toBe(i + 1);
      }
      
      const additionTime = Date.now() - startTime;
      console.log(`[Performance Test] ✅ Added ${targetProviderCount - initialCount} providers in ${additionTime}ms`);
      
      // Verify final provider count
      const finalProviders = await CalendarSettings.getByBusiness(business.id, { useServiceRole: true });
      expect(finalProviders.length).toBe(targetProviderCount);
      
      // Check that availability exists and reflects all providers
      const today = new Date();
      const availabilitySlots = await AvailabilitySlots.getByBusinessAndDateRange(
        business.id,
        today.toISOString().split('T')[0],
        new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        { useServiceRole: true }
      );
      
      expect(availabilitySlots.length).toBeGreaterThan(0);
      
      // Verify provider counts in slots
      const firstSlot = availabilitySlots[0];
      const duration60Slots = firstSlot.slots['60'] || [];
      if (duration60Slots.length > 0) {
        const [time, providerCount] = duration60Slots[0];
        console.log(`[Performance Test] Final provider count in availability: ${providerCount}`);
        expect(providerCount).toBe(targetProviderCount);
      }
      
      console.log('[Performance Test] ✅ Large provider addition test successful');
    });

    it('should_handle_removing_multiple_providers_sequentially', async () => {
      const business = testBusiness.business;
      const setupProviderCount = 5;
      
      // First add providers
      console.log(`[Performance Test] Setting up ${setupProviderCount} providers for removal test`);
      const addedProviders: string[] = [];
      
      for (let i = 1; i < setupProviderCount; i++) {
        const result = await addProviderToBusiness(business.id, {
          firstName: `RemovalTest`,
          lastName: `${i}`,
          email: `removal${i}-${Date.now()}@perftest.com`
        });
        expect(result.success).toBe(true);
        addedProviders.push(result.userId!);
      }
      
      // Note: Don't manually create availability - let the provider addition process handle it
      
      // Now remove providers one by one
      console.log(`[Performance Test] Removing ${addedProviders.length} providers sequentially`);
      const startTime = Date.now();
      
      for (let i = 0; i < addedProviders.length; i++) {
        const providerId = addedProviders[i];
        console.log(`[Performance Test] Removing provider ${i + 1}/${addedProviders.length}`);
        
        const result = await removeProviderFromBusiness(business.id, {
          userId: providerId,
          reason: 'admin_removal'
        });
        
        expect(result.success).toBe(true);
        
        // Verify provider count decreased
        const currentProviders = await CalendarSettings.getByBusiness(business.id, { useServiceRole: true });
        expect(currentProviders.length).toBe(setupProviderCount - i - 1);
      }
      
      const removalTime = Date.now() - startTime;
      console.log(`[Performance Test] ✅ Removed ${addedProviders.length} providers in ${removalTime}ms`);
      
      // Should be back to original count (1)
      const finalProviders = await CalendarSettings.getByBusiness(business.id, { useServiceRole: true });
      expect(finalProviders.length).toBe(1);
      
      console.log('[Performance Test] ✅ Large provider removal test successful');
    });
  });

  describe('Availability Regeneration Performance', () => {
    it('should_regenerate_availability_efficiently_with_many_providers', async () => {
      const business = testBusiness.business;
      const providerCount = 5;
      
      // Add providers
      console.log(`[Performance Test] Setting up business with ${providerCount} providers`);
      for (let i = 1; i < providerCount; i++) {
        const result = await addProviderToBusiness(business.id, {
          firstName: `Perf`,
          lastName: `Provider${i}`,
          email: `perf${i}-${Date.now()}@test.com`
        });
        expect(result.success).toBe(true);
      }
      
      // Measure regeneration performance (this will create availability if none exists)
      console.log('[Performance Test] Measuring availability regeneration performance');
      const startTime = Date.now();
      const today = new Date();
      
      await regenerateAllBusinessAvailability(business.id, { useServiceRole: true });
      
      const regenerationTime = Date.now() - startTime;
      console.log(`[Performance Test] Regeneration completed in ${regenerationTime}ms`);
      
      // Verify regeneration worked
      const afterRegeneration = await AvailabilitySlots.getByBusinessAndDateRange(
        business.id,
        today.toISOString().split('T')[0],
        new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        { useServiceRole: true }
      );
      
      expect(afterRegeneration.length).toBeGreaterThan(0);
      
      // Performance expectation: should complete within reasonable time
      expect(regenerationTime).toBeLessThan(30000); // 30 seconds max
      
      console.log('[Performance Test] ✅ Availability regeneration performance test passed');
    });
  });

  describe('Error Recovery', () => {
    it('should_recover_from_provider_addition_failures_gracefully', async () => {
      const business = testBusiness.business;
      
      console.log('[Error Recovery Test] Testing recovery from addition failures');
      
      // Add some providers successfully
      for (let i = 0; i < 2; i++) {
        const result = await addProviderToBusiness(business.id, {
          firstName: `Recovery`,
          lastName: `Provider${i}`,
          email: `recovery${i}-${Date.now()}@test.com`
        });
        expect(result.success).toBe(true);
      }
      
      // Verify providers were added
      const afterSuccess = await CalendarSettings.getByBusiness(business.id, { useServiceRole: true });
      expect(afterSuccess.length).toBe(3); // 1 original + 2 added
      
      // Try to add a provider with non-existent business ID (should fail)
      const invalidResult = await addProviderToBusiness('00000000-0000-0000-0000-000000000000', {
        firstName: 'Invalid',
        lastName: 'Provider', 
        email: `invalid-${Date.now()}@test.com`
      });
      
      expect(invalidResult.success).toBe(false);
      
      // Verify provider count unchanged after failure
      const afterFailure = await CalendarSettings.getByBusiness(business.id, { useServiceRole: true });
      expect(afterFailure.length).toBe(3); // Should remain the same
      
      // Continue with valid operations
      const recoveryResult = await addProviderToBusiness(business.id, {
        firstName: 'Recovery',
        lastName: 'Success',
        email: `recovery-success-${Date.now()}@test.com`
      });
      
      expect(recoveryResult.success).toBe(true);
      
      const finalCount = await CalendarSettings.getByBusiness(business.id, { useServiceRole: true });
      expect(finalCount.length).toBe(4); // Should have increased
      
      console.log('[Error Recovery Test] ✅ Graceful error recovery successful');
    });
  });
}); 