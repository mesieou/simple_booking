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

  // Now, create a new session.
  try {
    const createInput: ChatSessionCreateInput = {
      channel: channel,
      channelUserId: channelUserId,
      businessId: businessId,
      allMessages: [],
      userId: null, // Explicitly set to null for anonymous WhatsApp users
      ...(additionalSessionParams || {}),
    };
    const newSession = await ChatSession.create(createInput);
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