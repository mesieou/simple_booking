// Mock the Supabase client
jest.mock('../server');

import { User } from "../../models/user";
import { Booking } from "../../models/booking";
import { Business } from "../../models/business";
import { Quote } from "../../models/quote";
import { computeAvailability } from "../../helpers/availability";
import { CalendarSettings } from "../../models/calendar-settings";
import { DateTime } from "luxon";

// Mock CalendarSettings.getByUserAndBusiness
jest.spyOn(CalendarSettings, 'getByUserAndBusiness').mockImplementation(async () => {
  return new CalendarSettings({
    userId: "user123",
    businessId: "business123",
    workingHours: {
      mon: { start: '07:00', end: '19:00' },
      tue: { start: '07:00', end: '19:00' },
      wed: { start: '07:00', end: '19:00' },
      thu: { start: '07:00', end: '19:00' },
      fri: { start: '07:00', end: '19:00' },
      sat: null,
      sun: null
    },
    settings: {
      timezone: 'America/New_York',
      bufferTime: 30 // 30 minutes buffer between bookings
    }
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
    })
  };
  return quotes[id] || new Quote({
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
  });
});

describe('Availability Computation', () => {
  it('should compute available slots correctly', async () => {
    // Create test user
    const user = new User(
      "Test",
      "Provider",
      "provider",
      "business123"
    );

    // Create test business
    const business = new Business({
      id: "business123",
      name: "Test Business",
      email: "business@example.com",
      phone: "123-456-7890",
      timeZone: "America/New_York",
      serviceRatePerMinute: 1.5
    });

    // Create test quote (2 hour duration)
    const quote = new Quote({
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
    });

    // Create test date in provider's timezone
    const providerTZ = 'America/New_York';
    const testDate = DateTime.fromObject({ year: 2024, month: 5, day: 13 }, { zone: providerTZ });
    
    // Create bookings in provider's timezone
    const existingBookings = [
      new Booking({
        // First day (May 13) - 2 PM in provider's timezone
        dateTime: testDate.set({ hour: 14, minute: 0 }).toUTC().toISO() || '',
        providerId: "user123",
        userId: "customer1",
        quoteId: "2d135918-7779-487d-9a5d-3b35e4b1ee54", // 3 hour duration
        businessId: "business123",
        status: "Not Completed"
      }),
      new Booking({
        // Second day (May 14) - 10 AM in provider's timezone
        dateTime: testDate.plus({ days: 1 }).set({ hour: 10, minute: 0 }).toUTC().toISO() || '',
        providerId: "user123",
        userId: "customer2",
        quoteId: "29026509-4c84-44ab-9204-f6fe02845030", // 1.5 hour duration
        businessId: "business123",
        status: "Not Completed"
      })
    ];

    // Log the bookings in both UTC and provider's timezone for debugging
    console.log("Test Bookings:");
    existingBookings.forEach(booking => {
      const bookingTime = DateTime.fromISO(booking.dateTime);
      if (bookingTime.isValid) {
        console.log(`UTC: ${bookingTime.toISO()}`);
        console.log(`Provider TZ: ${bookingTime.setZone(providerTZ).toFormat('yyyy-MM-dd HH:mm:ss')}`);
      }
    });

    // Test date range (May 13-14, 2024)
    const fromDate = testDate.toJSDate();
    const days = 2; // Test for two days

    const availableSlots = await computeAvailability(
      user,
      existingBookings,
      fromDate,
      days,
      business,
      quote
    );

    // Add assertions
    expect(availableSlots).toBeDefined();
    expect(Array.isArray(availableSlots)).toBe(true);
    expect(availableSlots.length).toBe(2); // Should have two day objects

    // Verify first day (May 13)
    const firstDaySlots = availableSlots[0];
    expect(firstDaySlots.date).toBe("2024-05-13");
    expect(firstDaySlots.slots["120"]).toBeDefined();
    const firstDayTimes = firstDaySlots.slots["120"];
    console.log("First day available times:", firstDayTimes);
    
    // Verify first day slots don't overlap with afternoon booking
    expect(firstDayTimes).not.toContain("14:00"); // Booked at 2 PM
    expect(firstDayTimes).not.toContain("14:30"); // Overlaps with 3 hour booking
    expect(firstDayTimes).not.toContain("15:00"); // Overlaps with 3 hour booking
    expect(firstDayTimes).not.toContain("15:30"); // Overlaps with 3 hour booking
    expect(firstDayTimes).not.toContain("16:00"); // Overlaps with 3 hour booking

    // Verify second day (May 14)
    const secondDaySlots = availableSlots[1];
    expect(secondDaySlots.date).toBe("2024-05-14");
    expect(secondDaySlots.slots["120"]).toBeDefined();
    const secondDayTimes = secondDaySlots.slots["120"];
    console.log("Second day available times:", secondDayTimes);

    // Verify second day slots don't overlap with morning booking
    expect(secondDayTimes).not.toContain("10:00"); // Booked at 10 AM
    expect(secondDayTimes).not.toContain("10:30"); // Overlaps with 1.5 hour booking

    // Verify slots are within working hours for both days
    [firstDayTimes, secondDayTimes].forEach(times => {
      times.forEach(time => {
        const [hours, minutes] = time.split(":").map(Number);
        const timeInMinutes = hours * 60 + minutes;
        expect(timeInMinutes).toBeGreaterThanOrEqual(7 * 60); // 7 AM
        expect(timeInMinutes).toBeLessThanOrEqual(19 * 60); // 7 PM (last slot that can fit 2 hours)
      });
    });
    
    // Log the results for inspection
    console.log("Available Slots:", JSON.stringify(availableSlots, null, 2));
  });
}); 