// Mock the Supabase client
jest.mock('../server');

import { User } from "../../models/user";
import { Booking } from "../../models/booking";
import { Business } from "../../models/business";
import { Quote } from "../../models/quote";
import { updateDayAvailability } from "../../helpers/availability";
import { CalendarSettings } from "../../models/calendar-settings";
import { AvailabilitySlots } from "../../models/availability-slots";
import { DateTime } from "luxon";

// Test constants
const TEST_TIMEZONE = 'America/New_York';
const TEST_YEAR = 2024;
const TEST_MONTH = 5;
const TEST_DAY = 13;
const WORKING_HOURS = {
  START: 9, // 9 AM
  END: 17   // 5 PM
};
const BUFFER_TIME = 30; // 30 minutes buffer between bookings
const DURATION_INTERVALS = [60, 90, 120, 150, 180, 240, 300, 360]; // 1h, 1.5h, 2h, 2.5h, 3h, 4h, 5h, 6h

// Helper function to create DateTime object
const createDateTime = (day: number, hour: number, minute: number) => {
  return DateTime.fromObject({ 
    year: TEST_YEAR, 
    month: TEST_MONTH, 
    day, 
    hour, 
    minute 
  }, { zone: TEST_TIMEZONE });
};

// Helper function to check if a slot is available (no overlap with booking)
const isSlotAvailable = (
  slotStart: DateTime,
  slotEnd: DateTime,
  bookingStart: DateTime,
  bookingEnd: DateTime,
  bufferTime: number
) => {
  const bufferEnd = bookingEnd.plus({ minutes: bufferTime });
  // A slot is available if:
  // 1. It ends before the booking starts, OR
  // 2. It starts after the booking ends (including buffer)
  return slotEnd <= bookingStart || slotStart >= bufferEnd;
};

// Helper function to create test user
const createTestUser = () => {
  return new User(
    "Test",
    "Provider",
    "provider",
    "business123"
  );
};

// Helper function to create test business
const createTestBusiness = () => {
  return new Business({
    id: "business123",
    name: "Test Business",
    email: "business@example.com",
    phone: "123-456-7890",
    timeZone: TEST_TIMEZONE,
    serviceRatePerMinute: 1.5
  });
};

// Mock CalendarSettings.getByUserAndBusiness
jest.spyOn(CalendarSettings, 'getByUserAndBusiness').mockImplementation(async () => {
  return new CalendarSettings({
    userId: "user123",
    businessId: "business123",
    workingHours: {
      mon: { start: `${WORKING_HOURS.START}:00`, end: `${WORKING_HOURS.END}:00` },
      tue: { start: `${WORKING_HOURS.START}:00`, end: `${WORKING_HOURS.END}:00` },
      wed: { start: `${WORKING_HOURS.START}:00`, end: `${WORKING_HOURS.END}:00` },
      thu: { start: `${WORKING_HOURS.START}:00`, end: `${WORKING_HOURS.END}:00` },
      fri: { start: `${WORKING_HOURS.START}:00`, end: `${WORKING_HOURS.END}:00` },
      sat: null,
      sun: null
    },
    settings: {
      timezone: TEST_TIMEZONE,
      bufferTime: BUFFER_TIME
    }
  });
});

// Mock Quote.getById
jest.spyOn(Quote, 'getById').mockImplementation(async (id: string) => {
  return new Quote({
    id: id,
    pickUp: "123 Main St",
    dropOff: "456 Oak Ave",
    baseFare: 100,
    travelFare: 20,
    userId: "user123",
    businessId: "business123",
    jobType: "one item",
    status: "accepted",
    labourFare: 50,
    total: 170,
    baseTime: 60,
    travelTime: 30,
    jobDuration: 120,
    totalDuration: 120 // 2 hours
  });
});

// Mock AvailabilitySlots.getByProviderAndDate
jest.spyOn(AvailabilitySlots, 'getByProviderAndDate').mockImplementation(async () => {
  // Create initial slots for all duration intervals
  const slots: { [key: string]: string[] } = {};
  DURATION_INTERVALS.forEach(duration => {
    const times: string[] = [];
    let currentTime = WORKING_HOURS.START * 60; // Start time in minutes
    const endTime = WORKING_HOURS.END * 60; // End time in minutes

    while (currentTime + duration <= endTime) {
      const hours = Math.floor(currentTime / 60);
      const minutes = currentTime % 60;
      times.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
      currentTime += 30; // 30-minute intervals
    }

    slots[duration.toString()] = times;
  });

  return new AvailabilitySlots({
    providerId: "user123",
    date: `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')}-${String(TEST_DAY).padStart(2, '0')}`,
    slots
  });
});

