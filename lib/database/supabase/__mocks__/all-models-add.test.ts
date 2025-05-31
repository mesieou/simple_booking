import { Business, BusinessData } from "../../database/models/business";
import { Quote, QuoteData } from "../../database/models/quote";
import { User, UserData } from "../../database/models/user";
import { Booking, BookingData } from "../../database/models/booking";

jest.mock("../client.ts"); // Uses __mocks__/all-models.ts

describe("Business", () => {
  it("should create a booking, quote, business and use and do associations", async () => {
    const business = new Business({
      name: "Test Biz",
      email: "test@biz.com",
      phone: "123456789",
      timeZone: "Australia/Melbourne",
      serviceRatePerMinute: 1.5
    });

    // Insert business and get its ID
    const businessData = await business.add();
    expect(businessData).toBeDefined();
    expect(businessData.id).toBe("mocked-business-id");

    if (!businessData.id) throw new Error("Business ID is required");

    //creates a new user and a provider
    const user = new User({
      firstName: "Juan",
      lastName: "Berna",
      role: "admin",
      businessId: businessData.id
    });

    const provider = new User({
      firstName: "Daniel",
      lastName: "Berna",
      role: "provider",
      businessId: businessData.id
    });

    const userData = await user.add();
    const providerData = await provider.add();

    expect(userData).toBeDefined();
    expect(userData.id).toBe("mocked-user-id");
    expect(userData.businessId).toBe(businessData.id);
    expect(providerData).toBeDefined();
    expect(providerData.id).toBe("mocked-user-id");
    expect(providerData.businessId).toBe(businessData.id);

    if (!userData.id) throw new Error("User ID is required");
    if (!providerData.id) throw new Error("Provider ID is required");

    //creates a new quote and assign the user and business to the quote
    const quote = new Quote({
      pickUp: "12 Lygon Street, Carlton VIC 3053",
      dropOff: "87 Chapel Street, South Yarra VIC 3141",
      baseFare: 85,
      travelFare: 50,
      userId: userData.id,
      businessId: businessData.id,
      jobType: "one item",
      status: "pending",
      labourFare: 50,
      total: 185
    });

    //inserts the quote into the data base
    const quoteData = await quote.add();

    //tests that the booking creation does not return an issue, that it was create and the business and user were created properly
    expect(quoteData).toBeDefined();
    expect(quoteData.id).toBe("mocked-quote-id");
    expect(quoteData.businessId).toBe(businessData.id);
    expect(quoteData.userId).toBe(userData.id);

    if (!quoteData.id) throw new Error("Quote ID is required");

    //creates a new booking and assign the user and business to the booking
    const booking = new Booking({
      startTime: "2025-05-05T14:42:10.123+10:00",
      endTime: "2025-05-05T15:42:10.123+10:00",
      status: "Not Completed",
      userId: userData.id,
      providerId: providerData.id,
      quoteId: quoteData.id,
      businessId: businessData.id
    });

    //inserts the booking into the data base
    const bookingData = await booking.add();

    //tests that the booking creation does not return an issue, that it was create and the business and user were created properly
    expect(bookingData).toBeDefined();
    expect(bookingData.id).toBe("mocked-booking-id");
    expect(bookingData.businessId).toBe(businessData.id);
    expect(bookingData.userId).toBe(userData.id);
  });
});
