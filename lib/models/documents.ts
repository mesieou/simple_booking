import { createClient } from "@/lib/supabase/client";
import { handleModelError } from '@/lib/helpers/error';

export interface DocumentData {
  id?: string;
  businessId: string;
  category?: string;
  type?: string;
  title?: string;
  content: string;
  source?: string;
  createdAt?: string;
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
    this.data = data;
  }

  static async add(data: DocumentData): Promise<DocumentData> {
    const supabase = createClient();
    const insertData = {
      ...data,
      createdAt: new Date().toISOString(),
    };
    const { data: result, error } = await supabase.from("documents").insert(insertData).select().single();
    if (error) handleModelError("Failed to insert document", error);
    if (!result) handleModelError("No data returned after insert", new Error("No data returned"));
    return result;
  }

  static async getById(id: string): Promise<DocumentData> {
    const supabase = createClient();
    const { data, error } = await supabase.from("documents").select("*").eq("id", id).single();
    if (error) handleModelError("Failed to fetch document", error);
    if (!data) handleModelError("Document not found", new Error("Document not found"));
    return data;
  }

  static async getAll(businessId?: string): Promise<DocumentData[]> {
    const supa = createClient();
    let query = supa.from("documents").select("*");
    if (businessId) query = query.eq("businessId", businessId);
    const { data, error } = await query;
    if (error) {
      handleModelError("Failed to fetch documents", error);
    }
    return data || [];
  }

  static async update(id: string, data: Partial<DocumentData>): Promise<DocumentData> {
    const supabase = createClient();
    const { data: result, error } = await supabase.from("documents").update(data).eq("id", id).select().single();
    if (error) handleModelError("Failed to update document", error);
    if (!result) handleModelError("No data returned after update", new Error("No data returned"));
    return result;
  }

  static async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) handleModelError("Failed to delete document", error);
  }
} 