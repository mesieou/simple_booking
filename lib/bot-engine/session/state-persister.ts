import {
  UserGoal,
  ChatConversationSession,
} from "@/lib/bot-engine/types";
import { persistSessionState as persistState } from "@/lib/shared/llm/functions/save-history-and-context";
import { UserContext } from "@/lib/database/models/user-context";
import { ChatMessage, ChatSession } from "@/lib/database/models/chat-session";
import { ParsedMessage, BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { convertParsedMessageToChatMessage } from "@/lib/bot-engine/utils/message-converter";

/**
 * LLM Context filtering options for different use cases
 */
export interface LLMContextOptions {
  maxMessages?: number;
  maxTokensEstimate?: number;
  prioritizeRecent?: boolean;
  includeGoalContext?: boolean;
  useCase?: 'conversation_flow' | 'escalation_analysis' | 'contextual_response' | 'general';
}

/**
 * Intelligently filters message history for LLM context based on specific use case requirements
 * while preserving complete history storage in the database
 */
export function filterLLMContext(
  allMessages: ChatMessage[], 
  options: LLMContextOptions = {}
): ChatMessage[] {
  const {
    maxMessages = 8,
    maxTokensEstimate = 2000,
    prioritizeRecent = true,
    includeGoalContext = true,
    useCase = 'general'
  } = options;

  if (!allMessages || allMessages.length === 0) {
    return [];
  }

  // Use case specific configurations
  let filteredMessages: ChatMessage[] = [];
  
  switch (useCase) {
    case 'conversation_flow':
      // For conversation flow analysis: focus on recent exchanges, max 6 messages
      filteredMessages = allMessages.slice(-6);
      break;
      
    case 'escalation_analysis':
      // For escalation: include more history to detect patterns, max 12 messages
      filteredMessages = allMessages.slice(-12);
      break;
      
    case 'contextual_response':
      // For generating responses: balance between context and performance
      filteredMessages = getBalancedContext(allMessages, maxTokensEstimate);
      break;
      
    default:
      // General case: recent messages with smart filtering
      filteredMessages = allMessages.slice(-maxMessages);
  }

  // Apply token limit estimation (rough calculation: ~4 chars per token)
  if (maxTokensEstimate > 0) {
    filteredMessages = applyTokenLimit(filteredMessages, maxTokensEstimate);
  }

  console.log(`[LLMContextFilter] Filtered for ${useCase}: ${allMessages.length} total → ${filteredMessages.length} for LLM (estimated tokens: ${estimateTokens(filteredMessages)})`);
  
  return filteredMessages;
}

/**
 * Gets balanced context prioritizing conversation flow and important messages
 */
function getBalancedContext(allMessages: ChatMessage[], maxTokens: number): ChatMessage[] {
  // Always include the last few messages for immediate context
  const recentMessages = allMessages.slice(-4);
  let contextMessages = [...recentMessages];
  
  // Add earlier messages that might be relevant (goal starts, questions, etc.)
  const remainingMessages = allMessages.slice(0, -4);
  const importantMessages = remainingMessages.filter(msg => 
    isImportantMessage(msg)
  ).slice(-4); // Limit important messages too
  
  // Combine and ensure chronological order
  const combinedMessages = [...importantMessages, ...recentMessages];
  const uniqueMessages = removeDuplicateMessages(combinedMessages);
  
  // Apply token limit
  return applyTokenLimit(uniqueMessages, maxTokens);
}

/**
 * Determines if a message is important for context (goal starts, explicit questions, etc.)
 */
function isImportantMessage(msg: ChatMessage): boolean {
  if (!msg.content) return false;
  
  const content = typeof msg.content === 'string' ? msg.content.toLowerCase() : 
                  JSON.stringify(msg.content).toLowerCase();
  
  // Check for important patterns
  const importantPatterns = [
    'start_booking', 'reservar', 'book', 'appointment',
    'hello', 'hola', 'hi', 'good morning', 'buenos dias',
    'help', 'ayuda', 'question', 'pregunta',
    'problem', 'problema', 'issue', 'error'
  ];
  
  return importantPatterns.some(pattern => content.includes(pattern));
}

/**
 * Removes duplicate messages based on content and timestamp
 */
function removeDuplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter(msg => {
    const signature = createMessageSignature(msg);
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

/**
 * Applies token limit by removing older messages first
 */
function applyTokenLimit(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
  let currentTokens = 0;
  const result: ChatMessage[] = [];
  
  // Process messages from newest to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateMessageTokens(messages[i]);
    if (currentTokens + msgTokens <= maxTokens) {
      result.unshift(messages[i]); // Add to beginning to maintain order
      currentTokens += msgTokens;
    } else {
      break; // Stop when we hit the token limit
    }
  }
  
  return result;
}

/**
 * Estimates token count for a single message (rough calculation)
 */
function estimateMessageTokens(msg: ChatMessage): number {
  if (!msg.content) return 0;
  
  const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
  // Rough estimation: 4 characters per token, plus overhead for role and structure
  return Math.ceil(content.length / 4) + 10; // +10 for role and metadata
}

/**
 * Estimates total token count for an array of messages
 */
function estimateTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, msg) => total + estimateMessageTokens(msg), 0);
}

