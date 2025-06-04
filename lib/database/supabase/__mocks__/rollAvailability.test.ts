import { User } from "../../database/models/user";
import { Business } from "../../database/models/business";
import { rollAvailability, rollAllProvidersAvailability, computeInitialAvailability } from "../../helpers/availability";
import { CalendarSettings } from "../../database/models/calendar-settings";
import { DateTime } from "luxon";
import { AvailabilitySlots } from "../../database/models/availability-slots";
import { Booking } from "../../database/models/booking";
import { Quote } from "../../database/models/quote";
import { v4 } from 'uuid';

const TEST_TIMEZONE = 'America/New_York';
const TEST_YEAR = 2024;
const TEST_MONTH = 5;
const TEST_DAY = 13;
const WORKING_HOURS = {
  START: 7,
  END: 19
};
const BUFFER_TIME = 30;
const DURATION_INTERVALS = ["60", "90", "120", "150", "180", "240", "300", "360"];

// Mock Supabase
jest.mock('../server');

// Mock availability module
jest.mock('../../helpers/availability', () => {
  const actual = jest.requireActual('../../helpers/availability');

  return {
    ...actual,
    computeInitialAvailability: jest.fn().mockImplementation(async (user, date, days, business) => {
      // Convert the input date to a DateTime object in UTC first
      const dateTime = DateTime.fromJSDate(date);
      // Then convert to business timezone
      const dateInBusinessTZ = dateTime.setZone(business.timeZone);
      // Format the date - no need to add days since the input date is already the target date
      const zonedDate = dateInBusinessTZ.toFormat("yyyy-MM-dd");
      
      return [new (require('../../models/availability-slots').AvailabilitySlots)({
        providerId: user.id,
        date: zonedDate,
        slots: {
          "60": ["07:00", "07:30", "08:00"],
          "90": ["07:00", "07:30"],
          "120": ["07:00"],
          "150": ["07:00"],
          "180": ["07:00"],
          "240": ["07:00"],
          "300": ["07:00"],
          "360": ["07:00"]
        }
      })];
    })
  };
});


jest.mock('uuid', () => ({
  v4: () => 'test-user-id'
}));

const createDateTime = (day: number, hour: number, minute: number) => {
  return DateTime.fromObject({
    year: TEST_YEAR,
    month: TEST_MONTH,
    day,
    hour,
    minute
  }, { zone: TEST_TIMEZONE });
};

const createTestUser = () => {
  return new User(
    "Test",
    "Provider",
    "provider",
    "business123"
  );
};

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

jest.spyOn(AvailabilitySlots, 'delete').mockImplementation(async (providerId: string, date: string) => { return; });

jest.spyOn(AvailabilitySlots.prototype, 'add').mockImplementation(async () => {
  const user = createTestUser();
  const business = createTestBusiness();
  const thirtyDaysLater = DateTime.now().plus({ days: 30 }).toJSDate();
  const availability = await computeInitialAvailability(user, thirtyDaysLater, 1, business);
  return availability[0];
});

const mockQueryBuilder = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  data: null,
  error: null
};

jest.mock('../server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => mockQueryBuilder),
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user123' } }, error: null }),
        deleteUser: jest.fn().mockResolvedValue({ error: null })
      }
    }
  }))
}));

jest.spyOn(Booking, 'getByProviderAndDateRange').mockImplementation(async () => []);

jest.spyOn(Quote, 'getById').mockImplementation(async () => {
  return new Quote({
    id: "quote123",
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
    jobDuration: 60,
    totalDuration: 60
  });
});

describe('Roll Availability', () => {
  const fixedDate = "2025-05-10T12:00:00.000Z";

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder.data = null;
    mockQueryBuilder.error = null;

    // Mock DateTime.now() to return the fixed date
    const mockedNow = DateTime.fromISO(fixedDate) as DateTime<true>;
    jest.spyOn(DateTime, 'now').mockReturnValue(mockedNow);
  });

  it('should roll availability for a provider', async () => {
    const user = createTestUser();
    const business = createTestBusiness();
    const providerTZ = TEST_TIMEZONE;

    const calendarSettingsMock = new CalendarSettings({
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
        timezone: providerTZ,
        bufferTime: BUFFER_TIME
      }
    });

    // Mock calendar settings for both rollAvailability and computeInitialAvailability
    jest.spyOn(CalendarSettings, 'getByUserAndBusiness')
      .mockResolvedValue(calendarSettingsMock);

    // Calculate dates in provider's timezone
    const today = DateTime.fromISO(fixedDate).setZone(providerTZ);
    const yesterday = today.minus({ days: 1 }).toFormat("yyyy-MM-dd");
    const day30 = today.plus({ days: 30 }).toFormat("yyyy-MM-dd");

    console.log('Debug Date Information:');
    console.log('Fixed Date:', fixedDate);
    console.log('Today in provider TZ:', today.toISO());
    console.log('Yesterday:', yesterday);
    console.log('Day30:', day30);

    await rollAvailability(user, business);

    expect(AvailabilitySlots.delete).toHaveBeenCalledWith(user.id, yesterday);

    const callArgs = (computeInitialAvailability as jest.Mock).mock.calls[0];
    const dateArg = callArgs[1];
    console.log('Date passed to computeInitialAvailability:', dateArg.toISOString());
    const actualDate = DateTime.fromJSDate(dateArg).setZone(providerTZ).toFormat("yyyy-MM-dd");
    console.log('Actual date after conversion:', actualDate);

    expect(actualDate).toBe(day30);
  });
});
