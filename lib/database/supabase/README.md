# Supabase Clients - Restored Working Setup

This is your restored working Supabase client setup with simple dev/prod environment support.

## Usage Examples

### Browser Components (Client-side)
```tsx
import { createClient, createDevClient, createProdClient } from '@/lib/database/supabase/client';

// Default client (uses NEXT_PUBLIC_SUPABASE_URL)
const supabase = createClient();

// Dev environment client
const devSupabase = createDevClient();

// Prod environment client  
const prodSupabase = createProdClient();
```

### Server Components/API Routes
```tsx
import { createClient, createDevServerClient, createProdServerClient } from '@/lib/database/supabase/server';

// Default server client (uses NEXT_PUBLIC_SUPABASE_URL)
const supabase = createClient();

// Dev environment server client
const devSupabase = createDevServerClient();

// Prod environment server client
const prodSupabase = createProdServerClient();
```

### Service Role (Admin operations)
```tsx
import { getServiceRoleClient, getDevServiceRoleClient, getProdServiceRoleClient } from '@/lib/database/supabase/service-role';

// Default service role client (uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
const adminSupabase = getServiceRoleClient();

// Dev environment service role client
const devAdminSupabase = getDevServiceRoleClient();

// Prod environment service role client
const prodAdminSupabase = getProdServiceRoleClient();
```

## Environment Variables Required

### Default/Local (working as before)
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key
```

### Dev Environment (optional)
```env
SUPABASE_DEV_URL=https://your-dev-project.supabase.co
SUPABASE_DEV_ANON_KEY=your_dev_anon_key
SUPABASE_DEV_SERVICE_ROLE_KEY=your_dev_service_role_key
```

### Prod Environment (optional)
```env
SUPABASE_PROD_URL=https://your-prod-project.supabase.co
SUPABASE_PROD_ANON_KEY=your_prod_anon_key
SUPABASE_PROD_SERVICE_ROLE_KEY=your_prod_service_role_key
```

## What was restored
- ✅ Simple working browser client
- ✅ Simple working server client  
- ✅ Simple working service role client
- ✅ Working SSR client
- ✅ Working middleware
- ✅ Added dev/prod environment support without breaking existing functionality
- ✅ No index.ts file needed - imports work directly from specific files (as before) 