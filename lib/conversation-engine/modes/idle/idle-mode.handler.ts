import { ParsedMessage, BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { ConversationContext } from "../../conversation.context";
import { formatMessagesForOpenAI } from "../../task-processors/openai-message-formatter"; // Adjust path if this utility was moved
import { executeChatCompletion, OpenAIChatMessage } from "../../llm-actions/chat-interactions/openai-config/openai-core";
import { systemPrompt } from "../../customer-interaction-prompts"; // Adjust path if this was moved

/**
 * Handles interactions when the conversation is in IdleMode (general Q&A).
 * Calls the LLM to generate a response based on the conversation history.
 * @param parsedMessage The standardized incoming message.
 * @param context The current conversation context (chatHistory will be updated).
 * @returns A Promise resolving to a BotResponse.
 */
export async function handleIdleModeInteraction(
  parsedMessage: ParsedMessage, 
  context: ConversationContext
): Promise<BotResponse> {
  console.log(`[IdleModeHandler] Handling general query for user ${context.userId}: "${parsedMessage.text}"`);

  // Ensure chatHistory is initialized if it's somehow undefined/null
  context.chatHistory = context.chatHistory || [];
  
  // The user's current message is already added to context.chatHistory by the main manager
  const messagesForOpenAI = formatMessagesForOpenAI(context.chatHistory, systemPrompt);
  
  try {
    const completion = await executeChatCompletion(messagesForOpenAI, "gpt-4o", 0.3, 1000);
    const llmContent = completion.choices[0].message.content || "Sorry, I encountered an issue and couldn't generate a response.";
    
    context.chatHistory.push({ role: 'assistant', content: llmContent });
    
    console.log(`[IdleModeHandler] LLM response for user ${context.userId}: "${llmContent}"`);
    return { text: llmContent };

  } catch (error) {
    console.error("[IdleModeHandler] Error calling LLM:", error);
    const errorMessage = "I'm having a little trouble connecting to my brain right now. Please try again in a moment.";
    context.chatHistory.push({ role: 'assistant', content: errorMessage });
    return { text: errorMessage };
  }
}
