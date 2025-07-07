# Tests

This folder contains integration tests and utilities.

## Database utilities

`tests/integration/dbUtils.ts` exposes helpers to clean the Supabase database during tests:

- `deleteUserByWhatsapp(number: string)` – remove any user record matching the WhatsApp number.
- `deleteChatSessionsForUser(number: string)` – delete chat sessions linked to that number.

Use these in integration tests to ensure a fresh state before and after running scenarios.

```ts
import { deleteUserByWhatsapp, deleteChatSessionsForUser } from './integration/dbUtils';

beforeAll(async () => {
  await deleteChatSessionsForUser('+15555550123');
  await deleteUserByWhatsapp('+15555550123');
});
```

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


## WhatsApp new user flow test

`tests/integration/newUserFlow.test.ts` exercises the complete onboarding path for a WhatsApp user.
It simulates a real webhook payload using the phone number ID `684078768113901` and routes it through the actual webhook handler. The message is associated with the business `7c98818f-2b01-4fa4-bbca-0d59922a50f7` which must not be modified.

The test sends a greeting from the unique customer number `+19998887777`. The bot
asks for the user's name, the test replies, and then verifies that:

- A `User` record is created with the provided name.
- A `ChatSession` and corresponding `UserContext` exist for the business.

All calls to Supabase and OpenAI use the real development environment. After the
assertions, the test removes the created user, chat session and user context so it
can be run repeatedly without leaving data behind.
