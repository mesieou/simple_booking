import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { 
  computeAggregatedAvailability, 
  updateDayAvailability 
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
import { Booking } from '@/lib/database/models/booking';

describe('Multi Provider Booking Impact', () => {
  let testBusiness: TestBusiness;
  let createdBusinesses: TestBusiness[] = [];

  beforeAll(async () => {
    jest.setTimeout(30000);
  });

  afterAll(async () => {
    if (createdBusinesses.length > 0) {
      await cleanupTestData(createdBusinesses);
    }
  });

  beforeEach(async () => {
    // Create business with 3 providers
    testBusiness = await createTestBusiness('MultiBooking', 3);
    createdBusinesses.push(testBusiness);
  });

  afterEach(async () => {
    if (testBusiness) {
      await cleanupTestData([testBusiness]);
      createdBusinesses = createdBusinesses.filter(b => b.business.id !== testBusiness.business.id);
    }
  });

  it('should_reduce_provider_count_when_one_provider_gets_booking', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const service = testBusiness.services[0];

    expect(providers.length).toBe(3);

    // Generate initial aggregated availability
    const today = new Date();
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      today,
      7
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    // Find a slot with availability
    const availableSlot = initialSlots.find(slot => Object.keys(slot.slots).length > 0);
    expect(availableSlot).toBeDefined();
    
    if (!availableSlot) return;

    const slotValues = Object.values(availableSlot.slots);
    const timeSlots = slotValues[0] as Array<[string, number]>;
    const [availableTime, initialProviderCount] = timeSlots[0];
    
    expect(initialProviderCount).toBe(3); // Should have all 3 providers
    console.log(`[Test] Initial availability at ${availableTime}: ${initialProviderCount} provider(s)`);

    // Create a booking for provider 1 in Sydney timezone (matching calendar settings)
    const { DateTime } = require('luxon');
    const sydneyDateTime = DateTime.fromISO(`${availableSlot.date}T${availableTime}:00`, { zone: 'Australia/Sydney' });
    const bookingDateTime = sydneyDateTime.toJSDate();
    console.log(`[Test] Creating booking at ${sydneyDateTime.toISO()} (Sydney) = ${bookingDateTime.toISOString()} (UTC)`);
    
    const { booking, quote } = await createTestBooking(
      providers[0].id, // Book provider 1
      business.id,
      service.id,
      bookingDateTime,
      120 // 2 hours
    );

    // Recalculate aggregated availability after booking
    const afterBookingSlots = await computeAggregatedAvailability(
      business.id,
      new Date(bookingDateTime),
      1
    );

    // Find the same time slot
    const updatedSlot = afterBookingSlots.find(slot => slot.date === availableSlot.date);
    if (updatedSlot) {
      const updatedSlotValues = Object.values(updatedSlot.slots);
      if (updatedSlotValues.length > 0) {
        const updatedTimeSlots = updatedSlotValues[0] as Array<[string, number]>;
        const bookingTimeSlot = updatedTimeSlots.find(([time]) => time === availableTime);
        
        if (bookingTimeSlot) {
          const [, newProviderCount] = bookingTimeSlot;
          expect(newProviderCount).toBe(2); // Should be reduced to 2 providers
          console.log(`[Test] After booking at ${availableTime}: ${newProviderCount} provider(s) (reduced from ${initialProviderCount})`);
        }
      }
    }
  });

  it('should_maintain_availability_from_other_providers', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const service = testBusiness.services[0];

    // Generate initial availability
    const today = new Date();
    const testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    const availableSlot = initialSlots[0];
    const initialTimeSlotCount = Object.keys(availableSlot.slots).reduce((total, duration) => {
      return total + availableSlot.slots[duration].length;
    }, 0);

    console.log(`[Test] Initial time slots: ${initialTimeSlotCount}`);

    // Create booking for provider 1 at 10:00
    const { DateTime } = require('luxon');
    const bookingDateTime = DateTime.fromISO(`${availableSlot.date}T10:00:00`, { zone: 'Australia/Sydney' }).toJSDate();
    const { booking, quote } = await createTestBooking(
      providers[0].id,
      business.id,
      service.id,
      bookingDateTime,
      90 // 1.5 hours (10:00-11:30)
    );

    // Recalculate aggregated availability
    const afterBookingSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(afterBookingSlots.length).toBeGreaterThan(0);
    
    const updatedSlot = afterBookingSlots[0];
    const updatedTimeSlotCount = Object.keys(updatedSlot.slots).reduce((total, duration) => {
      return total + updatedSlot.slots[duration].length;
    }, 0);

    // Should still have availability (just reduced counts)
    expect(updatedTimeSlotCount).toBeGreaterThan(0);
    console.log(`[Test] Time slots after booking: ${updatedTimeSlotCount}`);

    // Verify that non-conflicting times still have 3 providers
    const allTimeSlots = Object.values(updatedSlot.slots).flat() as Array<[string, number]>;
    const nonConflictingTimes = allTimeSlots.filter(([time]) => {
      const timeHour = parseInt(time.split(':')[0]);
      return timeHour < 10 || timeHour >= 12; // Before 10:00 or after 12:00
    });

    if (nonConflictingTimes.length > 0) {
      const [sampleTime, providerCount] = nonConflictingTimes[0];
      expect(providerCount).toBe(3); // Should still have all 3 providers for non-conflicting times
      console.log(`[Test] Non-conflicting time ${sampleTime}: ${providerCount} providers (maintained)`);
    }
  });

  it('should_remove_slots_when_all_providers_are_busy', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const service = testBusiness.services[0];

    // Generate initial availability
    const today = new Date();
    const testDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000); // Day after tomorrow
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    const availableSlot = initialSlots[0];
    
    // Create overlapping bookings for all 3 providers at 14:00 in Sydney timezone
    const { DateTime } = require('luxon'); 
    const sydneyDateTime = DateTime.fromISO(`${availableSlot.date}T14:00:00`, { zone: 'Australia/Sydney' });
    const bookingDateTime = sydneyDateTime.toJSDate();
    
    // Create bookings sequentially to avoid race conditions
    const bookings = [];
    bookings.push(await createTestBooking(providers[0].id, business.id, service.id, bookingDateTime, 120)); // 14:00-16:00
    bookings.push(await createTestBooking(providers[1].id, business.id, service.id, bookingDateTime, 120)); // 14:00-16:00
    bookings.push(await createTestBooking(providers[2].id, business.id, service.id, bookingDateTime, 120)); // 14:00-16:00

    console.log(`[Test] Created ${bookings.length} overlapping bookings for all providers`);

    // Recalculate aggregated availability
    const afterBookingsSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    if (afterBookingsSlots.length > 0) {
      const updatedSlot = afterBookingsSlots[0];
      const allTimeSlots = Object.values(updatedSlot.slots).flat() as Array<[string, number]>;
      
      // Time slots that should be completely removed (14:00-16:00 range)
      const conflictingTimes = ['14:00', '14:30', '15:00', '15:30'];
      const remainingConflictingTimes = allTimeSlots.filter(([time]) => 
        conflictingTimes.includes(time)
      );

      expect(remainingConflictingTimes.length).toBe(0);
      console.log(`[Test] All conflicting time slots removed when all providers busy`);

      // Verify other times still have availability
      const nonConflictingTimes = allTimeSlots.filter(([time]) => {
        const timeHour = parseInt(time.split(':')[0]);
        return timeHour < 14 || timeHour >= 16;
      });

      expect(nonConflictingTimes.length).toBeGreaterThan(0);
      console.log(`[Test] ${nonConflictingTimes.length} non-conflicting time slots maintained`);
    }
  });

  it('should_handle_different_booking_durations_correctly', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const service = testBusiness.services[0];

    // Generate initial availability - find next weekday
    const today = new Date();
    let testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    while (testDate.getDay() === 0 || testDate.getDay() === 6) { // Skip weekends
      testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    const availableSlot = initialSlots[0];
    
    // Check initial duration availability
    const initialDurations = Object.keys(availableSlot.slots);
    console.log(`[Test] Initial duration slots: ${initialDurations.join(', ')}`);

    // Create bookings with different durations at different times in Sydney timezone
    const { DateTime } = require('luxon');
    const createSydneyDateTime = (timeStr) => DateTime.fromISO(`${availableSlot.date}T${timeStr}`, { zone: 'Australia/Sydney' }).toJSDate();
    
    // Create bookings sequentially to avoid race conditions
    const bookings = [];
    bookings.push(await createTestBooking(providers[0].id, business.id, service.id, createSydneyDateTime('09:00:00'), 60));  // 1 hour
    bookings.push(await createTestBooking(providers[1].id, business.id, service.id, createSydneyDateTime('11:00:00'), 90));  // 1.5 hours
    bookings.push(await createTestBooking(providers[2].id, business.id, service.id, createSydneyDateTime('14:00:00'), 120)); // 2 hours

    console.log(`[Test] Created bookings: 60min at 09:00, 90min at 11:00, 120min at 14:00`);

    // Recalculate aggregated availability
    const afterBookingsSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    if (afterBookingsSlots.length > 0) {
      const updatedSlot = afterBookingsSlots[0];
      
      // Check how different durations are affected
      for (const duration of ['60', '90', '120']) {
        const initialCount = availableSlot.slots[duration]?.length || 0;
        const updatedCount = updatedSlot.slots[duration]?.length || 0;
        
        if (initialCount > 0) {
          const impact = initialCount - updatedCount;
          console.log(`[Test] Duration ${duration}min: ${initialCount} -> ${updatedCount} (impact: ${impact})`);
          
          // Longer durations should be more affected
          expect(updatedCount).toBeLessThanOrEqual(initialCount);
        }
      }

      // Verify specific time ranges are affected appropriately
      const allTimeSlots = Object.values(updatedSlot.slots).flat() as Array<[string, number]>;
      
      // Times around 09:00 should have reduced count (1 provider busy)
      const time0900 = allTimeSlots.find(([time]) => time === '09:00');
      if (time0900) {
        const [, count0900] = time0900;
        expect(count0900).toBe(2); // 3 providers - 1 busy = 2
        console.log(`[Test] 09:00 has ${count0900} providers (1 busy)`);
      }

      // Times around 11:00 should have reduced count (1 provider busy)
      const time1100 = allTimeSlots.find(([time]) => time === '11:00');
      if (time1100) {
        const [, count1100] = time1100;
        expect(count1100).toBe(2); // 3 providers - 1 busy = 2
        console.log(`[Test] 11:00 has ${count1100} providers (1 busy)`);
      }

      // Times around 14:00 should have reduced count (1 provider busy)
      const time1400 = allTimeSlots.find(([time]) => time === '14:00');
      if (time1400) {
        const [, count1400] = time1400;
        expect(count1400).toBe(2); // 3 providers - 1 busy = 2
        console.log(`[Test] 14:00 has ${count1400} providers (1 busy)`);
      }
    }
  });

  it('should_handle_concurrent_bookings_correctly', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const service = testBusiness.services[0];

    // Generate initial availability - find next weekday
    const today = new Date();
    let testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    while (testDate.getDay() === 0 || testDate.getDay() === 6) { // Skip weekends
      testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    // Simulate concurrent bookings for the same time slot in Sydney timezone
    const { DateTime } = require('luxon');
    const sydneyDateTime = DateTime.fromISO(`${initialSlots[0].date}T13:00:00`, { zone: 'Australia/Sydney' });
    const bookingDateTime = sydneyDateTime.toJSDate();
    
    // Create two bookings at the same time (providers 0 and 1) - sequentially to avoid race conditions
    const concurrentBookings = [];
    concurrentBookings.push(await createTestBooking(providers[0].id, business.id, service.id, bookingDateTime, 90));
    concurrentBookings.push(await createTestBooking(providers[1].id, business.id, service.id, bookingDateTime, 90));

    console.log(`[Test] Created 2 concurrent bookings at 13:00 for different providers`);

    // Recalculate availability
    const afterConcurrentSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    if (afterConcurrentSlots.length > 0) {
      const updatedSlot = afterConcurrentSlots[0];
      const allTimeSlots = Object.values(updatedSlot.slots).flat() as Array<[string, number]>;
      
      // Time 13:00 should now have only 1 provider available (3 - 2 busy = 1)
      const time1300 = allTimeSlots.find(([time]) => time === '13:00');
      if (time1300) {
        const [, count1300] = time1300;
        expect(count1300).toBe(1); // Only 1 provider left
        console.log(`[Test] After concurrent bookings at 13:00: ${count1300} provider(s) remaining`);
      }

      // Times that don't conflict should still have all 3 providers
      const time0900 = allTimeSlots.find(([time]) => time === '09:00');
      if (time0900) {
        const [, count0900] = time0900;
        expect(count0900).toBe(3); // All providers available
        console.log(`[Test] Non-conflicting time 09:00: ${count0900} provider(s) (unaffected)`);
      }
    }

    // Test booking the remaining provider
    const finalBooking = await createTestBooking(
      providers[2].id, // Last remaining provider
      business.id,
      service.id,
      bookingDateTime,
      90
    );

    console.log(`[Test] Booked the last remaining provider at 13:00`);

    // Recalculate final availability
    const finalSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    if (finalSlots.length > 0) {
      const finalSlot = finalSlots[0];
      const finalTimeSlots = Object.values(finalSlot.slots).flat() as Array<[string, number]>;
      
      // Time 13:00 should be completely removed (no providers available)
      const finalTime1300 = finalTimeSlots.find(([time]) => time === '13:00');
      expect(finalTime1300).toBeUndefined();
      console.log(`[Test] Time slot 13:00 completely removed when all providers busy`);
    }
  });
}); 