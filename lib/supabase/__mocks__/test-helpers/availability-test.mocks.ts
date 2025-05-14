import { TEST_CONSTANTS } from './availability-test.helpers';
import { CalendarSettings } from '../../../models/calendar-settings';
import { Quote } from '../../../models/quote';
import { AvailabilitySlots } from '../../../models/availability-slots';
import { Booking } from '../../../models/booking';

export const setupMocks = () => {
  // Mock Booking.getByProviderAndDateRange
  jest.spyOn(Booking, 'getByProviderAndDateRange').mockImplementation(async () => {
    return []; // Return empty array to indicate no existing bookings
  });

  // Mock instance method add() on AvailabilitySlots
  jest.spyOn(AvailabilitySlots.prototype, 'add').mockImplementation(async function(this: AvailabilitySlots) {
    return {
      providerId: this.providerId,
      date: this.date,
      slots: this.slots,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  // Mock CalendarSettings.getByUserAndBusiness
  jest.spyOn(CalendarSettings, 'getByUserAndBusiness').mockImplementation(async () => {
    return new CalendarSettings({
      userId: TEST_CONSTANTS.TEST_IDS.USER_ID,
      businessId: TEST_CONSTANTS.TEST_IDS.BUSINESS_ID,
      workingHours: {
        mon: { start: `${TEST_CONSTANTS.WORKING_HOURS.START}:00`, end: `${TEST_CONSTANTS.WORKING_HOURS.END}:00` },
        tue: { start: `${TEST_CONSTANTS.WORKING_HOURS.START}:00`, end: `${TEST_CONSTANTS.WORKING_HOURS.END}:00` },
        wed: { start: `${TEST_CONSTANTS.WORKING_HOURS.START}:00`, end: `${TEST_CONSTANTS.WORKING_HOURS.END}:00` },
        thu: { start: `${TEST_CONSTANTS.WORKING_HOURS.START}:00`, end: `${TEST_CONSTANTS.WORKING_HOURS.END}:00` },
        fri: { start: `${TEST_CONSTANTS.WORKING_HOURS.START}:00`, end: `${TEST_CONSTANTS.WORKING_HOURS.END}:00` },
        sat: null,
        sun: null
      },
      settings: {
        timezone: TEST_CONSTANTS.TIMEZONE,
        bufferTime: TEST_CONSTANTS.BUFFER_TIME
      }
    });
  });

  // Mock Quote.getById
  jest.spyOn(Quote, 'getById').mockImplementation(async () => {
    return new Quote({
      id: "new-quote",
      pickUp: "123 Main St",
      dropOff: "456 Oak Ave",
      baseFare: 100,
      travelFare: 20,
      userId: TEST_CONSTANTS.TEST_IDS.USER_ID,
      businessId: TEST_CONSTANTS.TEST_IDS.BUSINESS_ID,
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
    const slots: { [key: string]: string[] } = {};
    TEST_CONSTANTS.DURATION_INTERVALS.forEach(duration => {
      const times: string[] = [];
      let currentTime = TEST_CONSTANTS.WORKING_HOURS.START * 60;
      const endTime = TEST_CONSTANTS.WORKING_HOURS.END * 60;

      while (currentTime + parseInt(duration) <= endTime) {
        const hours = Math.floor(currentTime / 60);
        const minutes = currentTime % 60;
        times.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        currentTime += 30; // 30-minute intervals
      }

      slots[duration.toString()] = times;
    });

    return new AvailabilitySlots({
      providerId: TEST_CONSTANTS.TEST_IDS.USER_ID,
      date: `${TEST_CONSTANTS.DATE.YEAR}-${String(TEST_CONSTANTS.DATE.MONTH).padStart(2, '0')}-${String(TEST_CONSTANTS.DATE.DAYS.MAY_13).padStart(2, '0')}`,
      slots
    });
  });

  // Mock AvailabilitySlots.update
  jest.spyOn(AvailabilitySlots, 'update').mockImplementation(async (_, __, slotsData) => {
    return new AvailabilitySlots(slotsData);
  });

  // Mock AvailabilitySlots.delete
  jest.spyOn(AvailabilitySlots, 'delete').mockImplementation(async () => {
    return;
  });
}; 