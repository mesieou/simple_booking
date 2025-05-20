import { executeChatCompletion, ChatMessage, ChatResponse } from "../openai-core";

export async function detectConversationCategory(
  conversation: { role: 'user' | 'assistant', content: string }[],
  categories: string[]
): Promise<string | undefined> {
  const prompt = `You are an expert assistant. Given the following conversation, select the best matching category from this list:\n${categories.map(c => `- ${c}`).join('\n')}\n\nConversation:\n${conversation.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nReturn ONLY the category name, nothing else.`;

  const response = await executeChatCompletion([
    { role: 'system', content: 'You are a helpful assistant that categorizes conversations.' },
    { role: 'user', content: prompt }
  ], 'gpt-4o', 0.3, 256);

  const result = response.choices[0]?.message?.content?.trim();
  if (!result) return undefined;
  // Return the best matching category (case-insensitive)
  const match = categories.find(cat => cat.toLowerCase() === result.toLowerCase());
  return match || undefined;
}

export async function clarifyMessage(
  message: string, 
  chatHistory: ChatMessage[] = []
): Promise<'clear' | 'unclear' | 'irrelevant' | undefined> {
  try {
    // Format the chat history for context
    const historyContext = chatHistory.length > 0 
      ? `\n\nPrevious conversation context (most recent first):\n` +
        chatHistory
          .slice(-5) // Limit to last 5 messages to avoid too much context
          .reverse() // Show most recent first
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n')
      : '';

    const prompt = `You are a message clarity classifier.\n\nYour job is to receive a user message and its conversation context, then classify it into one of the following labels:\n\n- clear → the message is well-formed and understandable; the bot can reply without needing more context\n- unclear → the message is vague, ambiguous, or lacks context; it would require clarification before responding\n- irrelevant → the message has nothing to do with customer service or is off-topic (e.g., emojis, jokes, random text)\n\nImportant considerations:\n1. If the message refers to something in the conversation history, it might be clear\n2. If the message is a follow-up without context (e.g., \"What about that thing?\"), it's likely unclear\n3. If the message is completely out of context from the conversation, it might be irrelevant\n\nInstructions:\n- Only reply with one of the three labels: \`clear\`, \`unclear\`, or \`irrelevant\`\n- Do not provide any explanation or extra text\n- Be strict — if there is any doubt or ambiguity, classify it as \`unclear\`\n\nExamples with context:\n1. Previous: user: \"I want to book a moving service\"\n   New: \"For next Monday\" → clear  \n2. Previous: (no context)\n   New: \"For next Monday\" → unclear  \n3. New: \"😂😂😂\" → irrelevant\n\nNow classify this message:${historyContext}\n\nNew message to classify:\n${message}`;

    const messages = [
      {
        role: "system" as const,
        content: "You are a helpful assistant that classifies message clarity based on both the message and conversation context."
      },
      {
        role: "user" as const,
        content: prompt
      }
    ];
    const response = await executeChatCompletion(messages, "gpt-4o", 0.3, 500) as unknown as ChatResponse;

    const classification = response.choices[0]?.message?.content?.trim().toLowerCase();

    // Validate the response is one of the expected values
    if (classification === 'clear' || classification === 'unclear' || classification === 'irrelevant') {
      return classification;
    }

    return 'unclear'; // Default to 'unclear' if the response is not as expected
  } catch (error) {
    console.error('Error classifying message:', error);
    return undefined;
  }
} 