// Mock AvailabilitySlots.update
jest.spyOn(AvailabilitySlots, 'update').mockImplementation(async (providerId: string, date: string, slotsData: any) => {
  return new AvailabilitySlots(slotsData);
});

// Mock AvailabilitySlots.delete
jest.spyOn(AvailabilitySlots, 'delete').mockImplementation(async (providerId: string, date: string) => {
  return;
});

describe('Update Day Availability', () => {
  it('should update availability when a new booking is added', async () => {
    const user = createTestUser();
    const business = createTestBusiness();
    const testDate = createDateTime(TEST_DAY, 0, 0);

    // Get initial availability
    const initialAvailability = await AvailabilitySlots.getByProviderAndDate(
      user.id,
      testDate.toFormat("yyyy-MM-dd")
    );

    console.log("\nInitial Availability:");
    console.log(JSON.stringify(initialAvailability, null, 2));

    // Create a new booking that will trigger the update
    const bookingDateTime = createDateTime(TEST_DAY, 11, 0);
    if (!bookingDateTime.isValid) {
      throw new Error('Failed to create booking date time');
    }

    const isoString = bookingDateTime.toUTC().toISO();
    if (!isoString) {
      throw new Error('Failed to convert booking date time to ISO string');
    }

    const newBooking = new Booking({
      dateTime: isoString, // 11:00 AM
      providerId: user.id,
      userId: "customer1",
      quoteId: "new-quote",
      businessId: business.id ?? "business123",
      status: "Not Completed"
    });

    // Get the quote for the new booking
    const quote = await Quote.getById(newBooking.quoteId);

    console.log("\nNew Booking Details:");
    console.log(`- Provider: ${user.firstName} ${user.lastName}`);
    console.log(`- Date: ${testDate.toFormat('yyyy-MM-dd')}`);
    console.log(`- Time: ${createDateTime(TEST_DAY, 11, 0).toFormat('HH:mm')}`);
    console.log(`- Duration: ${quote.totalDuration / 60}h`);
    console.log(`- End with buffer: ${createDateTime(TEST_DAY, 11, 0).plus({ minutes: quote.totalDuration + BUFFER_TIME }).toFormat('HH:mm')}`);

    // Update availability with the new booking
    const updatedAvailability = await updateDayAvailability(
      user,
      [newBooking],
      testDate.toJSDate(),
      business,
      quote
    );

    console.log("\nUpdated Availability:");
    console.log(JSON.stringify(updatedAvailability, null, 2));

    // Compare changes
    console.log("\nChanges Summary:");
    console.log("1. Initial durations:", Object.keys(initialAvailability?.slots || {}).join(", "));
    console.log("2. Updated durations:", Object.keys(updatedAvailability?.slots || {}).join(", "));
    console.log("3. New duration slots:", updatedAvailability?.slots[quote.totalDuration.toString()]?.length || 0);

    // 1. Basic validation
    expect(updatedAvailability).toBeDefined();
    expect(updatedAvailability).toBeInstanceOf(AvailabilitySlots);

    // 2. Check slots for the booking duration
    const bookingDurationSlots = updatedAvailability?.slots[quote.totalDuration.toString()];
    expect(bookingDurationSlots).toBeDefined();
    expect(Array.isArray(bookingDurationSlots)).toBe(true);
    expect(bookingDurationSlots?.length).toBeGreaterThan(0);

    // 3. Verify slots are within working hours
    bookingDurationSlots?.forEach(time => {
      const [hours, minutes] = time.split(":").map(Number);
      const timeInMinutes = hours * 60 + minutes;
      const durationInMinutes = quote.totalDuration;
      const lastPossibleStartTime = WORKING_HOURS.END * 60 - durationInMinutes;
      
      expect(timeInMinutes).toBeGreaterThanOrEqual(WORKING_HOURS.START * 60);
      expect(timeInMinutes).toBeLessThanOrEqual(lastPossibleStartTime);
    });

    // 4. Verify slots don't overlap with the new booking
    const bookingStart = createDateTime(TEST_DAY, 11, 0);
    const bookingEnd = bookingStart.plus({ minutes: quote.totalDuration });

    bookingDurationSlots?.forEach(time => {
      const [hours, minutes] = time.split(":").map(Number);
      const slotStart = createDateTime(TEST_DAY, hours, minutes);
      const slotEnd = slotStart.plus({ minutes: quote.totalDuration });

      // Verify slot is available (no overlap with booking or buffer)
      expect(isSlotAvailable(slotStart, slotEnd, bookingStart, bookingEnd, BUFFER_TIME)).toBe(true);
    });
  });
}); 