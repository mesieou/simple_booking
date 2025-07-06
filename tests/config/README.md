# Test Configuration

This directory contains centralized configuration for integration tests.

## 📱 How to Run Tests with Your Phone Number

To receive real WhatsApp messages during testing and verify the system works correctly:

### 1. Edit the Test Configuration

Open `tests/config/test-config.ts` and change the `TEST_PHONE_NUMBER`:

```typescript
export const TEST_CONFIG = {
  // 📱 CHANGE THIS TO YOUR PHONE NUMBER
  TEST_PHONE_NUMBER: '6140509485', // Replace with your 10-digit phone number
  
  // ... other config (DO NOT CHANGE)
}
```

### 2. Phone Number Format

- ✅ **Use 10-digit format without country code**: `6140509485`
- ❌ **Don't include +1**: `+16140509485`  
- ❌ **Don't include parentheses**: `(614) 050-9485`
- ❌ **Don't include dashes**: `614-050-9485`

### 3. Run the Test

```bash
npm test -- tests/integration/newUserFlow.test.ts
```

### 4. What to Expect

You will receive **2 real WhatsApp messages** during the test:

1. **First message**: `"Hi! I'd love to help you. What's your name so I can assist you better?"`
2. **Second message**: `"Hello, TestLukitas! How can I assist you today?"` (with booking button)

## 🏢 Business Configuration

The tests use a real business in the database:
- **Business ID**: `7c98818f-2b01-4fa4-bbca-0d59922a50f7`
- **WhatsApp Number**: `+15551890570`
- **Phone Number ID**: `684078768113901`

**⚠️ DO NOT CHANGE** these values - they point to the real business that contains all necessary data for testing.

## 🧹 Test Cleanup

The test automatically cleans up after itself:
- ✅ Deletes test user profiles
- ✅ Deletes chat sessions  
- ✅ Deletes user contexts
- ✅ Deletes auth users

Each test run starts with a clean slate.

## 🔧 Adding New Tests

When creating new integration tests, import the configuration:

```typescript
import { TEST_CONFIG, getNormalizedTestPhone } from '../config/test-config';

// Use the centralized constants
const TEST_PHONE = TEST_CONFIG.TEST_PHONE_NUMBER;
const BUSINESS_ID = TEST_CONFIG.BUSINESS_ID;
```

## 🆘 Troubleshooting

### "No WhatsApp messages received"
- Check that your phone number is correctly formatted in `test-config.ts`
- Verify your phone number is registered with the WhatsApp Business API

### "Business not found"
- Don't change the `BUSINESS_ID` - it points to the real business in the database
- Contact the development team if the business configuration is broken

### "Test timeout"
- The test makes real API calls to OpenAI and WhatsApp
- Increase `TIMEOUT_SECONDS` in `test-config.ts` if needed
- Check your internet connection 