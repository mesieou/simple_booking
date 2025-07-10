-- Add delivery tracking fields to notifications table
ALTER TABLE "notifications" 
ADD COLUMN "deliveryStatus" TEXT DEFAULT 'pending',
ADD COLUMN "deliveryAttempts" INTEGER DEFAULT 0,
ADD COLUMN "lastDeliveryAttempt" TIMESTAMP WITH TIME ZONE,
ADD COLUMN "deliveryError" TEXT,
ADD COLUMN "targetPhoneNumber" TEXT;

-- Add check constraint for delivery status
ALTER TABLE "notifications" 
ADD CONSTRAINT "notifications_delivery_status_check" 
CHECK ("deliveryStatus" IN ('pending', 'sent', 'failed', 'retry_scheduled'));

-- Create index for efficient querying of failed deliveries
CREATE INDEX "idx_notifications_delivery_retry" 
ON "notifications" ("deliveryStatus", "deliveryAttempts", "lastDeliveryAttempt") 
WHERE "deliveryStatus" = 'retry_scheduled';

-- Create index for delivery status queries
CREATE INDEX "idx_notifications_delivery_status" 
ON "notifications" ("deliveryStatus");

-- Add comment for documentation
COMMENT ON COLUMN "notifications"."deliveryStatus" IS 'Tracks WhatsApp message delivery status: pending, sent, failed, retry_scheduled';
COMMENT ON COLUMN "notifications"."deliveryAttempts" IS 'Number of delivery attempts made (max 3)';
COMMENT ON COLUMN "notifications"."lastDeliveryAttempt" IS 'Timestamp of last delivery attempt';
COMMENT ON COLUMN "notifications"."deliveryError" IS 'Error message from last failed delivery attempt';
COMMENT ON COLUMN "notifications"."targetPhoneNumber" IS 'Phone number where notification was sent'; 