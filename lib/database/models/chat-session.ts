import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "../supabase/environment";
import { v4 as uuidv4 } from 'uuid';
import { handleModelError } from '@/lib/general-helpers/error';

// Represents a single message within the allMessages array
export interface ChatMessage {
  role: 'user' | 'bot' | 'staff';
  content: string | BotResponseMessage; // Can be simple text or a rich response object
  timestamp?: string; // ISO date string, when the message was recorded in allMessages
  displayType?: 'text' | 'interactive'; // Helps frontend decide how to render
  attachments?: Array<{
    type: 'image' | 'video' | 'document' | 'audio' | 'sticker';
    url: string;
    caption?: string;
    originalFilename?: string;
    mimeType?: string;
    size?: number;
  }>; // Optional field for media content
}

// Represents the interactive message format from the bot
export interface BotResponseMessage {
  text?: string;
  buttons?: Array<{ 
    buttonText: string;
    buttonValue: string;
    buttonDescription?: string;
  }>;
  listActionText?: string;
  listSectionTitle?: string;
}

// Interface for the actual database schema of the chatSessions table
export interface ChatSessionDBSchema {
  id: string; // uuid, primary key
  userId?: string | null; // uuid, foreign key to users.id
  businessId: string; // uuid, foreign key to businesses.id (Now non-nullable)
  channel: string; // e.g., 'whatsapp', 'web', 'api' (Made non-nullable as it's key for session identification)
  channelUserId: string; // User's identifier on the specific channel (Made non-nullable)
  status?: string | null; // Session status: 'active', 'completed', 'escalated', 'expired', 'abandoned'
  endedAt?: string | null; // timestamptz, when the session was explicitly ended
  sessionIntent?: string | null; // Detected overall intent for the session
  allMessages: ChatMessage[]; // jsonb, array of ChatMessage objects
  summarySession?: string | null; // Text summary of the session
  feedbackDataAveraged?: Record<string, any> | null; // jsonb, aggregated feedback data
  overallChatScore?: number | null; // int2, score for the chat session
  controlledByUserId?: string | null; // uuid, foreign key to users.id - admin who has control
  controlTakenAt?: string | null; // timestamptz, when admin control was taken
  createdAt: string; // timestamptz, when the record was created/session started
  updatedAt: string; // timestamptz, when the record was last updated
}

