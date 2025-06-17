import { createClient } from "../supabase/server";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error';

// Represents a single message within the allMessages array
export interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp?: string; // ISO date string, when the message was recorded in allMessages
}

// Interface for the actual database schema of the chatSessions table
export interface ChatSessionDBSchema {
  id: string; // uuid, primary key
  userId?: string | null; // uuid, foreign key to users.id
  businessId: string; // uuid, foreign key to businesses.id (Now non-nullable)
  channel: string; // e.g., 'whatsapp', 'web', 'api' (Made non-nullable as it's key for session identification)
  channelUserId: string; // User's identifier on the specific channel (Made non-nullable)
  endedAt?: string | null; // timestamptz, when the session was explicitly ended
  sessionIntent?: string | null; // Detected overall intent for the session
  allMessages: ChatMessage[]; // jsonb, array of ChatMessage objects
  summarySession?: string | null; // Text summary of the session
  feedbackDataAveraged?: Record<string, any> | null; // jsonb, aggregated feedback data
  overallChatScore?: number | null; // int2, score for the chat session
  createdAt: string; // timestamptz, when the record was created/session started
  updatedAt: string; // timestamptz, when the record was last updated
}

// Interface for data used when creating a new chat session
export type ChatSessionCreateInput = {
  channel: string; // Required
  channelUserId: string; // Required
  businessId: string; // Required
  userId?: string | null;
  endedAt?: string | null;
  sessionIntent?: string | null;
  allMessages?: ChatMessage[] | null; // Optional, will default to []
  summarySession?: string | null;
  feedbackDataAveraged?: Record<string, any> | null;
  overallChatScore?: number | null;
};

// Interface for data used when updating an existing chat session
// id is used for lookup, most other fields are optional for update
export type ChatSessionUpdateInput = Partial<Omit<ChatSessionDBSchema, 'id' | 'createdAt' | 'channel' | 'channelUserId' | 'businessId'>>;

export class ChatSession {
  id: string;
  userId?: string | null;
  businessId: string;
  channel: string;
  channelUserId: string;
  endedAt?: string | null;
  sessionIntent?: string | null;
  allMessages: ChatMessage[];
  summarySession?: string | null;
  feedbackDataAveraged?: Record<string, any> | null;
  overallChatScore?: number | null;
  createdAt: string;
  updatedAt: string;

