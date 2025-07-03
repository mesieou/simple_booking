-- Live Schema File
-- Edit this file directly to make schema changes
-- Run: supabase db diff to generate migrations automatically

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- Core Tables

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "firstName" TEXT NULL,
    "lastName" TEXT NULL,
    email TEXT UNIQUE,
    "phoneNumber" TEXT,
    role TEXT NULL DEFAULT 'customer',
    "businessId" UUID REFERENCES businesses(id),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Businesses table  
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    "phoneNumber" TEXT,
    email TEXT,
    address TEXT,
    "businessType" TEXT,
    "stripeAccountId" TEXT,
    "onboardingCompleted" BOOLEAN DEFAULT false,
    "requiresDeposit" BOOLEAN DEFAULT false,
    "depositPercentage" INTEGER DEFAULT 0,
    "websiteUrl" TEXT,  -- 🆕 NEW FIELD ADDED!
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Services table
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "businessId" UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    "basePriceEstimate" INTEGER,
    "durationMinutes" INTEGER,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quotes table
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID REFERENCES users(id),
    "businessId" UUID NOT NULL REFERENCES businesses(id),
    "serviceId" UUID REFERENCES services(id),
    "pickUp" TEXT,
    "dropOff" TEXT,
    "proposedDateTime" TIMESTAMP WITH TIME ZONE,
    "totalJobCostEstimation" INTEGER,
    "travelCostEstimation" INTEGER,
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID REFERENCES users(id),
    "providerId" UUID REFERENCES users(id),
    "businessId" UUID NOT NULL REFERENCES businesses(id),
    "quoteId" UUID REFERENCES quotes(id),
    "dateTime" TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending',
    "totalCost" INTEGER,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Availability Slots table
CREATE TABLE "availabilitySlots" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "providerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    slots JSONB NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE("providerId", date)
);

-- Chat Sessions table
CREATE TABLE "chatSessions" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "businessId" UUID NOT NULL REFERENCES businesses(id),
    "userId" UUID REFERENCES users(id),
    channel TEXT NOT NULL,
    "channelUserId" TEXT NOT NULL,
    "allMessages" JSONB DEFAULT '[]',
    "sessionIntent" TEXT,
    "summarySession" TEXT,
    "overallCustomerSatisfaction" DECIMAL,
    "feedbackData" JSONB,
    "endedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Contexts table (for bot conversation state)
CREATE TABLE "userContexts" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "channelUserId" TEXT NOT NULL,
    "businessId" UUID REFERENCES businesses(id),
    "currentGoal" JSONB,
    "previousGoal" JSONB,
    "participantPreferences" JSONB DEFAULT '{"language": "en", "timezone": "UTC"}',
    "frequentlyDiscussedTopics" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "businessId" UUID NOT NULL REFERENCES businesses(id),
    "userId" UUID REFERENCES users(id),
    "chatSessionId" UUID REFERENCES "chatSessions"(id),
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table (for AI knowledge base)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "businessId" UUID NOT NULL REFERENCES businesses(id),
    content TEXT NOT NULL,
    source TEXT,
    category TEXT,
    "sourceUrl" TEXT,
    "pageNumber" INTEGER,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Embeddings table (for vector search)
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    "businessId" UUID NOT NULL REFERENCES businesses(id),
    content TEXT NOT NULL,
    embedding vector(1536),
    category TEXT,
    source TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calendar Settings table
CREATE TABLE "calendarSettings" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "businessId" UUID NOT NULL REFERENCES businesses(id),
    "providerId" UUID NOT NULL REFERENCES users(id),
    "workingHours" JSONB DEFAULT '{}',
    "timezone" TEXT DEFAULT 'UTC',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "availabilitySlots_providerId_date_idx" ON "availabilitySlots"("providerId", "date");
CREATE INDEX IF NOT EXISTS "embeddings_businessId_idx" ON embeddings("businessId");
CREATE INDEX IF NOT EXISTS "documents_businessId_idx" ON documents("businessId");
CREATE INDEX IF NOT EXISTS "chatSessions_businessId_idx" ON "chatSessions"("businessId");

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE "availabilitySlots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chatSessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendarSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "userContexts" ENABLE ROW LEVEL SECURITY;

-- ================================
-- BUSINESSES TABLE RLS POLICIES
-- ================================

-- Admin policies (full access)
CREATE POLICY "admin_businesses_all" ON "businesses" 
  TO "authenticated" 
  USING (get_my_role() = 'admin') 
  WITH CHECK (get_my_role() = 'admin');

-- Admin/Provider policies (own business only)
CREATE POLICY "admin_provider_businesses_own" ON "businesses" 
  TO "authenticated" 
  USING (get_my_role() = 'admin/provider' AND id = get_my_business_id()) 
  WITH CHECK (get_my_role() = 'admin/provider' AND id = get_my_business_id());

