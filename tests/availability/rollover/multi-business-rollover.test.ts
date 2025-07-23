import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { 
  rollAggregatedAvailability, 
  computeAggregatedAvailability 
} from '@/lib/general-helpers/availability';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { 
  createTestBusiness, 
  cleanupTestData, 
  TestBusiness,
  expectAvailabilitySlots
} from '../helpers/availability-test-factory';
import { DateTime } from 'luxon';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';

describe('Multi Business Rollover', () => {
  let businessA: TestBusiness;
  let businessB: TestBusiness;
  let businessC: TestBusiness;
  let createdBusinesses: TestBusiness[] = [];

  beforeAll(async () => {
    jest.setTimeout(45000); // Longer timeout for multiple businesses
  });

  afterAll(async () => {
    if (createdBusinesses.length > 0) {
      await cleanupTestData(createdBusinesses);
    }
  });

  beforeEach(async () => {
    // Create multiple businesses with different configurations
    businessA = await createTestBusiness('BusinessA', 1); // Single provider
    businessB = await createTestBusiness('BusinessB', 2); // Two providers
    businessC = await createTestBusiness('BusinessC', 3); // Three providers
    
    createdBusinesses.push(businessA, businessB, businessC);
  });

  afterEach(async () => {
    if (createdBusinesses.length > 0) {
      await cleanupTestData(createdBusinesses);
      createdBusinesses = [];
    }
  });

  it('should_rollover_business_A_without_affecting_business_B', async () => {
    const today = new Date();
    
    // Generate initial availability for both businesses
    const businessA_initial = await computeAggregatedAvailability(
      businessA.business.id,
      today,
      30
    );
    
    const businessB_initial = await computeAggregatedAvailability(
      businessB.business.id,
      today,
      30
    );

    expect(businessA_initial.length).toBeGreaterThan(0);
    expect(businessB_initial.length).toBeGreaterThan(0);
    
    console.log(`[Test] Business A initial slots: ${businessA_initial.length}`);
    console.log(`[Test] Business B initial slots: ${businessB_initial.length}`);

    // Store initial counts
    const businessB_initialCount = businessB_initial.length;

    // Roll availability for Business A only
    await rollAggregatedAvailability(businessA.business.id, { useServiceRole: true });

    // Verify Business A has rolled over
    const businessA_after = await computeAggregatedAvailability(
      businessA.business.id,
      today,
      30
    );
    
    // Verify Business B is unchanged
    const businessB_after = await computeAggregatedAvailability(
      businessB.business.id,
      today,
      30
    );

    expect(businessA_after.length).toBeGreaterThan(0);
    expect(businessB_after.length).toBe(businessB_initialCount);
    
    // Verify business IDs are correct
    businessA_after.forEach(slot => {
      expect(slot.businessId).toBe(businessA.business.id);
    });
    
    businessB_after.forEach(slot => {
      expect(slot.businessId).toBe(businessB.business.id);
    });
    
    console.log(`[Test] After rollover A: Business A: ${businessA_after.length}, Business B: ${businessB_after.length} (unchanged)`);
  });

  it('should_handle_rollover_for_multiple_businesses_simultaneously', async () => {
    const today = new Date();
    
    // Generate initial availability for all businesses
    const initialResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, today, 30),
      computeAggregatedAvailability(businessB.business.id, today, 30),
      computeAggregatedAvailability(businessC.business.id, today, 30)
    ]);

    const [businessA_initial, businessB_initial, businessC_initial] = initialResults;
    
    expect(businessA_initial.length).toBeGreaterThan(0);
    expect(businessB_initial.length).toBeGreaterThan(0);
    expect(businessC_initial.length).toBeGreaterThan(0);

    // Roll availability for all businesses simultaneously
    await Promise.all([
      rollAggregatedAvailability(businessA.business.id, { useServiceRole: true }),
      rollAggregatedAvailability(businessB.business.id, { useServiceRole: true }),
      rollAggregatedAvailability(businessC.business.id, { useServiceRole: true })
    ]);

    // Verify all businesses have maintained availability
    const afterResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, today, 30),
      computeAggregatedAvailability(businessB.business.id, today, 30),
      computeAggregatedAvailability(businessC.business.id, today, 30)
    ]);

    const [businessA_after, businessB_after, businessC_after] = afterResults;

    expect(businessA_after.length).toBeGreaterThan(0);
    expect(businessB_after.length).toBeGreaterThan(0);
    expect(businessC_after.length).toBeGreaterThan(0);

    // Verify business IDs remain isolated
    businessA_after.forEach(slot => expect(slot.businessId).toBe(businessA.business.id));
    businessB_after.forEach(slot => expect(slot.businessId).toBe(businessB.business.id));
    businessC_after.forEach(slot => expect(slot.businessId).toBe(businessC.business.id));

    console.log(`[Test] Simultaneous rollover results: A:${businessA_after.length}, B:${businessB_after.length}, C:${businessC_after.length}`);
  });

  it('should_isolate_provider_availability_by_business', async () => {
    const today = new Date();
    
    // Verify each business has the expected number of providers
    expect(businessA.providers.length).toBe(1);
    expect(businessB.providers.length).toBe(2);
    expect(businessC.providers.length).toBe(3);

    // Generate availability for all businesses
    const availabilityResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, today, 7),
      computeAggregatedAvailability(businessB.business.id, today, 7),
      computeAggregatedAvailability(businessC.business.id, today, 7)
    ]);

    const [businessA_slots, businessB_slots, businessC_slots] = availabilityResults;

    // Verify provider counts reflect business size
    const checkProviderCounts = (slots: AvailabilitySlots[], expectedMaxProviders: number, businessName: string) => {
      if (slots.length > 0) {
        const sampleSlot = slots[0];
        const slotValues = Object.values(sampleSlot.slots);
        if (slotValues.length > 0) {
          const timeSlots = slotValues[0] as Array<[string, number]>;
          if (timeSlots.length > 0) {
            const [time, providerCount] = timeSlots[0];
            expect(providerCount).toBeGreaterThanOrEqual(1);
            expect(providerCount).toBeLessThanOrEqual(expectedMaxProviders);
            console.log(`[Test] ${businessName} at ${time}: ${providerCount}/${expectedMaxProviders} providers`);
          }
        }
      }
    };

    checkProviderCounts(businessA_slots, 1, 'Business A');
    checkProviderCounts(businessB_slots, 2, 'Business B');
    checkProviderCounts(businessC_slots, 3, 'Business C');

    // Rollover all businesses
    await Promise.all([
      rollAggregatedAvailability(businessA.business.id, { useServiceRole: true }),
      rollAggregatedAvailability(businessB.business.id, { useServiceRole: true }),
      rollAggregatedAvailability(businessC.business.id, { useServiceRole: true })
    ]);

    // Verify isolation is maintained after rollover
    const afterRolloverResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, today, 7),
      computeAggregatedAvailability(businessB.business.id, today, 7),
      computeAggregatedAvailability(businessC.business.id, today, 7)
    ]);

    const [businessA_after, businessB_after, businessC_after] = afterRolloverResults;

    // Verify each business still has its own availability
    expect(businessA_after.length).toBeGreaterThan(0);
    expect(businessB_after.length).toBeGreaterThan(0);
    expect(businessC_after.length).toBeGreaterThan(0);

    // Verify no cross-contamination of business IDs
    const allBusinessIds = new Set([
      ...businessA_after.map(s => s.businessId),
      ...businessB_after.map(s => s.businessId),
      ...businessC_after.map(s => s.businessId)
    ]);

    expect(allBusinessIds.size).toBe(3); // Should have exactly 3 unique business IDs
    expect(allBusinessIds.has(businessA.business.id)).toBe(true);
    expect(allBusinessIds.has(businessB.business.id)).toBe(true);
    expect(allBusinessIds.has(businessC.business.id)).toBe(true);

    console.log(`[Test] Isolation maintained: ${allBusinessIds.size} unique businesses with separate availability`);
  });

  it('should_handle_different_timezones_across_businesses', async () => {
    // Note: For this test, we'll modify the calendar settings to simulate different timezones
    // In practice, all test businesses use Australia/Sydney, but we can verify isolation
    
    const today = new Date();
    
    // Modify Business B to have different working hours (simulating timezone effect)
    const businessB_settings = businessB.calendarSettings[0];
    const differentHours = {
      mon: { start: '06:00', end: '14:00' }, // Early shift (like different timezone)
      tue: { start: '06:00', end: '14:00' },
      wed: { start: '06:00', end: '14:00' },
      thu: { start: '06:00', end: '14:00' },
      fri: { start: '06:00', end: '14:00' },
      sat: null,
      sun: null
    };

    await CalendarSettings.save(businessB_settings.id, {
      providerId: businessB.providers[0].id,
      businessId: businessB.business.id,
      workingHours: differentHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney', // Same timezone but different hours
        bufferTime: 15
      }
    }, { useServiceRole: true });

    // Generate availability
    const businessA_slots = await computeAggregatedAvailability(businessA.business.id, today, 7);
    const businessB_slots = await computeAggregatedAvailability(businessB.business.id, today, 7);

    // Verify different time patterns
    const getTimeSlots = (slots: AvailabilitySlots[]) => {
      if (slots.length === 0) return [];
      const firstSlot = slots[0];
      return Object.values(firstSlot.slots).flat().map(([time]) => time);
    };

    const businessA_times = getTimeSlots(businessA_slots);
    const businessB_times = getTimeSlots(businessB_slots);

    // Business A should have standard hours (09:00+), Business B should have early hours (06:00+)
    if (businessA_times.length > 0 && businessB_times.length > 0) {
      const businessA_earliestTime = businessA_times.sort()[0];
      const businessB_earliestTime = businessB_times.sort()[0];
      
      expect(businessA_earliestTime).toBe('09:00');
      expect(businessB_earliestTime).toBe('06:00');
      
      console.log(`[Test] Business A starts at ${businessA_earliestTime}, Business B starts at ${businessB_earliestTime}`);
    }

    // Roll both businesses
    await Promise.all([
      rollAggregatedAvailability(businessA.business.id, { useServiceRole: true }),
      rollAggregatedAvailability(businessB.business.id, { useServiceRole: true })
    ]);

    // Verify time patterns are maintained after rollover
    const businessA_after = await computeAggregatedAvailability(businessA.business.id, today, 7);
    const businessB_after = await computeAggregatedAvailability(businessB.business.id, today, 7);

    expect(businessA_after.length).toBeGreaterThan(0);
    expect(businessB_after.length).toBeGreaterThan(0);

    console.log(`[Test] After rollover: Business A: ${businessA_after.length} slots, Business B: ${businessB_after.length} slots`);
  });
}); 