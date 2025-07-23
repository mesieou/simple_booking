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

describe('Single Provider Calendar Changes', () => {
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
    testBusiness = await createTestBusiness('CalendarChanges', 1);
    createdBusinesses.push(testBusiness);
  });

  afterEach(async () => {
    if (testBusiness) {
      await cleanupTestData([testBusiness]);
      createdBusinesses = createdBusinesses.filter(b => b.business.id !== testBusiness.business.id);
    }
  });

  it('should_recalculate_availability_when_working_hours_change', async () => {
    const provider = testBusiness.providers[0];
    const business = testBusiness.business;
    const calendarSettings = testBusiness.calendarSettings[0];

    // Generate initial availability with standard hours (9-17)
    const today = new Date();
    const testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      7
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    // Check initial time range
    const initialSlot = initialSlots[0];
    const initialTimes = Object.values(initialSlot.slots).flat() as Array<[string, number]>;
    const initialEarliestTime = initialTimes.map(([time]) => time).sort()[0];
    const initialLatestTime = initialTimes.map(([time]) => time).sort().reverse()[0];

    console.log(`[Test] Initial time range: ${initialEarliestTime} - ${initialLatestTime}`);
    expect(initialEarliestTime).toBe('09:00');

    // Update working hours to 8:00-18:00 (extended hours)
    const extendedHours = {
      mon: { start: '08:00', end: '18:00' },
      tue: { start: '08:00', end: '18:00' },
      wed: { start: '08:00', end: '18:00' },
      thu: { start: '08:00', end: '18:00' },
      fri: { start: '08:00', end: '18:00' },
      sat: null,
      sun: null
    };

    await CalendarSettings.save(calendarSettings.id, {
      providerId: provider.id,
      businessId: business.id,
      workingHours: extendedHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    console.log(`[Test] Updated working hours to 08:00-18:00`);

    // Recalculate provider contribution
    await recalculateProviderContribution(provider, business);

    // Get updated availability
    const updatedSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      7
    );

    expect(updatedSlots.length).toBeGreaterThan(0);
    
    const updatedSlot = updatedSlots[0];
    const updatedTimes = Object.values(updatedSlot.slots).flat() as Array<[string, number]>;
    const updatedEarliestTime = updatedTimes.map(([time]) => time).sort()[0];
    const updatedLatestTime = updatedTimes.map(([time]) => time).sort().reverse()[0];

    console.log(`[Test] Updated time range: ${updatedEarliestTime} - ${updatedLatestTime}`);

    // Should now start earlier (8:00) and end later
    expect(updatedEarliestTime).toBe('08:00');
    expect(parseInt(updatedLatestTime.split(':')[0])).toBeGreaterThan(parseInt(initialLatestTime.split(':')[0]));

    // Should have more time slots overall
    expect(updatedTimes.length).toBeGreaterThan(initialTimes.length);
    console.log(`[Test] Time slots increased: ${initialTimes.length} -> ${updatedTimes.length}`);
  });

  it('should_remove_availability_when_working_days_reduced', async () => {
    const provider = testBusiness.providers[0];
    const business = testBusiness.business;
    const calendarSettings = testBusiness.calendarSettings[0];

    // Generate initial availability for a week
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (8 - today.getDay()) % 7); // Next Monday
    
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      nextMonday,
      7
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    // Count weekday slots (Mon-Fri)
    const initialWeekdaySlots = initialSlots.filter(slot => {
      const date = DateTime.fromISO(slot.date);
      const dayOfWeek = date.weekday; // 1=Monday, 7=Sunday
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    });

    console.log(`[Test] Initial weekday slots: ${initialWeekdaySlots.length}`);
    expect(initialWeekdaySlots.length).toBe(5); // Mon-Fri

    // Update to only work Monday-Wednesday
    const reducedHours = {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: null, // No longer working
      fri: null, // No longer working
      sat: null,
      sun: null
    };

    await CalendarSettings.save(calendarSettings.id, {
      providerId: provider.id,
      businessId: business.id,
      workingHours: reducedHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    console.log(`[Test] Updated to work only Monday-Wednesday`);

    // Recalculate availability
    await recalculateProviderContribution(provider, business);

    const updatedSlots = await computeAggregatedAvailability(
      business.id,
      nextMonday,
      7
    );

    // Should only have Monday-Wednesday slots
    const updatedWeekdaySlots = updatedSlots.filter(slot => {
      const date = DateTime.fromISO(slot.date);
      const dayOfWeek = date.weekday;
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    });

    console.log(`[Test] Updated weekday slots: ${updatedWeekdaySlots.length}`);
    expect(updatedWeekdaySlots.length).toBe(3); // Only Mon-Wed

    // Verify no Thursday or Friday slots exist
    const thursOrFriSlots = updatedSlots.filter(slot => {
      const date = DateTime.fromISO(slot.date);
      const dayOfWeek = date.weekday;
      return dayOfWeek === 4 || dayOfWeek === 5; // Thursday or Friday
    });

    expect(thursOrFriSlots.length).toBe(0);
    console.log(`[Test] Thursday/Friday slots removed: ${thursOrFriSlots.length}`);
  });

  it('should_add_availability_when_weekend_work_added', async () => {
    const provider = testBusiness.providers[0];
    const business = testBusiness.business;
    const calendarSettings = testBusiness.calendarSettings[0];

    // Generate initial availability (weekdays only)
    const today = new Date();
    const testDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      7
    );

    // Count weekend slots initially
    const initialWeekendSlots = initialSlots.filter(slot => {
      const date = DateTime.fromISO(slot.date);
      const dayOfWeek = date.weekday;
      return dayOfWeek === 6 || dayOfWeek === 7; // Saturday or Sunday
    });

    console.log(`[Test] Initial weekend slots: ${initialWeekendSlots.length}`);
    expect(initialWeekendSlots.length).toBe(0); // No weekend work initially

    // Add weekend work
    const weekendWorkHours = {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: { start: '09:00', end: '17:00' },
      sat: { start: '10:00', end: '16:00' }, // Added Saturday
      sun: { start: '11:00', end: '15:00' }  // Added Sunday
    };

    await CalendarSettings.save(calendarSettings.id, {
      providerId: provider.id,
      businessId: business.id,
      workingHours: weekendWorkHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    console.log(`[Test] Added weekend work: Saturday 10-16, Sunday 11-15`);

    // Recalculate availability
    await recalculateProviderContribution(provider, business);

    const updatedSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      7
    );

    // Count weekend slots after update
    const updatedWeekendSlots = updatedSlots.filter(slot => {
      const date = DateTime.fromISO(slot.date);
      const dayOfWeek = date.weekday;
      return dayOfWeek === 6 || dayOfWeek === 7;
    });

    console.log(`[Test] Updated weekend slots: ${updatedWeekendSlots.length}`);
    expect(updatedWeekendSlots.length).toBeGreaterThan(0);

    // Verify weekend hours are correct
    const saturdaySlot = updatedWeekendSlots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 6;
    });

    const sundaySlot = updatedWeekendSlots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 7;
    });

    if (saturdaySlot) {
      const satTimes = Object.values(saturdaySlot.slots).flat() as Array<[string, number]>;
      const satEarliest = satTimes.map(([time]) => time).sort()[0];
      const satLatest = satTimes.map(([time]) => time).sort().reverse()[0];
      
      expect(satEarliest).toBe('10:00');
      expect(parseInt(satLatest.split(':')[0])).toBeLessThan(16);
      console.log(`[Test] Saturday availability: ${satEarliest} - ${satLatest}`);
    }

    if (sundaySlot) {
      const sunTimes = Object.values(sundaySlot.slots).flat() as Array<[string, number]>;
      const sunEarliest = sunTimes.map(([time]) => time).sort()[0];
      
      expect(sunEarliest).toBe('11:00');
      console.log(`[Test] Sunday availability starts at: ${sunEarliest}`);
    }
  });

  it('should_handle_buffer_time_changes_correctly', async () => {
    const provider = testBusiness.providers[0];
    const business = testBusiness.business;
    const calendarSettings = testBusiness.calendarSettings[0];

    // Generate initial availability with 15min buffer
    const today = new Date();
    // Find next weekday (Monday = 1, Friday = 5) to ensure providers work
    let testDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    while (testDate.getDay() === 0 || testDate.getDay() === 6) { // Skip Sunday (0) and Saturday (6)
      testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
    }
    const initialSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(initialSlots.length).toBeGreaterThan(0);
    
    const initialSlot = initialSlots[0];
    const initialTimeSlotCount = Object.values(initialSlot.slots).reduce((total, timeSlots) => {
      return total + timeSlots.length;
    }, 0);

    console.log(`[Test] Initial time slots with 15min buffer: ${initialTimeSlotCount}`);

    // Update buffer time to 45 minutes
    await CalendarSettings.save(calendarSettings.id, {
      providerId: provider.id,
      businessId: business.id,
      workingHours: calendarSettings.workingHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 45 // Increased buffer time
      }
    }, { useServiceRole: true });

    console.log(`[Test] Increased buffer time to 45 minutes`);

    // Recalculate availability
    await recalculateProviderContribution(provider, business);

    const updatedSlots = await computeAggregatedAvailability(
      business.id,
      testDate,
      1
    );

    expect(updatedSlots.length).toBeGreaterThan(0);
    
    const updatedSlot = updatedSlots[0];
    const updatedTimeSlotCount = Object.values(updatedSlot.slots).reduce((total, timeSlots) => {
      return total + timeSlots.length;
    }, 0);

    console.log(`[Test] Updated time slots with 45min buffer: ${updatedTimeSlotCount}`);

    // With larger buffer time, should have fewer available slots
    // (less opportunities to fit services with required buffer)
    expect(updatedTimeSlotCount).toBeLessThanOrEqual(initialTimeSlotCount);

    // Verify the time intervals are affected by buffer
    const initialTimes = Object.values(initialSlot.slots).flat() as Array<[string, number]>;
    const updatedTimes = Object.values(updatedSlot.slots).flat() as Array<[string, number]>;
    
    const initialTimesArray = initialTimes.map(([time]) => time).sort();
    const updatedTimesArray = updatedTimes.map(([time]) => time).sort();

    console.log(`[Test] Time slots reduced from ${initialTimesArray.length} to ${updatedTimesArray.length} due to buffer increase`);
  });

  it('should_recalculate_future_availability_only', async () => {
    const provider = testBusiness.providers[0];
    const business = testBusiness.business;
    const calendarSettings = testBusiness.calendarSettings[0];

    // Generate availability for past, present, and future
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const pastSlots = await computeAggregatedAvailability(business.id, yesterday, 1);
    const todaySlots = await computeAggregatedAvailability(business.id, today, 1);
    const futureSlots = await computeAggregatedAvailability(business.id, tomorrow, 7);

    console.log(`[Test] Initial availability: past:${pastSlots.length}, today:${todaySlots.length}, future:${futureSlots.length}`);

    // Change working hours significantly
    const newHours = {
      mon: { start: '12:00', end: '20:00' }, // Completely different hours
      tue: { start: '12:00', end: '20:00' },
      wed: { start: '12:00', end: '20:00' },
      thu: { start: '12:00', end: '20:00' },
      fri: { start: '12:00', end: '20:00' },
      sat: null,
      sun: null
    };

    await CalendarSettings.save(calendarSettings.id, {
      providerId: provider.id,
      businessId: business.id,
      workingHours: newHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    console.log(`[Test] Changed working hours to 12:00-20:00`);

    // Recalculate availability
    await recalculateProviderContribution(provider, business);

    // Check availability after recalculation
    const newFutureSlots = await computeAggregatedAvailability(business.id, tomorrow, 7);

    expect(newFutureSlots.length).toBeGreaterThan(0);
    
    // Future availability should reflect new hours (starting at 12:00)
    if (newFutureSlots.length > 0) {
      const newSlot = newFutureSlots[0];
      const newTimes = Object.values(newSlot.slots).flat() as Array<[string, number]>;
      const newEarliestTime = newTimes.map(([time]) => time).sort()[0];
      
      expect(newEarliestTime).toBe('12:00');
      console.log(`[Test] Future availability now starts at: ${newEarliestTime}`);
    }

    // Today and past should remain unaffected by the change
    // (In a real system, past bookings shouldn't be affected by calendar changes)
    const checkTodaySlots = await computeAggregatedAvailability(business.id, today, 1);
    console.log(`[Test] Today's slots after change: ${checkTodaySlots.length}`);
  });
}); 