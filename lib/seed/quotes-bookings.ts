import { faker } from '@faker-js/faker';
import { Quote, JobType, QuoteStatus } from '../models/quote';
import { Booking, BookingError, BookingStatus } from '../models/booking';
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

  for (let i = 0; i < numQuotes; i++) {
    const baseFare = faker.number.int({ min: 50, max: 300 });
    const travelFare = faker.number.int({ min: 20, max: 150 });
    const labourFare = faker.number.int({ min: 50, max: 200 });
    const total = baseFare + travelFare + labourFare;

    const quote = new Quote({
      pickUp: faker.location.streetAddress(),
      dropOff: faker.location.streetAddress(),
      baseFare,
      travelFare,
      userId: client.id!,
      businessId: business.id!,
      jobType: faker.helpers.arrayElement(["one item", "few items", "house/apartment move"]) as JobType,
      status: faker.helpers.arrayElement(["pending", "accepted", "rejected"]) as QuoteStatus,
      labourFare,
      total
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

export async function createBookings(
  client: User,
  providers: User[],
  quotes: Quote[],
  business: Business
): Promise<Booking[]> {
  const bookings: Booking[] = [];

  for (const quote of quotes) {
    if (quote.status === 'accepted') {
      const provider = providers[Math.floor(Math.random() * providers.length)];

      const booking = new Booking({
        status: "Not Completed",
        userId: client.id!,
        providerId: provider.id!,
        quoteId: quote.id!,
        businessId: business.id!
      });

      try {
        const bookingData = await booking.add();  // Use the instance method
        bookings.push(booking);  // Push the Booking instance
      } catch (error) {
        console.error('Error creating booking:', error instanceof BookingError ? error.originalError : error);
      }
    }
  }

  return bookings;
}
