import { createClient } from "@/lib/supabase/server";
import { handleModelError } from '@/lib/helpers/error';
import { CONFIDENCE_CONFIG } from '@/lib/bot/content-crawler/config';

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
    if (!data.embedding) handleModelError("embedding is required", new Error("Missing embedding"));
    if (data.metadata?.confidence !== undefined) {
      if (data.metadata.confidence < CONFIDENCE_CONFIG.MIN_SCORE || 
          data.metadata.confidence > CONFIDENCE_CONFIG.MAX_SCORE) {
        handleModelError("Invalid confidence score", 
          new Error(`Confidence must be between ${CONFIDENCE_CONFIG.MIN_SCORE} and ${CONFIDENCE_CONFIG.MAX_SCORE}`));
      }
    }
    this.data = data;
  }

  static async add(data: EmbeddingData): Promise<EmbeddingData> {
    const supa = await createClient();
    const insertData = {
      ...data,
      chunkIndex: data.chunkIndex ?? 0,
      createdAt: new Date().toISOString(),
    };
    console.log(`[Embedding] Attempting to insert embedding for document ${data.documentId}, chunk ${data.chunkIndex}`);
    const { data: result, error } = await supa.from("embeddings").insert(insertData).select().single();
    
    if (error) {
      console.error('Failed to insert embedding:', {
        documentId: data.documentId,
        chunkIndex: data.chunkIndex,
        error: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint
      });
      handleModelError("Failed to insert embedding", error);
    }
    
    if (!result) {
      console.error('No data returned after embedding insert');
      handleModelError("No data returned after insert", new Error("No data returned"));
    }

    console.log('Successfully added embedding:', {
      id: result.id,
      documentId: result.documentId,
      category: result.category,
      chunkIndex: result.chunkIndex
    });

    return result;
  }

  static async getByDocumentId(documentId: string): Promise<EmbeddingData[]> {
    return Embedding.getByDocumentIds([documentId]);
  }

  static async deleteByDocumentId(documentId: string): Promise<void> {
    const supa = await createClient();
    const { error } = await supa.from("embeddings").delete().eq("documentId", documentId);
    if (error) handleModelError("Failed to delete embeddings", error);
  }

  static async getByDocumentIds(documentIds: string[]): Promise<EmbeddingData[]> {
    if (!documentIds.length) return [];
    const supabase = await createClient();
    const { data, error } = await supabase.from("embeddings").select("*").in("documentId", documentIds);
    if (error) handleModelError("Failed to fetch embeddings by documentIds", error);
    return data || [];
  }
} 