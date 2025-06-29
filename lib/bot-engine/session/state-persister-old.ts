import {
    UserGoal,
    ChatConversationSession,
  } from "@/lib/bot-engine/types";
  import { persistSessionState as persistState } from "@/lib/shared/llm/functions/save-history-and-context";
  import { UserContext } from "@/lib/database/models/user-context";
  import { ChatMessage } from "@/lib/database/models/chat-session";
  
  // Persists the updated conversation state to the database
  export async function persistSessionState(
    sessionId: string,
    userContext: UserContext,
    activeSession: ChatConversationSession,
    currentGoal: UserGoal | undefined,
    userMessage: string,
    botResponse: string,
    fullHistory?: ChatMessage[]
  ): Promise<void> {
    try {
      let updatedContext: any;
  
      if (currentGoal && currentGoal.goalStatus === "completed") {
        updatedContext = {
          ...userContext,
          currentGoal: null,
          previousGoal: {
            goalType: currentGoal.goalType,
            goalAction: currentGoal.goalAction,
            goalStatus: currentGoal.goalStatus,
            currentStepIndex: currentGoal.currentStepIndex,
            collectedData: currentGoal.collectedData,
            flowKey: currentGoal.flowKey,
          },
          frequentlyDiscussedTopics: Array.isArray(
            userContext.frequentlyDiscussedTopics
          )
            ? userContext.frequentlyDiscussedTopics.join(", ")
            : userContext.frequentlyDiscussedTopics || null,
        };
      } else {
        updatedContext = {
          ...userContext,
          currentGoal: currentGoal
            ? {
                goalType: currentGoal.goalType,
                goalAction: currentGoal.goalAction,
                goalStatus: currentGoal.goalStatus,
                currentStepIndex: currentGoal.currentStepIndex,
                collectedData: currentGoal.collectedData,
                flowKey: currentGoal.flowKey,
              }
            : null,
          frequentlyDiscussedTopics: Array.isArray(
            userContext.frequentlyDiscussedTopics
          )
            ? userContext.frequentlyDiscussedTopics.join(", ")
            : userContext.frequentlyDiscussedTopics || null,
        };
      }
  
      let chatMessages: ChatMessage[] = [];
  
      // Use fullHistory if provided (during escalations), otherwise use activeGoals
      if (fullHistory) {
        chatMessages = [...fullHistory];
      } else if (
        activeSession.activeGoals.length > 0 &&
        activeSession.activeGoals[0].messageHistory
      ) {
        for (const msg of activeSession.activeGoals[0].messageHistory) {
          chatMessages.push({
            role: msg.speakerRole === "user" ? "user" : "bot",
            content: msg.content,
            timestamp: msg.messageTimestamp.toISOString(),
          });
        }
      }
  
      // Check if this user message is already in the history to avoid duplicates
      const lastUserMessage = chatMessages
        .slice()
        .reverse()
        .find((msg) => msg.role === "user");
      const isNewMessage =
        !lastUserMessage || lastUserMessage.content !== userMessage;
  
      if (isNewMessage) {
        const currentTimestamp = new Date().toISOString();
  
        // Always add the user message
        chatMessages.push({
          role: "user",
          content: userMessage,
          timestamp: currentTimestamp,
        });
  
        // Only add bot response if it's not empty (avoid ghost messages)
        if (botResponse && botResponse.trim() !== "") {
          chatMessages.push({
            role: "bot",
            content: botResponse,
            timestamp: currentTimestamp,
          });
          console.log(
            `[StatePersister] Adding message pair: user="${userMessage}", bot="${botResponse}"`
          );
        } else {
          console.log(
            `[StatePersister] Adding user message only: user="${userMessage}" (bot silent)`
          );
        }
      } else {
        console.log(
          `[StatePersister] Skipping duplicate message: "${userMessage}"`
        );
      }
  
      await persistState(sessionId, updatedContext, chatMessages);
    } catch (error) {
      console.error(`[StatePersister] Error persisting session state:`, error);
    }
  } 