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

describe('Multi Provider Rollover', () => {
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
    // Create a business with 3 providers
    testBusiness = await createTestBusiness('MultiRollover', 3);
    createdBusinesses.push(testBusiness);
  });

  afterEach(async () => {
    if (testBusiness) {
      await cleanupTestData([testBusiness]);
      createdBusinesses = createdBusinesses.filter(b => b.business.id !== testBusiness.business.id);
    }
  });

  it('should_rollover_aggregated_availability_for_business_with_three_providers', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;

    expect(providers.length).toBe(3);
    
    // Generate initial aggregated availability
    const today = new Date();
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      today,
      30
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    console.log(`[Test] Generated ${initialSlots.length} initial aggregated availability slots`);

    // Verify aggregated availability combines all providers
    const sampleSlot = initialSlots[0];
    expectAvailabilitySlots(sampleSlot, sampleSlot.date, business.id);
    
    // Check that provider counts reflect multiple providers
    const slotValues = Object.values(sampleSlot.slots);
    if (slotValues.length > 0) {
      const timeSlots = slotValues[0] as Array<[string, number]>;
      if (timeSlots.length > 0) {
        const [time, providerCount] = timeSlots[0];
        expect(providerCount).toBeGreaterThanOrEqual(1);
        expect(providerCount).toBeLessThanOrEqual(3); // Max 3 providers
        console.log(`[Test] Sample time slot ${time} has ${providerCount} available providers`);
      }
    }

    // Roll aggregated availability forward
    await rollAggregatedAvailability(business.id, { useServiceRole: true });

    // Verify availability after rollover
    const afterRolloverSlots = await computeAggregatedAvailability(
      business.id,
      today,
      30
    );

    expect(afterRolloverSlots.length).toBeGreaterThan(0);
    console.log(`[Test] After rollover: ${afterRolloverSlots.length} aggregated availability slots`);

    // Verify dates are in correct range
    const todayStr = DateTime.now().setZone('Australia/Sydney').toFormat('yyyy-MM-dd');
    const futureDate = DateTime.now().setZone('Australia/Sydney').plus({ days: 29 }).toFormat('yyyy-MM-dd');
    
    const hasToday = afterRolloverSlots.some(slot => slot.date === todayStr);
    const hasFuture = afterRolloverSlots.some(slot => slot.date === futureDate);
    
    expect(hasToday).toBe(true);
    expect(hasFuture).toBe(true);
  });

  it('should_combine_all_provider_schedules_in_rollover', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const calendarSettings = testBusiness.calendarSettings;

    // Verify we have different providers with schedules
    expect(calendarSettings.length).toBe(3); // All 3 providers should have calendar settings

    // Modify one provider to have different working hours
    const provider2Settings = calendarSettings[1];
    const extendedHours = {
      mon: { start: '08:00', end: '18:00' }, // Earlier start, later end
      tue: { start: '08:00', end: '18:00' },
      wed: { start: '08:00', end: '18:00' },
      thu: { start: '08:00', end: '18:00' },
      fri: { start: '08:00', end: '18:00' },
      sat: { start: '10:00', end: '14:00' }, // Works weekends
      sun: null
    };

    await CalendarSettings.save(provider2Settings.id, {
      providerId: providers[1].id,
      businessId: business.id,
      workingHours: extendedHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    // Generate aggregated availability
    const today = new Date();
    const aggregatedSlots = await computeAggregatedAvailability(
      business.id,
      today,
      7 // Just 1 week for easier testing
    );

    expect(aggregatedSlots.length).toBeGreaterThan(0);

    // Find a Saturday slot to verify extended hours
    const saturdaySlot = aggregatedSlots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 6; // Saturday
    });

    if (saturdaySlot) {
      // Should have some availability on Saturday from provider 2
      const hasSaturdaySlots = Object.keys(saturdaySlot.slots).length > 0;
      expect(hasSaturdaySlots).toBe(true);
      console.log(`[Test] Saturday availability found: ${Object.keys(saturdaySlot.slots).join(', ')}`);
    }

    // Roll availability and verify it maintains the combined schedule
    await rollAggregatedAvailability(business.id, { useServiceRole: true });

    const afterRollover = await computeAggregatedAvailability(
      business.id,
      today,
      7
    );

    expect(afterRollover.length).toBeGreaterThan(0);
    console.log(`[Test] Combined schedule rollover: ${aggregatedSlots.length} -> ${afterRollover.length} slots`);
  });

  it('should_handle_providers_with_different_working_days', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const calendarSettings = testBusiness.calendarSettings;

    // Set different working patterns for providers
    const patterns = [
      // Provider 1: Monday-Wednesday
      {
        mon: { start: '09:00', end: '17:00' },
        tue: { start: '09:00', end: '17:00' },
        wed: { start: '09:00', end: '17:00' },
        thu: null,
        fri: null,
        sat: null,
        sun: null
      },
      // Provider 2: Wednesday-Friday (overlap on Wednesday)
      {
        mon: null,
        tue: null,
        wed: { start: '09:00', end: '17:00' },
        thu: { start: '09:00', end: '17:00' },
        fri: { start: '09:00', end: '17:00' },
        sat: null,
        sun: null
      },
      // Provider 3: Friday-Sunday (weekend coverage)
      {
        mon: null,
        tue: null,
        wed: null,
        thu: null,
        fri: { start: '09:00', end: '17:00' },
        sat: { start: '10:00', end: '16:00' },
        sun: { start: '10:00', end: '16:00' }
      }
    ];

    // Update each provider's schedule
    for (let i = 0; i < 3; i++) {
      await CalendarSettings.save(calendarSettings[i].id, {
        providerId: providers[i].id,
        businessId: business.id,
        workingHours: patterns[i],
        manageCalendar: false,
        settings: {
          timezone: 'Australia/Sydney',
          bufferTime: 15
        }
      }, { useServiceRole: true });
    }

    // Generate aggregated availability
    const today = new Date();
    const aggregatedSlots = await computeAggregatedAvailability(
      business.id,
      today,
      14 // 2 weeks
    );

    // Verify we have availability across all days
    const daysWithAvailability = new Set();
    aggregatedSlots.forEach(slot => {
      const date = DateTime.fromISO(slot.date);
      daysWithAvailability.add(date.weekday);
    });

    // Should have availability for most days (1=Mon, 7=Sun)
    expect(daysWithAvailability.size).toBeGreaterThanOrEqual(5); // At least 5 different weekdays
    console.log(`[Test] Days with availability: ${Array.from(daysWithAvailability).sort()}`);

    // Verify Wednesday has 2 providers (overlap day)
    const wednesdaySlot = aggregatedSlots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 3; // Wednesday
    });

    if (wednesdaySlot) {
      const slotValues = Object.values(wednesdaySlot.slots);
      if (slotValues.length > 0) {
        const timeSlots = slotValues[0] as Array<[string, number]>;
        if (timeSlots.length > 0) {
          const [time, providerCount] = timeSlots[0];
          expect(providerCount).toBeGreaterThanOrEqual(2); // Should have overlap
          console.log(`[Test] Wednesday overlap: ${providerCount} providers available at ${time}`);
        }
      }
    }

    // Roll availability
    await rollAggregatedAvailability(business.id, { useServiceRole: true });

    const afterRollover = await computeAggregatedAvailability(
      business.id,
      today,
      14
    );

    expect(afterRollover.length).toBeGreaterThan(0);
    console.log(`[Test] Different working days rollover maintained ${afterRollover.length} slots`);
  });
}); 