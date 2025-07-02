# 🚀 Quick Start - Get Running in 5 Minutes

**New to this project?** This gets you from zero to working WhatsApp bot development environment in ~5 minutes.

## ⚡ Prerequisites (One-Time Install)

```bash
# Install required tools
brew install colima supabase/tap/supabase postgresql

# Start Docker alternative
colima start
export DOCKER_HOST=unix:///Users/$(whoami)/.colima/default/docker.sock
```

## 🔧 5-Step Setup

```bash
# 1. Install project dependencies
npm install

# 2. Create environment file
npm run setup:quick
# Edit .env.local with your OpenAI API key

# 3. Start local database
supabase start

# 4. Load complete database schema
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/migrations_backup/20250702024633_remote_schema.sql

# 5. Start development server
npm run dev
```

## ✅ Verify Everything Works

```bash
npm run setup:check
```

**Expected output:**
- ✅ All software dependencies installed
- ✅ Local Supabase running
- ✅ Database schema loaded
- ✅ Vector search ready

## 🔗 Your Local Environment

- **App**: http://localhost:3000
- **Database Studio**: http://127.0.0.1:54323
- **API**: http://127.0.0.1:54321
- **Webhook**: http://localhost:3000/api/webhook2

## 🎯 Test Your Setup

```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/api/webhook2

# Open database studio
open http://127.0.0.1:54323
```

## 🆘 If Something Breaks

```bash
# Reset everything
supabase stop
colima restart
supabase start
# Re-run step 4 above
```

## 📚 Next Steps

- **Need more details?** → [Complete Setup Guide](./SETUP_LOCAL_DEVELOPMENT.md)
- **Want to make schema changes?** → [Schema Management](./DATABASE_SCHEMA_MANAGEMENT.md)
- **Ready to deploy?** → [Production Deployment](./DEPLOYMENT_PRODUCTION.md)

---

**You're ready!** 🎉 Local WhatsApp bot with vector search is running. 