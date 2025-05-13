import { createClient } from "@/lib/supabase/client";

export interface EmbeddingData {
  id?: string;
  document_id: string;
  content: string;
  embedding: number[];
  category?: string;
  chunk_index?: number;
  metadata?: Record<string, any>;
  created_at?: string;
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
    if (!data.document_id) throw new EmbeddingError("document_id is required");
    if (!data.content) throw new EmbeddingError("content is required");
    if (!Array.isArray(data.embedding)) throw new EmbeddingError("embedding must be an array");
    this.data = data;
  }

  static async add(data: EmbeddingData): Promise<EmbeddingData> {
    const supa = createClient();
    const insertData = {
      ...data,
      created_at: new Date().toISOString(),
    };
    const { data: result, error } = await supa.from("embeddings").insert(insertData).select().single();
    if (error) throw new EmbeddingError("Failed to insert embedding", error);
    if (!result) throw new EmbeddingError("No data returned after insert");
    return result;
  }

  static async getByDocumentId(document_id: string): Promise<EmbeddingData[]> {
    const supa = createClient();
    const { data, error } = await supa.from("embeddings").select("*").eq("document_id", document_id);
    if (error) throw new EmbeddingError("Failed to fetch embeddings", error);
    return data || [];
  }

  static async deleteByDocumentId(document_id: string): Promise<void> {
    const supa = createClient();
    const { error } = await supa.from("embeddings").delete().eq("document_id", document_id);
    if (error) throw new EmbeddingError("Failed to delete embeddings", error);
  }
} 