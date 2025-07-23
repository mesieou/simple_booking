# Availability System Tests

This test suite comprehensively tests the multi-provider availability system, covering rollover, booking impact, and calendar changes across different business scenarios.

## Test Structure

```
tests/availability/
├── helpers/
│   └── availability-test-factory.ts     # Test data factories and utilities
├── rollover/
│   ├── single-provider-rollover.test.ts   # Single provider rollover scenarios  
│   ├── multi-provider-rollover.test.ts    # Multi-provider within one business
│   └── multi-business-rollover.test.ts    # Multiple businesses isolation
├── booking-impact/
│   ├── single-provider-booking.test.ts    # Single provider booking effects
│   ├── multi-provider-booking.test.ts     # Multi-provider booking effects  
│   └── multi-business-booking.test.ts     # Multiple businesses booking isolation
├── calendar-changes/
│   ├── single-provider-changes.test.ts    # Single provider schedule changes
│   ├── multi-provider-changes.test.ts     # Multi-provider schedule changes
│   └── multi-business-changes.test.ts     # Multiple businesses schedule isolation
├── jest.config.js                         # Jest configuration
├── jest.setup.js                          # Test setup and environment
├── package.json                           # Test dependencies and scripts
└── README.md                              # This documentation
```

## Core Functions Under Test

### Rollover Functions
- `rollAggregatedAvailability(businessId)` - Business-level daily rollover
- `rollAvailabilityOptimized(user, business, calendarSettings)` - Legacy provider rollover
- `computeAggregatedAvailability(businessId, fromDate, days)` - Generate aggregated availability

### Booking Impact Functions  
- `updateDayAvailability(user, existingBookings, date, business, quote)` - Update availability after booking
- `computeDayAggregatedAvailability(businessId, date)` - Single day aggregated calculation

### Calendar Change Functions
- Calendar settings updates and their impact on availability
- Provider schedule modifications and recalculation

## Test Scenarios

### 🔄 Rollover Tests

**Single Provider:**
- Basic rollover functionality (delete past, add future)
- Handling non-working days
- Optimized vs standard rollover methods

**Multi-Provider (Same Business):**
- Aggregated availability rollover 
- Different working schedules combination
- Provider overlap handling

**Multi-Business:**
- Business isolation during rollover
- Simultaneous rollover operations
- No cross-contamination of availability

### 📅 Booking Impact Tests

**Single Provider:**
- Availability decrease when bookings created
- Overlapping time slot removal
- Multiple duration slot updates
- Buffer time handling

**Multi-Provider (Same Business):**
- Provider count reduction when one gets booked
- Maintaining availability from other providers
- Removing slots when all providers busy
- Concurrent booking handling

**Multi-Business:**
- Only target business affected by bookings
- Other businesses remain unaffected
- Independent booking processing

### ⚙️ Calendar Changes Tests

**Single Provider:**
- Working hours changes recalculation
- Adding/removing working days
- Future availability updates

**Multi-Provider (Same Business):**
- One provider's changes affecting aggregated availability
- Maintaining other providers' availability
- Business hours recalculation

**Multi-Business:**
- Only target business updated
- Other businesses unaffected
- Independent schedule management

## Running Tests

```bash
# Install dependencies
cd tests/availability
npm install

# Run all availability tests
npm test

# Run specific test categories
npm run test:rollover
npm run test:booking-impact  
npm run test:calendar-changes

# Run individual test files
npm run test:single
npm run test:multi
npm run test:businesses

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Test Data Factory

The `availability-test-factory.ts` provides utilities for:

**Business Creation:**
- `createTestBusiness(name, numberOfProviders)` - Create business with providers
- Automatic user account creation
- Calendar settings setup
- Service creation

**Booking Creation:**  
- `createTestBooking(providerId, businessId, serviceId, dateTime, duration)` - Create test bookings
- Quote generation
- Proper booking-quote relationships

**Cleanup:**
- `cleanupTestData(businesses)` - Clean all test data
- Proper deletion order (foreign key constraints)
- Auth user cleanup

**Assertions:**
- `expectAvailabilitySlots(slots, date, businessId)` - Validate availability structure
- `expectNoAvailabilitySlots(slots)` - Validate empty availability

## Key Testing Principles

1. **Isolation**: Each test creates fresh data and cleans up afterward
2. **Real Database**: Tests use actual Supabase database for authentic behavior
3. **Sequential Execution**: Tests run one at a time to avoid conflicts
4. **Comprehensive Coverage**: Tests cover single/multi-provider and single/multi-business scenarios
5. **Edge Cases**: Buffer times, overlapping bookings, timezone handling
6. **Declarative Naming**: Test names clearly describe the scenario being tested

## Database Schema Used

The tests work with the existing database schema:
- `users` table with roles (admin, admin/provider, provider)
- `calendarSettings` table linking providers to businesses  
- `availabilitySlots` table storing generated availability
- `bookings` and `quotes` tables for booking impact testing
- `businesses` table for multi-business scenarios

## Integration with Main System

These tests validate the core availability functions used by:
- Cron jobs for daily rollover
- Booking creation APIs  
- Provider schedule management
- WhatsApp bot availability queries
- Customer booking interface

The test suite ensures the multi-provider availability system works correctly across all business scenarios while maintaining proper isolation and data integrity. 