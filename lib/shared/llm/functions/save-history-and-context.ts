import { ChatSession, ChatMessage } from "@/lib/database/models/chat-session";
import { UserContext } from "@/lib/database/models/user-context";

/**
 * Persists the updated user context and conversation history to Supabase.
 *
 * This helper keeps API routes clean by centralizing the database writes
 * required after each turn of the conversation.
 *
 * @param sessionId The current chat session identifier.
 * @param updatedContext The user's updated context after processing the message.
 * @param history The full conversation history to store.
 */
export async function persistSessionState(
  sessionId: string,
  updatedContext: UserContext,
  history: ChatMessage[]
): Promise<void> {
  try {
    await UserContext.updateByChannelUserId(updatedContext.channelUserId, {
      currentGoal: updatedContext.currentGoal,
      previousGoal: updatedContext.previousGoal,
      frequentlyDiscussedTopics: updatedContext.frequentlyDiscussedTopics,
      participantPreferences: updatedContext.participantPreferences,
    });
    console.log(`[StatePersister] Updated UserContext for ${updatedContext.channelUserId}.`);
  } catch (err) {
    console.error("[StatePersister] Failed to update UserContext:", err);
  }

  try {
    await ChatSession.update(sessionId, { allMessages: history });
    console.log(`[StatePersister] Updated ChatSession ${sessionId} history.`);
  } catch (err) {
    console.error("[StatePersister] Failed to update ChatSession history:", err);
  }
}