-- Add admin control tracking to chatSessions table
-- This separates admin control from escalation notifications

ALTER TABLE "chatSessions" 
ADD COLUMN IF NOT EXISTS "controlledByUserId" UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS "controlTakenAt" TIMESTAMP WITH TIME ZONE;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS "chatSessions_controlled_by_idx" 
ON "chatSessions" ("controlledByUserId") 
WHERE "controlledByUserId" IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN "chatSessions"."controlledByUserId" IS 'ID of admin/staff user who has taken control of this chat session';
COMMENT ON COLUMN "chatSessions"."controlTakenAt" IS 'Timestamp when admin control was taken'; 