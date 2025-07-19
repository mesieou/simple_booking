# Notification Test Suite

This test suite covers all notification types in the system, mirroring production flows exactly.

## Test Coverage

### 1. Booking Notifications (`booking-notification.test.ts`)
- ✅ Tests the exact flow that creates booking notifications
- ✅ Verifies database notification creation with proper UUID handling
- ✅ Tests GenericNotificationService with real business and super admin lookup
- ✅ Validates WhatsApp message formatting and sending
- ✅ Tests failure scenarios and error handling

### 2. Escalation Notifications (`escalation-notification.test.ts`)
- ✅ Tests escalation notification creation and delivery
- ✅ Verifies admin and super admin recipient finding
- ✅ Tests proxy mode escalation notifications
- ✅ Validates template message handling

### 3. Feedback Notifications (`feedback-notification.test.ts`)
- ✅ Tests negative feedback notification flow
- ✅ Verifies system notification type handling
- ✅ Tests super admin only recipient filtering
- ✅ Validates feedback message formatting

## Test Environment

- **Database**: Uses test Supabase instance with production-like data
- **WhatsApp**: Uses mock WhatsApp sender for safe testing
- **Recipients**: Tests with real admin and super admin user data
- **UUID Handling**: Tests both valid UUIDs and null values

## Key Test Scenarios

### Critical UUID Bug Test
The main production issue where `'system-generated'` was being passed as UUID:
```typescript
// PRODUCTION BUG: This fails with UUID validation error
chatSessionId: chatSessionId || 'system-generated'

// FIXED: This passes with null value
chatSessionId: chatSessionId || null
```

### Production Flow Simulation
Each test simulates the exact production code paths:
1. Database lookups for recipients
2. Notification creation with proper UUID/null handling
3. WhatsApp message formatting and sending
4. Error handling and logging

## Running Tests

```bash
# Run all notification tests
npm test tests/notifications/

# Run specific test
npm test tests/notifications/booking-notification.test.ts

# Run with coverage
npm test tests/notifications/ -- --coverage
```

## Test Data

Tests use production-like data structure but in isolated test environment:
- Test businesses with real business IDs
- Test users with admin and super admin roles
- Test phone numbers for notification delivery
- Test quotes and bookings for realistic scenarios 