import { createClient } from "@/lib/supabase/client";

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
    if (!data.businessId) throw new DocumentError("businessId is required");
    if (!data.content) throw new DocumentError("content is required");
    this.data = data;
  }

  static async add(data: DocumentData): Promise<DocumentData> {
    const supa = createClient();
    const insertData = {
      ...data,
      createdAt: new Date().toISOString(),
    };
    const { data: result, error } = await supa.from("documents").insert(insertData).select().single();
    if (error) {
      console.error("Supabase insert error:", {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint,
        table: "documents",
        data: insertData
      });
      throw new DocumentError(`Failed to insert document: ${error.message}`, error);
    }
    if (!result) throw new DocumentError("No data returned after insert");
    return result;
  }

  static async getById(id: string): Promise<DocumentData> {
    const supa = createClient();
    const { data, error } = await supa.from("documents").select("*").eq("id", id).single();
    if (error) {
      console.error("Supabase fetch error:", {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint,
        table: "documents",
        id
      });
      throw new DocumentError(`Failed to fetch document: ${error.message}`, error);
    }
    if (!data) throw new DocumentError("Document not found");
    return data;
  }

  static async getAll(businessId?: string): Promise<DocumentData[]> {
    const supa = createClient();
    let query = supa.from("documents").select("*");
    if (businessId) query = query.eq("businessId", businessId);
    const { data, error } = await query;
    if (error) {
      console.error("Supabase fetch error:", {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint,
        table: "documents",
        businessId
      });
      throw new DocumentError(`Failed to fetch documents: ${error.message}`, error);
    }
    return data || [];
  }

  static async update(id: string, data: Partial<DocumentData>): Promise<DocumentData> {
    const supa = createClient();
    const updateData = {
      ...data,
    };
    const { data: result, error } = await supa.from("documents").update(updateData).eq("id", id).select().single();
    if (error) {
      console.error("Supabase update error:", {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint,
        table: "documents",
        id,
        data: updateData
      });
      throw new DocumentError(`Failed to update document: ${error.message}`, error);
    }
    if (!result) throw new DocumentError("No data returned after update");
    return result;
  }

  static async delete(id: string): Promise<void> {
    const supa = createClient();
    const { error } = await supa.from("documents").delete().eq("id", id);
    if (error) {
      console.error("Supabase delete error:", {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint,
        table: "documents",
        id
      });
      throw new DocumentError(`Failed to delete document: ${error.message}`, error);
    }
  }
} 