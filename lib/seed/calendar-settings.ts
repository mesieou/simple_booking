import { faker } from '@faker-js/faker';
import { CalendarSettings } from '../models/calendar-settings';
import { Business } from '../models/business';

export async function createCalendarSettings(
  userId: string,
  business: Business
): Promise<{ settings: CalendarSettings | null, calendarId: string | null }> {
  const useCalendar = faker.datatype.boolean();
  const settingsData = {
    userId,
    businessId: business.id!,
    workingHours: CalendarSettings.getDefaultWorkingHours(),
    calendarType: useCalendar ? faker.helpers.arrayElement(['google', 'outlook']) : undefined,
    calendarId: undefined,
    settings: {
      bufferTime: faker.helpers.arrayElement([15, 30, 45]),
      timezone: business.timeZone
    }
  };

  try {
    const settings = await CalendarSettings.save(undefined, settingsData);
    return {
      settings: settings,
      calendarId: null
    };
  } catch (error) {
    console.error('Error creating calendar settings:', error);
    return { settings: null, calendarId: null };
  }
} 