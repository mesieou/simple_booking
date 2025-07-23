-- Add missing columns for proxy escalation functionality
-- Fresh migration to add columns that were recorded but not executed
-- Using camelCase naming convention to match existing schema

-- Add type column for notification categorization
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS "notificationType" TEXT DEFAULT 'escalation';

-- Add priority column for escalation urgency
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS "priorityLevel" TEXT DEFAULT 'medium';

-- Add language column for internationalization
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS "languageCode" TEXT DEFAULT 'en';

-- Add proxy session data column (CRITICAL for proxy mode)
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS "proxySessionData" JSONB DEFAULT NULL;

-- Add index for proxy session queries
CREATE INDEX IF NOT EXISTS "notifications_proxy_mode_idx" 
ON notifications(status, "targetPhoneNumber") 
WHERE status = 'proxy_mode';

-- Verify the new columns were created
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND column_name IN ('notificationType', 'priorityLevel', 'languageCode', 'proxySessionData')
ORDER BY column_name;
