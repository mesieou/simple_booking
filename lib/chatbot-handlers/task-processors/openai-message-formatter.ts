import { OpenAIChatMessage } from "@/lib/llm-actions/chat-interactions/openai-config/openai-core";

/**
 * Formats the chat history for OpenAI API compatibility.
 * Ensures correct roles and content structure.
 * @param history The current chat history.
 * @param currentSystemPrompt The system prompt to prepend.
 * @returns An array of OpenAIChatMessage formatted for the API.
 */
export function formatMessagesForOpenAI(history: OpenAIChatMessage[], currentSystemPrompt: string): OpenAIChatMessage[] {
  const processedMessages: OpenAIChatMessage[] = history.map((msg): OpenAIChatMessage => {
    // Ensure msg itself conforms to OpenAIChatMessage before processing
    // This map function reconstructs each message to ensure full type compliance for the API call.
    if (msg.role === 'system') {
      // System messages from history might be overridden or ignored if a currentSystemPrompt is always prepended.
      // Here, we are preserving them if they exist, but typically only one system message (currentSystemPrompt) is used.
      return { role: 'system', content: msg.content || '' };
    }
    if (msg.role === 'user') {
      return { role: 'user', content: msg.content || '' };
    }
    if (msg.role === 'assistant') {
      // Ensure function_call is correctly passed if it exists
      if (msg.function_call) {
        // OpenAIChatMessage type expects content to be string. Provide empty string if null.
        return { role: 'assistant', content: msg.content || '', function_call: msg.function_call };
      }
      return { role: 'assistant', content: msg.content || '' };
    }
    if (msg.role === 'function') {
      return { role: 'function', name: msg.name, content: msg.content || '' };
    }
    // Fallback for any unexpected roles, though typescript should help prevent this.
    console.error("[ChatUtils] Unknown message role in history:", msg);
    return { role: 'user', content: JSON.stringify(msg) }; // Defaulting to user role with stringified content
  });

  return [
    { role: "system", content: currentSystemPrompt },
    ...processedMessages
  ];
}
