-- Create embeddings table
CREATE TABLE IF NOT EXISTS "embeddings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "category" TEXT,
    "chunkIndex" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "embeddings_documentId_idx" ON "embeddings"("documentId");
CREATE INDEX IF NOT EXISTS "embeddings_category_idx" ON "embeddings"("category");
CREATE INDEX IF NOT EXISTS "embeddings_chunkIndex_idx" ON "embeddings"("chunkIndex"); 