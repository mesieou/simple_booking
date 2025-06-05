import { ParsedMessage, BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { ConversationContext, ConversationMode } from "./conversation-context";
import { analyzeClientNeed, ClientNeedResult } from "./llm-actions/chat-interactions/functions/intention-detector";
import { formatMessagesForOpenAI } from "./task-processors/openai-message-formatter";
import { executeChatCompletion, OpenAIChatMessage } from "./llm-actions/chat-interactions/openai-config/openai-core";
import { systemPrompt } from "./customer-interaction-prompts";

// Mode handlers
import { handleBookingModeInteraction } from "./modes/booking/booking.mode-handler";
import { handleIdleModeInteraction } from "./modes/idle/idle-mode.handler";

// --- Begin Stubs for other modes (to be moved to separate files later) --- 
async function handleFAQModeInteraction(parsedMessage: ParsedMessage, context: ConversationContext): Promise<BotResponse> {
  console.log(`[MainManager] STUB: Delegating to FAQMode for user: ${context.userId}, message: "${parsedMessage.text}"`);
  return handleIdleModeInteraction(parsedMessage, context);
}

async function handleAccountModeInteraction(parsedMessage: ParsedMessage, context: ConversationContext): Promise<BotResponse> {
  console.log(`[MainManager] STUB: Delegating to AccountMode for user: ${context.userId}, message: "${parsedMessage.text}"`);
  context.accountState = context.accountState || { status: 'not_authenticated' };
  return { text: "Account mode: Please log in to continue. (Stub)" };
}

async function handleEscalationModeInteraction(parsedMessage: ParsedMessage, context: ConversationContext): Promise<BotResponse> {
  console.log(`[MainManager] STUB: Delegating to EscalationMode for user: ${context.userId}, message: "${parsedMessage.text}"`);
  return { text: "Escalation mode: Connecting you to a human agent shortly. (Stub)" };
}
// --- End Stubs --- 

/**
 * Main orchestrator for routing incoming messages to the appropriate handlers based on conversation mode and intent.
 * @param parsedMessage The standardized incoming message.
 * @param context The current conversation context for the user (will be modified and returned).
 * @returns A Promise resolving to an object containing the final BotResponse and the updated ConversationContext.
 */
export async function routeInteraction(
  parsedMessage: ParsedMessage,
  context: ConversationContext
): Promise<{ finalBotResponse: BotResponse; updatedContext: ConversationContext }> {
  console.log(`[MainManager] Routing interaction for user ${context.userId}. Current mode: ${context.currentMode}. Message: "${parsedMessage.text}"`);

  const historyMessage: OpenAIChatMessage = {
    role: 'user', 
    content: parsedMessage.text || '' 
  };
  if (!context.chatHistory) context.chatHistory = [];
  context.chatHistory.push(historyMessage);

  try {
    const chatHistoryForIntent = context.chatHistory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant') 
      .map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content || '' }));
      
    // Analyze client need
    context.lastUserIntent = await analyzeClientNeed(parsedMessage.text || "", chatHistoryForIntent);
    console.log(`[MainManager] Detected intent for user ${context.userId}: ${JSON.stringify(context.lastUserIntent)}`);
  } catch (intentError) {
    console.error("[MainManager] Error analyzing client need:", intentError);
    context.lastUserIntent = { need_type: 'general', intent: 'unknown_intent_error', confidence: 0, category: undefined };
  }


  // If in idle mode
  let botResponse: BotResponse;
  let nextMode: ConversationMode = context.currentMode;

  if (context.currentMode === 'IdleMode') {
    const intent = context.lastUserIntent?.intent;
    console.log(`[MainManager] IdleMode: Checking intent: ${intent}`);
    switch (intent) {
      case 'request_booking': 
        nextMode = 'BookingMode';
        break;
      case 'ask_faq': 
        nextMode = 'FAQMode';
        break;
      default:
        nextMode = 'IdleMode';
        break;
    }
    if (context.currentMode !== nextMode) {
      console.log(`[MainManager] Transitioning from ${context.currentMode} to ${nextMode} for user ${context.userId}`);
      context.currentMode = nextMode;
    }
  }

  console.log(`[MainManager] Delegating to mode: ${context.currentMode}`);
  switch (context.currentMode) {
    case 'BookingMode':
      botResponse = await handleBookingModeInteraction(parsedMessage, context);
      break;
    case 'FAQMode':
      botResponse = await handleFAQModeInteraction(parsedMessage, context);
      break;
    case 'AccountMode':
      botResponse = await handleAccountModeInteraction(parsedMessage, context);
      break;
    case 'EscalationMode':
      botResponse = await handleEscalationModeInteraction(parsedMessage, context);
      break;
    case 'IdleMode': 
    default:       
      botResponse = await handleIdleModeInteraction(parsedMessage, context);
      break;
  }
  
  console.log(`[MainManager] Responding to user ${context.userId}. Mode after handling: ${context.currentMode}. Response: "${botResponse.text}"`);
  // Return the final BotResponse and the (potentially modified) ConversationContext
  return { finalBotResponse: botResponse, updatedContext: context }; 
} 