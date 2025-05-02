import { Business } from "../../business";
jest.mock("../supabase/client"); // Use the mock from __mocks__/client.ts

describe("Business", () => {
  it("should create a business successfully", async () => {
    const workingHours = {
      Monday: { start: "09:00", end: "17:00" },
    };

    const business = new Business(
      "Test Biz",
      "test@biz.com",
      "123456789",
      "Australia/Melbourne",
      workingHours,
      1.50
    );

    const { data, error } = await business.add();

    expect(data).toBeDefined();
    expect(data.id).toBe("mocked-business-id");
    expect(error).toBeNull();
  });
});
