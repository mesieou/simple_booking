import { Business } from "../../business";
import { Quote } from "../../quote";
import { User } from "../../user";
import { Booking } from "../../booking";

jest.mock("../client.ts"); // Uses __mocks__/all-models.ts

describe("Business", () => {
  it("should create a booking, quote, business and use and do associations", async () => {
    const workingHours = {
      Monday: { start: "09:00", end: "17:00" },
    };

    const business = new Business(
      "Test Biz",
      "test@biz.com",
      "123456789",
      "Australia/Melbourne",
      workingHours,
      1.5
    );

    // Insert business and get its ID
    const { data: bizData, error: bizError } = await business.add()

    expect(bizError).toBeNull();
    expect(bizData).toBeDefined();





    //creates a new user and a provider
    const user = new User("Juan", "Berna", "Owner", bizData.id);
    const provider = new User("Daniel", "Berna", "Provider", bizData.id);

    const { data: providerData, error: providerError } = await user.add()
    const { data: userData, error: userError } = await user.add()

    expect(userError).toBeNull();
    expect(userData).toBeDefined();
    expect(userData.businessId).toBe(bizData.id);
    expect(providerError).toBeNull();
    expect(providerData).toBeDefined();
    expect(providerData.businessId).toBe(bizData.id);






    //creates a new quote and assign the suer and business to the quote
    const quote = new Quote(
      "12 Lygon Street, Carlton VIC 3053",
      "87 Chapel Street, South Yarra VIC 3141",
      85,
      userData.id,
      bizData.id
    )

    //inserts the quote into the data base
    const {data: quoteData, error: quoteError } = await quote.add();

    //tests that the booking creation does not return an issue, that it was create and the business and user were created properly
    expect(quoteError).toBeNull();
    expect(quoteData).toBeDefined();
    expect(quoteData.businessId).toBe(bizData.id);
    expect(quoteData.userId).toBe(userData.id);





     //creates a new booking and assign the suer and business to the booking
     const booking = new Booking(
      "2025-05-05T14:42:10.123+10:00",
      "Not Completed",
      userData.id,
      providerData.id,
      quoteData.id,
      bizData.id
    )

    //inserts the booking into the data base
    const {data: bookingData, error: bookingError } = await booking.add();

    //tests that the booking creation does not return an issue, that it was create and the business and user were created properly
    expect(bookingError).toBeNull();
    expect(bookingData).toBeDefined();
    expect(bookingData.businessId).toBe(bizData.id);
    expect(bookingData.userId).toBe(userData.id);
  });
});
