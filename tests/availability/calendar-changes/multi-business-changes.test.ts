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

describe('Multi Business Calendar Changes', () => {
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
    businessA = await createTestBusiness('CalendarBusinessA', 1); // Single provider
    businessB = await createTestBusiness('CalendarBusinessB', 2); // Two providers
    businessC = await createTestBusiness('CalendarBusinessC', 3); // Three providers
    
    createdBusinesses.push(businessA, businessB, businessC);
  });

  afterEach(async () => {
    if (createdBusinesses.length > 0) {
      await cleanupTestData(createdBusinesses);
      createdBusinesses = [];
    }
  });

  it('should_only_affect_target_business_when_calendar_changes', async () => {
    const today = new Date();
    const testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    // Generate initial availability for all businesses
    const initialResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 7),
      computeAggregatedAvailability(businessB.business.id, testDate, 7),
      computeAggregatedAvailability(businessC.business.id, testDate, 7)
    ]);

    const [businessA_initial, businessB_initial, businessC_initial] = initialResults;
    
    expect(businessA_initial.length).toBeGreaterThan(0);
    expect(businessB_initial.length).toBeGreaterThan(0);
    expect(businessC_initial.length).toBeGreaterThan(0);

    // Get initial time ranges for comparison
    const getTimeRange = (slots: AvailabilitySlots[]) => {
      if (slots.length === 0) return { earliest: null, latest: null };
      const allTimes = slots.flatMap(slot => 
        Object.values(slot.slots).flat().map(([time]) => time)
      );
      return {
        earliest: allTimes.sort()[0],
        latest: allTimes.sort().reverse()[0]
      };
    };

    const businessA_initialRange = getTimeRange(businessA_initial);
    const businessB_initialRange = getTimeRange(businessB_initial);
    const businessC_initialRange = getTimeRange(businessC_initial);

    console.log(`[Test] Initial ranges - A: ${businessA_initialRange.earliest}-${businessA_initialRange.latest}, B: ${businessB_initialRange.earliest}-${businessB_initialRange.latest}, C: ${businessC_initialRange.earliest}-${businessC_initialRange.latest}`);

    // Change Business A's provider hours significantly (extend to 06:00-22:00)
    const extendedHours = {
      mon: { start: '06:00', end: '22:00' },
      tue: { start: '06:00', end: '22:00' },
      wed: { start: '06:00', end: '22:00' },
      thu: { start: '06:00', end: '22:00' },
      fri: { start: '06:00', end: '22:00' },
      sat: { start: '08:00', end: '18:00' }, // Weekend work
      sun: { start: '10:00', end: '16:00' }
    };

    await CalendarSettings.save(businessA.calendarSettings[0].id, {
      providerId: businessA.providers[0].id,
      businessId: businessA.business.id,
      workingHours: extendedHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    console.log(`[Test] Extended Business A provider hours to 06:00-22:00 + weekends`);

    // Recalculate only Business A's provider contribution
    await recalculateProviderContribution(businessA.providers[0], businessA.business);

    // Get updated availability for all businesses
    const updatedResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 7),
      computeAggregatedAvailability(businessB.business.id, testDate, 7),
      computeAggregatedAvailability(businessC.business.id, testDate, 7)
    ]);

    const [businessA_updated, businessB_updated, businessC_updated] = updatedResults;

    // Business A should be affected (extended hours)
    const businessA_updatedRange = getTimeRange(businessA_updated);
    expect(businessA_updatedRange.earliest).toBe('06:00');
    expect(parseInt(businessA_updatedRange.latest?.split(':')[0] || '0')).toBeGreaterThan(parseInt(businessA_initialRange.latest?.split(':')[0] || '0'));
    console.log(`[Test] Business A updated range: ${businessA_updatedRange.earliest}-${businessA_updatedRange.latest} (extended)`);

    // Business B and C should be unchanged
    const businessB_updatedRange = getTimeRange(businessB_updated);
    const businessC_updatedRange = getTimeRange(businessC_updated);

    expect(businessB_updatedRange.earliest).toBe(businessB_initialRange.earliest);
    expect(businessB_updatedRange.latest).toBe(businessB_initialRange.latest);
    expect(businessC_updatedRange.earliest).toBe(businessC_initialRange.earliest);
    expect(businessC_updatedRange.latest).toBe(businessC_initialRange.latest);

    console.log(`[Test] Business B range unchanged: ${businessB_updatedRange.earliest}-${businessB_updatedRange.latest}`);
    console.log(`[Test] Business C range unchanged: ${businessC_updatedRange.earliest}-${businessC_updatedRange.latest}`);

    // Verify business IDs remain isolated
    businessA_updated.forEach(slot => expect(slot.businessId).toBe(businessA.business.id));
    businessB_updated.forEach(slot => expect(slot.businessId).toBe(businessB.business.id));
    businessC_updated.forEach(slot => expect(slot.businessId).toBe(businessC.business.id));
  });

  it('should_handle_simultaneous_calendar_changes_across_businesses', async () => {
    const today = new Date();
    const testDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    
    // Generate initial availability
    const initialResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    // Apply different schedule changes to each business
    const scheduleChanges = [
      // Business A: Early hours (06:00-14:00)
      {
        mon: { start: '06:00', end: '14:00' },
        tue: { start: '06:00', end: '14:00' },
        wed: { start: '06:00', end: '14:00' },
        thu: { start: '06:00', end: '14:00' },
        fri: { start: '06:00', end: '14:00' },
        sat: null,
        sun: null
      },
      // Business B: Late hours (14:00-22:00) - first provider
      {
        mon: { start: '14:00', end: '22:00' },
        tue: { start: '14:00', end: '22:00' },
        wed: { start: '14:00', end: '22:00' },
        thu: { start: '14:00', end: '22:00' },
        fri: { start: '14:00', end: '22:00' },
        sat: null,
        sun: null
      },
      // Business C: Weekend work (first provider)
      {
        mon: { start: '09:00', end: '17:00' },
        tue: { start: '09:00', end: '17:00' },
        wed: { start: '09:00', end: '17:00' },
        thu: { start: '09:00', end: '17:00' },
        fri: { start: '09:00', end: '17:00' },
        sat: { start: '10:00', end: '16:00' }, // Weekend work
        sun: { start: '11:00', end: '15:00' }
      }
    ];

    // Apply schedule changes simultaneously to ALL providers in each business
    const updatePromises = [];
    
    // Update all providers in Business A
    for (let i = 0; i < businessA.calendarSettings.length; i++) {
      updatePromises.push(CalendarSettings.save(businessA.calendarSettings[i].id, {
        providerId: businessA.providers[i].id,
        businessId: businessA.business.id,
        workingHours: scheduleChanges[0],
        manageCalendar: false,
        settings: { timezone: 'Australia/Sydney', bufferTime: 15 }
      }, { useServiceRole: true }));
    }
    
    // Update all providers in Business B
    for (let i = 0; i < businessB.calendarSettings.length; i++) {
      updatePromises.push(CalendarSettings.save(businessB.calendarSettings[i].id, {
        providerId: businessB.providers[i].id,
        businessId: businessB.business.id,
        workingHours: scheduleChanges[1],
        manageCalendar: false,
        settings: { timezone: 'Australia/Sydney', bufferTime: 15 }
      }, { useServiceRole: true }));
    }
    
    // Update all providers in Business C
    for (let i = 0; i < businessC.calendarSettings.length; i++) {
      updatePromises.push(CalendarSettings.save(businessC.calendarSettings[i].id, {
        providerId: businessC.providers[i].id,
        businessId: businessC.business.id,
        workingHours: scheduleChanges[2],
        manageCalendar: false,
        settings: { timezone: 'Australia/Sydney', bufferTime: 15 }
      }, { useServiceRole: true }));
    }

    await Promise.all(updatePromises);
    console.log(`[Test] Applied simultaneous schedule changes to all providers in all businesses`);

    // Recalculate provider contributions simultaneously for ALL providers
    const recalcPromises = [];
    businessA.providers.forEach(provider => recalcPromises.push(recalculateProviderContribution(provider, businessA.business)));
    businessB.providers.forEach(provider => recalcPromises.push(recalculateProviderContribution(provider, businessB.business)));
    businessC.providers.forEach(provider => recalcPromises.push(recalculateProviderContribution(provider, businessC.business)));

    await Promise.all(recalcPromises);

    // Get updated availability
    const updatedResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 7),
      computeAggregatedAvailability(businessB.business.id, testDate, 7),
      computeAggregatedAvailability(businessC.business.id, testDate, 7)
    ]);

    const [businessA_updated, businessB_updated, businessC_updated] = updatedResults;

    // Verify each business has its specific schedule
    const getWeekdayRange = (slots: AvailabilitySlots[]) => {
      const weekdaySlots = slots.filter(slot => {
        const date = DateTime.fromISO(slot.date);
        return date.weekday >= 1 && date.weekday <= 5;
      });
      if (weekdaySlots.length === 0) return { earliest: null, latest: null };
      
      const allTimes = weekdaySlots.flatMap(slot => 
        Object.values(slot.slots).flat().map(([time]) => time)
      );
      return {
        earliest: allTimes.sort()[0],
        latest: allTimes.sort().reverse()[0]
      };
    };

    const businessA_range = getWeekdayRange(businessA_updated);
    const businessB_range = getWeekdayRange(businessB_updated);

    // Business A should start early (06:00)
    expect(businessA_range.earliest).toBe('06:00');
    expect(parseInt(businessA_range.latest?.split(':')[0] || '0')).toBeLessThan(16);
    console.log(`[Test] Business A early hours: ${businessA_range.earliest}-${businessA_range.latest}`);

    // Business B should start late (14:00)
    expect(businessB_range.earliest).toBe('14:00');
    expect(parseInt(businessB_range.latest?.split(':')[0] || '0')).toBeGreaterThan(20);
    console.log(`[Test] Business B late hours: ${businessB_range.earliest}-${businessB_range.latest}`);

    // Business C should have weekend availability
    const businessC_weekendSlots = businessC_updated.filter(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 6 || date.weekday === 7;
    });

    expect(businessC_weekendSlots.length).toBeGreaterThan(0);
    console.log(`[Test] Business C weekend slots: ${businessC_weekendSlots.length}`);

    // Verify business isolation
    const allBusinessIds = new Set([
      ...businessA_updated.map(s => s.businessId),
      ...businessB_updated.map(s => s.businessId),
      ...businessC_updated.map(s => s.businessId)
    ]);

    expect(allBusinessIds.size).toBe(3);
  });

  it('should_maintain_independent_business_schedules', async () => {
    const today = new Date();
    // Find a Monday to ensure the 5-day window includes Friday
    let testDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    while (testDate.getDay() !== 1) { // Find Monday (1)
      testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
    }

    // Change Business B to have no Friday work
    const noFridayHours = {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: null, // No Friday work
      sat: null,
      sun: null
    };

    // Update ALL providers in Business B to remove Friday work
    await Promise.all(businessB.providers.map(async (provider, index) => {
      await CalendarSettings.save(businessB.calendarSettings[index].id, {
        providerId: provider.id,
        businessId: businessB.business.id,
        workingHours: noFridayHours,
        manageCalendar: false,
        settings: {
          timezone: 'Australia/Sydney',
          bufferTime: 15
        }
      }, { useServiceRole: true });
    }));

    console.log(`[Test] Removed Friday work from Business B (all ${businessB.providers.length} providers)`);

    // Recalculate all Business B providers' contributions
    await Promise.all(businessB.providers.map(provider => 
      recalculateProviderContribution(provider, businessB.business)
    ));

    // Get availability for all businesses
    const allResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 5), // Weekdays
      computeAggregatedAvailability(businessB.business.id, testDate, 5),
      computeAggregatedAvailability(businessC.business.id, testDate, 5)
    ]);

    const [businessA_slots, businessB_slots, businessC_slots] = allResults;

    // Business A should still have Friday availability
    const businessA_friday = businessA_slots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 5; // Friday
    });

    expect(businessA_friday).toBeDefined();
    if (businessA_friday) {
      const fridayTimes = Object.values(businessA_friday.slots).flat() as Array<[string, number]>;
      expect(fridayTimes.length).toBeGreaterThan(0);
      console.log(`[Test] Business A Friday availability: ${fridayTimes.length} time slots (maintained)`);
    }

    // Business B should have no Friday availability
    const businessB_friday = businessB_slots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 5;
    });

    expect(businessB_friday).toBeUndefined();
    console.log(`[Test] Business B Friday availability: removed`);

    // Business C should still have Friday availability
    const businessC_friday = businessC_slots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 5;
    });

    expect(businessC_friday).toBeDefined();
    if (businessC_friday) {
      const fridayTimes = Object.values(businessC_friday.slots).flat() as Array<[string, number]>;
      expect(fridayTimes.length).toBeGreaterThan(0);
      console.log(`[Test] Business C Friday availability: ${fridayTimes.length} time slots (maintained)`);
    }

    // Verify Monday-Thursday are unaffected for all businesses
    const mondayThuSlots = [businessA_slots, businessB_slots, businessC_slots].map(slots =>
      slots.filter(slot => {
        const date = DateTime.fromISO(slot.date);
        return date.weekday >= 1 && date.weekday <= 4; // Mon-Thu
      })
    );

    mondayThuSlots.forEach((slots, index) => {
      expect(slots.length).toBe(4); // Mon-Thu
      console.log(`[Test] Business ${['A', 'B', 'C'][index]} Mon-Thu slots: ${slots.length} (unchanged)`);
    });
  });

  it('should_isolate_provider_count_changes_across_businesses', async () => {
    const today = new Date();
    // Find next weekday (Monday = 1, Friday = 5) to ensure providers work
    let testDate = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);
    while (testDate.getDay() === 0 || testDate.getDay() === 6) { // Skip Sunday (0) and Saturday (6)
      testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
    }

    // Generate initial availability
    const initialResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    // Check initial provider counts
    const getProviderCount = (slots: AvailabilitySlots[]) => {
      if (slots.length === 0) return 0;
      const times = Object.values(slots[0].slots).flat() as Array<[string, number]>;
      return times.length > 0 ? times[0][1] : 0;
    };

    const initialCounts = initialResults.map(getProviderCount);
    expect(initialCounts).toEqual([1, 2, 3]); // Business A=1, B=2, C=3 providers
    console.log(`[Test] Initial provider counts: A:${initialCounts[0]}, B:${initialCounts[1]}, C:${initialCounts[2]}`);

    // Remove one provider from Business C (reduce their working days)
    const reducedHours = {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: null, // No Wednesday work
      thu: null, // No Thursday work
      fri: null, // No Friday work
      sat: null,
      sun: null
    };

    await CalendarSettings.save(businessC.calendarSettings[1].id, {
      providerId: businessC.providers[1].id,
      businessId: businessC.business.id,
      workingHours: reducedHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    console.log(`[Test] Reduced Business C provider 2 to only Mon-Tue`);

    // Recalculate only Business C's affected provider
    await recalculateProviderContribution(businessC.providers[1], businessC.business);

    // Get updated availability
    const updatedResults = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    const updatedCounts = updatedResults.map(getProviderCount);

    // Business A and B should be unchanged
    expect(updatedCounts[0]).toBe(1); // Business A still 1 provider
    expect(updatedCounts[1]).toBe(2); // Business B still 2 providers
    console.log(`[Test] Business A count unchanged: ${updatedCounts[0]}`);
    console.log(`[Test] Business B count unchanged: ${updatedCounts[1]}`);

    // Business C should still have 3 providers on days where all work
    expect(updatedCounts[2]).toBe(3); // Business C still 3 providers on available days
    console.log(`[Test] Business C count on Mon/Tue: ${updatedCounts[2]} (maintained)`);

    // Check Business C Wed-Fri availability (should have 2 providers)
    const businessC_weekSlots = await computeAggregatedAvailability(businessC.business.id, testDate, 5);
    const businessC_wednesday = businessC_weekSlots.find(slot => {
      const date = DateTime.fromISO(slot.date);
      return date.weekday === 3; // Wednesday
    });

    if (businessC_wednesday) {
      const wedTimes = Object.values(businessC_wednesday.slots).flat() as Array<[string, number]>;
      if (wedTimes.length > 0) {
        const [, wedProviderCount] = wedTimes[0];
        expect(wedProviderCount).toBe(2); // 3 providers - 1 not working = 2
        console.log(`[Test] Business C Wednesday count: ${wedProviderCount} (reduced)`);
      }
    }

    // Verify business isolation
    expect(updatedResults[0].every(slot => slot.businessId === businessA.business.id)).toBe(true);
    expect(updatedResults[1].every(slot => slot.businessId === businessB.business.id)).toBe(true);
    expect(updatedResults[2].every(slot => slot.businessId === businessC.business.id)).toBe(true);
  });

  it('should_handle_buffer_time_changes_independently', async () => {
    const today = new Date();
    const testDate = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);

    // Generate initial availability
    const initialSlots = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    const getTimeSlotCount = (slots: AvailabilitySlots[]) => {
      return slots.reduce((total, slot) => {
        return total + Object.values(slot.slots).reduce((slotTotal, timeSlots) => {
          return slotTotal + timeSlots.length;
        }, 0);
      }, 0);
    };

    const initialCounts = initialSlots.map(getTimeSlotCount);
    console.log(`[Test] Initial time slot counts: A:${initialCounts[0]}, B:${initialCounts[1]}, C:${initialCounts[2]}`);

    // Change buffer times for each business differently
    const bufferChanges = [
      { business: businessA, bufferTime: 60 }, // 1 hour buffer
      { business: businessB, bufferTime: 30 }, // 30 min buffer
      { business: businessC, bufferTime: 15 }  // Keep 15 min buffer
    ];

    // Apply buffer time changes
    const updatePromises = bufferChanges.map(({ business, bufferTime }) =>
      CalendarSettings.save(business.calendarSettings[0].id, {
        providerId: business.providers[0].id,
        businessId: business.business.id,
        workingHours: business.calendarSettings[0].workingHours,
        manageCalendar: false,
        settings: {
          timezone: 'Australia/Sydney',
          bufferTime: bufferTime
        }
      }, { useServiceRole: true })
    );

    await Promise.all(updatePromises);
    console.log(`[Test] Set buffer times: A:60min, B:30min, C:15min`);

    // Recalculate provider contributions
    const recalcPromises = [
      recalculateProviderContribution(businessA.providers[0], businessA.business),
      recalculateProviderContribution(businessB.providers[0], businessB.business),
      recalculateProviderContribution(businessC.providers[0], businessC.business)
    ];

    await Promise.all(recalcPromises);

    // Get updated availability
    const updatedSlots = await Promise.all([
      computeAggregatedAvailability(businessA.business.id, testDate, 1),
      computeAggregatedAvailability(businessB.business.id, testDate, 1),
      computeAggregatedAvailability(businessC.business.id, testDate, 1)
    ]);

    const updatedCounts = updatedSlots.map(getTimeSlotCount);
    console.log(`[Test] Updated time slot counts: A:${updatedCounts[0]}, B:${updatedCounts[1]}, C:${updatedCounts[2]}`);

    // Business A (60min buffer) should have the fewest slots
    // Business C (15min buffer) should have the most slots
    // Business B (30min buffer) should be in between
    expect(updatedCounts[0]).toBeLessThanOrEqual(updatedCounts[1]); // A <= B
    expect(updatedCounts[1]).toBeLessThanOrEqual(updatedCounts[2]); // B <= C

    // All businesses should still have some availability
    updatedCounts.forEach((count, index) => {
      expect(count).toBeGreaterThan(0);
      console.log(`[Test] Business ${['A', 'B', 'C'][index]} maintained availability: ${count} slots`);
    });

    // Verify business isolation
    const allBusinessIds = new Set([
      ...updatedSlots[0].map(s => s.businessId),
      ...updatedSlots[1].map(s => s.businessId),
      ...updatedSlots[2].map(s => s.businessId)
    ]);

    expect(allBusinessIds.size).toBe(3);
    expect(allBusinessIds.has(businessA.business.id)).toBe(true);
    expect(allBusinessIds.has(businessB.business.id)).toBe(true);
    expect(allBusinessIds.has(businessC.business.id)).toBe(true);
  });
}); 