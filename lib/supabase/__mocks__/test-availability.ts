// Mock the Supabase client
jest.mock('../server');

import { User } from "../../models/user";
import { Booking } from "../../models/booking";
import { Business } from "../../models/business";
import { Quote } from "../../models/quote";
import { computeAvailability } from "../../helpers/availability";
import { CalendarSettings } from "../../models/calendar-settings";

// Mock CalendarSettings.getByUserAndBusiness
jest.spyOn(CalendarSettings, 'getByUserAndBusiness').mockImplementation(async () => {
  return new CalendarSettings({
    userId: "user123",
    businessId: "business123",
    workingHours: {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: { start: '09:00', end: '17:00' },
      sat: null,
      sun: null
    },
    settings: {
      timezone: 'America/New_York'
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

async function testAvailability() {
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

  // Create some existing bookings with different quote durations
  const existingBookings = [
    new Booking({
      dateTime: "2024-05-13T10:00:00Z", // Monday, 10 AM
      providerId: "user123",
      userId: "customer1",
      quoteId: "29026509-4c84-44ab-9204-f6fe02845030", // 1.5 hour duration
      businessId: "business123",
      status: "Not Completed"
    }),
    new Booking({
      dateTime: "2024-05-13T14:00:00Z", // Monday, 2 PM
      providerId: "user123",
      userId: "customer2",
      quoteId: "2d135918-7779-487d-9a5d-3b35e4b1ee54", // 3 hour duration
      businessId: "business123",
      status: "Not Completed"
    })
  ];

  // Test date range (May 13, 2024 - Monday)
  const fromDate = new Date("2024-05-13");
  const days = 1; // Test for one day

  try {
    const availableSlots = await computeAvailability(
      user,
      existingBookings,
      fromDate,
      days,
      business,
      quote
    );

    console.log("Available Slots:");
    console.log(JSON.stringify(availableSlots, null, 2));
  } catch (error) {
    console.error("Error computing availability:", error);
  }
}

// Run the test
testAvailability(); 