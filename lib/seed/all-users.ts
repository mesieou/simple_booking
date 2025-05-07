import { faker } from '@faker-js/faker';
import { User, UserRole } from '@/lib/models/user';
import { Business } from '@/lib/models/business';
import { createCalendarSettings } from './calendar-settings';
import { createEventsForUser } from './events';
import { createUser } from './user';

export async function createAllUsers(business: Business) {
  const providers: User[] = [];
  const calendarIds = new Map<string, string>();

  // Create owner
  const owner = await createUser(
    faker.helpers.arrayElement(['admin', 'admin/provider', 'provider']) as UserRole,
    business
  );

  // Create client user
  const client = await createUser('customer', business);

  // If owner is admin/provider, add them to providers
  if (owner?.role === 'admin/provider') {
    providers.push(owner);
    await createEventsForUser(owner.id!);
    const { settings, calendarId } = await createCalendarSettings(owner.id!, business);
    calendarIds.set(owner.id!, calendarId!);

  } else {
    // Create additional provider users
    const numProviders = 3;
    for (let i = 0; i < numProviders; i++) {
      const provider = await createUser('provider', business);
      if (provider) {
        providers.push(provider);
        const { settings, calendarId } = await createCalendarSettings(provider.id!, business);
        calendarIds.set(provider.id!, calendarId!);
        await createEventsForUser(provider.id!);
      }
    }
  }

  return { providers, client };
} 