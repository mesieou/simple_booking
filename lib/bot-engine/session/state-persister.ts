import {
  UserGoal,
  ChatConversationSession,
  ButtonConfig,
} from "@/lib/bot-engine/types";
import { persistSessionState as persistState } from "@/lib/shared/llm/functions/save-history-and-context";
import { UserContext } from "@/lib/database/models/user-context";
import { ChatMessage } from "@/lib/database/models/chat-session";
import { ParsedMessage } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { convertParsedMessageToChatMessage } from "@/lib/bot-engine/utils/message-converter";

// Persists the updated conversation state to the database
export async function persistSessionState(
  sessionId: string,
  userContext: UserContext,
  activeSession: ChatConversationSession,
  currentGoal: UserGoal | undefined,
  userMessage: string,
  botResponse: string,
  fullHistory?: ChatMessage[],
  parsedMessage?: ParsedMessage, // Include original parsed message for attachments
  botButtons?: ButtonConfig[], // NEW: Include bot buttons for history
  listActionText?: string, // NEW: Include list action text
  listSectionTitle?: string // NEW: Include list section title
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
      if (botResponse && botResponse.trim() !== "") {
        // Combine bot response with options in a single message
        let fullBotMessage = botResponse;
        const optionsText = formatBotOptionsAsText(botButtons, listActionText, listSectionTitle);
        if (optionsText) {
          fullBotMessage += `\n\n${optionsText}`;
          console.log(`[StatePersister] Including bot options in same message`);
        }

        chatMessages.push({
          role: "bot",
          content: fullBotMessage,
          timestamp: currentTimestamp,
        });
        console.log(
          `[StatePersister] Adding bot message with options: "${fullBotMessage.substring(0, 100)}..."`
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

/**
 * Formats bot buttons and list options as plain text for history visibility
 */
function formatBotOptionsAsText(
  buttons?: ButtonConfig[],
  listActionText?: string,
  listSectionTitle?: string
): string | null {
  if (!buttons || buttons.length === 0) {
    return null;
  }

  const parts: string[] = [];

  // Add list section title if present
  if (listSectionTitle) {
    parts.push(`📋 ${listSectionTitle}`);
  }

  // Add list action text if present
  if (listActionText) {
    parts.push(`🔘 ${listActionText}`);
  }

  // Format buttons as numbered list
  parts.push("Available options:");
  buttons.forEach((button, index) => {
    const number = index + 1;
    let buttonText = `${number}. ${button.buttonText}`;
    
    // Add description if available
    if (button.buttonDescription) {
      buttonText += ` - ${button.buttonDescription}`;
    }
    
    parts.push(buttonText);
  });

  return parts.join('\n');
} 