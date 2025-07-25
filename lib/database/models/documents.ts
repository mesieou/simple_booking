import { getEnvironmentServerClient } from "../supabase/environment";
import { handleModelError } from '@/lib/general-helpers/error-handling/model-error-handler';
import { CONFIDENCE_CONFIG } from '@/lib/general-config/general-config';

export interface DocumentData {
  id?: string;
  businessId: string;
  category?: string;
  type?: 'pdf' | 'website_page' | string;
  title?: string;
  content: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  contentHash?: string;
  sessionId?: string;
  confidence?: number;
  preChunkSourceIndex?: number;
  embedding?: number[];
  embeddingInputText?: string;
  embeddingAttemptResult?: {
    vectorSample?: number[];
    error?: string;
    stack?: string;
  };
  serviceId?: string;
}

export class DocumentError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = "DocumentError";
  }
}

export class Document {
  private data: DocumentData;

  constructor(data: DocumentData) {
    if (!data.businessId) handleModelError("businessId is required", new Error("Missing businessId"));
    if (!data.content) handleModelError("content is required", new Error("Missing content"));
    if (data.type && !['pdf', 'website_page'].includes(data.type)) {
      console.warn(`Document type '${data.type}' is not 'pdf' or 'website_page'. Allowed if DB column is generic text.`);
    }
    if (data.confidence !== undefined) {
      if (data.confidence < CONFIDENCE_CONFIG.MIN_SCORE || data.confidence > CONFIDENCE_CONFIG.MAX_SCORE) {
        handleModelError("Invalid confidence score", new Error(`Confidence must be between ${CONFIDENCE_CONFIG.MIN_SCORE} and ${CONFIDENCE_CONFIG.MAX_SCORE}`));
      }
    }
    this.data = data;
  }

  static async add(data: DocumentData): Promise<DocumentData> {
    console.log('Attempting to add document:', {
      businessId: data.businessId,
      category: data.category,
      type: data.type,
      title: data.title,
      contentLength: data.content.length,
      contentHash: data.contentHash,
      confidence: data.confidence
    });

    if (data.confidence !== undefined) {
      if (data.confidence < CONFIDENCE_CONFIG.MIN_SCORE || data.confidence > CONFIDENCE_CONFIG.MAX_SCORE) {
        handleModelError("Invalid confidence score", new Error(`Confidence must be between ${CONFIDENCE_CONFIG.MIN_SCORE} and ${CONFIDENCE_CONFIG.MAX_SCORE}`));
      }
    }

    const supabase = await getEnvironmentServerClient();
    const insertData = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const { data: result, error } = await supabase.from("documents").insert(insertData).select().single();
    
    if (error) {
      console.error('Failed to insert document:', {
        error: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint
      });
      handleModelError("Failed to insert document", error);
    }
    
    if (!result) {
      console.error('No data returned after document insert');
      handleModelError("No data returned after insert", new Error("No data returned"));
    }

    console.log('Successfully added document:', {
      id: result.id,
      businessId: result.businessId,
      category: result.category,
      type: result.type,
      confidence: result.confidence
    });

    return result;
  }

  static async getById(id: string): Promise<DocumentData> {
    const supabase = await getEnvironmentServerClient();
    const { data, error } = await supabase.from("documents").select("*").eq("id", id).single();
    if (error) handleModelError("Failed to fetch document", error);
    if (!data) handleModelError("Document not found", new Error("Document not found"));
    return data;
  }

  static async getAll(businessId?: string): Promise<DocumentData[]> {
    const supa = await getEnvironmentServerClient();
    let query = supa.from("documents").select("*");
    if (businessId) query = query.eq("businessId", businessId);
    const { data, error } = await query;
    if (error) {
      handleModelError("Failed to fetch documents", error);
    }
    return data || [];
  }

  static async update(id: string, data: Partial<DocumentData>): Promise<DocumentData> {
    const supabase = await getEnvironmentServerClient();
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const { data: result, error } = await supabase.from("documents").update(updateData).eq("id", id).select().single();
    if (error) handleModelError("Failed to update document", error);
    if (!result) handleModelError("No data returned after update", new Error("No data returned"));
    return result;
  }

  static async delete(id: string): Promise<void> {
    const supabase = await getEnvironmentServerClient();
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) handleModelError("Failed to delete document", error);
  }

  static async getBySessionId(sessionId: string): Promise<DocumentData[]> {
    const supabase = await getEnvironmentServerClient();
    const { data, error } = await supabase.from("documents").select("*").eq("sessionId", sessionId);
    if (error) handleModelError("Failed to fetch documents by sessionId", error);
    return data || [];
  }

  static async deleteBySessionId(sessionId: string): Promise<void> {
    const supabase = await getEnvironmentServerClient();
    const { error } = await supabase.from("documents").delete().eq("sessionId", sessionId);
    if (error) handleModelError("Failed to delete documents by sessionId", error);
  }

  static async findByServiceId(serviceId: string): Promise<DocumentData | null> {
    const supabase = await getEnvironmentServerClient();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("serviceId", serviceId)
      .maybeSingle();
    if (error) handleModelError("Failed to fetch document by serviceId", error);
    return data || null;
  }
} 