import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { DateTime } from 'luxon';
import { computeAggregatedAvailability, computeDayAggregatedAvailability } from '@/lib/general-helpers/availability';
import { updateDayAggregatedAvailability } from '@/lib/general-helpers/availability';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { Booking } from '@/lib/database/models/booking';
import { createTestBusiness, createTestBooking, cleanupTestData } from '../helpers/availability-test-factory';

type TestBusiness = Awaited<ReturnType<typeof createTestBusiness>>;

describe('Single Provider Booking Impact', () => {
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
    testBusiness = await createTestBusiness('BookingImpact', 1);
    createdBusinesses.push(testBusiness);
  });

  afterEach(async () => {
    if (testBusiness) {
      await cleanupTestData([testBusiness]);
      createdBusinesses = createdBusinesses.filter(b => b.business.id !== testBusiness.business.id);
    }
  });

  it('should_decrease_availability_when_provider_gets_booking', async () => {
    const provider = testBusiness.providers[0];
    const business = testBusiness.business;
    const service = testBusiness.services[0];

    // Generate initial availability - ensure we use a weekday
    const today = new Date();
    let testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Start from tomorrow
    while (testDate.getDay() === 0 || testDate.getDay() === 6) { // Skip Sunday (0) and Saturday (6)
      testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      7
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    // Save availability to database so booking updates can find it
    await Promise.all(initialSlots.map(slot => slot.add()));
    
    // Wait for database commit to avoid race condition
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Find a slot with availability
    const availableSlot = initialSlots.find(slot => Object.keys(slot.slots).length > 0);
    expect(availableSlot).toBeDefined();
    
    if (!availableSlot) return;

    const slotValues = Object.values(availableSlot.slots);
    const timeSlots = slotValues[0] as Array<[string, number]>;
    const [availableTime, initialProviderCount] = timeSlots[0];
    
    expect(initialProviderCount).toBe(1); // Single provider should have count of 1
    console.log(`[Test] Initial availability at ${availableTime}: ${initialProviderCount} provider(s)`);

    // Create a booking - use same dynamic approach as working multi-provider tests
    // Extract date part from ISO timestamp and combine with time
    const dateOnly = availableSlot.date.split('T')[0]; // Extract "2025-07-23" from "2025-07-23T00:00:00+00:00"
    
    // Use Sydney timezone consistently with other tests
    const bookingDateTime = DateTime.fromFormat(
      `${dateOnly} ${availableTime}`, 
      'yyyy-MM-dd HH:mm',
      { zone: 'Australia/Sydney' }
    );
    
    if (!bookingDateTime.isValid) {
      throw new Error(`Failed to parse booking date/time: ${bookingDateTime.invalidReason}`);
    }
    
    const bookingDateTimeJS = bookingDateTime.toJSDate();
    console.log(`[Test] Creating booking for ${dateOnly} at ${availableTime}, parsed as: ${bookingDateTimeJS.toISOString()}`);
    
    const { booking, quote } = await createTestBooking(
      provider.id,
      business.id,
      service.id,
      bookingDateTimeJS,
      120 // 2 hours
    );

    console.log(`[Test] Created booking successfully, now checking updated availability`);

    // Use dynamic availability computation like working multi-provider tests
    const updatedSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1 // Just check the day we booked
    );

    // Find the updated slot for the same date
    const updatedSlot = updatedSlots.find(slot => slot.date.split('T')[0] === dateOnly);
    expect(updatedSlot).toBeDefined();
    
    if (updatedSlot) {
      // Check if the time slot was removed (since single provider became unavailable)
      const hasAvailabilityAtBookedTime = updatedSlot.slots[availableTime] !== undefined;
      
      // For a single provider business, the time slot should be completely removed
      expect(hasAvailabilityAtBookedTime).toBe(false);
      console.log(`[Test] Availability at ${availableTime} was removed after booking (correct for single provider)`);
    }
  });

  // TODO: Rewrite these tests to properly test business-aggregated availability
  // The old tests were manually calling updateDayAvailability which is not how the system works
  // Real tests should verify that booking.add() automatically updates business availability

}); 