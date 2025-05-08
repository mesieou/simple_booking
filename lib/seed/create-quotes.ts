import { faker } from '@faker-js/faker';
import { Quote, JobType, QuoteStatus } from '../models/quote';
import { User } from '../models/user';
import { Business } from '../models/business';
import { 
  calculateTotalFare, 
  calculateTotalDuration, 
  calculateBaseFare,
  calculateTravelFare,
  calculateLabourFare,
  JOB_DURATIONS 
} from '../helpers/quote';

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

  for (let i = 0; i < numQuotes; i++) {
    const jobType = faker.helpers.arrayElement(["one item", "few items", "house/apartment move"]) as JobType;
    
    // Generate random times
    const baseTime = faker.number.int({ min: 5, max: 90 });
    const travelTime = faker.number.int({ min: 5, max: 90 });
    const jobDuration = JOB_DURATIONS[jobType];
    const totalDuration = calculateTotalDuration(baseTime, travelTime, jobType);
    
    const baseFare = calculateBaseFare(baseTime, business.serviceRatePerMinute);
    const travelFare = calculateTravelFare(travelTime, business.serviceRatePerMinute);
    const labourFare = calculateLabourFare(jobType, business.serviceRatePerMinute);
    const total = calculateTotalFare(baseTime, travelTime, jobType, business.serviceRatePerMinute);

    const quote = new Quote({
      pickUp: faker.location.streetAddress(),
      dropOff: faker.location.streetAddress(),
      baseTime,
      travelTime,
      jobDuration,
      totalDuration,
      baseFare,
      travelFare,
      labourFare,
      total,
      userId: client.id!,
      businessId: business.id!,
      jobType,
      status: faker.helpers.arrayElement(["pending", "accepted", "rejected"]) as QuoteStatus
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
