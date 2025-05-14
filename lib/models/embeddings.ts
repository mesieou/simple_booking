import { createClient } from "@/lib/supabase/server";
import { handleModelError } from '@/lib/helpers/error';

export interface EmbeddingData {
  id?: string;
  documentId: string;
  content: string;
  embedding: number[];
  category?: string;
  chunkIndex?: number;
  metadata?: Record<string, any>;
  createdAt?: string;
}

export class EmbeddingError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export class Embedding {
  private data: EmbeddingData;

  constructor(data: EmbeddingData) {
    if (!data.documentId) handleModelError("documentId is required", new Error("Missing documentId"));
    if (!data.content) handleModelError("content is required", new Error("Missing content"));
    if (!Array.isArray(data.embedding)) handleModelError("embedding must be an array", new Error("Invalid embedding format"));
    this.data = data;
  }

  static async add(data: EmbeddingData): Promise<EmbeddingData> {
    const supa = createClient();
    const insertData = {
      ...data,
      createdAt: new Date().toISOString(),
    };
    const { data: result, error } = await supa.from("embeddings").insert(insertData).select().single();
    if (error) handleModelError("Failed to insert embedding", error);
    if (!result) handleModelError("No data returned after insert", new Error("No data returned"));
    return result;
  }

  static async getByDocumentId(documentId: string): Promise<EmbeddingData[]> {
    const supa = createClient();
    const { data, error } = await supa.from("embeddings").select("*").eq("documentId", documentId);
    if (error) handleModelError("Failed to fetch embeddings", error);
    return data || [];
  }

  static async deleteByDocumentId(documentId: string): Promise<void> {
    const supa = createClient();
    const { error } = await supa.from("embeddings").delete().eq("documentId", documentId);
    if (error) handleModelError("Failed to delete embeddings", error);
  }



  /**
   * Find the most similar content chunks to a given embedding vector.
   * @param embedding The embedding vector of the user message.
   * @param matchCount How many top matches to return (default: 5).
   * @returns Array of matching chunks with similarity scores.
   */
  static async findSimilar(embedding: number[], matchCount = 5) {
    const supa = createClient();
    const { data, error } = await supa.rpc('match_documents', {
      query_embedding: embedding,
      match_count: matchCount
    });
    if (error) throw error;
    return data;
  }
} 