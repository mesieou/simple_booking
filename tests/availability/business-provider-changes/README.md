# Business Provider Changes Tests

This test suite validates the functionality for dynamically adding and removing providers from businesses and ensuring availability is properly regenerated.

## Overview

These tests follow the same patterns as other availability tests:
- Uses `createTestBusiness()` from the test factory
- Follows standard cleanup patterns with `cleanupTestData()`
- Uses `computeAggregatedAvailability()` for availability generation
- Tests actual functionality we fixed for provider management

## The Bug We Fixed

### Problem
The `AvailabilitySlots.delete()` method wasn't accepting options and always used the regular server client instead of the service role client. This caused deletions to fail silently due to RLS restrictions.

```typescript
// BEFORE (broken)
static async delete(businessId: string, date: string): Promise<void> {
    const supa = await getEnvironmentServerClient(); // ❌ No service role support
}

// AFTER (fixed)  
static async delete(
    businessId: string, 
    date: string, 
    options?: { useServiceRole?: boolean; supabaseClient?: any }
): Promise<void> {
    const supa = options?.supabaseClient || 
        (options?.useServiceRole ? getEnvironmentServiceRoleClient() : await getEnvironmentServerClient());
}
```

### Result
- ✅ Availability regeneration now works correctly
- ✅ Existing slots properly deleted before recreation
- ✅ No more duplicate key constraint violations
- ✅ Provider count changes reflected in availability

## Test Structure

### Core Functionality Tests (`add-remove-providers.test.ts`)

**Adding Providers**
- `should_add_provider_and_regenerate_availability` - Tests single provider addition

**Removing Providers**  
- `should_remove_provider_and_regenerate_availability` - Tests single provider removal
- `should_prevent_removing_admin_provider` - Ensures admin protection

**Availability Functions**
- `should_regenerate_all_business_availability` - Tests regeneration function
- `should_update_business_provider_count_correctly` - Tests count updates

### Performance Tests (`performance-stress.test.ts`)

**Large Provider Operations**
- `should_handle_adding_multiple_providers_sequentially` - Tests adding 5+ providers
- `should_handle_removing_multiple_providers_sequentially` - Tests removing multiple providers

**Availability Performance**
- `should_regenerate_availability_efficiently_with_many_providers` - Performance benchmarks

**Error Recovery**
- `should_recover_from_provider_addition_failures_gracefully` - Tests error handling

## Test Patterns Used

Following existing availability test patterns:

```typescript
// Setup - same as other availability tests
testBusiness = await createTestBusiness('TestName', numberOfProviders);

// Availability generation - same pattern
const today = new Date();
const initialSlots = await computeAggregatedAvailability(business.id, today, 30);
await Promise.all(initialSlots.map(slots => slots.add()));

// Testing availability slots - same pattern
const slots = await AvailabilitySlots.getByBusinessAndDateRange(
  business.id,
  today.toISOString().split('T')[0],
  new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
);

// Cleanup - same pattern
await cleanupTestData([testBusiness]);
```

## Running the Tests

From the availability tests directory:

```bash
# Run all business provider changes tests
npm test -- --testNamePattern="Business Provider Changes"

# Run core functionality only
npm test business-provider-changes/add-remove-providers.test.ts

# Run performance tests only  
npm test business-provider-changes/performance-stress.test.ts
```

## Expected Results

When tests run successfully, you should see:

```
[Test] Adding new provider...
[regenerateAllBusinessAvailability] Found 3 providers in CalendarSettings
[regenerateAllBusinessAvailability] Deleting all existing slots for business
[regenerateAllBusinessAvailability] ✅ Created 30/30 slots
[Test] ✅ Provider addition and availability regeneration successful
```

## Dependencies

These tests require the same environment as other availability tests:
- Environment variables: `SUPABASE_DEV_URL`, `SUPABASE_DEV_SERVICE_ROLE_KEY`
- Same database setup as existing availability tests
- Uses the shared `availability-test-factory` for test data creation

## Notes

- Tests use service role client (`{ useServiceRole: true }`) for operations requiring elevated permissions
- Each test creates isolated businesses to avoid conflicts
- Performance tests have 2-minute timeout for stress operations
- All test data automatically cleaned up after completion 