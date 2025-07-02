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
    "firstName" TEXT,
    "lastName" TEXT,
    email TEXT UNIQUE,
    "phoneNumber" TEXT,
    role TEXT DEFAULT 'customer',
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