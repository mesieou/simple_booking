import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { 
  computeAggregatedAvailability, 
  recalculateProviderContribution 
} from '@/lib/general-helpers/availability';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { 
  createTestBusiness, 
  cleanupTestData, 
  TestBusiness,
  expectAvailabilitySlots
} from '../helpers/availability-test-factory';
import { DateTime } from 'luxon';

describe('Multi Provider Calendar Changes', () => {
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
    testBusiness = await createTestBusiness('MultiCalendarChanges', 3);
    createdBusinesses.push(testBusiness);
  });

  afterEach(async () => {
    if (testBusiness) {
      await cleanupTestData([testBusiness]);
      createdBusinesses = createdBusinesses.filter(b => b.business.id !== testBusiness.business.id);
    }
  });

  it('should_update_aggregated_availability_when_one_provider_changes_hours', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const calendarSettings = testBusiness.calendarSettings;

    expect(providers.length).toBe(3);
    expect(calendarSettings.length).toBe(3);

    // Generate initial aggregated availability
    const today = new Date();
    const testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      7
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    // Check initial provider counts at a sample time
    const initialSlot = initialSlots[0];
    const initialTimes = Object.values(initialSlot.slots).flat() as Array<[string, number]>;
    const [sampleTime, initialProviderCount] = initialTimes[0];
    
    expect(initialProviderCount).toBe(3); // All 3 providers available
    console.log(`[Test] Initial provider count at ${sampleTime}: ${initialProviderCount}`);

    // Change working hours for provider 1 (extend to weekend)
    const extendedHours = {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: { start: '09:00', end: '17:00' },
      sat: { start: '10:00', end: '16:00' }, // Added Saturday
      sun: { start: '11:00', end: '15:00' }  // Added Sunday
    };

    await CalendarSettings.save(calendarSettings[0].id, {
      providerId: providers[0].id,
      businessId: business.id,
      workingHours: extendedHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    console.log(`[Test] Extended Provider 1 to work weekends`);

    // Recalculate the changed provider's contribution
    await recalculateProviderContribution(providers[0], business);

    // Get updated aggregated availability
    const updatedSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      7
    );

    expect(updatedSlots.length).toBeGreaterThan(0);

    // Check weekday availability (should remain same - 3 providers)
    const weekdaySlots = updatedSlots.filter(slot => {
      const date = DateTime.fromISO(slot.date);
      const dayOfWeek = date.weekday;
      return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday-Friday
    });

    if (weekdaySlots.length > 0) {
      const weekdaySlot = weekdaySlots[0];
      const weekdayTimes = Object.values(weekdaySlot.slots).flat() as Array<[string, number]>;
      if (weekdayTimes.length > 0) {
        const [weekdayTime, weekdayProviderCount] = weekdayTimes[0];
        expect(weekdayProviderCount).toBe(3); // Still 3 providers on weekdays
        console.log(`[Test] Weekday provider count at ${weekdayTime}: ${weekdayProviderCount} (unchanged)`);
      }
    }

    // Check weekend availability (should now have 1 provider)
    const weekendSlots = updatedSlots.filter(slot => {
      const date = DateTime.fromISO(slot.date);
      const dayOfWeek = date.weekday;
      return dayOfWeek === 6 || dayOfWeek === 7; // Saturday or Sunday
    });

    expect(weekendSlots.length).toBeGreaterThan(0);
    console.log(`[Test] Weekend slots added: ${weekendSlots.length}`);

    if (weekendSlots.length > 0) {
      const weekendSlot = weekendSlots[0];
      const weekendTimes = Object.values(weekendSlot.slots).flat() as Array<[string, number]>;
      if (weekendTimes.length > 0) {
        const [weekendTime, weekendProviderCount] = weekendTimes[0];
        expect(weekendProviderCount).toBe(1); // Only 1 provider working weekends
        console.log(`[Test] Weekend provider count at ${weekendTime}: ${weekendProviderCount} (new)`);
      }
    }
  });

  it('should_maintain_other_providers_availability_when_one_reduces_hours', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const calendarSettings = testBusiness.calendarSettings;

    // Find next weekday (Monday = 1, Friday = 5) to ensure providers work
    const today = new Date();
    let testDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    
    // Ensure we start on a Monday for consistent 5 weekdays
    const startDateTime = DateTime.fromJSDate(testDate).setZone('Australia/Sydney');
    const daysUntilMonday = startDateTime.weekday === 1 ? 0 : (8 - startDateTime.weekday) % 7;
    testDate = new Date(testDate.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
    
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      5 // Weekdays only
    );

    // Should have 5 weekday slots initially (all providers work Mon-Fri)
    expect(initialSlots.length).toBe(5); // Mon-Fri

    // Check initial Thursday/Friday availability (all 3 providers)
    const initialThursday = initialSlots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 4; // Thursday
    });

    const initialFriday = initialSlots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 5; // Friday
    });

    let initialThursdayCount = 0;
    let initialFridayCount = 0;

    if (initialThursday) {
      const thursTimes = Object.values(initialThursday.slots).flat() as Array<[string, number]>;
      if (thursTimes.length > 0) {
        initialThursdayCount = thursTimes[0][1];
      }
    }

    if (initialFriday) {
      const friTimes = Object.values(initialFriday.slots).flat() as Array<[string, number]>;
      if (friTimes.length > 0) {
        initialFridayCount = friTimes[0][1];
      }
    }

    expect(initialThursdayCount).toBe(3);
    expect(initialFridayCount).toBe(3);
    console.log(`[Test] Initial counts - Thursday: ${initialThursdayCount}, Friday: ${initialFridayCount}`);

    // Reduce provider 2's hours (no Thursday/Friday)
    const reducedHours = {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: null, // Removed Thursday
      fri: null, // Removed Friday
      sat: null,
      sun: null
    };

    await CalendarSettings.save(calendarSettings[1].id, {
      providerId: providers[1].id,
      businessId: business.id,
      workingHours: reducedHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    console.log(`[Test] Removed Provider 2 from Thursday/Friday`);

    // Recalculate the changed provider's contribution
    await recalculateProviderContribution(providers[1], business);

    // Get updated availability - Note: Thursday/Friday will now have reduced providers
    const updatedSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      5
    );

    // Should still have 5 slots since other providers still work Thu/Fri
    expect(updatedSlots.length).toBe(5);

    // Monday-Wednesday should still have 3 providers
    const mondayWedSlots = updatedSlots.filter(slot => {
      const date = DateTime.fromISO(slot.date);
      const dayOfWeek = date.weekday;
      return dayOfWeek >= 1 && dayOfWeek <= 3; // Mon-Wed
    });

    mondayWedSlots.forEach(slot => {
      const times = Object.values(slot.slots).flat() as Array<[string, number]>;
      if (times.length > 0) {
        const [time, providerCount] = times[0];
        expect(providerCount).toBe(3); // Still 3 providers Mon-Wed
        console.log(`[Test] ${DateTime.fromISO(slot.date).toFormat('cccc')} at ${time}: ${providerCount} providers (maintained)`);
      }
    });

    // Thursday/Friday should now have 2 providers
    const updatedThursday = updatedSlots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 4;
    });

    const updatedFriday = updatedSlots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 5;
    });

    if (updatedThursday) {
      const thursTimes = Object.values(updatedThursday.slots).flat() as Array<[string, number]>;
      if (thursTimes.length > 0) {
        const [thursTime, thursCount] = thursTimes[0];
        expect(thursCount).toBe(2); // 3 providers - 1 removed = 2
        console.log(`[Test] Thursday at ${thursTime}: ${thursCount} providers (reduced)`);
      }
    }

    if (updatedFriday) {
      const friTimes = Object.values(updatedFriday.slots).flat() as Array<[string, number]>;
      if (friTimes.length > 0) {
        const [friTime, friCount] = friTimes[0];
        expect(friCount).toBe(2); // 3 providers - 1 removed = 2
        console.log(`[Test] Friday at ${friTime}: ${friCount} providers (reduced)`);
      }
    }
  });

  it('should_handle_multiple_providers_changing_schedules_simultaneously', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const calendarSettings = testBusiness.calendarSettings;

    // Find next weekday to ensure consistent testing
    const today = new Date();
    let testDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    // Ensure we start on a weekday
    const startDateTime = DateTime.fromJSDate(testDate).setZone('Australia/Sydney');
    const daysUntilMonday = startDateTime.weekday === 1 ? 0 : (8 - startDateTime.weekday) % 7;
    testDate = new Date(testDate.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
    
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      5 // Test with weekdays only
    );

    // Set up different schedules for each provider
    const schedules = [
      // Provider 1: Early bird (7-15)
      {
        mon: { start: '07:00', end: '15:00' },
        tue: { start: '07:00', end: '15:00' },
        wed: { start: '07:00', end: '15:00' },
        thu: { start: '07:00', end: '15:00' },
        fri: { start: '07:00', end: '15:00' },
        sat: null,
        sun: null
      },
      // Provider 2: Normal hours (9-17)
      {
        mon: { start: '09:00', end: '17:00' },
        tue: { start: '09:00', end: '17:00' },
        wed: { start: '09:00', end: '17:00' },
        thu: { start: '09:00', end: '17:00' },
        fri: { start: '09:00', end: '17:00' },
        sat: null,
        sun: null
      },
      // Provider 3: Late shift (12-20)
      {
        mon: { start: '12:00', end: '20:00' },
        tue: { start: '12:00', end: '20:00' },
        wed: { start: '12:00', end: '20:00' },
        thu: { start: '12:00', end: '20:00' },
        fri: { start: '12:00', end: '20:00' },
        sat: null,
        sun: null
      }
    ];

    // Update all provider schedules
    const updatePromises = providers.map((provider, index) => {
      return CalendarSettings.save(calendarSettings[index].id, {
        providerId: provider.id,
        businessId: business.id,
        workingHours: schedules[index],
        manageCalendar: false,
        settings: {
          timezone: 'Australia/Sydney',
          bufferTime: 15
        }
      }, { useServiceRole: true });
    });

    await Promise.all(updatePromises);

    // Recalculate availability after changes
    await Promise.all(providers.map(provider => 
      recalculateProviderContribution(provider, business)
    ));

    // Get updated aggregated availability
    const updatedSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      5 // Weekdays only
    );

    expect(updatedSlots.length).toBeGreaterThan(0);

    if (updatedSlots.length > 0) {
      const slot = updatedSlots[0];
      // Look at 60-minute slots specifically instead of flattening all durations
      const sixtyMinuteSlots = slot.slots['60'] || [];
      const timeMap = new Map(sixtyMinuteSlots);

      // Check provider counts at different times - but be flexible about exact times
      const availableTimes = Array.from(timeMap.keys()).sort();
      
      // Find times that should have different provider counts
      const earlyTime = availableTimes.find(time => time <= '08:00'); // Should have 1 provider
      const midMorningTime = availableTimes.find(time => time >= '09:00' && time <= '11:00'); // Should have 2 providers  
      const midDayTime = availableTimes.find(time => time >= '12:00' && time <= '14:00'); // Should have 3 providers
      const afternoonTime = availableTimes.find(time => time >= '15:00' && time <= '16:00'); // Should have 2 providers
      const eveningTime = availableTimes.find(time => time >= '17:00'); // Should have 1 provider

      if (earlyTime) {
        const count = timeMap.get(earlyTime);
        expect(count).toBe(1);
      }

      if (midMorningTime) {
        const count = timeMap.get(midMorningTime);
        expect(count).toBe(2);
      }

      if (midDayTime) {
        const count = timeMap.get(midDayTime);
        expect(count).toBe(3);
      }

      if (afternoonTime) {
        const count = timeMap.get(afternoonTime);
        expect(count).toBe(2);
      }

      if (eveningTime) {
        const count = timeMap.get(eveningTime);
        expect(count).toBe(1);
      }

      // Verify coverage extends from early morning to late evening
      const earliestTime = availableTimes[0];
      const latestTime = availableTimes[availableTimes.length - 1];
      
      expect(earliestTime).toBe('07:00');
      expect(parseInt(latestTime.split(':')[0])).toBeGreaterThanOrEqual(19);
      console.log(`[Test] Extended coverage: ${earliestTime} - ${latestTime}`);
    }
  });

  it('should_handle_provider_buffer_time_differences', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const calendarSettings = testBusiness.calendarSettings;

    // Find next weekday to ensure providers are working
    const today = new Date();
    let testDate = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);
    
    // Ensure we test on a weekday when providers work
    const startDateTime = DateTime.fromJSDate(testDate).setZone('Australia/Sydney');
    if (startDateTime.weekday > 5) { // If weekend, move to next Monday
      const daysUntilMonday = (8 - startDateTime.weekday) % 7;
      testDate = new Date(testDate.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
    }
    
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    const initialSlot = initialSlots[0];
    const initialTimeCount = Object.values(initialSlot.slots).reduce((total, timeSlots) => {
      return total + timeSlots.length;
    }, 0);

    console.log(`[Test] Initial time slots: ${initialTimeCount}`);

    // Set different buffer times for each provider - keep them reasonable
    const bufferTimes = [15, 30, 45]; // 15min, 30min, 45min

    const updatePromises = providers.map((provider, index) =>
      CalendarSettings.save(calendarSettings[index].id, {
        providerId: provider.id,
        businessId: business.id,
        workingHours: calendarSettings[index].workingHours, // Keep existing working hours
        manageCalendar: false,
        settings: {
          timezone: 'Australia/Sydney',
          bufferTime: bufferTimes[index]
        }
      }, { useServiceRole: true })
    );

    await Promise.all(updatePromises);
    console.log(`[Test] Set buffer times: ${bufferTimes.join('min, ')}min`);

    // Recalculate all provider contributions
    const recalcPromises = providers.map(provider =>
      recalculateProviderContribution(provider, business)
    );

    await Promise.all(recalcPromises);

    // Get updated aggregated availability
    const updatedSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(updatedSlots.length).toBeGreaterThan(0);
    
    const updatedSlot = updatedSlots[0];
    const updatedTimeCount = Object.values(updatedSlot.slots).reduce((total, timeSlots) => {
      return total + timeSlots.length;
    }, 0);

    console.log(`[Test] Updated time slots: ${updatedTimeCount}`);

    // Different buffer times might affect aggregated availability
    // Providers with larger buffers contribute fewer slots
    // The aggregated result should still provide availability but potentially with adjusted timing
    
    // Verify we still have availability despite different buffer times
    expect(updatedTimeCount).toBeGreaterThan(0);
    
    // Check that provider counts are maintained at available times
    const updatedTimes = Object.values(updatedSlot.slots).flat() as Array<[string, number]>;
    if (updatedTimes.length > 0) {
      const [sampleTime, providerCount] = updatedTimes[0];
      expect(providerCount).toBeGreaterThanOrEqual(1);
      expect(providerCount).toBeLessThanOrEqual(3);
      console.log(`[Test] Sample time ${sampleTime}: ${providerCount} providers with mixed buffer times`);
    }
  });

  it('should_recalculate_business_hours_when_provider_schedules_change', async () => {
    const business = testBusiness.business;
    const providers = testBusiness.providers;
    const calendarSettings = testBusiness.calendarSettings;

    // Generate initial business-wide availability
    const today = new Date();
    const testDate = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    const initialSlot = initialSlots[0];
    const initialTimes = Object.values(initialSlot.slots).flat() as Array<[string, number]>;
    const initialEarliestTime = initialTimes.map(([time]) => time).sort()[0];
    const initialLatestTime = initialTimes.map(([time]) => time).sort().reverse()[0];

    console.log(`[Test] Initial business hours: ${initialEarliestTime} - ${initialLatestTime}`);

    // Extend one provider's hours significantly
    const extendedHours = {
      mon: { start: '06:00', end: '22:00' }, // Much longer hours
      tue: { start: '06:00', end: '22:00' },
      wed: { start: '06:00', end: '22:00' },
      thu: { start: '06:00', end: '22:00' },
      fri: { start: '06:00', end: '22:00' },
      sat: { start: '08:00', end: '18:00' }, // Weekend work
      sun: { start: '10:00', end: '16:00' }
    };

    await CalendarSettings.save(calendarSettings[0].id, {
      providerId: providers[0].id,
      businessId: business.id,
      workingHours: extendedHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    console.log(`[Test] Extended Provider 1 hours: 06:00-22:00 + weekends`);

    // Recalculate the extended provider's contribution
    await recalculateProviderContribution(providers[0], business);

    // Get updated business-wide availability
    const updatedSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(updatedSlots.length).toBeGreaterThan(0);
    
    const updatedSlot = updatedSlots[0];
    const updatedTimes = Object.values(updatedSlot.slots).flat() as Array<[string, number]>;
    const updatedEarliestTime = updatedTimes.map(([time]) => time).sort()[0];
    const updatedLatestTime = updatedTimes.map(([time]) => time).sort().reverse()[0];

    console.log(`[Test] Updated business hours: ${updatedEarliestTime} - ${updatedLatestTime}`);

    // Business hours should now start earlier and end later
    expect(updatedEarliestTime).toBe('06:00');
    expect(parseInt(updatedLatestTime.split(':')[0])).toBeGreaterThan(parseInt(initialLatestTime.split(':')[0]));

    // Check that different times have appropriate provider counts
    const timeMap = new Map(updatedTimes);
    
    const earlyMorning = timeMap.get('06:00');
    const normalHours = timeMap.get('10:00');
    const lateEvening = timeMap.get('21:00');

    if (earlyMorning) {
      expect(earlyMorning).toBe(1); // Only extended provider
      console.log(`[Test] Early morning (06:00): ${earlyMorning} provider`);
    }

    if (normalHours) {
      expect(normalHours).toBe(3); // All providers
      console.log(`[Test] Normal hours (10:00): ${normalHours} providers`);
    }

    if (lateEvening) {
      expect(lateEvening).toBe(1); // Only extended provider
      console.log(`[Test] Late evening (21:00): ${lateEvening} provider`);
    }
  });
}); 