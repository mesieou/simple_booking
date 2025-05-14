import { Quote } from '../models/quote';
import { Booking } from '../models/booking';
import { User } from '../models/user';
import { Business } from '../models/business';


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
      
      // Generate a random date within the next 30 days
      const dateTime = new Date();
      dateTime.setDate(dateTime.getDate() + Math.floor(Math.random() * 30));
      dateTime.setHours(Math.floor(Math.random() * 24));
      dateTime.setMinutes(Math.floor(Math.random() * 60));

      const booking = new Booking({
        status: "Not Completed",
        userId: client.id!,
        providerId: provider.id!,
        quoteId: quote.id!,
        businessId: business.id!,
        dateTime: dateTime.toISOString()
      });

      try {
        const bookingData = await booking.add();
        bookings.push(booking);
      } catch (error) {
        console.error('Error creating booking:', error);
      }
    }
  }

  return bookings;
}