// Interface for data used when creating a new chat session
export type ChatSessionCreateInput = {
  channel: string; // Required
  channelUserId: string; // Required
  businessId: string; // Required
  userId?: string | null;
  status?: string | null; // Session status, defaults to 'active'
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
  status?: string | null;
  endedAt?: string | null;
  sessionIntent?: string | null;
  allMessages: ChatMessage[];
  summarySession?: string | null;
  feedbackDataAveraged?: Record<string, any> | null;
  overallChatScore?: number | null;
  controlledByUserId?: string | null;
  controlTakenAt?: string | null;
  createdAt: string;
  updatedAt: string;

  private constructor(data: ChatSessionDBSchema) {
    this.id = data.id;
    this.userId = data.userId;
    this.businessId = data.businessId;
    this.channel = data.channel;
    this.channelUserId = data.channelUserId;
    this.status = data.status;
    this.endedAt = data.endedAt;
    this.sessionIntent = data.sessionIntent;
    this.allMessages = data.allMessages || []; // Ensure it's an array
    this.summarySession = data.summarySession;
    this.feedbackDataAveraged = data.feedbackDataAveraged;
    this.overallChatScore = data.overallChatScore;
    this.controlledByUserId = data.controlledByUserId;
    this.controlTakenAt = data.controlTakenAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  private static isValidUUID(id: string): boolean {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  static async create(input: ChatSessionCreateInput): Promise<ChatSession> {
    const supa = getEnvironmentServiceRoleClient(); // Use service role client to bypass RLS for creation
    const newId = uuidv4();
    const now = new Date().toISOString();

    const dbData: ChatSessionDBSchema = {
      id: newId,
      channel: input.channel,
      channelUserId: input.channelUserId,
      businessId: input.businessId,
      userId: input.userId,
      status: input.status || 'active', // Default to 'active' status
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
    const supa = getEnvironmentServiceRoleClient(); // Use service role client for all backend operations
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
    const supa = getEnvironmentServiceRoleClient(); // Use service role client for all backend operations
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
    const supa = getEnvironmentServiceRoleClient(); // Use service role client for all backend operations
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
    const supa = getEnvironmentServiceRoleClient(); // Use service role client for all backend operations
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
    const supa = getEnvironmentServiceRoleClient(); // Use service role client for all backend operations
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
    const supa = getEnvironmentServiceRoleClient(); // Use service role client for all backend operations
    const { error } = await supa.from('chatSessions').delete().eq('id', id);

    if (error) {
      handleModelError(`Failed to delete chat session ${id}`, error);
    }
  }

  static async updateStatus(
    sessionId: string,
    status: 'active' | 'completed' | 'escalated' | 'expired' | 'abandoned'
  ): Promise<ChatSession> {
    if (!this.isValidUUID(sessionId)) {
      console.warn(`[ChatSessionModel] Attempted to update status with invalid UUID: ${sessionId}`);
      throw new Error(`Invalid session ID: ${sessionId}`);
    }
    
    const supa = getEnvironmentServiceRoleClient(); // Use service role client for all backend operations
    const { data, error } = await supa
      .from('chatSessions')
      .update({ 
        status: status, 
        'updatedAt': new Date().toISOString() // Use quoted column name to ensure proper handling
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      handleModelError(`Failed to update chat session status for session ${sessionId}`, error);
    }

    if (!data) {
      handleModelError(`Chat session with id ${sessionId} not found for update`, new Error('Chat session not found'));
    }

    return new ChatSession(data);
  }

  /**
   * Take admin control of a chat session
   */
  static async takeControl(sessionId: string, userId: string): Promise<ChatSession> {
    if (!this.isValidUUID(sessionId)) {
      throw new Error(`Invalid session ID: ${sessionId}`);
    }
    if (!this.isValidUUID(userId)) {
      throw new Error(`Invalid user ID: ${userId}`);
    }
    
    const supa = getEnvironmentServiceRoleClient();
    const { data, error } = await supa
      .from('chatSessions')
      .update({ 
        controlledByUserId: userId,
        controlTakenAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      handleModelError(`Failed to take control of session ${sessionId}`, error);
    }

    if (!data) {
      handleModelError(`Chat session with id ${sessionId} not found`, new Error('Chat session not found'));
    }

    return new ChatSession(data);
  }

  /**
   * Release admin control of a chat session
   */
  static async releaseControl(sessionId: string): Promise<ChatSession> {
    if (!this.isValidUUID(sessionId)) {
      throw new Error(`Invalid session ID: ${sessionId}`);
    }
    
    const supa = getEnvironmentServiceRoleClient();
    const { data, error } = await supa
      .from('chatSessions')
      .update({ 
        controlledByUserId: null,
        controlTakenAt: null,
        updatedAt: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      handleModelError(`Failed to release control of session ${sessionId}`, error);
    }

    if (!data) {
      handleModelError(`Chat session with id ${sessionId} not found`, new Error('Chat session not found'));
    }

    return new ChatSession(data);
  }

  /**
   * Checks if a chat session is currently under admin control
   * This is used to determine if the bot should be blocked from responding
   * @param sessionId The ID of the chat session to check
   * @returns Promise<boolean> - true if under admin control, false otherwise
   */
  static async isUnderAdminControl(sessionId: string): Promise<boolean> {
    if (!this.isValidUUID(sessionId)) {
      console.warn(`[ChatSessionModel] Invalid UUID for admin control check: ${sessionId}`);
      return false;
    }

    try {
      const supa = getEnvironmentServiceRoleClient();
      const { data, error } = await supa
        .from('chatSessions')
        .select('controlledByUserId')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error(`[ChatSessionModel] Error checking admin control:`, error);
        // In case of error, we'll assume no admin control to avoid blocking the bot unnecessarily
        return false;
      }

      // If controlledByUserId exists and is not null, session is under admin control
      return !!data?.controlledByUserId;
    } catch (error) {
      console.error(`[ChatSessionModel] Exception checking admin control:`, error);
      // In case of exception, we'll assume no admin control to avoid blocking the bot unnecessarily
      return false;
    }
  }

  static async getAll(): Promise<ChatSession[]> {
    const supa = getEnvironmentServiceRoleClient(); // Use service role client for all backend operations
    const { data, error } = await supa
      .from('chatSessions')
      .select('*');

    if (error) {
      handleModelError('Failed to fetch all chat sessions', error);
    }

    return data.map((row: ChatSessionDBSchema) => new ChatSession(row));
  }

  /**
   * Get all chat sessions for a specific business
   */
  static async getByBusinessId(businessId: string): Promise<ChatSession[]> {
    if (!this.isValidUUID(businessId)) {
      console.warn(`[ChatSessionModel] Attempted to fetch with invalid businessId UUID: ${businessId}`);
      return [];
    }
    
    const supa = getEnvironmentServiceRoleClient();
    const { data, error } = await supa
      .from('chatSessions')
      .select('*')
      .eq('businessId', businessId)
      .order('updatedAt', { ascending: false });

    if (error) {
      handleModelError(`Failed to fetch chat sessions for business ${businessId}`, error);
    }

    return data.map((row: ChatSessionDBSchema) => new ChatSession(row));
  }

  /**
   * Get unique conversations for a business (deduplicated by channelUserId)
   */
  static async getConversationsForBusiness(businessId: string): Promise<Array<{
    channelUserId: string;
    updatedAt: string;
  }>> {
    if (!this.isValidUUID(businessId)) {
      console.warn(`[ChatSessionModel] Attempted to fetch conversations with invalid businessId UUID: ${businessId}`);
      return [];
    }
    
    const supa = getEnvironmentServiceRoleClient();
    const { data, error } = await supa
      .from('chatSessions')
      .select('channelUserId, updatedAt')
      .eq('businessId', businessId)
      .order('updatedAt', { ascending: false });

    if (error) {
      handleModelError(`Failed to fetch conversations for business ${businessId}`, error);
    }

    // Create conversations map to deduplicate by channelUserId
    const conversationsMap = new Map<string, { channelUserId: string; updatedAt: string }>();
    
    if (data) {
      for (const session of data) {
        if (!conversationsMap.has(session.channelUserId)) {
          conversationsMap.set(session.channelUserId, {
            channelUserId: session.channelUserId,
            updatedAt: session.updatedAt,
          });
        }
      }
    }

    return Array.from(conversationsMap.values());
  }

  /**
   * Get channelUserId from sessionId with business security check
   */
  static async getChannelUserIdBySessionId(sessionId: string, businessId: string): Promise<string | null> {
    if (!this.isValidUUID(sessionId)) {
      console.warn(`[ChatSessionModel] Attempted to fetch with invalid sessionId UUID: ${sessionId}`);
      return null;
    }
    
    if (!this.isValidUUID(businessId)) {
      console.warn(`[ChatSessionModel] Attempted to fetch with invalid businessId UUID: ${businessId}`);
      return null;
    }

    const supa = getEnvironmentServiceRoleClient();
    const { data, error } = await supa
      .from('chatSessions')
      .select('channelUserId')
      .eq('id', sessionId)
      .eq('businessId', businessId) // Security check to ensure session belongs to the business
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      console.error(`[ChatSessionModel] Error fetching session for preselection: ${error.message}`);
      return null;
    }

    return data?.channelUserId || null;
  }

  /**
   * High-level method to get all conversation data needed for the chat interface
   * Combines user business lookup, conversations fetching, session preselection, and escalation status
   */
  static async getBusinessConversationsData(
    userId: string,
    preselectedSessionId?: string
  ): Promise<{
    conversations: Array<{ 
      channelUserId: string; 
      updatedAt: string; 
      hasEscalation: boolean;
      escalationStatus: string | null;
      sessionId: string;
    }>;
    preselectedChannelUserId?: string;
  } | null> {
    try {
      const supa = getEnvironmentServiceRoleClient();

      // First, get the businessId of the logged-in user
      const { data: userData, error: userError } = await supa
        .from("users")
        .select("businessId")
        .eq("id", userId)
        .single();

      if (userError || !userData?.businessId) {
        console.error("Error fetching user's businessId:", userError);
        return null;
      }

      const businessId = userData.businessId;

      // Get all chat sessions for this business
      const { data: chatSessions, error: sessionsError } = await supa
        .from("chatSessions")
        .select("id, channelUserId, updatedAt")
        .eq("businessId", businessId)
        .order("updatedAt", { ascending: false });

      if (sessionsError) {
        console.error("Error fetching chat sessions:", sessionsError);
        return null;
      }

      // Get active notifications for this business
      const { data: notifications, error: notificationsError } = await supa
        .from("notifications")
        .select("chatSessionId, status")
        .eq("businessId", businessId)
        .in("status", ["pending", "attending"])
        .order("createdAt", { ascending: false });

      if (notificationsError) {
        console.error("Error fetching notifications:", notificationsError);
        // Continue without escalation data rather than failing completely
      }

      // Create a map of sessionId -> escalation info
      const escalationMap = new Map<string, { status: string }>();
      if (notifications) {
        for (const notification of notifications) {
          if (!escalationMap.has(notification.chatSessionId)) {
            escalationMap.set(notification.chatSessionId, {
              status: notification.status
            });
          }
        }
      }

      // Group sessions by channelUserId to create unique conversations with escalation data
      const conversationsMap = new Map<string, { 
        channelUserId: string; 
        updatedAt: string; 
        hasEscalation: boolean;
        escalationStatus: string | null;
        sessionId: string;
      }>();
      
      if (chatSessions) {
        for (const session of chatSessions) {
          if (!conversationsMap.has(session.channelUserId)) {
            const escalationInfo = escalationMap.get(session.id);
            conversationsMap.set(session.channelUserId, {
              channelUserId: session.channelUserId,
              updatedAt: session.updatedAt,
              hasEscalation: !!escalationInfo,
              escalationStatus: escalationInfo?.status || null,
              sessionId: session.id,
            });
          }
        }
      }

      // Convert to array and sort with escalations first
      const conversations = Array.from(conversationsMap.values()).sort((a, b) => {
        // Prioritize escalations: pending first, then attending, then non-escalated
        const getEscalationPriority = (conv: typeof a) => {
          if (conv.escalationStatus === 'pending') return 0;
          if (conv.escalationStatus === 'attending') return 1;
          return 2;
        };

        const priorityA = getEscalationPriority(a);
        const priorityB = getEscalationPriority(b);

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // If same escalation priority, sort by most recent activity
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      let preselectedChannelUserId: string | undefined = undefined;

      // If a session ID is specified, find its corresponding channelUserId
      if (preselectedSessionId && chatSessions) {
        const targetSession = chatSessions.find(session => session.id === preselectedSessionId);
        if (targetSession) {
          preselectedChannelUserId = targetSession.channelUserId;
        }
      }

      return {
        conversations,
        preselectedChannelUserId,
      };

    } catch (error) {
      console.error("Error in getBusinessConversationsData:", error);
      return null;
    }
  }

  /**
   * High-level method to get all conversation data for superadmin
   * Returns conversations from ALL businesses
   */
  static async getAllBusinessesConversationsData(
    preselectedSessionId?: string
  ): Promise<{
    conversations: Array<{ 
      channelUserId: string; 
      updatedAt: string; 
      hasEscalation: boolean;
      escalationStatus: string | null;
      sessionId: string;
      businessId: string;
      businessName: string;
    }>;
    preselectedChannelUserId?: string;
  } | null> {
    try {
      const supa = getEnvironmentServiceRoleClient();

      // Get all chat sessions from all businesses
      const { data: chatSessions, error: sessionsError } = await supa
        .from("chatSessions")
        .select(`
          id, 
          channelUserId, 
          updatedAt, 
          businessId,
          businesses!inner(name)
        `)
        .order("updatedAt", { ascending: false });

      if (sessionsError) {
        console.error("Error fetching chat sessions:", sessionsError);
        return null;
      }

      // Get all active notifications from all businesses
      const { data: notifications, error: notificationsError } = await supa
        .from("notifications")
        .select("chatSessionId, status")
        .in("status", ["pending", "attending"])
        .order("createdAt", { ascending: false });

      if (notificationsError) {
        console.error("Error fetching notifications:", notificationsError);
        // Continue without escalation data rather than failing completely
      }

      // Create a map of sessionId -> escalation info
      const escalationMap = new Map<string, { status: string }>();
      if (notifications) {
        for (const notification of notifications) {
          if (!escalationMap.has(notification.chatSessionId)) {
            escalationMap.set(notification.chatSessionId, {
              status: notification.status
            });
          }
        }
      }

      // Group sessions by channelUserId to create unique conversations with escalation data
      const conversationsMap = new Map<string, { 
        channelUserId: string; 
        updatedAt: string; 
        hasEscalation: boolean;
        escalationStatus: string | null;
        sessionId: string;
        businessId: string;
        businessName: string;
      }>();
      
      if (chatSessions) {
        for (const session of chatSessions) {
          if (!conversationsMap.has(session.channelUserId)) {
            const escalationInfo = escalationMap.get(session.id);
            conversationsMap.set(session.channelUserId, {
              channelUserId: session.channelUserId,
              updatedAt: session.updatedAt,
              hasEscalation: !!escalationInfo,
              escalationStatus: escalationInfo?.status || null,
              sessionId: session.id,
              businessId: session.businessId,
              businessName: session.businesses?.name || 'Unknown Business',
            });
          }
        }
      }

      // Convert to array and sort with escalations first
      const conversations = Array.from(conversationsMap.values()).sort((a, b) => {
        // Prioritize escalations: pending first, then attending, then non-escalated
        const getEscalationPriority = (conv: typeof a) => {
          if (conv.escalationStatus === 'pending') return 0;
          if (conv.escalationStatus === 'attending') return 1;
          return 2;
        };

        const priorityA = getEscalationPriority(a);
        const priorityB = getEscalationPriority(b);

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // If same escalation priority, sort by most recent activity
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      let preselectedChannelUserId: string | undefined = undefined;

      // If a session ID is specified, find its corresponding channelUserId
      if (preselectedSessionId && chatSessions) {
        const targetSession = chatSessions.find(session => session.id === preselectedSessionId);
        if (targetSession) {
          preselectedChannelUserId = targetSession.channelUserId;
        }
      }

      return {
        conversations,
        preselectedChannelUserId,
      };

    } catch (error) {
      console.error("Error in getAllBusinessesConversationsData:", error);
      return null;
    }
  }
}