-- Provider read access to own business
CREATE POLICY "provider_businesses_read_own" ON "businesses" 
  FOR SELECT TO "authenticated" 
  USING (get_my_role() = 'provider' AND id = get_my_business_id());

-- Customer read access (only businesses they interact with)
CREATE POLICY "customer_businesses_interactions" ON "businesses" 
  FOR SELECT TO "authenticated" 
  USING (get_my_role() = 'customer' AND customer_has_interaction_with_business(id));

-- Webhook read access for anon users
CREATE POLICY "webhook_businesses_read" ON "businesses" 
  FOR SELECT TO "anon" 
  USING (true);

-- ⭐ NEW: Service role INSERT policy for seeding operations
CREATE POLICY "service_role_businesses_insert" ON "businesses" 
  FOR INSERT TO "service_role" 
  WITH CHECK (true);

-- ⭐ NEW: Admin INSERT policy for business creation
CREATE POLICY "admin_businesses_insert" ON "businesses" 
  FOR INSERT TO "authenticated" 
  WITH CHECK (get_my_role() = 'admin');

-- Super Admin policies (full access to everything)
CREATE POLICY "super_admin_businesses_all" ON "businesses" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- ================================
-- SUPER ADMIN POLICIES FOR ALL TABLES
-- ================================

-- Users table - Super Admin full access
CREATE POLICY "super_admin_users_all" ON "users" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- Services table - Super Admin full access
CREATE POLICY "super_admin_services_all" ON "services" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- Quotes table - Super Admin full access
CREATE POLICY "super_admin_quotes_all" ON "quotes" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- Bookings table - Super Admin full access
CREATE POLICY "super_admin_bookings_all" ON "bookings" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- Availability Slots table - Super Admin full access
CREATE POLICY "super_admin_availability_slots_all" ON "availabilitySlots" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- Chat Sessions table - Super Admin full access
CREATE POLICY "super_admin_chat_sessions_all" ON "chatSessions" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- Notifications table - Super Admin full access
CREATE POLICY "super_admin_notifications_all" ON "notifications" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- Documents table - Super Admin full access
CREATE POLICY "super_admin_documents_all" ON "documents" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- Embeddings table - Super Admin full access
CREATE POLICY "super_admin_embeddings_all" ON "embeddings" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- Calendar Settings table - Super Admin full access
CREATE POLICY "super_admin_calendar_settings_all" ON "calendarSettings" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- User Contexts table - Super Admin full access
CREATE POLICY "super_admin_user_contexts_all" ON "userContexts" 
  TO "authenticated" 
  USING (get_my_role() = 'super_admin') 
  WITH CHECK (get_my_role() = 'super_admin');

-- Helper Functions
CREATE OR REPLACE FUNCTION get_my_business_id() RETURNS UUID
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT "businessId" FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_role() RETURNS TEXT
LANGUAGE SQL SECURITY DEFINER  
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION customer_has_interaction_with_business(business_id UUID) RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quotes q WHERE q."businessId" = business_id AND q."userId" = auth.uid()
    UNION
    SELECT 1 FROM bookings b WHERE b."businessId" = business_id AND b."userId" = auth.uid()
    UNION
    SELECT 1 FROM "chatSessions" cs WHERE cs."businessId" = business_id AND cs."userId" = auth.uid()
  );
$$;

-- ================================
-- ADDITIONAL RLS POLICIES FOR OTHER TABLES
-- ================================

-- Documents table policies
CREATE POLICY "documents_business_access" ON "documents" 
  FOR SELECT TO "authenticated" 
  USING (get_my_role() IN ('admin', 'admin/provider', 'provider') AND "businessId" = get_my_business_id());

-- Embeddings table policies
CREATE POLICY "embeddings_business_access" ON "embeddings" 
  FOR SELECT TO "authenticated" 
  USING (get_my_role() IN ('admin', 'admin/provider', 'provider') AND "businessId" = get_my_business_id());

-- Calendar Settings table policies
CREATE POLICY "calendar_settings_provider_access" ON "calendarSettings" 
  TO "authenticated" 
  USING (get_my_role() IN ('admin', 'admin/provider', 'provider') AND "providerId" = auth.uid()) 
  WITH CHECK (get_my_role() IN ('admin', 'admin/provider', 'provider') AND "providerId" = auth.uid());

-- User Contexts table policies
CREATE POLICY "user_contexts_business_access" ON "userContexts" 
  TO "authenticated" 
  USING (get_my_role() IN ('admin', 'admin/provider', 'provider') AND "businessId" = get_my_business_id()) 
  WITH CHECK (get_my_role() IN ('admin', 'admin/provider', 'provider') AND "businessId" = get_my_business_id()); 