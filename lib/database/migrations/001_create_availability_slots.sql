-- Create availabilitySlots table
CREATE TABLE IF NOT EXISTS "availabilitySlots" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "providerId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "date" DATE NOT NULL,
    "slots" JSONB NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("providerId", "date")
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "availabilitySlots_providerId_date_idx" ON "availabilitySlots"("providerId", "date"); 