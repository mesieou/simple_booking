# 🔧 Environment Configuration

Complete guide to setting up your environment variables for local development, staging, and production.

## 🎯 Quick Setup

```bash
# Copy environment template
npm run setup:quick
# This creates .env.local from template

# Edit with your actual keys
code .env.local
```

## 📝 Environment Files

### Local Development: `.env.local`
```env
# Local Supabase (auto-configured)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Local Database
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# WhatsApp Testing (local)
WHATSAPP_PHONE_NUMBER_ID=local_test_phone_id
WHATSAPP_ACCESS_TOKEN=local_test_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=local_webhook_verify_token
WEBHOOK_BASE_URL=http://localhost:3000

# AI/Bot Configuration
OPENAI_API_KEY=your_openai_api_key

# Local Testing Flags
ENVIRONMENT=local
DEBUG_WEBHOOKS=true
LOG_LEVEL=debug
```

### Development: `.env.development`
```env
# Supabase Development Database (skedy-dev)
NEXT_PUBLIC_SUPABASE_URL=https://yxavypxuzpjejkezwzjl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_dev_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_dev_service_role_key
DATABASE_URL=your_dev_database_url

# WhatsApp Development
WHATSAPP_PHONE_NUMBER_ID=your_dev_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_dev_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_dev_webhook_verify_token
WEBHOOK_BASE_URL=https://your-dev-domain.com

# AI Configuration
OPENAI_API_KEY=your_openai_api_key

# Development Flags
ENVIRONMENT=development
DEBUG_WEBHOOKS=true
LOG_LEVEL=info
```

### Production: Environment Variables
```env
# Supabase Production Database (skedy-prod)
NEXT_PUBLIC_SUPABASE_URL=https://itjtaeggupasvrepfkcw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_prod_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_prod_service_role_key
DATABASE_URL=your_prod_database_url

# WhatsApp Production
WHATSAPP_PHONE_NUMBER_ID=your_prod_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_prod_system_user_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_prod_webhook_verify_token
WEBHOOK_BASE_URL=https://yourdomain.com

# AI Configuration
OPENAI_API_KEY=your_openai_api_key

# Production Flags
ENVIRONMENT=production
DEBUG_WEBHOOKS=false
LOG_LEVEL=error
```

## 🔑 Where to Get Credentials

### Supabase Credentials

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project** (skedy-dev or skedy-prod)
3. **Navigate to Settings → API**

#### URL & Anon Key
- **Project URL**: Copy the "Project URL"
- **Anon Key**: Copy the "anon/public" key (safe for frontend)

#### Service Role Key
- **Service Role**: Copy the "service_role" key (⚠️ Keep secret!)

#### Database URL
- **Go to Settings → Database**
- **Copy "Connection string" → Nodejs format**

### WhatsApp Business API

1. **Go to Meta Business Suite**: https://business.facebook.com
2. **Navigate to WhatsApp Accounts**
3. **Select your WABA**

#### Phone Number ID
- **WhatsApp Manager → Phone Numbers**
- **Copy the Phone Number ID**

#### Access Token
- **Create System User Token** (permanent)
- **Grant full WABA permissions**

#### Webhook Verify Token
- **Create your own secure random string**
- **Use the same token in Meta webhook configuration**

### OpenAI API Key

1. **Go to OpenAI Platform**: https://platform.openai.com
2. **Navigate to API Keys**
3. **Create new secret key**

## 🔄 Database Management Environment

For schema management commands, you need credentials for both environments:

```env
# Development Database (for schema sync)
SUPABASE_DEV_URL=https://yxavypxuzpjejkezwzjl.supabase.co
SUPABASE_DEV_ANON_KEY=your_dev_anon_key
SUPABASE_DEV_SERVICE_ROLE_KEY=your_dev_service_role_key
SUPABASE_DEV_DATABASE_URL=your_dev_database_url

# Production Database (for schema sync)
SUPABASE_PROD_URL=https://itjtaeggupasvrepfkcw.supabase.co
SUPABASE_PROD_ANON_KEY=your_prod_anon_key
SUPABASE_PROD_SERVICE_ROLE_KEY=your_prod_service_role_key
SUPABASE_PROD_DATABASE_URL=your_prod_database_url

# Database Password (for CLI operations)
DB_PASSWORD=your_database_password
```

## 🔒 Security Best Practices

### ✅ Safe to Expose
- `NEXT_PUBLIC_SUPABASE_URL` - Public API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
- `WHATSAPP_PHONE_NUMBER_ID` - Phone number identifier

### 🚨 Keep Secret
- `SUPABASE_SERVICE_ROLE_KEY` - Full database access
- `WHATSAPP_ACCESS_TOKEN` - Meta API access
- `OPENAI_API_KEY` - OpenAI API access
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` - Webhook security
- `DATABASE_URL` - Direct database access

### 🛡️ Protection Rules
- **Never commit `.env.local`** to git
- **Use environment variables** in production deployment
- **Rotate tokens regularly** (quarterly recommended)
- **Use different tokens** for dev/staging/prod
- **Monitor token usage** for suspicious activity

## 🧪 Testing Environment Setup

### Verify Environment
```bash
npm run setup:check
```

### Test Database Connection
```bash
# Local
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT 1"

# Development (via Supabase CLI)
supabase db diff --linked
```

### Test WhatsApp Webhook
```bash
# Local testing
curl -X POST http://localhost:3000/api/webhook2 \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## 🚀 Deployment Environment Variables

### Vercel
```bash
# Set production environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... add all production variables
```

### Railway
```bash
# Set environment variables in Railway dashboard
# or via CLI
railway variables set NEXT_PUBLIC_SUPABASE_URL=https://itjtaeggupasvrepfkcw.supabase.co
```

### Docker
```dockerfile
# Dockerfile environment variables
ENV NEXT_PUBLIC_SUPABASE_URL=https://itjtaeggupasvrepfkcw.supabase.co
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
```

## 🔄 Environment Switching

### Local Development
```bash
# Uses .env.local automatically
npm run dev
```

### Development Deployment
```bash
# Set NODE_ENV=development
NODE_ENV=development npm run build
```

### Production Deployment
```bash
# Set NODE_ENV=production
NODE_ENV=production npm run build
```

## 📋 Environment Checklist

### Before First Run
- [ ] `.env.local` file created
- [ ] OpenAI API key added
- [ ] Local Supabase started
- [ ] Database schema loaded

### Before Development Deployment
- [ ] Development Supabase credentials
- [ ] WhatsApp webhook configured
- [ ] Domain SSL certificate

### Before Production Deployment
- [ ] Production Supabase credentials
- [ ] Production WhatsApp Business API
- [ ] Monitoring and alerts configured
- [ ] Backup strategy in place

---

**Need help?** Check the [Quick Setup Guide](./SETUP_QUICK_START.md) or [Troubleshooting](./TROUBLESHOOTING.md). 