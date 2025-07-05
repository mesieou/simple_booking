# Running Integration Tests

Integration tests verify critical flows against the development Supabase instance.

## Environment variables
Create a `.env.test` file in the project root with the following variables:

```env
SUPABASE_DEV_URL=https://your-dev-project.supabase.co
SUPABASE_DEV_ANON_KEY=your_dev_anon_key
SUPABASE_DEV_SERVICE_ROLE_KEY=your_dev_service_role_key
```

Additional variables required by your tests should also be added to `.env.test`.

## Executing the tests
Run the test suite with:

```bash
npm test
```

The `newUserFlow.test.ts` integration test uses the phone number `+19998887777`. After running the tests, clean up any records created for this number to keep the development database tidy.
