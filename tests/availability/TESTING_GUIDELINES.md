# Availability Testing Guidelines

## Overview
This document contains critical guidelines for writing availability tests in the booking system. These guidelines are based on real issues encountered during development and their solutions.

## 🚨 Critical Race Condition Fix

### Problem
Tests that call `computeAggregatedAvailability()` but don't save to database cause booking updates to fail with:
```
CRITICAL: No existing availability found for 2025-XX-XX - availability cannot be updated!
```

### Solution Pattern
**ALWAYS** save availability to database before creating bookings:

```typescript
// Generate availability
const initialSlots = await computeAggregatedAvailability(
  business.id,
  testDate,
  daysToGenerate
);

// ✅ CRITICAL: Save to database
await Promise.all(initialSlots.map(slot => slot.add()));

// ✅ CRITICAL: Wait for database commit
await new Promise(resolve => setTimeout(resolve, 100));

// Now safe to create bookings
const booking = await createTestBooking(...);
```

**Why this happens:**
- `computeAggregatedAvailability()` only computes availability in memory
- `createTestBooking()` triggers `updateBusinessAvailability()` which looks for existing availability in database
- Without saving first, the booking update fails

## 📅 Date and Time Format Guidelines

### Date Format Issues

**❌ WRONG - Creates invalid dates:**
```typescript
// availableSlot.date = "2025-07-28T00:00:00+00:00"
const dateTime = `${availableSlot.date}T14:00:00`; // Results in "2025-07-28T00:00:00+00:00T14:00:00"
```

**✅ CORRECT - Extract date part first:**
```typescript
const dateOnly = availableSlot.date.split('T')[0]; // "2025-07-28"
const dateTime = `${dateOnly}T14:00:00`; // "2025-07-28T14:00:00"
```

### Timezone Handling
Always use Sydney timezone for bookings to match business settings:

```typescript
const { DateTime } = require('luxon');
const dateOnly = availableSlot.date.split('T')[0];
const sydneyDateTime = DateTime.fromISO(`${dateOnly}T09:00:00`, { zone: 'Australia/Sydney' });
const bookingDateTime = sydneyDateTime.toJSDate();
```

## 🗓️ Weekend Handling

### Problem
Providers don't work weekends, so availability generation returns empty arrays on Saturday/Sunday.

### Solution
**ALWAYS** skip weekends when generating test dates:

```typescript ❌ WRONG:
const testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Could be weekend

✅ CORRECT:
let testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
while (testDate.getDay() === 0 || testDate.getDay() === 6) { // Skip Sunday (0) and Saturday (6)
  testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
}
```

### Weekend Day Reference
- Sunday = 0
- Monday = 1  
- Tuesday = 2
- Wednesday = 3
- Thursday = 4
- Friday = 5
- Saturday = 6

## 🗄️ Supabase Database Guidelines

### Environment Setup
Tests run against development environment with service role client:
```typescript
// Logs you'll see:
[Environment] Using development environment for service-role client
```

### Row Level Security (RLS)
Tests bypass RLS using service role client for:
- User creation: `[User.add] Using adminSupa client (bypasses RLS for user creation)`
- Calendar settings: `[CalendarSettings.save] Using service role client`
- Availability retrieval: `[AvailabilitySlots.getByBusinessAndDate] Using service role client`

### Test Cleanup
All tests automatically clean up created businesses:
```
✅ Cleaned up test business: MultiBooking Test Business 1753345XXX
```

## 📋 Test Structure Best Practices

### 1. Test Business Setup
```typescript
let testBusiness: BusinessTestSetup;

beforeAll(async () => {
  testBusiness = await createMultiProviderTestBusiness({
    providerCount: 3,
    businessName: 'Test Business'
  });
});

afterAll(async () => {
  await cleanupTestBusiness(testBusiness);
});
```

### 2. Availability Generation Pattern
```typescript
// 1. Generate date (skip weekends)
let testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
while (testDate.getDay() === 0 || testDate.getDay() === 6) {
  testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
}

// 2. Compute availability
const initialSlots = await computeAggregatedAvailability(
  business.id,
  testDate,
  1
);

// 3. Save to database (CRITICAL!)
await Promise.all(initialSlots.map(slot => slot.add()));
await new Promise(resolve => setTimeout(resolve, 100));

// 4. Verify availability exists
expect(initialSlots.length).toBeGreaterThan(0);
```

