-- Add notificationType column to notifications table
-- This allows us to distinguish between different types of notifications (escalation, booking, system)

-- Add the notificationType column with a default value for existing records
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS "notificationType" TEXT DEFAULT 'escalation';

-- Add a check constraint to ensure only valid notification types are allowed
ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK ("notificationType" IN ('escalation', 'booking', 'system'));

-- Create an index on notificationType for efficient filtering
CREATE INDEX IF NOT EXISTS idx_notifications_notification_type 
ON notifications ("notificationType");

-- Update any existing notifications to have the 'escalation' type (they were all escalations before)
UPDATE notifications 
SET "notificationType" = 'escalation' 
WHERE "notificationType" IS NULL;

-- Add a comment to document the column
COMMENT ON COLUMN notifications."notificationType" IS 'Type of notification: escalation (customer needs help), booking (new booking created), system (system alerts)'; 