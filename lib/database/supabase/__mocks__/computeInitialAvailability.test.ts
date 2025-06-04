// Mock the Supabase client
jest.mock('../server');

import { User } from "../../database/models/user";
import { Booking } from "../../database/models/booking";
import { Business } from "../../database/models/business";
import { computeInitialAvailability } from "../../helpers/availability";
import { CalendarSettings } from "../../database/models/calendar-settings";
import { DateTime } from "luxon";
import { Quote } from "../../database/models/quote";

// Test constants
const TEST_TIMEZONE = 'America/New_York';
const TEST_YEAR = 2024;
const TEST_MONTH = 5;
const TEST_DAYS = {
  MAY_13: 13,
  MAY_20: 20,
  MAY_27: 27
};
const WORKING_HOURS = {
  START: 7, // 7 AM
  END: 19   // 7 PM
};
const BUFFER_TIME = 30; // 30 minutes buffer between bookings
const BOOKINGS = {
  MAY_13: {
    START_HOUR: 12,
    START_MINUTE: 0,
    DURATION_HOURS: 3
  },
  MAY_20: {
    START_HOUR: 9,
    START_MINUTE: 0,
    DURATION_HOURS: 1.5
  },
  MAY_27: {
    START_HOUR: 14,
    START_MINUTE: 0,
    DURATION_HOURS: 2
  }
};
const DURATION_INTERVALS = ["60", "90", "120", "150", "180", "240", "300", "360"]; // 1h, 1.5h, 2h, 2.5h, 3h, 4h, 5h, 6h

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

