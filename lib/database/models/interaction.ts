import { createClient } from "../supabase/server";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error';

// Interface for the actual database schema of the interactions table
export interface InteractionDBSchema {
  id: string; // uuid, primary key
  chat_session_id: string; // uuid, foreign key to chatSessions.id
  userMessage?: string | null; // Text of the user's message
  botMessage?: string | null; // Text of the bot's response
  customerIntent?: string | null; // Detected intent of the user for this interaction
  retrievedDataInfo?: Record<string, any> | null; // jsonb, info about data retrieved for RAG
  feedbackDataInfo?: Record<string, any> | null; // jsonb, feedback given for this interaction
  overallInteractionScore?: number | null; // int2, score for this specific interaction turn
  createdAt: string; // timestamptz, when the record was created
  // Interactions are typically immutable, so updatedAt might not be present or used.
  // If your schema has it, add: updatedAt?: string | null;
}

// Interface for data used when creating a new interaction
// Omits auto-generated id and createdAt
export type InteractionCreateInput = Omit<InteractionDBSchema, 'id' | 'createdAt'>;

// Interface for data used when updating an existing interaction (if ever needed)
// Interactions are often immutable, so updates might be rare.
export type InteractionUpdateInput = Partial<Omit<InteractionDBSchema, 'id' | 'createdAt' | 'chat_session_id'>>;

export class Interaction {
  id: string;
  chat_session_id: string;
  userMessage?: string | null;
  botMessage?: string | null;
  customerIntent?: string | null;
  retrievedDataInfo?: Record<string, any> | null;
  feedbackDataInfo?: Record<string, any> | null;
  overallInteractionScore?: number | null;
  createdAt: string;

  private constructor(data: InteractionDBSchema) {
    this.id = data.id;
    this.chat_session_id = data.chat_session_id;
    this.userMessage = data.userMessage;
    this.botMessage = data.botMessage;
    this.customerIntent = data.customerIntent;
    this.retrievedDataInfo = data.retrievedDataInfo;
    this.feedbackDataInfo = data.feedbackDataInfo;
    this.overallInteractionScore = data.overallInteractionScore;
    this.createdAt = data.createdAt;
  }

  private static isValidUUID(id: string): boolean {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  static async create(input: InteractionCreateInput): Promise<Interaction> {
    const supa = await createClient();
    const newId = uuidv4();
    const now = new Date().toISOString();

    const dbData: InteractionDBSchema = {
      ...input,
      id: newId,
      createdAt: now,
    };

    const { data, error } = await supa
      .from('interactions')
      .insert(dbData)
      .select('*')
      .single();

    if (error) {
      handleModelError('Failed to create interaction', error);
    }
    if (!data) {
      handleModelError('Interaction creation returned no data', new Error('No data from insert'));
    }
    return new Interaction(data as InteractionDBSchema);
  }

  static async getById(id: string): Promise<Interaction | null> {
    if (!this.isValidUUID(id)) {
      console.warn(`[InteractionModel] Attempted to fetch with invalid UUID: ${id}`);
      return null;
    }
    const supa = await createClient();
    const { data, error } = await supa
      .from('interactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      handleModelError(`Failed to fetch interaction by ID ${id}`, error);
    }
    return data ? new Interaction(data as InteractionDBSchema) : null;
  }

  static async getBySessionId(
    chatSessionId: string,
    params?: { limit?: number; offset?: number; order?: 'asc' | 'desc' }
  ): Promise<Interaction[]> {
    if (!this.isValidUUID(chatSessionId)) {
      console.warn(`[InteractionModel] Attempted to fetch by session with invalid UUID: ${chatSessionId}`);
      return [];
    }
    const supa = await createClient();
    
    let queryBuilder = supa
      .from('interactions')
      .select('*')
      .eq('chat_session_id', chatSessionId)
      .order('createdAt', { ascending: params?.order === 'asc' });

    if (params?.limit !== undefined && params?.offset !== undefined) {
      queryBuilder = queryBuilder.range(params.offset, params.offset + params.limit - 1);
    } else if (params?.limit !== undefined) {
      queryBuilder = queryBuilder.limit(params.limit);
    }
    // Note: Supabase client might not support offset without limit directly in this chainable way.
    // .range() is preferred for pagination.

    const { data, error } = await queryBuilder;

    if (error) {
      handleModelError(`Failed to fetch interactions for session ID ${chatSessionId}`, error);
    }
    return (data || []).map(item => new Interaction(item as InteractionDBSchema));
  }

  // Interactions are often immutable. Update might be for admin corrections or very specific scenarios.
  static async update(id: string, input: InteractionUpdateInput): Promise<Interaction | null> {
    if (!this.isValidUUID(id)) {
      console.warn(`[InteractionModel] Attempted to update with invalid UUID: ${id}`);
      return null;
    }
    const supa = await createClient();
    // If your interactions table has an `updatedAt` column, set it here:
    // const dataToUpdate = { ...input, updatedAt: new Date().toISOString() };
    const dataToUpdate = { ...input }; 

    const { data, error } = await supa
      .from('interactions')
      .update(dataToUpdate)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      handleModelError(`Failed to update interaction ${id}`, error);
    }
     if (!data) {
      console.warn(`[InteractionModel] Update for interaction ${id} returned no data, record might not exist.`);
      return null;
    }
    return new Interaction(data as InteractionDBSchema);
  }

  static async delete(id: string): Promise<void> {
    if (!this.isValidUUID(id)) {
      handleModelError('Invalid UUID for delete Interaction', new Error('Invalid UUID for delete'));
      return;
    }
    const supa = await createClient();
    const { error } = await supa.from('interactions').delete().eq('id', id);

    if (error) {
      handleModelError(`Failed to delete interaction ${id}`, error);
    }
  }
} 