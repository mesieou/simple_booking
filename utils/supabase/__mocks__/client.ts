export const createClient = jest.fn(() => ({
    from: jest.fn((table) => ({
      insert: jest.fn((record) => ({
        select: jest.fn(() => ({
          single: jest.fn(() => {
            if (table === "business") {
              return {
                data: { id: "mocked-business-id" },
                error: null,
              };
            }
            if (table === "users") {
              return {
                data: {
                  id: "mocked-user-id",
                  business_id: record.business_id ?? "mocked-business-id",
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
  