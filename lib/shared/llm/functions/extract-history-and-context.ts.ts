import { ChatSession, ChatMessage, ChatSessionCreateInput } from "@/lib/database/models/chat-session"; 
import { getOrCreateSession } from "./sessions-manager";
import { UserContext } from "@/lib/database/models/user-context";

// Default session timeout in hours if not specified by the caller
const DEFAULT_SESSION_TIMEOUT_HOURS = 12;

export interface HistoryAndContextResult {
  currentSessionId: string;
  historyForLLM: ChatMessage[];
  isNewSession: boolean;
  userContext: UserContext; // The user's stateful context
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
    console.log(`[HistoryExtractor] Prepending history from previous session ${previousSession.id}`);
    const previousMessages = previousSession.allMessages || [];
    return [...previousMessages, ...historyFromCurrentSession];
  }

  // If no previous session is found, just return the current session's history
  return historyFromCurrentSession;
}

/**
 * Extracts conversational history and stateful context for a user.
 * It manages the user's chat session and their persistent UserContext.
 *
 * @param channel The communication channel (e.g., 'whatsapp').
 * @param channelUserId The user's identifier on that channel (e.g., phone number).
 * @param businessId The business identifier for the session.
 * @param sessionTimeoutHours The duration in hours to consider a session active.
 * @param additionalSessionParams Optional parameters for creating a new session.
 * @returns A Promise resolving to a HistoryAndContextResult object, or null if critical parameters are missing.
 */
export async function extractSessionHistoryAndContext(
  channel: string,
  channelUserId: string,
  businessId: string,
  sessionTimeoutHours: number = DEFAULT_SESSION_TIMEOUT_HOURS,
  additionalSessionParams?: Partial<Omit<ChatSessionCreateInput, 'channel' | 'channelUserId' | 'businessId'>>
): Promise<HistoryAndContextResult | null> { 
  if (!channel || !channelUserId || !businessId) {
    console.error("[HistoryExtractor] Critical error: Channel, Channel User ID, and Business ID are required.");
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
    console.error(`[HistoryExtractor] Failed to resolve a session for ${channel}:${channelUserId}.`);
    return null;
  }
  
  const { session: sessionToUse, isNew } = sessionResolution;

  // Step 2: Get or create the user's stateful context.
  let userContext = await UserContext.getByChannelUserIdAndBusinessId(channelUserId, businessId);
  if (!userContext) {
    console.log(`[HistoryExtractor] No UserContext found for ${channelUserId} and business ${businessId}, creating one.`);
    userContext = await UserContext.create({
      channelUserId: channelUserId,
      businessId: businessId,
    });
    console.log(`[HistoryExtractor] DEBUG - Created new UserContext:`, {
      id: userContext.id,
      channelUserId: userContext.channelUserId,
      businessId: userContext.businessId,
      hasCurrentGoal: !!userContext.currentGoal
    });
  } else {
    console.log(`[HistoryExtractor] DEBUG - Found existing UserContext:`, {
      id: userContext.id,
      channelUserId: userContext.channelUserId,
      businessId: userContext.businessId,
      hasCurrentGoal: !!userContext.currentGoal,
      currentGoalType: userContext.currentGoal?.goalType,
      currentGoalStatus: userContext.currentGoal?.goalStatus
    });
  }

  // Step 3: Build the historical context based on the resolved session.
  const history = await buildHistoryForContext(sessionToUse);

  // Step 4: Combine results and return.
  return {
    currentSessionId: sessionToUse.id,
    historyForLLM: history,
    isNewSession: isNew,
    userContext: userContext,
    userId: sessionToUse.userId,
    businessId: sessionToUse.businessId,
  };
} 