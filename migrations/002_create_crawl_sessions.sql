-- Create crawl_sessions table
CREATE TABLE IF NOT EXISTS "crawl_sessions" (
    "id" UUID PRIMARY KEY,
    "businessId" UUID NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
    "startTime" BIGINT NOT NULL,
    "endTime" BIGINT,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "successfulPages" INTEGER NOT NULL DEFAULT 0,
    "failedPages" INTEGER NOT NULL DEFAULT 0,
    "categories" JSONB NOT NULL DEFAULT '{}',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "missingInformation" TEXT,
    "categorizedContent" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "crawl_sessions_businessId_idx" ON "crawl_sessions"("businessId");
CREATE INDEX IF NOT EXISTS "crawl_sessions_startTime_idx" ON "crawl_sessions"("startTime"); 