  private constructor(data: ChatSessionDBSchema) {
    this.id = data.id;
    this.userId = data.userId;
    this.businessId = data.businessId;
    this.channel = data.channel;
    this.channelUserId = data.channelUserId;
    this.endedAt = data.endedAt;
    this.sessionIntent = data.sessionIntent;
    this.allMessages = data.allMessages || []; // Ensure it's an array
    this.summarySession = data.summarySession;
    this.feedbackDataAveraged = data.feedbackDataAveraged;
    this.overallChatScore = data.overallChatScore;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  private static isValidUUID(id: string): boolean {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  static async create(input: ChatSessionCreateInput): Promise<ChatSession> {
    const supa = await createClient();
    const newId = uuidv4();
    const now = new Date().toISOString();

    const dbData: ChatSessionDBSchema = {
      id: newId,
      channel: input.channel,
      channelUserId: input.channelUserId,
      businessId: input.businessId,
      userId: input.userId,
      endedAt: input.endedAt,
      sessionIntent: input.sessionIntent,
      allMessages: input.allMessages || [],
      summarySession: input.summarySession,
      feedbackDataAveraged: input.feedbackDataAveraged,
      overallChatScore: input.overallChatScore,
      createdAt: now,
      updatedAt: now,
    };

    const { data, error } = await supa
      .from('chatSessions')
      .insert(dbData)
      .select('*')
      .single();

    if (error) {
      handleModelError('Failed to create chat session', error);
    }
    if (!data) {
      handleModelError('Chat session creation returned no data', new Error('No data from insert'));
    }
    return new ChatSession(data as ChatSessionDBSchema);
  }

  static async getById(id: string): Promise<ChatSession | null> {
    if (!this.isValidUUID(id)) {
      console.warn(`[ChatSessionModel] Attempted to fetch with invalid UUID: ${id}`);
      return null;
    }
    const supa = await createClient();
    const { data, error } = await supa
      .from('chatSessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Standard code for "no rows returned"
      handleModelError(`Failed to fetch chat session by ID ${id}`, error);
    }
    return data ? new ChatSession(data as ChatSessionDBSchema) : null;
  }

  static async getActiveByChannelUserId(
    channel: string,
    channelUserId: string,
    sessionTimeoutHours: number
  ): Promise<ChatSession | null> {
    if (!channel || !channelUserId) {
        // It's better to throw or return null early if required params are missing
        console.error('[ChatSessionModel] Channel and channelUserId are required for getActiveByChannelUserId');
        // Depending on strictness, either throw or return null.
        // handleModelError typically throws, so using it might be an option if this is a critical error.
        // For a getter, returning null might be more expected by callers if parameters are invalid.
        return null; 
    }
    const supa = await createClient();
    const threshold = new Date(Date.now() - sessionTimeoutHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supa
      .from('chatSessions')
      .select('*')
      .eq('channel', channel)
      .eq('channelUserId', channelUserId)
      .is('endedAt', null)
      .gte('updatedAt', threshold)
      .order('updatedAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      handleModelError(`Failed to fetch active chat session for ${channel}:${channelUserId}`, error);
    }
    return data ? new ChatSession(data as ChatSessionDBSchema) : null;
  }

  static async update(id: string, input: ChatSessionUpdateInput): Promise<ChatSession | null> {
    if (!this.isValidUUID(id)) {
      console.warn(`[ChatSessionModel] Attempted to update with invalid UUID: ${id}`);
      return null;
    }
    const supa = await createClient();
    const dataToUpdate: ChatSessionUpdateInput & { updatedAt: string } = {
      ...input,
      updatedAt: new Date().toISOString(), // Always update the timestamp
    };

    const { data, error } = await supa
      .from('chatSessions')
      .update(dataToUpdate)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      handleModelError(`Failed to update chat session ${id}`, error);
    }
    if (!data) {
        console.warn(`[ChatSessionModel] Update for chat session ${id} returned no data, record might not exist.`);
        return null;
    }
    return new ChatSession(data as ChatSessionDBSchema);
  }

  static async end(id: string): Promise<ChatSession | null> {
    if (!this.isValidUUID(id)) {
        console.warn(`[ChatSessionModel] Attempted to end session with invalid UUID: ${id}`);
        return null;
    }
    return this.update(id, { endedAt: new Date().toISOString() });
  }

  static async getMostRecentPreviousSession(
    channel: string,
    channelUserId: string,
    currentSessionCreatedAt: string
  ): Promise<ChatSession | null> {
    if (!channel || !channelUserId || !currentSessionCreatedAt) {
      console.warn("[ChatSessionModel] Channel, channelUserId, and currentSessionCreatedAt are required to get previous session.");
      return null;
    }
    const supa = await createClient();
    try {
      const { data, error } = await supa
        .from('chatSessions')
        .select('*') // Select all fields to reconstruct a ChatSession object
        .eq('channel', channel)
        .eq('channelUserId', channelUserId)
        .lt('createdAt', currentSessionCreatedAt) // Use createdAt for comparison now
        .order('createdAt', { ascending: false }) // Get the latest among those that started before
        .limit(1)
        .maybeSingle();

      if (error) {
        // Log minimally, as failing to get a previous session is not critical for the current one
        console.warn(`[ChatSessionModel] Error fetching most recent previous session for ${channel}:${channelUserId}:`, error.message);
        return null;
      }
      return data ? new ChatSession(data as ChatSessionDBSchema) : null;
    } catch (e) {
      console.error("[ChatSessionModel] Unexpected error in getMostRecentPreviousSession:", e);
      return null;
    }
  }

  static async endInactiveSessionsForUser(
    channel: string,
    channelUserId: string,
    sessionTimeoutHours: number
  ): Promise<void> {
    if (!channel || !channelUserId) {
      console.warn("[ChatSessionModel] Channel and channelUserId are required to end inactive sessions.");
      return;
    }
    const supa = await createClient();
    const threshold = new Date(Date.now() - sessionTimeoutHours * 60 * 60 * 1000).toISOString();

    // Fire-and-forget query to close any lingering sessions for this user that have expired
    const { error } = await supa
      .from('chatSessions')
      .update({ endedAt: new Date().toISOString() })
      .eq('channel', channel)
      .eq('channelUserId', channelUserId)
      .is('endedAt', null)
      .lt('updatedAt', threshold);

    if (error) {
      // This is a background cleanup task, so we just log the error and don't throw,
      // as it shouldn't block the main flow of creating a new session.
      console.error(`[ChatSessionModel] Error ending inactive sessions for ${channel}:${channelUserId}:`, error.message);
    }
  }

  static async delete(id: string): Promise<void> {
    if (!this.isValidUUID(id)) {
      handleModelError('Invalid UUID for delete ChatSession', new Error('Invalid UUID for delete'));
      return; 
    }
    const supa = await createClient();
    const { error } = await supa.from('chatSessions').delete().eq('id', id);

    if (error) {
      handleModelError(`Failed to delete chat session ${id}`, error);
    }
  }
} 