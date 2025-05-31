import { faker } from '@faker-js/faker';
import { Quote, QuoteStatus } from '../models/quote';
import { User } from '../models/user';
import { Business } from '../models/business';
import { createServices } from './create-services';
import {
  calculateTravelCost,
  calculateTotalJobCost,
  calculateTotalJobDuration,
  computeQuoteEstimation
} from '@/lib/general-helpers/quote-cost-calculator';

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

  // Create services for the business
  const services = await createServices(business, 1);
  const service = services[0];

  for (let i = 0; i < numQuotes; i++) {
    const travelTimeEstimate = faker.number.int({ min: 5, max: 90 });
    const totalJobDurationEstimation = calculateTotalJobDuration(service, business, travelTimeEstimate);
    const travelCostEstimate = calculateTravelCost(service, business, travelTimeEstimate);
    const totalJobCostEstimation = calculateTotalJobCost(service, business, travelTimeEstimate).totalJobCost;

    const quote = new Quote({
      pickUp: faker.location.streetAddress(),
      dropOff: faker.location.streetAddress(),
      userId: client.id!,
      businessId: business.id!,
      serviceId: service.id!,
      travelTimeEstimate,
      totalJobDurationEstimation,
      travelCostEstimate,
      totalJobCostEstimation,
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
