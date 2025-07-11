# Test Configuration

This directory contains centralized configuration for integration tests.

## 📱 How Tests Work Now

Tests use **existing configured users** - no need to change phone numbers or receive real messages.

### ✅ Safe Testing Approach

- **Uses existing test users** (Juan Test Customer, Luisa Bernal)
- **Uses existing business** (Beauty Asiul)  
- **Only creates temporary sessions/contexts**
- **Never creates or deletes actual users**

### 🏢 Business Configuration

The tests use the real Luisa business in the database:
- **Business**: Beauty Asiul (Luisa's beauty salon)
- **Business ID**: `ef97961f-18ad-4304-9d9d-6cd38308d65f`
- **WhatsApp Number**: `+61411851098`
- **Phone Number ID**: `684078768113901`

### 👤 Test Users

**Customer User (Juan Test Customer)**:
- **Phone**: `+61473164581`
- **User ID**: `f49476a7-cd9b-43cc-9239-0b7ed0689ac5`
- **Name**: Juan
- **Role**: customer

**Admin User (Luisa Bernal)**:
- **Phone**: `+61452490450`  
- **User ID**: `74c27013-a954-4e2c-8fdc-1ae22429d8ec`
- **Name**: Luisa Bernal
- **Role**: admin/provider

## 🧹 Test Cleanup

The test automatically cleans up **only temporary data**:
- ✅ Deletes chat sessions
- ✅ Deletes user contexts  
- ❌ **Never deletes actual users**
- ❌ **Never deletes business data**

Each test run starts with a clean slate while preserving all user accounts.

## 🔧 Adding New Tests

When creating new integration tests, import the configuration:

```typescript
import { TEST_CONFIG, getNormalizedTestPhone } from '../config/test-config';

// Use the centralized constants
const TEST_PHONE = TEST_CONFIG.TEST_PHONE_NUMBER; // Juan's phone
const BUSINESS_ID = TEST_CONFIG.BUSINESS_ID; // Beauty Asiul
const ADMIN_PHONE = TEST_CONFIG.ADMIN_PHONE_NUMBER; // Luisa's phone
```

## 🆘 Troubleshooting

### "Business not found"
- Don't change the `BUSINESS_ID` - it points to the real Luisa business
- Make sure Luisa's business exists in the database

### "User not found"  
- Don't change the phone numbers - they point to existing test users
- Make sure Juan and Luisa users exist in the database

### "Test timeout"
- The test makes real API calls to OpenAI and database
- Increase `TIMEOUT_SECONDS` in `test-config.ts` if needed
- Check your database connection

### "Services not found"
- This means Luisa's services were deleted (probably by cleanup script)
- Run the service recreation script to restore them 