-- Add WhatsApp message ID field to notifications table
ALTER TABLE "notifications" 
ADD COLUMN "whatsappMessageId" TEXT;

-- Create index for WhatsApp message ID lookups
CREATE INDEX "idx_notifications_whatsapp_message_id" 
ON "notifications" ("whatsappMessageId") 
WHERE "whatsappMessageId" IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN "notifications"."whatsappMessageId" IS 'WhatsApp message ID returned by Meta API for tracking delivery status';
