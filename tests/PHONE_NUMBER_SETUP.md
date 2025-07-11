# 📱 Phone Number Setup for Integration Tests

**Quick Setup Guide**: Change your phone number to receive real WhatsApp messages during testing.

## 🚀 Quick Steps

1. **Edit the config file**: `tests/config/test-config.ts`
2. **Change this line**:
   ```typescript
   TEST_PHONE_NUMBER: '61450549485', // ← Change to YOUR phone number
   ```
3. **Run the test**:
   ```bash
   npm test -- tests/integration/newUserFlow.test.ts
   ```

## 📱 Phone Number Format

**✅ Correct Format**: `6140509485` (10 digits, no country code)

**❌ Wrong Formats**:
- `+16140509485` (with country code)
- `(614) 050-9485` (with parentheses)
- `614-050-9485` (with dashes)

## 🎯 What You'll Receive

During the test, you'll get **2 real WhatsApp messages**:

1. **Name Request**: `"Hi! I'd love to help you. What's your name so I can assist you better?"`
2. **Welcome Message**: `"Hello, [YourName]! How can I assist you today?"` + booking button

## 🔧 Full Configuration

See [`tests/config/README.md`](./config/README.md) for complete setup instructions and troubleshooting.

## 🏢 Business Info (DO NOT CHANGE)

The tests use a real business (Beauty Asiul):
- **Business ID**: `ef97961f-18ad-4304-9d9d-6cd38308d65f`
- **WhatsApp Number**: `+15551890570`
- **Phone Number ID**: `684078768113901`

---

**Need help?** Check the full documentation in `tests/config/README.md` 