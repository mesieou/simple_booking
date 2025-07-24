# Availability Testing Quick Reference

## 🚨 Essential Checklist for Every Test

### 1. Date Setup (Skip Weekends)
```typescript
let testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
while (testDate.getDay() === 0 || testDate.getDay() === 6) {
  testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
}
```

### 2. Availability Generation & Saving (Prevent Race Conditions)
```typescript
const initialSlots = await computeAggregatedAvailability(business.id, testDate, 1);
await Promise.all(initialSlots.map(slot => slot.add())); // ✅ SAVE TO DB
await new Promise(resolve => setTimeout(resolve, 100));   // ✅ WAIT FOR COMMIT
```

### 3. Date Format Fix (Prevent Invalid Dates)
```typescript
const dateOnly = availableSlot.date.split('T')[0]; // ✅ EXTRACT DATE PART
const sydneyDateTime = DateTime.fromISO(`${dateOnly}T09:00:00`, { zone: 'Australia/Sydney' });
```

## 🐛 Quick Error Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `CRITICAL: No existing availability found` | Missing `slot.add()` | Add availability saving pattern |
| `Invalid time value` | Wrong date concatenation | Use `availableSlot.date.split('T')[0]` |
| `Expected > 0, Received: 0` | Weekend date | Skip weekends in date generation |
| `Cannot read properties of undefined` | Empty availability | Check `initialSlots.length > 0` |

## 📋 Copy-Paste Templates

### Basic Test Structure
```typescript
it('test_name', async () => {
  // 1. Weekend-safe date
  let testDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  while (testDate.getDay() === 0 || testDate.getDay() === 6) {
    testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
  }

  // 2. Generate & save availability
  const initialSlots = await computeAggregatedAvailability(business.id, testDate, 1);
  await Promise.all(initialSlots.map(slot => slot.add()));
  await new Promise(resolve => setTimeout(resolve, 100));

  // 3. Create booking
  const dateOnly = availableSlot.date.split('T')[0];
  const bookingDateTime = DateTime.fromISO(`${dateOnly}T09:00:00`, { zone: 'Australia/Sydney' }).toJSDate();
  
  const { booking } = await createTestBooking(providerId, businessId, serviceId, bookingDateTime, 120);
  
  // 4. Verify results
});
```

### Multi-Business Availability Saving
```typescript
await Promise.all([
  ...businessA_slots.map(slot => slot.add()),
  ...businessB_slots.map(slot => slot.add()),
  ...businessC_slots.map(slot => slot.add())
]);
await new Promise(resolve => setTimeout(resolve, 100));
```

## 🎯 Before Submitting Test

- [ ] Skip weekends in date generation
- [ ] Save availability with `slot.add()` before bookings  
- [ ] Add 100ms delay after saving
- [ ] Extract date part: `availableSlot.date.split('T')[0]`
- [ ] Use Sydney timezone for bookings
- [ ] Test cleanup in `afterAll` 