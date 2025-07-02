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
    // CRITICAL: Always require businessId for multi-tenant environments
    if (!updatedContext.businessId) {
      throw new Error(`[StatePersister] CRITICAL ERROR: businessId is required for UserContext updates. ChannelUserId: ${updatedContext.channelUserId}`);
    }

    console.log(`[StatePersister] Attempting to update UserContext for channelUserId: ${updatedContext.channelUserId}, businessId: ${updatedContext.businessId}`);    
    // First, try to get the existing record to ensure it exists
    const existingContext = await UserContext.getByChannelUserIdAndBusinessId(
      updatedContext.channelUserId, 
      updatedContext.businessId
    );
    
    if (!existingContext) {
      console.log(`[StatePersister] No existing UserContext found, creating new one`);
      await UserContext.create({
        channelUserId: updatedContext.channelUserId,
        businessId: updatedContext.businessId,
        currentGoal: updatedContext.currentGoal,
        previousGoal: updatedContext.previousGoal,
        frequentlyDiscussedTopics: updatedContext.frequentlyDiscussedTopics,
        participantPreferences: updatedContext.participantPreferences,
        sessionData: updatedContext.sessionData,
      });
    } else {
      console.log(`[StatePersister] Updating existing UserContext with ID: ${existingContext.id}`);
      await UserContext.updateByChannelUserIdAndBusinessId(
        updatedContext.channelUserId, 
        updatedContext.businessId,
        {
          currentGoal: updatedContext.currentGoal,
          previousGoal: updatedContext.previousGoal,
          frequentlyDiscussedTopics: updatedContext.frequentlyDiscussedTopics,
          participantPreferences: updatedContext.participantPreferences,
          sessionData: updatedContext.sessionData,
        }
      );
    }
    
    console.log(`[StatePersister] Successfully updated UserContext for ${updatedContext.channelUserId}.`);
  } catch (err) {
    console.error("[StatePersister] Failed to update UserContext:", err);
    throw err; // Re-throw to ensure the error is properly handled upstream
  }

  try {
    await ChatSession.update(sessionId, { allMessages: history });
    console.log(`[StatePersister] Updated ChatSession ${sessionId} history.`);
  } catch (err) {
    console.error("[StatePersister] Failed to update ChatSession history:", err);
  }
}