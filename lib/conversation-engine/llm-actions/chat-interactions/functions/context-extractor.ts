import { ChatSession, ChatMessage, ChatSessionCreateInput } from "@/lib/database/models/chat-session"; 
import { getOrCreateSession, SessionResolution } from "./sessions-manager";

// Default session timeout in hours if not specified by the caller
const DEFAULT_SESSION_TIMEOUT_HOURS = 12;

export interface SessionContextResult {
  currentSessionId: string;
  historyForLLM: ChatMessage[];
  isNewSession: boolean;
  userId?: string | null; 
  businessId?: string | null; 
}

/**
 * Builds the historical context (ChatMessage array) for the LLM.
 * This logic is now unified: it ALWAYS tries to find the session immediately
 * preceding the one being used, to provide maximum context.
 * @param sessionToUse The session to build context from (can be new or resumed).
 * @returns A Promise resolving to the array of ChatMessage for history.
 */
async function buildHistoryForContext(
  sessionToUse: ChatSession
): Promise<ChatMessage[]> {
  const historyFromCurrentSession = sessionToUse.allMessages || [];

  // Always try to fetch the immediately preceding session for this user
  const previousSession = await ChatSession.getMostRecentPreviousSession(
    sessionToUse.channel,
    sessionToUse.channelUserId,
    sessionToUse.createdAt
  );

  if (previousSession) {
    console.log(`[ContextExtractor] Prepending history from previous session ${previousSession.id}`);
    const previousMessages = previousSession.allMessages || [];
    return [...previousMessages, ...historyFromCurrentSession];
  }

  // If no previous session is found, just return the current session's history
  // (which will be empty if the session is brand new).
  return historyFromCurrentSession;
}

/**
 * Extracts conversational context for LLMs by managing the user's chat session.
 * It finds an active session or creates a new one, and returns the relevant message history.
 *
 * @param channel The communication channel (e.g., 'whatsapp').
 * @param channelUserId The user's identifier on that channel (e.g., phone number).
 * @param businessId The business identifier for the session.
 * @param sessionTimeoutHours The duration in hours to consider a session active without new messages.
 * @param additionalSessionParams Optional parameters to pass when creating a new session (e.g., userId, businessId).
 * @returns A Promise resolving to a SessionContextResult object, or null if critical parameters are missing.
 */
export async function extractSessionContext(
  channel: string,
  channelUserId: string,
  businessId: string,
  sessionTimeoutHours: number = DEFAULT_SESSION_TIMEOUT_HOURS,
  additionalSessionParams?: Partial<Omit<ChatSessionCreateInput, 'channel' | 'channelUserId' | 'businessId'>>
): Promise<SessionContextResult | null> { 
  if (!channel || !channelUserId || !businessId) {
    console.error("[ContextExtractor] Critical error: Channel, Channel User ID, and Business ID are required.");
    return null;
  }

  // Step 1: Resolve which session to use (get existing active or create new).
  const sessionResolution = await getOrCreateSession(
    channel,
    channelUserId,
    businessId,
    sessionTimeoutHours,
    additionalSessionParams
  );

  if (!sessionResolution) {
    console.error(`[ContextExtractor] Failed to resolve a session for ${channel}:${channelUserId}.`);
    return null;
  }
  
  const { session: sessionToUse, isNew } = sessionResolution;

  // Step 2: Build the historical context based on the resolved session.
  const history = await buildHistoryForContext(sessionToUse);

  // Step 3: Combine results and return.
  return {
    currentSessionId: sessionToUse.id,
    historyForLLM: history,
    isNewSession: isNew,
    userId: sessionToUse.userId,
    businessId: sessionToUse.businessId,
  };
} 