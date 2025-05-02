import { Business } from "../../business";
import { User } from "../../user";

jest.mock("../client.ts"); // Uses __mocks__/client.ts

describe("Business", () => {
  it("should create a business and associated user successfully", async () => {
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

    //creates a new user
    const user = new User("Juan", "Berna", "Owner", bizData.id);

    // Insert user
    const { data: userData, error: userError } = await user.add()

    expect(userError).toBeNull();
    expect(userData).toBeDefined();
    expect(userData.business_id).toBe(bizData.id);
  });
});