### 3. Booking Creation Pattern
```typescript
// Extract clean date
const dateOnly = availableSlot.date.split('T')[0];
const sydneyDateTime = DateTime.fromISO(`${dateOnly}T09:00:00`, { zone: 'Australia/Sydney' });
const bookingDateTime = sydneyDateTime.toJSDate();

// Create booking
const { booking, quote } = await createTestBooking(
  providerId,
  businessId,
  serviceId,
  bookingDateTime,
  durationMinutes
);
```

## 🚀 Performance Considerations

### Parallel vs Sequential Operations
- ✅ **Parallel**: Multiple `computeAggregatedAvailability` calls
- ✅ **Parallel**: Multiple `slot.add()` operations  
- ❌ **Sequential**: Booking creation (to avoid race conditions)

### Test Timeouts
Availability tests can be slow due to:
- Database operations
- Multiple provider computations
- Business cleanup

Typical test durations:
- Single provider: ~2-3 seconds
- Multi provider: ~3-5 seconds  
- Multi business: ~5-7 seconds

## 🐛 Common Error Patterns

### 1. "Invalid time value" 
**Cause**: Incorrect date concatenation
**Fix**: Extract date part first: `availableSlot.date.split('T')[0]`

### 2. "Expected > 0, Received: 0"
**Cause**: Testing on weekend dates
**Fix**: Skip weekend dates in test setup

### 3. "CRITICAL: No existing availability found"
**Cause**: Missing `slot.add()` calls
**Fix**: Always save availability before creating bookings

### 4. "Cannot read properties of undefined (reading 'date')"
**Cause**: Empty availability array (usually weekend issue)
**Fix**: Verify `initialSlots.length > 0` and skip weekends

## 🎯 Test Validation Checklist

Before writing availability tests, ensure:

- [ ] **Weekend handling**: Skip Saturday (6) and Sunday (0)
- [ ] **Date format**: Use `availableSlot.date.split('T')[0]` for clean dates
- [ ] **Availability saving**: Call `slot.add()` before booking creation
- [ ] **Race condition prevention**: Add 100ms delay after saving
- [ ] **Timezone consistency**: Use 'Australia/Sydney' for business timezone
- [ ] **Test cleanup**: Proper business cleanup in `afterAll`
- [ ] **Assertions**: Verify availability exists before using it

## 📝 Example Complete Test

```typescript
it('should_reduce_provider_count_when_booking_created', async () => {
  const business = testBusiness.business;
  const providers = testBusiness.providers;
  const service = testBusiness.services[0];

  // 1. Generate weekday date
  const today = new Date();
  let testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  while (testDate.getDay() === 0 || testDate.getDay() === 6) {
    testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
  }

  // 2. Generate and save availability
  const initialSlots = await computeAggregatedAvailability(business.id, testDate, 1);
  await Promise.all(initialSlots.map(slot => slot.add()));
  await new Promise(resolve => setTimeout(resolve, 100));

  // 3. Verify availability exists
  expect(initialSlots.length).toBeGreaterThan(0);
  const availableSlot = initialSlots.find(slot => Object.keys(slot.slots).length > 0);
  expect(availableSlot).toBeDefined();

  // 4. Create booking with proper date format
  const dateOnly = availableSlot.date.split('T')[0];
  const sydneyDateTime = DateTime.fromISO(`${dateOnly}T09:00:00`, { zone: 'Australia/Sydney' });
  const bookingDateTime = sydneyDateTime.toJSDate();

  const { booking } = await createTestBooking(
    providers[0].id,
    business.id,
    service.id,
    bookingDateTime,
    120
  );

  // 5. Verify booking impact
  const afterSlots = await computeAggregatedAvailability(business.id, testDate, 1);
  // ... assertions
});
```

## 🔍 Debugging Tips

### Enable Debug Logging
Add temporary debug logs:
```typescript
console.log(`[Test] testDate = ${testDate.toISOString()}, day = ${testDate.getDay()}`);
console.log(`[Test] availableSlot.date = "${availableSlot.date}"`);
console.log(`[Test] initialSlots.length = ${initialSlots.length}`);
```

### Common Debug Patterns
- Check if date is weekend: `testDate.getDay() === 0 || testDate.getDay() === 6`
- Verify date format: `typeof availableSlot.date` should be 'string'
- Check availability: `initialSlots.length > 0`
- Validate booking date: `!isNaN(bookingDateTime.getTime())`

---

**Remember**: These guidelines prevent hours of debugging! Follow them consistently for reliable availability tests. 