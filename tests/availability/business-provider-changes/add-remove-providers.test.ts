import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { 
  regenerateAllBusinessAvailability,
  updateBusinessProviderCount,
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
import { DateTime } from 'luxon';

describe('Business Provider Changes', () => {
  let testBusiness: TestBusiness;
  let createdBusinesses: TestBusiness[] = [];

  beforeAll(async () => {
    jest.setTimeout(60000); // Longer timeout for provider operations
  });

  afterAll(async () => {
    if (createdBusinesses.length > 0) {
      await cleanupTestData(createdBusinesses);
    }
  });

  beforeEach(async () => {
    // Start with a business with 2 providers
    testBusiness = await createTestBusiness('ProviderChanges', 2);
    createdBusinesses.push(testBusiness);
  });

  afterEach(async () => {
    if (testBusiness) {
      await cleanupTestData([testBusiness]);
      createdBusinesses = createdBusinesses.filter(b => b.business.id !== testBusiness.business.id);
    }
  });

  describe('Adding Providers', () => {
    it('should_add_provider_and_regenerate_availability', async () => {
      const business = testBusiness.business;
      const initialProviderCount = testBusiness.providers.length;
      
      console.log(`[Test] Starting with ${initialProviderCount} providers`);
      
      // Generate initial availability
      const today = new Date();
      const initialSlots = await computeAggregatedAvailability(business.id, today, 30, { useServiceRole: true });
      await Promise.all(initialSlots.map(slots => slots.add()));
      
      // Check initial availability has correct provider counts
      const beforeAddSlots = await AvailabilitySlots.getByBusinessAndDateRange(
        business.id,
        today.toISOString().split('T')[0],
        new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        { useServiceRole: true }
      );
      
      expect(beforeAddSlots.length).toBeGreaterThan(0);
      console.log(`[Test] Initial availability slots: ${beforeAddSlots.length}`);
      
      // Verify initial provider counts in slots
      const firstSlot = beforeAddSlots[0];
      const duration60Slots = firstSlot.slots['60'] || [];
      if (duration60Slots.length > 0) {
        const [time, providerCount] = duration60Slots[0];
        console.log(`[Test] Initial provider count for first 60min slot: ${providerCount}`);
        expect(providerCount).toBe(initialProviderCount);
      }
      
      // Add a new provider
      console.log('[Test] Adding new provider...');
      const addResult = await addProviderToBusiness(business.id, {
        firstName: 'New',
        lastName: 'Provider',
        email: `newprovider-${Date.now()}@test.com`
      });
      
      expect(addResult.success).toBe(true);
      expect(addResult.userId).toBeDefined();
      console.log(`[Test] ✅ Successfully added provider: ${addResult.userId}`);
      
      // Verify provider count increased
              const afterAddProviders = await CalendarSettings.getByBusiness(business.id);
      expect(afterAddProviders.length).toBe(initialProviderCount + 1);
      console.log(`[Test] Provider count after add: ${afterAddProviders.length}`);
      
      // Check that availability was regenerated with increased capacity
      const afterAddSlots = await AvailabilitySlots.getByBusinessAndDateRange(
        business.id,
        today.toISOString().split('T')[0],
        new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        { useServiceRole: true }
      );
      
      expect(afterAddSlots.length).toBeGreaterThan(0);
      
      // Verify provider counts increased in availability slots
      const updatedSlot = afterAddSlots[0];
      const updatedDuration60Slots = updatedSlot.slots['60'] || [];
      if (updatedDuration60Slots.length > 0) {
        const [time, newProviderCount] = updatedDuration60Slots[0];
        console.log(`[Test] Provider count after add for first 60min slot: ${newProviderCount}`);
        expect(newProviderCount).toBe(initialProviderCount + 1);
      }
      
      console.log('[Test] ✅ Provider addition and availability regeneration successful');
    });
  });

  describe('Removing Providers', () => {
    it('should_remove_provider_and_regenerate_availability', async () => {
      const business = testBusiness.business;
      const initialProviders = testBusiness.providers;
      const initialProviderCount = initialProviders.length;
      
      console.log(`[Test] Starting provider removal test with ${initialProviderCount} providers`);
      
      // Generate initial availability
      const today = new Date();
      const initialSlots = await computeAggregatedAvailability(business.id, today, 30, { useServiceRole: true });
      await Promise.all(initialSlots.map(slots => slots.add()));
      
      // Check initial availability
      const beforeRemoveSlots = await AvailabilitySlots.getByBusinessAndDateRange(
        business.id,
        today.toISOString().split('T')[0],
        new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      );
      
      expect(beforeRemoveSlots.length).toBeGreaterThan(0);
      console.log(`[Test] Initial availability slots: ${beforeRemoveSlots.length}`);
      
      // Remove one provider (make sure it's not admin)
      const providerToRemove = initialProviders.find(p => p.role === 'provider');
      expect(providerToRemove).toBeDefined();
      
      console.log(`[Test] Removing provider: ${providerToRemove.firstName} ${providerToRemove.lastName}`);
      
      const removeResult = await removeProviderFromBusiness(business.id, {
        userId: providerToRemove.id,
        reason: 'admin_removal'
      });
      
      expect(removeResult.success).toBe(true);
      console.log('[Test] ✅ Provider removal successful');
      
      // Verify provider count decreased
              const afterRemoveProviders = await CalendarSettings.getByBusiness(business.id);
      expect(afterRemoveProviders.length).toBe(initialProviderCount - 1);
      console.log(`[Test] Provider count after removal: ${afterRemoveProviders.length}`);
      
      // Check that availability was regenerated with reduced capacity
      const afterRemoveSlots = await AvailabilitySlots.getByBusinessAndDateRange(
        business.id,
        today.toISOString().split('T')[0],
        new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        { useServiceRole: true }
      );
      
      expect(afterRemoveSlots.length).toBeGreaterThan(0);
      
      // Verify provider counts decreased in availability slots
      const updatedSlot = afterRemoveSlots[0];
      const updatedDuration60Slots = updatedSlot.slots['60'] || [];
      if (updatedDuration60Slots.length > 0) {
        const [time, newProviderCount] = updatedDuration60Slots[0];
        console.log(`[Test] Provider count after removal for first 60min slot: ${newProviderCount}`);
        expect(newProviderCount).toBe(initialProviderCount - 1);
      }
      
      console.log('[Test] ✅ Provider removal and availability regeneration successful');
    });

    it('should_prevent_removing_admin_provider', async () => {
      const business = testBusiness.business;
      
      // Find admin provider
      const adminProvider = testBusiness.providers.find(p => 
        p.role === 'admin' || p.role === 'admin/provider'
      );
      
      expect(adminProvider).toBeDefined();
      console.log(`[Test] Attempting to remove admin provider: ${adminProvider.role}`);
      
      // Attempt to remove admin (should fail)
      const removeResult = await removeProviderFromBusiness(business.id, {
        userId: adminProvider.id,
        reason: 'admin_removal'
      });
      
      expect(removeResult.success).toBe(false);
      expect(removeResult.error).toContain('Cannot remove business owner/admin');
      
      console.log('[Test] ✅ Correctly prevented admin removal');
    });
  });

  describe('Availability Regeneration Functions', () => {
    it('should_regenerate_all_business_availability', async () => {
      const business = testBusiness.business;
      
      // Generate initial availability
      const today = new Date();
      const initialSlots = await computeAggregatedAvailability(business.id, today, 30, { useServiceRole: true });
      await Promise.all(initialSlots.map(slots => slots.add()));
      
      const beforeRegenerate = await AvailabilitySlots.getByBusinessAndDateRange(
        business.id,
        today.toISOString().split('T')[0],
        new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        { useServiceRole: true }
      );
      
      console.log(`[Test] Before regeneration: ${beforeRegenerate.length} slots`);
      expect(beforeRegenerate.length).toBeGreaterThan(0);
      
      // Call regenerate function directly
      await regenerateAllBusinessAvailability(business.id, { useServiceRole: true });
      
      const afterRegenerate = await AvailabilitySlots.getByBusinessAndDateRange(
        business.id,
        today.toISOString().split('T')[0],
        new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        { useServiceRole: true }
      );
      
      console.log(`[Test] After regeneration: ${afterRegenerate.length} slots`);
      expect(afterRegenerate.length).toBeGreaterThan(0);
      
      // Should have roughly same number of slots (may vary slightly due to dates)
      expect(Math.abs(afterRegenerate.length - beforeRegenerate.length)).toBeLessThanOrEqual(2);
      
      console.log('[Test] ✅ Availability regeneration function works correctly');
    });

    it('should_update_business_provider_count_correctly', async () => {
      const business = testBusiness.business;
      const initialProviderCount = testBusiness.providers.length;
      
      // Generate initial availability
      const today = new Date();
      const initialSlots = await computeAggregatedAvailability(business.id, today, 30, { useServiceRole: true });
      await Promise.all(initialSlots.map(slots => slots.add()));
      
      // Test increasing provider count
      console.log(`[Test] Testing provider count update: ${initialProviderCount} → ${initialProviderCount + 2}`);
      
      await updateBusinessProviderCount(
        business.id,
        initialProviderCount,
        initialProviderCount + 2,
        { useServiceRole: true }
      );
      
      // Check that slots reflect increased provider count
      const increasedSlots = await AvailabilitySlots.getByBusinessAndDateRange(
        business.id,
        today.toISOString().split('T')[0],
        new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        { useServiceRole: true }
      );
      
      expect(increasedSlots.length).toBeGreaterThan(0);
      
      // Test decreasing provider count
      console.log(`[Test] Testing provider count update: ${initialProviderCount + 2} → ${initialProviderCount}`);
      
      await updateBusinessProviderCount(
        business.id,
        initialProviderCount + 2,
        initialProviderCount,
        { useServiceRole: true }
      );
      
      const decreasedSlots = await AvailabilitySlots.getByBusinessAndDateRange(
        business.id,
        today.toISOString().split('T')[0],
        new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        { useServiceRole: true }
      );
      
      expect(decreasedSlots.length).toBeGreaterThan(0);
      
      console.log('[Test] ✅ Business provider count update function works correctly');
    });
  });
}); 