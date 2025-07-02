# Scripts Guide

## Luisa Test Business Management

### 🧹 Cleanup Existing Data

Before creating Luisa's test business, clean up any existing data to avoid conflicts:

```bash
npm run cleanup-luisa
```

This will:
- ✅ Find all businesses matching Luisa's data (name, email, phone, WhatsApp)
- ✅ Clean up all related data (users, services, bookings, documents, etc.)
- ✅ Use the same cleanup logic as the seeding script

### 🌱 Create Test Business

After cleanup, create Luisa's test business:

```bash
# Run the specific Luisa seeding function
# (You'll need to modify your existing seed script to call createLuisaTestBusiness)
```

### 🔄 Full Reset Workflow

For a complete reset:

```bash
# 1. Clean up existing data
npm run cleanup-luisa

# 2. Create fresh test business
npm run seed  # (if configured to run createLuisaTestBusiness)
```

## Environment Requirements

Make sure your `.env.local` has the correct Supabase credentials:

```env
# For local development
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key

# For production
SUPABASE_PROD_URL=https://your-prod-project.supabase.co
SUPABASE_PROD_ANON_KEY=your_prod_anon_key
SUPABASE_PROD_SERVICE_ROLE_KEY=your_prod_service_role_key
```

## What the cleanup script removes

- 🗑️ Business records matching Luisa's data
- 🗑️ Associated users and auth records
- 🗑️ Services, bookings, quotes
- 🗑️ Calendar settings and availability slots
- 🗑️ Documents and embeddings
- 🗑️ Chat sessions and crawl sessions

Safe to run multiple times - it will only remove matching data. 