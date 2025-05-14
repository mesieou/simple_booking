import { DateTime } from "luxon";
import { User } from "../../../models/user";
import { Business } from "../../../models/business";

export const TEST_CONSTANTS = {
  TIMEZONE: 'America/New_York',
  DATE: {
    YEAR: 2024,
    MONTH: 5,
    DAYS: {
      MAY_13: 13,
      MAY_20: 20,
      MAY_27: 27
    }
  },
  WORKING_HOURS: {
    START: 9, // 9 AM
    END: 17   // 5 PM
  },
  BUFFER_TIME: 30, // 30 minutes buffer between bookings
  DURATION_INTERVALS: ["60", "90", "120", "150", "180", "240", "300", "360"], // 1h, 1.5h, 2h, 2.5h, 3h, 4h, 5h, 6h
  TEST_IDS: {
    USER: "user123",
    BUSINESS: "business123",
    QUOTE: "quote123",
    PROVIDER: "test-user-id",
    USER_ID: "user123",
    BUSINESS_ID: "business123",
    QUOTE_ID: "quote123",
    PROVIDER_ID: "test-user-id"
  },
  BOOKINGS: {
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
  }
} as const;

export const createDateTime = (day: number, hour: number, minute: number): DateTime => {
  return DateTime.fromObject({ 
    year: TEST_CONSTANTS.DATE.YEAR, 
    month: TEST_CONSTANTS.DATE.MONTH, 
    day, 
    hour, 
    minute 
  }, { zone: TEST_CONSTANTS.TIMEZONE });
};

export const isSlotAvailable = (
  slotStart: DateTime,
  slotEnd: DateTime,
  bookingStart: DateTime,
  bookingEnd: DateTime,
  bufferTime: number
): boolean => {
  const bufferEnd = bookingEnd.plus({ minutes: bufferTime });
  return slotEnd <= bookingStart || slotStart >= bufferEnd;
};

export const createTestUser = (): User => {
  return new User(
    "Test",
    "Provider",
    "provider",
    TEST_CONSTANTS.TEST_IDS.BUSINESS_ID
  );
};

export const createTestBusiness = (): Business => {
  return new Business({
    id: TEST_CONSTANTS.TEST_IDS.BUSINESS_ID,
    name: "Test Business",
    email: "business@example.com",
    phone: "123-456-7890",
    timeZone: TEST_CONSTANTS.TIMEZONE,
    serviceRatePerMinute: 1.5
  });
}; 