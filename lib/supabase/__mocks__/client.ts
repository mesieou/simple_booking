export const createClient = jest.fn(() => ({
    from: jest.fn((table) => ({
      insert: jest.fn((record) => ({
        select: jest.fn(() => ({
          single: jest.fn(() => {
            if (table === "businesses") {
              return {
                data: {
                  id: "mocked-business-id",
                  name: record.name,
                  email: record.email,
                  phone: record.phone,
                  timeZone: record.timeZone,
                  serviceRatePerMinute: record.serviceRatePerMinute,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                },
                error: null
              };
            }
            if (table === "users") {
              return {
                data: {
                  id: "mocked-user-id",
                  firstName: record.firstName,
                  lastName: record.lastName,
                  role: record.role,
                  businessId: record.businessId ?? "mocked-business-id",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                },
                error: null
              };
            }
            if (table === "quotes") {
              return {
                data: {
                  id: "mocked-quote-id",
                  pickUp: record.pickUp,
                  dropOff: record.dropOff,
                  baseFare: record.baseFare,
                  travelFare: record.travelFare,
                  userId: record.userId ?? "mocked-user-id",
                  businessId: record.businessId ?? "mocked-business-id",
                  jobType: record.jobType,
                  status: record.status,
                  labourFare: record.labourFare,
                  total: record.total,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                },
                error: null
              };
            }
            if (table === "bookings") {
              return {
                data: {
                  id: "mocked-booking-id",
                  startTime: record.startTime,
                  endTime: record.endTime,
                  status: record.status,
                  userId: record.userId ?? "mocked-user-id",
                  providerId: record.providerId ?? "mocked-provider-id",
                  quoteId: record.quoteId ?? "mocked-quote-id",
                  businessId: record.businessId ?? "mocked-business-id",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                },
                error: null
              };
            }
            if (table === "events") {
              return {
                data: {
                  id: "mocked-event-id",
                  summary: record.summary,
                  description: record.description,
                  location: record.location,
                  startTime: record.startTime,
                  endTime: record.endTime,
                  status: record.status,
                  userId: record.userId ?? "mocked-user-id",
                  calendarId: record.calendarId ?? "mocked-calendar-id",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                },
                error: null
              };
            }
            if (table === "calendarSettings") {
              return {
                data: {
                  id: "mocked-settings-id",
                  userId: record.userId ?? "mocked-user-id",
                  businessId: record.businessId ?? "mocked-business-id",
                  workingHours: record.workingHours,
                  manageCalendar: record.manageCalendar,
                  calendarId: record.calendarId,
                  calendarType: record.calendarType,
                  settings: record.settings,
                  lastSync: record.lastSync,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                },
                error: null
              };
            }
            return { data: null, error: "Unknown table" };
          }),
        })),
      })),
      update: jest.fn((record) => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => {
              return {
                data: {
                  ...record,
                  updatedAt: new Date().toISOString()
                },
                error: null
              };
            }),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          error: null
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => {
            return {
              data: {
                id: "mocked-id",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              error: null
            };
          }),
        })),
      })),
    })),
  }));
  