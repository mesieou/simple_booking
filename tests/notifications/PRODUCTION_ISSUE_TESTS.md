# 🚨 Production Issue: Notification UUID Validation Error

## **The Problem**

Your production booking notifications are failing with this error:

```
[NotificationDB] Error creating notification: {
  code: '22P02',
  details: null,
  hint: null,
  message: 'invalid input syntax for type uuid: "system-generated"'
}
```

## **Root Cause**

The issue is in `lib/bot-engine/services/generic-notification-service.ts` line 177:

**BROKEN CODE (what production is running):**
```typescript
const notification = await Notification.create({
  businessId,
  chatSessionId: chatSessionId || 'system-generated', // ❌ THIS IS THE BUG
  message: content.message,
  status: 'pending',
  notificationType: type
});
```

**FIXED CODE (what we changed):**
```typescript
const notification = await Notification.create({
  businessId,
  chatSessionId: chatSessionId || null, // ✅ FIXED: Use null instead
  message: content.message,
  status: 'pending',
  notificationType: type
});
```

## **Why It's Happening**

1. **Booking notifications** don't have a `chatSessionId` (they're triggered by payment completion, not chat)
2. The old code tried to use `'system-generated'` as a fallback
3. Database expects either a valid UUID or NULL for the `chatSessionId` column
4. `'system-generated'` is not a valid UUID format, causing the validation error

## **Tests That Catch This Issue**

### 🔴 **Critical Test: UUID Handling**

**File:** `tests/notifications/booking-notification.test.ts`

```typescript
describe('🚨 CRITICAL: UUID Handling Tests', () => {
  it('should handle null chatSessionId without UUID validation errors', async () => {
    // This is the EXACT scenario that's failing in production
    const notificationPromise = GenericNotificationService.sendBookingNotification(
      BUSINESS_ID,
      bookingDetails
    );

    // This should NOT throw a UUID validation error
    await expect(notificationPromise).resolves.not.toThrow();
  });

  it('should NOT accept system-generated as chatSessionId', async () => {
    // This is the OLD broken behavior that should fail
    const createWithInvalidUUID = async () => {
      return await Notification.create({
        businessId: BUSINESS_ID,
        chatSessionId: 'system-generated' as any, // This should fail
        message: 'Test notification',
        status: 'pending',
        notificationType: 'booking'
      });
    };

    // This should throw a UUID validation error
    await expect(createWithInvalidUUID()).rejects.toThrow();
  });
});
```

### 📊 **Production Flow Simulation**

```typescript
it('should simulate exact production booking flow from create-booking.ts', async () => {
  // This simulates the exact call made in create-booking.ts:505
  const bookingDetails = {
    bookingId: 'f6a3aef1-45e5-470b-9814-77c297dc0a49',
    customerName: 'Stiffy', // Real customer name from logs
    customerPhone: '+61452490450',
    // ... other real data from production logs
  };

  // This is the EXACT call that's failing in production
  await GenericNotificationService.sendBookingNotification(
    '5fbb7083-0de0-4bd2-bdbd-7f0260f3c7cc', // Real business ID from logs
    bookingDetails
  );

  // Should succeed without UUID errors
});
```

## **How to Run Tests**

### **Option 1: Run specific test (fastest)**
```bash
npm test tests/notifications/booking-notification.test.ts
```

### **Option 2: Run all notification tests**
```bash
node tests/notifications/run-tests.js
```

### **Option 3: Run just the UUID tests**
```bash
npm test tests/notifications/booking-notification.test.ts -- --testNamePattern="UUID Handling"
```

## **Expected Test Results**

### ✅ **With Fixed Code (should pass):**
```
✓ should handle null chatSessionId without UUID validation errors
✓ should create notification with null chatSessionId in database  
✓ should simulate exact production booking flow from create-booking.ts
```

### ❌ **With Broken Code (should fail):**
```
✗ should handle null chatSessionId without UUID validation errors
  Error: invalid input syntax for type uuid: "system-generated"
```

## **The Real Issue: Production Build**

Even though we fixed the code, **production is still running the old compiled version**. The error logs show:

```
[GenericNotificationService] ❌ Failed to send to Luisa Bernal: Error: Failed to create notification.
    at a.create (.next/server/chunks/9046.js:1:1447)  // ← Compiled code!
```

**To fix production, you need to:**

1. **Rebuild the application:** `npm run build`
2. **Redeploy to production** with the new build
3. **Verify the fix** by running a test booking

## **Test Coverage Summary**

Our test suite covers:

- ✅ **UUID validation errors** (the main production issue)
- ✅ **Booking notifications** (admin + super admin recipients)
- ✅ **Escalation notifications** (admin + super admin recipients)  
- ✅ **Feedback notifications** (super admin only recipients)
- ✅ **Database persistence** (correct data saved)
- ✅ **WhatsApp message formatting** (proper message content)
- ✅ **Error handling** (graceful failures)
- ✅ **Production flow simulation** (exact real-world scenarios)

## **Next Steps**

1. **Run the tests** to verify our fix works
2. **Rebuild production** to deploy the fix
3. **Test with real booking** to confirm resolution
4. **Keep this test suite** for future notification changes 