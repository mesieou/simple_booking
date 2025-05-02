export const createClient = () => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: "mocked-business-id" },
            error: null,
          })),
        })),
      })),
    })),
  });
  