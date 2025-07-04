import { ChatSession, ChatSessionCreateInput } from "@/lib/database/models/chat-session";

// Interface for the output of getOrCreateSession
export interface SessionResolution {
  session: ChatSession;
  isNew: boolean;
}

/**
 * Resolves the session for a given user.
 * It finds an active session or creates a new one after cleaning up any expired sessions.
 * This function encapsulates the logic of *which* session to use.
 *
 * @param channel The communication channel (e.g., 'whatsapp').
 * @param channelUserId The user's identifier on that channel.
 * @param businessId The ID of the business this session belongs to. This is required for creating a new session.
 * @param sessionTimeoutHours The duration in hours to consider a session active.
 * @param additionalSessionParams Optional parameters for creating a new session, like userId.
 * @returns A Promise resolving to a SessionResolution object, or null on critical failure.
 */
export async function getOrCreateSession(
  channel: string,
  channelUserId: string,
  businessId: string,
  sessionTimeoutHours: number,
  additionalSessionParams?: Partial<Omit<ChatSessionCreateInput, 'channel' | 'channelUserId' | 'businessId'>>
): Promise<SessionResolution | null> {
  // 1. Try to find an existing active session
  const activeSession = await ChatSession.getActiveByChannelUserId(
    channel,
    channelUserId,
    sessionTimeoutHours
  );

  if (activeSession) {
    // Case 1: Active session found, return it immediately.
    return {
      session: activeSession,
      isNew: false,
    };
  }

  // Case 2 & 3: No active session found.
  // First, perform a fire-and-forget cleanup of any lingering, expired sessions for this user.
  await ChatSession.endInactiveSessionsForUser(channel, channelUserId, sessionTimeoutHours);

  // Before creating a new session, try to get the most recent previous session to preserve message history
  let previousMessages: any[] = [];
  try {
    const mostRecentSession = await ChatSession.getMostRecentPreviousSession(
      channel,
      channelUserId,
      new Date().toISOString() // Use current time as reference
    );
    
    if (mostRecentSession && mostRecentSession.allMessages) {
      previousMessages = mostRecentSession.allMessages;
      console.log(`[SessionLogic] Found previous session ${mostRecentSession.id} with ${previousMessages.length} messages - preserving history`);
    } else {
      console.log(`[SessionLogic] No previous session found for ${channel}:${channelUserId} - starting with empty history`);
    }
  } catch (error) {
    console.warn(`[SessionLogic] Error retrieving previous session history for ${channel}:${channelUserId}:`, error);
    // Continue with empty history if we can't retrieve previous messages
  }

  // Now, create a new session with preserved message history.
  try {
    const createInput: ChatSessionCreateInput = {
      channel: channel,
      channelUserId: channelUserId,
      businessId: businessId,
      allMessages: previousMessages, // Preserve message history from previous session
      userId: null, // Explicitly set to null for anonymous WhatsApp users
      ...(additionalSessionParams || {}),
    };
    const newSession = await ChatSession.create(createInput);
    console.log(`[SessionLogic] Created new session ${newSession.id} with ${previousMessages.length} preserved messages`);
    return {
      session: newSession,
      isNew: true,
    };
  } catch (error) {
    console.error(`[SessionLogic] Fatal error creating new session for ${channel}:${channelUserId}:`, error);
    // If session creation fails, we cannot proceed.
    return null;
  }
} 