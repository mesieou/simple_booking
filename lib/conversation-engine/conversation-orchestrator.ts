/**
 * @fileoverview The main entry point for the conversation engine.
 * This orchestrator manages the high-level flow of an interaction:
 * 1. Receives a message from a user.
 * 2. Determines the user's intent using the intention-detector.
 * 3. Delegates state management and business logic to the state-manager.
 * 4. Formulates a response based on the updated state.
 */

import { ParsedMessage, BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { UserContext } from "@/lib/database/models/user-context";
import { AnalyzedIntent, analyzeConversationIntent } from "./llm-actions/chat-interactions/functions/intention-detector";
import { OpenAIChatMessage } from "./llm-actions/chat-interactions/openai-config/openai-core";
import { manageState } from "./state-manager";

// For compatibility, we'll define a type that merges UserContext with legacy fields.
// This allows the orchestrator to manage chat history and intent temporarily.
type OrchestratorContext = UserContext & { 
  chatHistory?: OpenAIChatMessage[];
  lastUserIntent?: AnalyzedIntent;
};

/**
 * Main orchestrator for routing incoming messages to the new state management engine.
 * @param parsedMessage The standardized incoming message.
 * @param context The user's current context, which will be updated and returned.
 * @returns A Promise resolving to the final BotResponse and the updated Context.
 */
export async function routeInteraction(
  parsedMessage: ParsedMessage,
  context: OrchestratorContext
): Promise<{ finalBotResponse: BotResponse; updatedContext: OrchestratorContext }> {
  
  console.log(`[Orchestrator] Routing interaction for user ${context.channelUserId}. Message: "${parsedMessage.text}"`);

  // 1. Update chat history for context
  const historyMessage: OpenAIChatMessage = { role: 'user', content: parsedMessage.text || '' };
  if (!context.chatHistory) {
    context.chatHistory = [];
  }
  context.chatHistory.push(historyMessage);

  // 2. Analyze user's intent using the full context
  try {
    const chatHistoryForIntent = context.chatHistory
      .filter((msg: OpenAIChatMessage) => msg.role === 'user' || msg.role === 'assistant') 
      .map((msg: OpenAIChatMessage) => ({ role: msg.role as 'user' | 'assistant', content: msg.content || '' }));
      
    // Pass the message, history, and the core UserContext to the intent analyzer
    context.lastUserIntent = await analyzeConversationIntent(parsedMessage.text || "", chatHistoryForIntent, context);
    console.log(`[Orchestrator] Detected intent for user ${context.channelUserId}: ${JSON.stringify(context.lastUserIntent, null, 2)}`);
  } catch (intentError) {
    console.error("[Orchestrator] Error analyzing conversation intent:", intentError);
    // Create a default error intent to prevent crashes
    context.lastUserIntent = { goalType: 'unknown', goalAction: 'none', contextSwitch: false, confidence: 0, extractedInformation: {} };
  }

  // 3. Delegate to the State Manager
  // The state manager will modify the context object directly.
  const updatedContext = await manageState(
    context, // The full context is passed as the UserContext
    context.lastUserIntent,
    parsedMessage.text || ''
  );

  // 4. Construct the final response from the state manager's output
  const lastStepOutput = updatedContext.currentGoal?.collectedData;
  
  const botResponse: BotResponse = {
    text: lastStepOutput?.confirmationMessage || lastStepOutput?.stepError || "I'm not sure how to respond. Can you try rephrasing?",
    buttons: lastStepOutput?.uiButtons || [],
  };
  
  console.log(`[Orchestrator] Responding to user ${context.channelUserId}. Response: "${botResponse.text}"`);

  // 5. Return the response and the updated context
  return { finalBotResponse: botResponse, updatedContext: updatedContext }; 
} 