# 🗄️ Database Schema Management

Complete guide to managing your database schema across local, development, and production environments.

## 🏗️ Database Architecture

### Environments
- **Local**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **Development**: `skedy-dev` (yxavypxuzpjejkezwzjl.supabase.co)
- **Production**: `skedy-prod` (itjtaeggupasvrepfkcw.supabase.co)

### Key Files
- **`supabase/schema.sql`** - Single source of truth for schema
- **`supabase/migrations/`** - Generated migration files
- **`supabase/migrations_backup/`** - Large migration backups

## 🎯 Recommended Workflow: Schema-First

**Most intuitive approach** - edit one file, auto-deploy everywhere:

### 1. Edit Schema File
```bash
code supabase/schema.sql
```

Add your changes:
```sql
-- Example: Add a new table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "bookingId" UUID REFERENCES bookings(id),
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 2. Test Locally
```bash
# Apply to local database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/schema.sql

# Test your changes
npm run dev
```

### 3. Deploy to Development
```bash
npm run db:schema-apply-dev
```

### 4. Deploy to Production
```bash
npm run db:schema-apply-prod
```

## 🔄 Alternative Workflows

### Dashboard-First Approach
If you prefer visual editing in Supabase Dashboard:

```bash
# 1. Make changes in Supabase Dashboard
# 2. Pull changes automatically
npm run db:pull-dev

# 3. Deploy to production
npm run db:push-prod
```

### Manual Migration Approach
For complex changes requiring custom logic:

```bash
# 1. Create new migration
npm run db:new-migration "add_payments_table"

# 2. Edit migration file in supabase/migrations/
# 3. Deploy to development
npm run db:push-dev

# 4. Deploy to production
npm run db:push-prod
```

## 📋 Available Commands

### Schema-First Commands (Recommended)
```bash
npm run db:schema-diff-dev       # Compare schema.sql vs dev database
npm run db:schema-diff-prod      # Compare schema.sql vs prod database
npm run db:schema-apply-dev      # Apply schema.sql to development
npm run db:schema-apply-prod     # Apply schema.sql to production
```

### Dashboard-Based Commands
```bash
npm run db:pull-dev             # Pull schema from development
npm run db:pull-prod            # Pull schema from production
npm run db:push-dev             # Push migrations to development
npm run db:push-prod            # Push migrations to production
```

### Management Commands
```bash
npm run db:help                 # Show all commands
npm run db:check-env           # Verify environment setup
npm run db:link-dev            # Link to development database
npm run db:link-prod           # Link to production database
npm run db:new-migration       # Create new migration
npm run db:diff                # Show differences
npm run db:reset               # Reset local database
```

## 🔍 Common Operations

### Adding a New Table
1. Edit `supabase/schema.sql`:
```sql
CREATE TABLE new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

2. Apply changes:
```bash
npm run db:schema-apply-dev    # Test in dev first
npm run db:schema-apply-prod   # Deploy to production
```

### Adding a Column
1. Edit `supabase/schema.sql`:
```sql
-- Find existing table and add column
ALTER TABLE bookings ADD COLUMN notes TEXT;
```

2. Deploy:
```bash
npm run db:schema-apply-dev
npm run db:schema-apply-prod
```

### Creating Functions
1. Add to `supabase/schema.sql`:
```sql
CREATE OR REPLACE FUNCTION get_user_bookings(user_id UUID)
RETURNS TABLE(booking_id UUID, service_name TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT b.id, s.name
    FROM bookings b
    JOIN services s ON b."serviceId" = s.id
    WHERE b."userId" = user_id;
END;
$$;
```

### Setting Up RLS Policies
```sql
-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view own bookings" ON bookings
    FOR SELECT USING (auth.uid() = "userId");
```

## 🔄 Syncing Between Environments

### Development → Production
```bash
npm run db:push-prod
```

### Production → Development
```bash
npm run db:pull-prod
npm run db:push-dev
```

### Check Differences
```bash
npm run db:diff
```

## 🚨 Best Practices

### ✅ Do's
- **Always test locally first** before deploying
- **Use schema.sql as single source of truth**
- **Make incremental changes** rather than large batches
- **Backup before major changes**
- **Use descriptive migration names**

### ❌ Don'ts
- **Don't edit production directly** without testing
- **Don't skip the development environment**
- **Don't make breaking changes** without migration strategy
- **Don't ignore foreign key constraints**

## 🔧 Troubleshooting

### Schema Loading Fails
```bash
# Reset and reload
supabase stop
supabase start
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/migrations_backup/20250702024633_remote_schema.sql
```

### Migration Conflicts
```bash
# Check differences
npm run db:diff

# Reset local and pull fresh
npm run db:reset
npm run db:pull-dev
```

### Environment Issues
```bash
# Check environment setup
npm run db:check-env

# Re-link databases
npm run db:link-dev
npm run db:link-prod
```

## 📊 Database Structure Overview

### Core Tables
- **users** - User accounts and profiles
- **businesses** - Business information
- **services** - Service offerings
- **bookings** - Appointment bookings
- **quotes** - Service quotes
- **availabilitySlots** - Available time slots

### Bot System
- **chatSessions** - WhatsApp conversation sessions
- **userContexts** - User conversation context
- **notifications** - System notifications
- **calendarSettings** - Calendar configurations

### AI/Vector Features
- **documents** - Knowledge base documents
- **embeddings** - Vector embeddings for search
- **crawlSessions** - Website crawling data

### Extensions
- **pgvector** - Vector similarity search
- **uuid-ossp** - UUID generation
- **pgcrypto** - Cryptographic functions

---

**Need help?** Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) or run `npm run db:help`. 