// Helper function to get last possible start time for a duration
const getLastPossibleStartTime = (durationInMinutes: number) => {
  return WORKING_HOURS.END * 60 - durationInMinutes;
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

// Helper function to create test bookings
const createTestBookings = () => {
  return [
    new Booking({
      dateTime: createDateTime(
        TEST_DAYS.MAY_13,
        BOOKINGS.MAY_13.START_HOUR,
        BOOKINGS.MAY_13.START_MINUTE
      ).toUTC().toISO() || '',
      providerId: "user123",
      userId: "customer1",
      quoteId: "2d135918-7779-487d-9a5d-3b35e4b1ee54",
      businessId: "business123",
      status: "Not Completed"
    }),
    new Booking({
      dateTime: createDateTime(
        TEST_DAYS.MAY_20,
        BOOKINGS.MAY_20.START_HOUR,
        BOOKINGS.MAY_20.START_MINUTE
      ).toUTC().toISO() || '',
      providerId: "user123",
      userId: "customer2",
      quoteId: "29026509-4c84-44ab-9204-f6fe02845030",
      businessId: "business123",
      status: "Not Completed"
    }),
    new Booking({
      dateTime: createDateTime(
        TEST_DAYS.MAY_27,
        BOOKINGS.MAY_27.START_HOUR,
        BOOKINGS.MAY_27.START_MINUTE
      ).toUTC().toISO() || '',
      providerId: "user123",
      userId: "customer3",
      quoteId: "3e246f1a-8c2b-4d9e-9f3a-1b2c3d4e5f6a",
      businessId: "business123",
      status: "Not Completed"
    })
  ];
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

// Mock Booking.getByProviderAndDateRange
jest.spyOn(Booking, 'getByProviderAndDateRange').mockImplementation(async (providerId: string, startDate: Date, endDate: Date) => {
  const bookings = createTestBookings();
  
  // Filter bookings based on the date range
  return bookings.filter(booking => {
    const bookingDate = DateTime.fromISO(booking.dateTime).setZone(TEST_TIMEZONE);
    const start = DateTime.fromJSDate(startDate).setZone(TEST_TIMEZONE);
    const end = DateTime.fromJSDate(endDate).setZone(TEST_TIMEZONE);
    return bookingDate >= start && bookingDate <= end;
  });
});

// Mock Quote.getById
jest.spyOn(Quote, 'getById').mockImplementation(async (id: string) => {
  // Different quotes with different durations
  const quotes: { [key: string]: Quote } = {
    "29026509-4c84-44ab-9204-f6fe02845030": new Quote({
      id: "29026509-4c84-44ab-9204-f6fe02845030",
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
      jobDuration: 90,
      totalDuration: 90 // 1.5 hours
    }),
    "2d135918-7779-487d-9a5d-3b35e4b1ee54": new Quote({
      id: "2d135918-7779-487d-9a5d-3b35e4b1ee54",
      pickUp: "789 Pine St",
      dropOff: "321 Elm Ave",
      baseFare: 150,
      travelFare: 30,
      userId: "user123",
      businessId: "business123",
      jobType: "house/apartment move",
      status: "accepted",
      labourFare: 75,
      total: 255,
      baseTime: 90,
      travelTime: 45,
      jobDuration: 180,
      totalDuration: 180 // 3 hours
    }),
    "3e246f1a-8c2b-4d9e-9f3a-1b2c3d4e5f6a": new Quote({
      id: "3e246f1a-8c2b-4d9e-9f3a-1b2c3d4e5f6a",
      pickUp: "123 Main St",
      dropOff: "456 Oak Ave",
      baseFare: 100,
      travelFare: 20,
      userId: "user123",
      businessId: "business123",
      jobType: "few items",
      status: "accepted",
      labourFare: 50,
      total: 170,
      baseTime: 60,
      travelTime: 30,
      jobDuration: 120,
      totalDuration: 120 // 2 hours
    })
  };
  return quotes[id];
});

describe('Initial Availability Computation', () => {
  it('should compute availability respecting all constraints', async () => {
    const user = createTestUser();
    const business = createTestBusiness();
    const testDate = createDateTime(TEST_DAYS.MAY_13, 0, 0);
    const fromDate = testDate.toJSDate();
    const days = 15;

    const availableSlots = await computeInitialAvailability(
      user,
      fromDate,
      days,
      business
    );

    // Log the complete raw output
    console.log("\nComplete Availability Output:");
    console.log(JSON.stringify(availableSlots, null, 2));

    // 1. Basic validation
    expect(availableSlots).toBeDefined();
    expect(Array.isArray(availableSlots)).toBe(true);
    expect(availableSlots.length).toBeGreaterThan(0);

    // 2. Check each day's slots
    availableSlots.forEach(daySlots => {
      DURATION_INTERVALS.forEach(duration => {
        if (daySlots.slots[duration]) {
          const times = daySlots.slots[duration];
          expect(Array.isArray(times)).toBe(true);
          expect(times.length).toBeGreaterThan(0);

          // 3. Verify slots are within working hours
          times.forEach(time => {
            const [hours, minutes] = time.split(":").map(Number);
            const timeInMinutes = hours * 60 + minutes;
            const durationInMinutes = parseInt(duration);
            const lastPossibleStartTime = getLastPossibleStartTime(durationInMinutes);
            
            expect(timeInMinutes).toBeGreaterThanOrEqual(WORKING_HOURS.START * 60);
            expect(timeInMinutes).toBeLessThanOrEqual(lastPossibleStartTime);
          });
        }
      });
    });

    // 4. Check specific days with bookings
    // May 13 booking (12:00 - 15:00)
    const may13Slots = availableSlots.find(slots => 
      slots.date === `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')}-${String(TEST_DAYS.MAY_13).padStart(2, '0')}`
    );
    expect(may13Slots).toBeDefined();
    if (may13Slots) {
      const bookingStart = createDateTime(
        TEST_DAYS.MAY_13,
        BOOKINGS.MAY_13.START_HOUR,
        BOOKINGS.MAY_13.START_MINUTE
      );
      const bookingEnd = bookingStart.plus({ hours: BOOKINGS.MAY_13.DURATION_HOURS });

      Object.entries(may13Slots.slots).forEach(([duration, times]) => {
        const durationInMinutes = parseInt(duration);
        times.forEach(time => {
          const [hours, minutes] = time.split(":").map(Number);
          const slotStart = createDateTime(TEST_DAYS.MAY_13, hours, minutes);
          const slotEnd = slotStart.plus({ minutes: durationInMinutes });

          // Verify slot is available (no overlap with booking or buffer)
          expect(isSlotAvailable(slotStart, slotEnd, bookingStart, bookingEnd, BUFFER_TIME)).toBe(true);
        });
      });
    }

    // Check May 20 booking
    const may20Slots = availableSlots.find(slots => 
      slots.date === `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')}-${String(TEST_DAYS.MAY_20).padStart(2, '0')}`
    );
    expect(may20Slots).toBeDefined();
    if (may20Slots) {
      const bookingStart = createDateTime(
        TEST_DAYS.MAY_20,
        BOOKINGS.MAY_20.START_HOUR,
        BOOKINGS.MAY_20.START_MINUTE
      );
      const bookingEnd = bookingStart.plus({ hours: BOOKINGS.MAY_20.DURATION_HOURS });

      Object.entries(may20Slots.slots).forEach(([duration, times]) => {
        const durationInMinutes = parseInt(duration);
        times.forEach(time => {
          const [hours, minutes] = time.split(":").map(Number);
          const slotStart = createDateTime(TEST_DAYS.MAY_20, hours, minutes);
          const slotEnd = slotStart.plus({ minutes: durationInMinutes });

          // Verify slot is available (no overlap with booking or buffer)
          expect(isSlotAvailable(slotStart, slotEnd, bookingStart, bookingEnd, BUFFER_TIME)).toBe(true);
        });
      });
    }

    // Check May 27 booking
    const may27Slots = availableSlots.find(slots => 
      slots.date === `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')}-${String(TEST_DAYS.MAY_27).padStart(2, '0')}`
    );
    expect(may27Slots).toBeDefined();
    if (may27Slots) {
      const bookingStart = createDateTime(
        TEST_DAYS.MAY_27,
        BOOKINGS.MAY_27.START_HOUR,
        BOOKINGS.MAY_27.START_MINUTE
      );
      const bookingEnd = bookingStart.plus({ hours: BOOKINGS.MAY_27.DURATION_HOURS });

      Object.entries(may27Slots.slots).forEach(([duration, times]) => {
        const durationInMinutes = parseInt(duration);
        times.forEach(time => {
          const [hours, minutes] = time.split(":").map(Number);
          const slotStart = createDateTime(TEST_DAYS.MAY_27, hours, minutes);
          const slotEnd = slotStart.plus({ minutes: durationInMinutes });

          // Verify slot is available (no overlap with booking or buffer)
          expect(isSlotAvailable(slotStart, slotEnd, bookingStart, bookingEnd, BUFFER_TIME)).toBe(true);
        });
      });
    }

    // 5. Verify that days with no available slots are not included
    const daysWithBookings = [
      `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')}-${String(TEST_DAYS.MAY_13).padStart(2, '0')}`,
      `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')}-${String(TEST_DAYS.MAY_20).padStart(2, '0')}`,
      `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')}-${String(TEST_DAYS.MAY_27).padStart(2, '0')}`
    ];
    const daysWithNoSlots = availableSlots.filter(slots => 
      daysWithBookings.includes(slots.date) && 
      Object.keys(slots.slots).length === 0
    );
    expect(daysWithNoSlots.length).toBe(0);
  });
}); 