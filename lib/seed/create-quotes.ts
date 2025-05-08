import { faker } from '@faker-js/faker';
import { Quote, JobType, QuoteStatus } from '../models/quote';
import { User } from '../models/user';
import { Business } from '../models/business';

export async function createQuotes(
  client: User | null,
  business: Business,
  numQuotes: number = 5
): Promise<Quote[]> {
  const quotes: Quote[] = [];

  // If no client, return empty array
  if (!client) {
    console.warn('No client provided for quote creation');
    return quotes;
  }

  // Define job durations based on job type (in minutes)
  const jobDurations = {
    "one item": 30,
    "few items": 60,
    "house/apartment move": 180
  };

  // Define rate per minute for base and travel time
  const BASE_RATE_PER_MINUTE = 1.5; // $1.50 per minute
  const TRAVEL_RATE_PER_MINUTE = 1.0; // $1.00 per minute

  for (let i = 0; i < numQuotes; i++) {
    const jobType = faker.helpers.arrayElement(["one item", "few items", "house/apartment move"]) as JobType;
    
    // Generate random times
    const baseTime = faker.number.int({ min: 5, max: 90 });
    const travelTime = faker.number.int({ min: 5, max: 90 });
    const jobDuration = jobDurations[jobType];
    const totalDuration = baseTime + travelTime + jobDuration;

    // Calculate fares based on time
    const baseFare = Math.round(baseTime * BASE_RATE_PER_MINUTE);
    const travelFare = Math.round(travelTime * TRAVEL_RATE_PER_MINUTE);
    const labourFare = Math.round(jobDuration * BASE_RATE_PER_MINUTE);
    const total = baseFare + travelFare + labourFare;

    const quote = new Quote({
      pickUp: faker.location.streetAddress(),
      dropOff: faker.location.streetAddress(),
      baseFare,
      travelFare,
      userId: client.id!,
      businessId: business.id!,
      jobType,
      status: faker.helpers.arrayElement(["pending", "accepted", "rejected"]) as QuoteStatus,
      labourFare,
      total,
      baseTime,
      travelTime,
      jobDuration,
      totalDuration
    });

    try {
      const quoteData = await quote.add();
      quotes.push(quote);
    } catch (error) {
      console.error('Error creating quote:', error);
    }
  }

  return quotes;
}
