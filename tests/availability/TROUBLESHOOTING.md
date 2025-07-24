# Availability Testing Troubleshooting Guide

## 🚨 Common Issues & Console Output

### 1. Race Condition: Missing Availability in Database

**❌ Console Output:**
```
[updateDayAggregatedAvailability] Looking for availability on date: 2025-07-24 for business: cc06ca60-...
[AvailabilitySlots.getByBusinessAndDate] Using service role client (bypasses RLS for business availability retrieval)
[updateDayAggregatedAvailability] CRITICAL: No existing availability found for 2025-07-24 - availability cannot be updated!
[Booking.updateBusinessAvailability] Successfully updated availability for business cc06ca60-...
```

**🔍 What This Means:**
- Test computed availability but never saved it to database
- When booking was created, it tried to update availability that doesn't exist
- The "Successfully updated" message is misleading - nothing was actually updated

**✅ Fix:**
```typescript
// Add this after computeAggregatedAvailability
await Promise.all(initialSlots.map(slot => slot.add()));
await new Promise(resolve => setTimeout(resolve, 100));
```

### 2. Weekend Date Issue

**❌ Console Output:**
```
[Test] DEBUG: Testing date = 2025-07-26T08:20:23.041Z, day = 6 (Sat)
[Test] DEBUG: initialSlots.length = 0
```

**🔍 What This Means:**
- Test generated a Saturday date (day = 6)
- Providers don't work weekends, so availability is empty

**✅ Fix:**
```typescript
while (testDate.getDay() === 0 || testDate.getDay() === 6) {
  testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
}
```

### 3. Invalid Date Format

**❌ Console Output:**
```
[Test] DEBUG: availableSlot.date = "2025-07-28T00:00:00+00:00", type = string
[Test] DEBUG: Trying to parse: "2025-07-28T00:00:00+00:00T14:00:00"
[Test] DEBUG: sydneyDateTime.isValid = false, error = unparsable
[Test] DEBUG: bookingDateTime = Invalid Date, valid = false

RangeError: Invalid time value
    at Date.toISOString (<anonymous>)
```

**🔍 What This Means:**
- availableSlot.date is already a full ISO string with timezone
- Concatenating "T14:00:00" creates double time parts
- Results in unparseable date string

**✅ Fix:**
```typescript
const dateOnly = availableSlot.date.split('T')[0]; // Extract just "2025-07-28"
const sydneyDateTime = DateTime.fromISO(`${dateOnly}T14:00:00`, { zone: 'Australia/Sydney' });
```

### 4. Successful Test Console Output

**✅ Healthy Console Output:**
```
[Environment] Using development environment for service-role client
[User.add] Found existing auth user with email: multibooking-...
[computeAggregatedAvailability] Found 3 providers for business cc06ca60-...
[Test] Initial availability at 09:00: 3 provider(s)
[Test] Creating booking at 2025-07-24T09:00:00.000+10:00 (Sydney) = 2025-07-23T23:00:00.000Z (UTC)
[Booking.updateBusinessAvailability] Updating availability for booking on 2025-07-24
[updateDayAggregatedAvailability] Looking for availability on date: 2025-07-24 for business: cc06ca60-...
[updateDayAggregatedAvailability] Business timezone: Australia/Sydney
[updateDayAggregatedAvailability] Booking in business timezone: 09:00 - 11:00 (120 min)
[Test] After booking at 09:00: 2 provider(s) (reduced from 3)
✅ Cleaned up test business: MultiBooking Test Business 1753345...
```

**🔍 What This Shows:**
- ✅ Environment setup working
- ✅ Provider count detected correctly
- ✅ Timezone conversion working (Sydney → UTC)
- ✅ Availability update found existing data
- ✅ Provider count reduced as expected
- ✅ Test cleanup successful

## 🔧 Debugging Commands

### Run Single Test with Full Output
```bash
npm test -- --testNamePattern="specific_test_name" --verbose
```

### Run Tests with Timeout Extension
```bash
npm test booking-impact/ -- --testTimeout=30000
```

### Environment Check
```bash
# Check if database is accessible
npm test -- --testNamePattern="should_decrease_availability_when_provider_gets_booking"
```

## 📊 Performance Indicators

### Normal Test Times
```
Single Provider Test: ~2-3 seconds
Multi Provider Test: ~3-5 seconds  
Multi Business Test: ~5-7 seconds
```

### Warning Signs
```
Test taking > 10 seconds: Database connection issues
Test taking > 30 seconds: Likely infinite loop or deadlock
Multiple timeouts: Environment/database problems
```

## 🎯 Quick Diagnosis Checklist

When a test fails, check console output for:

1. **Date Issues**
   - Look for: `day = 0` or `day = 6` (weekend)
   - Look for: `initialSlots.length = 0`
   - Look for: `Invalid time value` or `unparsable`

2. **Race Condition Issues**  
   - Look for: `CRITICAL: No existing availability found`
   - Look for: Test passes but availability doesn't change

3. **Environment Issues**
   - Look for: Connection timeouts
   - Look for: Missing `[Environment] Using development environment`
   - Look for: RLS permission errors

4. **Business Logic Issues**
   - Look for: Provider count mismatches
   - Look for: Timezone conversion errors
   - Look for: Booking creation failures

## 🚀 Pro Tips

### Add Temporary Debug Logging
```typescript
// Add these lines when debugging:
console.log(`[DEBUG] testDate = ${testDate.toISOString()}, day = ${testDate.getDay()}`);
console.log(`[DEBUG] initialSlots.length = ${initialSlots.length}`);
console.log(`[DEBUG] availableSlot = ${JSON.stringify(availableSlot)}`);
```

### Quick Validation Pattern
```typescript
// Use this pattern to catch issues early:
expect(initialSlots.length).toBeGreaterThan(0);
expect(availableSlot).toBeDefined();
expect(availableSlot.date).toBeTruthy();
expect(!isNaN(bookingDateTime.getTime())).toBe(true);
```

### Test-Specific Logging
```typescript
// Add test identifiers to console logs:
console.log(`[${expect.getState().currentTestName}] Debug info here`);
```

---

**Remember**: Good console output is your best friend for debugging availability tests! 