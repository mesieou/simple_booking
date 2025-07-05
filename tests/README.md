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
