-- Add sessionData column to userContexts table
-- This column will store session-specific data like user creation state (awaitingName, etc.)

ALTER TABLE "userContexts" 
ADD COLUMN "sessionData" JSONB DEFAULT NULL;

-- Add a comment to document the purpose
COMMENT ON COLUMN "userContexts"."sessionData" IS 'Stores session-specific data such as user creation state, temporary flags, and conversation flow state'; 