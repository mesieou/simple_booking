import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { DateTime } from 'luxon';
import { 
  computeAggregatedAvailability 
} from '@/lib/general-helpers/availability';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { 
  createTestBusiness, 
  createTestBooking,
  cleanupTestData, 
  TestBusiness,
  expectAvailabilitySlots
} from '../helpers/availability-test-factory';
import { DateTime } from 'luxon';

describe('Multi Business Booking Impact', () => {
  let businessA: TestBusiness;
  let businessB: TestBusiness;
  let businessC: TestBusiness;
  let createdBusinesses: TestBusiness[] = [];

  beforeAll(async () => {
    jest.setTimeout(45000);
  });

  afterAll(async () => {
    if (createdBusinesses.length > 0) {
      await cleanupTestData(createdBusinesses);
    }
  });

  beforeEach(async () => {
    // Create multiple businesses with different provider counts
    businessA = await createTestBusiness('BookingBusinessA', 1); // Single provider
    businessB = await createTestBusiness('BookingBusinessB', 2); // Two providers
    businessC = await createTestBusiness('BookingBusinessC', 3); // Three providers
    
    createdBusinesses.push(businessA, businessB, businessC);
  });

  afterEach(async () => {
    if (createdBusinesses.length > 0) {
      await cleanupTestData(createdBusinesses);
      createdBusinesses = [];
    }
  });

  it('should_only_affect_target_business_when_booking_created', async () => {
    const today = new Date();
    const testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    // Generate initial availability for all businesses
    const initialResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    const [businessA_initial, businessB_initial, businessC_initial] = initialResults;
    
    expect(businessA_initial.length).toBeGreaterThan(0);
    expect(businessB_initial.length).toBeGreaterThan(0);
    expect(businessC_initial.length).toBeGreaterThan(0);

    // Store initial slot counts
    const getSlotCount = (slots: AvailabilitySlots[]) => {
      return slots.reduce((total, slot) => {
        return total + Object.keys(slot.slots).reduce((slotTotal, duration) => {
          return slotTotal + slot.slots[duration].length;
        }, 0);
      }, 0);
    };

    const businessA_initialCount = getSlotCount(businessA_initial);
    const businessB_initialCount = getSlotCount(businessB_initial);
    const businessC_initialCount = getSlotCount(businessC_initial);

    console.log(`[Test] Initial slot counts: A:${businessA_initialCount}, B:${businessB_initialCount}, C:${businessC_initialCount}`);

    // Create booking only for Business A
    // Create booking in Sydney timezone (matching the business timezone)
    const bookingDateTime = DateTime.fromISO(`${businessA_initial[0].date}T10:00:00`, { zone: 'Australia/Sydney' }).toJSDate();
    const { booking, quote } = await createTestBooking(
      businessA.providers[0].id,
      businessA.business.id,
      businessA.services[0].id,
      bookingDateTime,
      120 // 2 hours
    );

    console.log(`[Test] Created booking for Business A at 10:00`);

    // Recalculate availability for all businesses
    const afterResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    const [businessA_after, businessB_after, businessC_after] = afterResults;

    const businessA_afterCount = getSlotCount(businessA_after);
    const businessB_afterCount = getSlotCount(businessB_after);
    const businessC_afterCount = getSlotCount(businessC_after);

    console.log(`[Test] After booking slot counts: A:${businessA_afterCount}, B:${businessB_afterCount}, C:${businessC_afterCount}`);

    // Business A should be affected (fewer slots)
    expect(businessA_afterCount).toBeLessThan(businessA_initialCount);

    // Business B and C should be unaffected
    expect(businessB_afterCount).toBe(businessB_initialCount);
    expect(businessC_afterCount).toBe(businessC_initialCount);

    // Verify business IDs remain isolated
    businessA_after.forEach(slot => expect(slot.businessId).toBe(businessA.business.id));
    businessB_after.forEach(slot => expect(slot.businessId).toBe(businessB.business.id));
    businessC_after.forEach(slot => expect(slot.businessId).toBe(businessC.business.id));
  });

  it('should_handle_simultaneous_bookings_across_businesses', async () => {
    const today = new Date();
    const testDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    
    // Generate initial availability for all businesses
    const initialResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    const [businessA_initial, businessB_initial, businessC_initial] = initialResults;

    // Create simultaneous bookings for all businesses at the same time
    const bookingDateTime = DateTime.fromISO(`${businessA_initial[0].date}T14:00:00`, { zone: 'Australia/Sydney' }).toJSDate();
    
    const simultaneousBookings = await Promise.all([
      createTestBooking(
        businessA.providers[0].id,
        businessA.business.id,
        businessA.services[0].id,
        bookingDateTime,
        90
      ),
      createTestBooking(
        businessB.providers[0].id,
        businessB.business.id,
        businessB.services[0].id,
        bookingDateTime,
        90
      ),
      createTestBooking(
        businessC.providers[0].id,
        businessC.business.id,
        businessC.services[0].id,
        bookingDateTime,
        90
      )
    ]);

    console.log(`[Test] Created simultaneous bookings for all 3 businesses at 14:00`);

    // Verify all bookings were created successfully
    expect(simultaneousBookings.length).toBe(3);
    simultaneousBookings.forEach((result, index) => {
      expect(result.booking.id).toBeDefined();
      expect(result.quote.id).toBeDefined();
    });

    // Recalculate availability for all businesses
    const afterResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    const [businessA_after, businessB_after, businessC_after] = afterResults;

    // All businesses should be affected by their own bookings
    expect(businessA_after.length).toBeGreaterThan(0);
    expect(businessB_after.length).toBeGreaterThan(0);
    expect(businessC_after.length).toBeGreaterThan(0);

    // Check that 14:00 time slot is affected differently based on provider count
    const checkTimeSlotImpact = (slots: AvailabilitySlots[], expectedProviders: number, businessName: string) => {
      if (slots.length > 0) {
        const slot = slots[0];
        const allTimeSlots = Object.values(slot.slots).flat() as Array<[string, number]>;
        const time1400 = allTimeSlots.find(([time]) => time === '14:00');
        
        if (time1400) {
          const [, providerCount] = time1400;
          expect(providerCount).toBe(expectedProviders - 1); // One provider busy
          console.log(`[Test] ${businessName} at 14:00: ${providerCount} providers (${expectedProviders - 1} expected)`);
        }
      }
    };

    checkTimeSlotImpact(businessA_after, 1, 'Business A'); // Should have 0 providers (slot removed)
    checkTimeSlotImpact(businessB_after, 2, 'Business B'); // Should have 1 provider
    checkTimeSlotImpact(businessC_after, 3, 'Business C'); // Should have 2 providers

    // Verify business isolation
    const allBusinessIds = new Set([
      ...businessA_after.map(s => s.businessId),
      ...businessB_after.map(s => s.businessId),
      ...businessC_after.map(s => s.businessId)
    ]);

    expect(allBusinessIds.size).toBe(3);
  });

  it('should_maintain_independent_provider_counts', async () => {
    const today = new Date();
    // Find next weekday (Monday = 1, Friday = 5) to ensure providers work
    let testDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    while (testDate.getDay() === 0 || testDate.getDay() === 6) { // Skip Sunday (0) and Saturday (6)
      testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    console.log(`[Test] Testing date: ${testDate.toISOString()} (${testDate.toLocaleDateString('en-US', { weekday: 'long' })})`);
    
    // Generate availability
    const businessA_slots = await computeAggregatedAvailability(businessA.business.id, testDate, 1);
    const businessB_slots = await computeAggregatedAvailability(businessB.business.id, testDate, 1);
    const businessC_slots = await computeAggregatedAvailability(businessC.business.id, testDate, 1);
    
    console.log(`[Test] Availability results: A=${businessA_slots?.length || 'undefined'}, B=${businessB_slots?.length || 'undefined'}, C=${businessC_slots?.length || 'undefined'}`);

    // Verify initial provider counts are correct for each business
    const checkProviderCounts = (slots: AvailabilitySlots[], expectedCount: number, businessName: string) => {
      if (slots.length > 0) {
        const slot = slots[0];
        const slotValues = Object.values(slot.slots);
        if (slotValues.length > 0) {
          const timeSlots = slotValues[0] as Array<[string, number]>;
          if (timeSlots.length > 0) {
            const [time, providerCount] = timeSlots[0];
            expect(providerCount).toBe(expectedCount);
            console.log(`[Test] ${businessName} initial provider count: ${providerCount}/${expectedCount}`);
          }
        }
      }
    };

    checkProviderCounts(businessA_slots, 1, 'Business A');
    checkProviderCounts(businessB_slots, 2, 'Business B');
    checkProviderCounts(businessC_slots, 3, 'Business C');

    // Ensure all businesses have availability before proceeding
    if (!businessC_slots || businessC_slots.length === 0) {
      throw new Error(`Business C has no availability slots. Length: ${businessC_slots?.length || 'undefined'}`);
    }

    // Book one provider from Business C (which has 3 providers)
    const bookingDateTime = DateTime.fromISO(`${businessC_slots[0].date}T11:00:00`, { zone: 'Australia/Sydney' }).toJSDate();
    await createTestBooking(
      businessC.providers[1].id, // Second provider
      businessC.business.id,
      businessC.services[0].id,
      bookingDateTime,
      60
    );

    console.log(`[Test] Booked one provider from Business C (3 -> 2 expected)`);

    // Recalculate all businesses
    const afterResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    const [businessA_after, businessB_after, businessC_after] = afterResults;

    // Business A and B should be unchanged
    checkProviderCounts(businessA_after, 1, 'Business A (unchanged)');
    checkProviderCounts(businessB_after, 2, 'Business B (unchanged)');

    // Business C should have reduced count at the booking time
    if (businessC_after.length > 0) {
      const slot = businessC_after[0];
      const allTimeSlots = Object.values(slot.slots).flat() as Array<[string, number]>;
      
      const time1100 = allTimeSlots.find(([time]) => time === '11:00');
      if (time1100) {
        const [, providerCount] = time1100;
        expect(providerCount).toBe(2); // 3 providers - 1 busy = 2
        console.log(`[Test] Business C at 11:00: ${providerCount} providers (reduced)`);
      }

      // Other times should still have 3 providers
      const otherTimes = allTimeSlots.filter(([time]) => time !== '11:00');
      if (otherTimes.length > 0) {
        const [sampleTime, sampleCount] = otherTimes[0];
        expect(sampleCount).toBe(3);
        console.log(`[Test] Business C at ${sampleTime}: ${sampleCount} providers (maintained)`);
      }
    }
  });

  it('should_handle_cross_business_booking_isolation', async () => {
    const today = new Date();
    // Find next weekday (Monday = 1, Friday = 5) to ensure providers work
    let testDate = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);
    while (testDate.getDay() === 0 || testDate.getDay() === 6) { // Skip Sunday (0) and Saturday (6)
      testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
    }

    // Create multiple bookings across different businesses
    const businessA_slots = await computeAggregatedAvailability(businessA.business.id, testDate, 1);
    const businessB_slots = await computeAggregatedAvailability(businessB.business.id, testDate, 1);
    
    // Ensure businesses have availability before proceeding
    if (!businessA_slots || businessA_slots.length === 0) {
      throw new Error(`Business A has no availability slots. Length: ${businessA_slots?.length || 'undefined'}`);
    }
    if (!businessB_slots || businessB_slots.length === 0) {
      throw new Error(`Business B has no availability slots. Length: ${businessB_slots?.length || 'undefined'}`);
    }
    
    // Book all providers in Business A (only 1 provider)
    const bookingA_DateTime = DateTime.fromISO(`${businessA_slots[0].date}T09:00:00`, { zone: 'Australia/Sydney' }).toJSDate();
    await createTestBooking(
      businessA.providers[0].id,
      businessA.business.id,
      businessA.services[0].id,
      bookingA_DateTime,
      480 // 8 hours - book entire day
    );

    // Book one provider in Business B (has 2 providers)
    const bookingB_DateTime = DateTime.fromISO(`${businessB_slots[0].date}T09:00:00`, { zone: 'Australia/Sydney' }).toJSDate();
    await createTestBooking(
      businessB.providers[0].id,
      businessB.business.id,
      businessB.services[0].id,
      bookingB_DateTime,
      120 // 2 hours
    );

    console.log(`[Test] Fully booked Business A, partially booked Business B`);

    // Recalculate availability
    const afterResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    const [businessA_after, businessB_after, businessC_after] = afterResults;

    // Business A should have no availability (fully booked)
    const businessA_totalSlots = businessA_after.reduce((total, slot) => {
      return total + Object.keys(slot.slots).reduce((slotTotal, duration) => {
        return slotTotal + slot.slots[duration].length;
      }, 0);
    }, 0);

    expect(businessA_totalSlots).toBe(0);
    console.log(`[Test] Business A total available slots: ${businessA_totalSlots} (fully booked)`);

    // Business B should have reduced availability at booking time
    if (businessB_after.length > 0) {
      const slot = businessB_after[0];
      const allTimeSlots = Object.values(slot.slots).flat() as Array<[string, number]>;
      
      const time0900 = allTimeSlots.find(([time]) => time === '09:00');
      if (time0900) {
        const [, providerCount] = time0900;
        expect(providerCount).toBe(1); // 2 providers - 1 busy = 1
        console.log(`[Test] Business B at 09:00: ${providerCount} provider (partially booked)`);
      }
    }

    // Business C should be completely unaffected
    if (businessC_after.length > 0) {
      const slot = businessC_after[0];
      const slotValues = Object.values(slot.slots);
      if (slotValues.length > 0) {
        const timeSlots = slotValues[0] as Array<[string, number]>;
        if (timeSlots.length > 0) {
          const [time, providerCount] = timeSlots[0];
          expect(providerCount).toBe(3); // All 3 providers available
          console.log(`[Test] Business C at ${time}: ${providerCount} providers (unaffected)`);
        }
      }
    }

    // Verify business IDs are properly isolated
    expect(businessA_after.every(slot => slot.businessId === businessA.business.id)).toBe(true);
    expect(businessB_after.every(slot => slot.businessId === businessB.business.id)).toBe(true);
    expect(businessC_after.every(slot => slot.businessId === businessC.business.id)).toBe(true);
  });
}); 