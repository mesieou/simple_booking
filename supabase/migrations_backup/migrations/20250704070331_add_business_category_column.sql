-- Add businessCategory column to businesses table
-- This column will be used for structured business categorization

ALTER TABLE businesses 
ADD COLUMN "businessCategory" TEXT;

-- Add comment to describe the column purpose
COMMENT ON COLUMN businesses."businessCategory" IS 'Structured business categorization (e.g., restaurant, retail, service, etc.)';
