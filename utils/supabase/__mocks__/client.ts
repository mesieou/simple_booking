export const createClient = jest.fn(() => ({
    from: jest.fn((table) => ({
      insert: jest.fn((record) => ({
        select: jest.fn(() => ({
          single: jest.fn(() => {
            if (table === "businesses") {
              return {
                data: { id: "mocked-business-id" },
                error: null,
              };
            }
            if (table === "users") {
              return {
                data: {
                  id: "mocked-user-id",
                  businessId: record.businessId ?? "mocked-business-id",
                },
                error: null,
              };
            }
            if (table === "quotes") {
              return {
                data: {
                  id: "mocked-quote-id",
                  businessId: record.businessId ?? "mocked-business-id",
                  userId: record.userId ?? "mocked-user-id",
                },
                error: null,
              };
            }
            if (table === "bookings") {
              return {
                data: {
                  id: "mocked-booking-id",
                  businessId: record.businessId ?? "mocked-business-id",
                  userId: record.userId ?? "mocked-user-id",
                  quoteId: record.quoteId ?? "mocked-user-id",
                },
                error: null,
              };
            }
            return { data: null, error: "Unknown table" };
          }),
        })),
      })),
    })),
  }));
  