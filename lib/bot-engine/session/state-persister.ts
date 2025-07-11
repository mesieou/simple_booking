import {
  UserGoal,
  ChatConversationSession,
} from "@/lib/bot-engine/types";
import { persistSessionState as persistState } from "@/lib/shared/llm/functions/save-history-and-context";
import { UserContext } from "@/lib/database/models/user-context";
import { ChatMessage, ChatSession } from "@/lib/database/models/chat-session";
import { ParsedMessage, BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { convertParsedMessageToChatMessage } from "@/lib/bot-engine/utils/message-converter";

// Persists the updated conversation state to the database
export async function persistSessionState(
  sessionId: string,
  userContext: UserContext,
  activeSession: ChatConversationSession,
  currentGoal: UserGoal | undefined,
  userMessage: string,
  botResponse: string | BotResponse,
  fullHistory?: ChatMessage[],
  parsedMessage?: ParsedMessage // NEW: Include original parsed message for attachments
): Promise<void> {
  try {
    // DEBUG: Log the incoming userContext to check businessId
    console.log(`[StatePersister] DEBUG - Incoming userContext:`, {
      channelUserId: userContext.channelUserId,
      businessId: userContext.businessId,
      hasCurrentGoal: !!userContext.currentGoal,
      currentGoalType: userContext.currentGoal?.goalType
    });
    
    console.log(`[StatePersister] DEBUG - Current goal being processed:`, {
      goalType: currentGoal?.goalType,
      goalStatus: currentGoal?.goalStatus,
      stepIndex: currentGoal?.currentStepIndex
    });

    // DEBUG: Log session userData
    console.log(`[StatePersister] DEBUG - Session userData:`, activeSession.userData);

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
        // Preserve session userData
        sessionData: activeSession.userData || null,
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
        // Preserve session userData
        sessionData: activeSession.userData || null,
      };
    }

    // DEBUG: Log the updatedContext to verify businessId is preserved
    console.log(`[StatePersister] DEBUG - Updated context:`, {
      channelUserId: updatedContext.channelUserId,
      businessId: updatedContext.businessId,
      hasCurrentGoal: !!updatedContext.currentGoal,
      currentGoalType: updatedContext.currentGoal?.goalType,
      currentGoalStep: updatedContext.currentGoal?.currentStepIndex,
      hasSessionData: !!updatedContext.sessionData
    });

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
    } else {
      // ✅ FIX: When no fullHistory or activeGoals, fetch current session messages from database
      try {
        console.log(`[StatePersister] No fullHistory or activeGoals found, fetching existing messages from session ${sessionId}`);
        const currentSession = await ChatSession.getById(sessionId);
        if (currentSession && currentSession.allMessages && currentSession.allMessages.length > 0) {
          chatMessages = [...currentSession.allMessages];
          console.log(`[StatePersister] Retrieved ${chatMessages.length} existing messages from session`);
        } else {
          console.log(`[StatePersister] No existing messages found in session ${sessionId}, starting with empty history`);
        }
      } catch (error) {
        console.error(`[StatePersister] Error fetching existing session messages for ${sessionId}:`, error);
        // Continue with empty array if we can't fetch existing messages
      }
    }

    // Check if this user message is already in the history to avoid duplicates
    const lastUserMessage = chatMessages
      .slice()
      .reverse()
      .find((msg) => msg.role === "user");
    
    let isNewMessage = true;
    
    if (lastUserMessage) {
      // For messages with attachments, be more intelligent about duplicates
      if (parsedMessage && parsedMessage.attachments && parsedMessage.attachments.length > 0) {
        // For media messages, only consider it duplicate if:
        // 1. Same content AND
        // 2. Same exact timestamp (within 5 seconds) AND 
        // 3. Same messageId (if available)
        const timeDiff = Math.abs(
          new Date().getTime() - new Date(lastUserMessage.timestamp || 0).getTime()
        );
        const isSameMessageId = parsedMessage.messageId && 
          lastUserMessage.content === userMessage && 
          timeDiff < 5000; // Within 5 seconds
        
        isNewMessage = !isSameMessageId;
        
        if (!isNewMessage) {
          console.log(`[StatePersister] Detected true duplicate media message (same ID/timestamp): "${userMessage}"`);
        } else {
          console.log(`[StatePersister] Media message with same content but different context - treating as new message`);
        }
      } else {
        // For text messages, use original logic but with time consideration
        const timeDiff = Math.abs(
          new Date().getTime() - new Date(lastUserMessage.timestamp || 0).getTime()
        );
        const isRecentDuplicate = lastUserMessage.content === userMessage && timeDiff < 5000; // Within 5 seconds
        
        isNewMessage = !isRecentDuplicate;
        
        if (!isNewMessage) {
          console.log(`[StatePersister] Detected recent duplicate text message: "${userMessage}"`);
        }
      }
    }

    if (isNewMessage) {
      const currentTimestamp = new Date().toISOString();

      // Check if we have a ParsedMessage with attachments
      if (parsedMessage && parsedMessage.attachments && parsedMessage.attachments.length > 0) {
        console.log(`[StatePersister] Converting ParsedMessage with ${parsedMessage.attachments.length} attachments`);
        
        // Use the converter to preserve attachments
        const userMessageWithAttachments = convertParsedMessageToChatMessage(parsedMessage, 'user');
        chatMessages.push(userMessageWithAttachments);
        
        console.log(`[StatePersister] Added user message with attachments: "${userMessage}"`);
      } else {
        // Regular message without attachments
        chatMessages.push({
          role: "user",
          content: userMessage,
          timestamp: currentTimestamp,
        });
      }

      // Only add bot response if it's not empty (avoid ghost messages)
      if (botResponse) {
        if (typeof botResponse === 'string' && botResponse.trim() !== "") {
          // Handle plain text bot response
          chatMessages.push({
            role: "bot",
            content: botResponse,
            displayType: 'text',
            timestamp: currentTimestamp,
          });
          console.log(`[StatePersister] Adding message pair: user="${userMessage}", bot="${botResponse}"`);
        } else if (typeof botResponse === 'object' && botResponse.text && typeof botResponse.text === 'string' && botResponse.text.trim() !== "") {
          // Handle rich BotResponse object
          chatMessages.push({
            role: "bot",
            content: botResponse, // Store the entire object
            displayType: 'interactive',
            timestamp: currentTimestamp,
          });
          console.log(`[StatePersister] Adding message pair: user="${userMessage}", bot="[Interactive Message]"`);
        }
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