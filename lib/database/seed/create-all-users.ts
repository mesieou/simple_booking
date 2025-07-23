import { faker } from '@faker-js/faker';
import { User, UserRole } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';
import { createCalendarSettings } from './create-calendar-settings';
import { createEventsForUser } from './create-events';
import { createUser } from './user';
import { createClient } from '../supabase/server';
import { User as SupabaseUser } from '../models/user';
import { computeAggregatedAvailability } from '@/lib/general-helpers/availability';

export async function createAllUsers(business: Business) {
  if (!business.id) {
    throw new Error('Business ID is required');
  }

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
    const { settings, calendarId } = await createCalendarSettings(owner.id!, business);
    calendarIds.set(owner.id!, calendarId!);
    
    // Create initial availability for owner/provider
    const fromDate = new Date();
    const initialAvailability = await computeAggregatedAvailability(business.id, fromDate, 30);
    await Promise.all(initialAvailability.map(slots => slots.add()));
    
    await createEventsForUser(owner.id!);
  } else {
    // Create additional provider users
    const numProviders = 3;
    for (let i = 0; i < numProviders; i++) {
      const provider = await createUser('provider', business);
      if (provider) {
        providers.push(provider);
        const { settings, calendarId } = await createCalendarSettings(provider.id!, business);
        calendarIds.set(provider.id!, calendarId!);
        
        // Create initial availability for each provider
        const fromDate = new Date();
        const initialAvailability = await computeAggregatedAvailability(business.id, fromDate, 30);
        await Promise.all(initialAvailability.map(slots => slots.add()));
        
        await createEventsForUser(provider.id!);
      }
    }
  }

  return { providers, client };
} 