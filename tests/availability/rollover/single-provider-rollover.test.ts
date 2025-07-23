import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { 
  rollAvailability, 
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

describe('Single Provider Rollover', () => {
  let testBusiness: TestBusiness;
  let createdBusinesses: TestBusiness[] = [];

  beforeAll(async () => {
    // Set timeout for setup
    jest.setTimeout(30000);
  });

  afterAll(async () => {
    // Cleanup all test data
    if (createdBusinesses.length > 0) {
      await cleanupTestData(createdBusinesses);
    }
  });

  beforeEach(async () => {
    // Create a fresh test business for each test
    testBusiness = await createTestBusiness('SingleRollover', 1);
    createdBusinesses.push(testBusiness);
  });

  afterEach(async () => {
    // Clean up after each test (but keep for final cleanup too)
    if (testBusiness) {
      await cleanupTestData([testBusiness]);
      // Remove from array to avoid double cleanup
      createdBusinesses = createdBusinesses.filter(b => b.business.id !== testBusiness.business.id);
    }
  });

  it('should_rollover_availability_for_business_with_one_provider', async () => {
    const provider = testBusiness.providers[0];
    const business = testBusiness.business;
    const calendarSettings = testBusiness.calendarSettings[0];

          // Generate initial availability (30 days)
      const today = new Date();
      const initialSlots = await computeAggregatedAvailability(
        business.id,
        today,
        30
      );
      
      // Save the computed availability
      await Promise.all(initialSlots.map(slots => slots.add()));

      expect(initialSlots.length).toBeGreaterThan(0);
    console.log(`[Test] Generated ${initialSlots.length} initial availability slots`);

    // Roll availability forward
    await rollAvailability(provider, business);

    // Verify that we still have availability slots using business-aggregated method
    const afterRolloverSlots = await AvailabilitySlots.getByBusinessAndDateRange(
      business.id,
      today.toISOString().split('T')[0],
      new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );

    expect(afterRolloverSlots.length).toBeGreaterThan(0);
    console.log(`[Test] After rollover: ${afterRolloverSlots.length} availability slots`);

    // Verify dates are in correct range (today + 30 days)
    const todayStr = DateTime.now().setZone('Australia/Sydney').toFormat('yyyy-MM-dd');
    const futureDate = DateTime.now().setZone('Australia/Sydney').plus({ days: 29 }).toFormat('yyyy-MM-dd');
    
    const hasToday = afterRolloverSlots.some(slot => slot.date.split('T')[0] === todayStr);
    const hasFuture = afterRolloverSlots.some(slot => slot.date.split('T')[0] === futureDate);
    
    expect(hasToday).toBe(true);
    expect(hasFuture).toBe(true);
  });

  it('should_delete_past_dates_and_add_new_day', async () => {
    const provider = testBusiness.providers[0];
    const business = testBusiness.business;

    // Generate initial availability
    const today = new Date();
    const initialSlots = await computeAggregatedAvailability(business.id, today, 30);
    await Promise.all(initialSlots.map(slots => slots.add()));

    // Manually create a "past" availability slot (simulate yesterday)
    const yesterday = DateTime.now().setZone('Australia/Sydney').minus({ days: 1 });
    const pastSlot = new AvailabilitySlots({
      businessId: business.id,
      date: yesterday.toFormat('yyyy-MM-dd'),
      slots: {
        "120": [["09:00", 1], ["11:00", 1]]
      }
    });
    await pastSlot.add({ useServiceRole: true });

    // Count slots before rollover using business-aggregated method
    const beforeRollover = await AvailabilitySlots.getByBusinessAndDateRange(
      business.id,
      new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // From 2 days ago
      new Date(today.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]  // To 31 days future
    );

    // Roll availability
    await rollAvailability(provider, business);

    // Count slots after rollover using business-aggregated method
    const afterRollover = await AvailabilitySlots.getByBusinessAndDateRange(
      business.id,
      new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date(today.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );

    // Verify past slot was deleted
    const pastSlotExists = afterRollover.some(slot => slot.date === yesterday.toFormat('yyyy-MM-dd'));
    expect(pastSlotExists).toBe(false);

    // Verify we have availability for future dates
    const todayStr = DateTime.now().setZone('Australia/Sydney').toFormat('yyyy-MM-dd');
    const hasToday = afterRollover.some(slot => slot.date.split('T')[0] === todayStr);
    expect(hasToday).toBe(true);

    console.log(`[Test] Slots before rollover: ${beforeRollover.length}, after: ${afterRollover.length}`);
  });

  it('should_handle_provider_not_working_on_new_day', async () => {
    const provider = testBusiness.providers[0];
    const business = testBusiness.business;
    const calendarSettings = testBusiness.calendarSettings[0];

    // Modify calendar settings to not work on weekends
    const workingHours = {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: { start: '09:00', end: '17:00' },
      sat: null, // No work on Saturday
      sun: null  // No work on Sunday
    };

    // Update calendar settings
    await CalendarSettings.save(calendarSettings.id, {
      providerId: provider.id,
      businessId: business.id,
      workingHours: workingHours,
      manageCalendar: false,
      settings: {
        timezone: 'Australia/Sydney',
        bufferTime: 15
      }
    }, { useServiceRole: true });

    // Generate initial availability
    const today = new Date();
    const initialSlots = await computeAggregatedAvailability(business.id, today, 30);
    await Promise.all(initialSlots.map(slots => slots.add()));

    // Roll availability
    await rollAvailability(provider, business);

    // Get all availability slots using business-aggregated method
    const allSlots = await AvailabilitySlots.getByBusinessAndDateRange(
      business.id,
      today.toISOString().split('T')[0],
      new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );

    // Verify no weekend slots exist
    const weekendSlots = allSlots.filter(slot => {
      const date = DateTime.fromISO(slot.date);
      const dayOfWeek = date.weekday; // 1=Monday, 7=Sunday
      return dayOfWeek === 6 || dayOfWeek === 7; // Saturday or Sunday
    });

    expect(weekendSlots.length).toBe(0);
    console.log(`[Test] Found ${weekendSlots.length} weekend slots (should be 0)`);
    console.log(`[Test] Total weekday slots: ${allSlots.length}`);
  });

  it('should_use_optimized_rollover_method', async () => {
    const provider = testBusiness.providers[0];
    const business = testBusiness.business;
    const calendarSettings = testBusiness.calendarSettings[0];

    // Generate initial availability
    const today = new Date();
    const initialSlots = await computeAggregatedAvailability(business.id, today, 30);
    await Promise.all(initialSlots.map(slots => slots.add()));

    // Count slots before rollover using business-aggregated method
    const beforeCount = await AvailabilitySlots.getByBusinessAndDateRange(
      business.id,
      today.toISOString().split('T')[0],
      new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );

    // Use optimized rollover
    await rollAggregatedAvailability(business.id);

    // Count slots after rollover using business-aggregated method
    const afterCount = await AvailabilitySlots.getByBusinessAndDateRange(
      business.id,
      today.toISOString().split('T')[0],
      new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );

    // Should maintain similar number of slots (cleaned up past, added future)
    expect(afterCount.length).toBeGreaterThan(0);
    
    // Verify we have availability for today and near future
    const todayStr = DateTime.now().setZone('Australia/Sydney').toFormat('yyyy-MM-dd');
    const hasToday = afterCount.some(slot => slot.date.split('T')[0] === todayStr);
    expect(hasToday).toBe(true);

    console.log(`[Test] Optimized rollover: ${beforeCount.length} -> ${afterCount.length} slots`);
  });
}); 