/**
 * Intelligently merges two message history arrays while avoiding duplicates
 * and preserving chronological order
 */
function mergeMessageHistories(existingMessages: ChatMessage[], newMessages: ChatMessage[]): ChatMessage[] {
  if (!newMessages || newMessages.length === 0) {
    return existingMessages;
  }
  
  if (!existingMessages || existingMessages.length === 0) {
    return [...newMessages];
  }
  
  // Create a Set of existing message signatures for fast duplicate detection
  const existingSignatures = new Set(
    existingMessages.map(msg => createMessageSignature(msg))
  );
  
  // Filter out duplicates and merge
  const uniqueNewMessages = newMessages.filter(msg => {
    const signature = createMessageSignature(msg);
    return !existingSignatures.has(signature);
  });
  
  // Combine and sort by timestamp
  const allMessages = [...existingMessages, ...uniqueNewMessages];
  
  // Sort by timestamp (fallback to array order if timestamps are missing)
  allMessages.sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeA - timeB;
  });
  
  console.log(`[StatePersister] Merged histories: ${existingMessages.length} existing + ${uniqueNewMessages.length} new (${newMessages.length - uniqueNewMessages.length} duplicates filtered) = ${allMessages.length} total`);
  
  return allMessages;
}

/**
 * Creates a unique signature for a message to detect duplicates
 */
function createMessageSignature(msg: ChatMessage): string {
  // Use role + content + timestamp (rounded to seconds) for duplicate detection
  const timestamp = msg.timestamp ? new Date(msg.timestamp).getTime() : 0;
  const timestampRounded = Math.floor(timestamp / 1000); // Round to seconds
  
  // Handle different content types
  let contentStr = '';
  if (typeof msg.content === 'string') {
    contentStr = msg.content;
  } else if (typeof msg.content === 'object' && msg.content) {
    contentStr = JSON.stringify(msg.content);
  }
  
  return `${msg.role}:${contentStr}:${timestampRounded}`;
}

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

    // 🔧 FIX: ALWAYS start with complete existing history from database
    // This ensures we never lose previous messages when new goals are created
    try {
      console.log(`[StatePersister] Fetching existing messages from session ${sessionId} to preserve complete history`);
      const currentSession = await ChatSession.getById(sessionId);
      if (currentSession && currentSession.allMessages && currentSession.allMessages.length > 0) {
        chatMessages = [...currentSession.allMessages];
        console.log(`[StatePersister] Starting with ${chatMessages.length} existing messages from database`);
      } else {
        console.log(`[StatePersister] No existing messages found in session ${sessionId}, starting with empty history`);
      }
    } catch (error) {
      console.error(`[StatePersister] Error fetching existing session messages for ${sessionId}:`, error);
      // Continue with empty array if we can't fetch existing messages
    }

    // Merge additional context if provided
    if (fullHistory) {
      // During escalations, fullHistory may contain additional context
      // Merge intelligently to avoid duplicates while preserving order
      console.log(`[StatePersister] Merging fullHistory (${fullHistory.length} messages) with existing messages`);
      chatMessages = mergeMessageHistories(chatMessages, fullHistory);
    } else if (
      activeSession.activeGoals.length > 0 &&
      activeSession.activeGoals[0].messageHistory &&
      activeSession.activeGoals[0].messageHistory.length > 0
    ) {
      // Goal messageHistory might contain additional context for current goal
      // This is mainly for backup/consistency, since we're now always starting with database history
      const goalMessages: ChatMessage[] = [];
      for (const msg of activeSession.activeGoals[0].messageHistory) {
        goalMessages.push({
          role: msg.speakerRole === "user" ? "user" : "bot",
          content: msg.content,
          timestamp: msg.messageTimestamp.toISOString(),
        });
      }
      
      if (goalMessages.length > 0) {
        console.log(`[StatePersister] Merging goal messageHistory (${goalMessages.length} messages) with existing messages`);
        chatMessages = mergeMessageHistories(chatMessages, goalMessages);
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