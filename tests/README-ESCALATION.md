# Escalation Testing Guide

## Overview

This guide explains how to set up and run escalation tests for the WhatsApp bot system. The escalation tests validate that the bot properly escalates conversations to human agents when needed.

## Prerequisites

### 1. Database Setup

The escalation tests require a properly seeded database with:
- **Luisa Business** (Beauty Asiul) - The test business
- **Admin User** (Luisa Bernal) - The business owner/admin
- **Customer User** (Juan Test Customer) - A test customer

### 2. Environment Variables

Ensure these environment variables are configured:

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# WhatsApp API (for proxy communication tests)
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

## Setup Instructions

### Step 1: Validate Test Environment

Before running tests, validate that the required data exists:

```bash
# Check if test data exists
tsx tests/utilities/validate-test-setup.ts
```

### Step 2: Seed Test Data (if needed)

If the validation fails, create the required test data:

```bash
# Create Luisa business and users
tsx scripts/seed-luisa-business.ts
```

### Step 3: Run Escalation Tests

```bash
# Run all escalation tests
npm test -- tests/integration/escalation/

# Run specific test file
npm test -- tests/integration/escalation/escalation-flow.test.ts
```

## Test Structure

### Database Validation Approach

The tests now use a **database validation approach** instead of hardcoded values:

1. **Validation**: Tests check that required business and users exist in the database
2. **Dynamic Configuration**: Test configuration is populated from actual database records  
3. **Existing Records**: Uses specific database record IDs that already exist

### Test Categories

#### 1. Complete Escalation Flow Tests
- **Media Content Escalation**: Tests escalation when customers send images/videos
- **Human Request Escalation**: Tests escalation when customers request human help
- **Frustration Pattern Escalation**: Tests escalation when customers show frustration

#### 2. Proxy Communication Flow Tests
- **Template Sending**: Tests sending escalation templates to admins
- **Message Routing**: Tests routing messages between admin and customer
- **Proxy Takeover**: Tests admin taking control from the bot

#### 3. Edge Cases and Error Scenarios
- **Invalid Business**: Tests handling of invalid business configurations
- **Non-Escalation Content**: Tests that certain content (like stickers) don't trigger escalation

## Key Features

### Dynamic Test Configuration

The tests use actual database records instead of hardcoded values:

```typescript
// Old approach (hardcoded)
const BUSINESS_ID = 'hardcoded-uuid';

// New approach (database validation)
const testData = await getValidatedTestData();
const businessId = testData.business.id;
```

### Existing Record Validation

Tests validate that specific database records exist and have required configuration:

```typescript
// Uses existing database record IDs
const EXISTING_IDS = {
  BUSINESS_ID: 'ef97961f-18ad-4304-9d9d-6cd38308d65f',
  ADMIN_USER_ID: '74c27013-a954-4e2c-8fdc-1ae22429d8ec', 
  CUSTOMER_USER_ID: 'ecff50f9-85b3-4065-90bc-64471faf047f'
};
```

### Real Business Data

Tests use the actual Luisa business data:

- **Business**: Beauty Asiul
- **Phone**: +61473164581
- **WhatsApp**: +61411851098
- **WhatsApp API ID**: 684078768113901

## Test Data

### Luisa Business (Beauty Asiul)
- **Services**: 12 hair & nail services
- **Working Hours**: Mon-Fri 7:00-17:00, Sat 7:00-13:00
- **Location**: 9 Dryburgh St, West Melbourne, VIC 3003
- **Deposit**: 50% required for bookings

### Test Users
- **Admin**: Luisa Bernal (admin/provider role)
- **Customer**: Juan Test Customer (customer role)

## Troubleshooting

### Common Issues

#### 1. "Business not found in database"
```bash
# Solution: Seed the business
tsx scripts/seed-luisa-business.ts
```

#### 2. "WhatsApp template not found"
```bash
# This is expected in test environment
# Tests focus on logic, not actual WhatsApp delivery
```

#### 3. "Invalid UUID format"
```bash
# Solution: Validate test environment
tsx tests/utilities/validate-test-setup.ts
```

### Test Environment Validation

Run the validation script to check your setup:

```bash
tsx tests/utilities/validate-test-setup.ts
```

This will:
- ✅ Check if the specified business exists 
- ✅ Validate WhatsApp configuration
- ✅ Check admin and customer users exist
- 🔧 Fix missing WhatsApp fields if needed

## Running Tests

### Individual Test Files

```bash
# Escalation flow tests
npm test -- tests/integration/escalation/escalation-flow.test.ts

# Escalation scenarios
npm test -- tests/flow/escalation-scenarios/complete-escalation-scenarios.test.ts
```

### Test Output

Tests provide detailed logging:

```
🔧 Initializing escalation test environment...
🔍 Looking for Luisa business in database...
✅ Found Luisa business: Beauty Asiul
🔍 Looking for admin user (Luisa)...
✅ Found admin user: Luisa Bernal
🔍 Looking for test customer user...
✅ Found existing test customer user: Juan Test Customer
✅ Test environment initialized successfully
```

## Best Practices

1. **Always validate** test environment before running tests
2. **Use actual database data** instead of hardcoded values
3. **Clean up test data** after each test run
4. **Check test logs** for escalation trigger details
5. **Verify database state** if tests fail unexpectedly

## Development Notes

### Database Schema Dependencies

The tests depend on these database tables:
- `businesses` - Business information
- `users` - Admin and customer users
- `notifications` - Escalation notifications
- `chatSessions` - Chat session data

### Environment-Specific Behavior

- **Development**: Uses development database
- **Testing**: Creates/validates test data automatically
- **Production**: Uses production business data (Luisa's real business)

### Adding New Tests

When adding new escalation tests:

1. Use `EscalationDatabaseHelpers.initializeTestEnvironment()` in `beforeAll`
2. Use `ESCALATION_TEST_CONFIG` for business/user data
3. Use assertion helpers from `EscalationAssertions`
4. Clean up test data in `afterEach`

This ensures tests are reliable and use actual database records rather than hardcoded values. 