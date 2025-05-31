import { faker } from '@faker-js/faker';
import { DateTime } from 'luxon';
import { Event } from '../models/events';

export async function createEventsForUser(
  userId: string,
  numEvents: number = 5
): Promise<Event[]> {
  const events: Event[] = [];

  for (let i = 0; i < numEvents; i++) {
    const start = DateTime.now().plus({ days: i, hours: 9 }).toISO();
    const end = DateTime.now().plus({ days: i, hours: 10 }).toISO();

    const event = new Event({
      summary: faker.lorem.words(3),
      startTime: start,
      endTime: end,
      status: "confirmed",
      userId: userId,
      description: faker.lorem.sentence(),
      location: faker.location.streetAddress()
    });

    try {
      await event.add();
      events.push(event);
    } catch (error) {
      console.error("Error creating event:", error);
      throw error; // Keep this for now to stop silent failures
    }
  }

  return events;
} 