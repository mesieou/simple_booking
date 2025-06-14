/**
 * @file This file contains the LLM Response Generator service.
 * @description This service is responsible for taking a structured, system-generated bot response
 * and using an LLM to "enhance" it, making it sound more natural and conversational.
 * It is designed to be a "presentation layer" enhancement and includes a critical
 * graceful fallback mechanism to ensure the bot never breaks due to an LLM failure.
 */

import { BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { UserContext } from "@/lib/database/models/user-context";
import { executeChatCompletion, OpenAIChatMessage, ChatMessage } from "./chat-interactions/openai-config/openai-core";

type EnhancementType = 'rephrase' | 'faq_answer';

/**
 * Takes a raw, system-generated bot response and uses an LLM to make it more human-like.
 * It can operate in two modes:
 *  - 'rephrase': Polishes a simple system message.
 *  - 'faq_answer': Generates a full answer to a user's question using provided knowledge base text.
 * 
 * @param rawResponse The structured response. For 'rephrase', text is the message to polish. For 'faq_answer', text is the raw knowledge base content.
 * @param userContext The user's current context for personalization.
 * @param chatHistory The recent conversation history for context.
 * @param enhancementType The mode to operate in: 'rephrase' or 'faq_answer'.
 * @param userQuestion The original user question, required for 'faq_answer' mode.
 * @param isResumableGoalInProgress Indicates whether a task was previously in progress.
 * @returns A promise resolving to the enhanced BotResponse.
 */
export async function enhanceBotResponse(
  rawResponse: BotResponse, 
  userContext: UserContext,
  chatHistory: ChatMessage[],
  enhancementType: EnhancementType = 'rephrase',
  userQuestion?: string,
  isResumableGoalInProgress?: boolean
): Promise<BotResponse> {

  // If there's no text to work with, return immediately.
  if (!rawResponse.text || rawResponse.text.trim() === '') {
    return rawResponse;
  }

  let systemPrompt: string;
  let userPrompt: string;

  const recentHistory = chatHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n');

  const goalInProgressInfo = isResumableGoalInProgress
      ? 'A booking task was in progress before this question.'
      : 'No specific task is currently in progress.';

  if (enhancementType === 'faq_answer') {
    if (!userQuestion) {
      console.error('[ResponseEnhancer] Fallback: userQuestion is required for faq_answer enhancement type.');
      return rawResponse; // Return raw KB text as a fallback
    }
    systemPrompt = `You are a helpful and friendly customer service assistant for "Skedy", a beauty lounge booking system.

Instructions:
- Answer the user's question based on the "Knowledge Base Info" provided below.
- Your primary goal is to be helpful.
- **After your answer, you MUST add a conversational follow-up question.**
-   - If a task was in progress (see 'Task Status' in CONTEXT), your follow-up should smoothly ask to continue it (e.g., "Now, back to your booking, shall we continue?").
-   - If no task was in progress, ask a relevant follow-up question based on the user's query or offer general help (e.g., "Does that sound like what you're looking for?" or "Is there anything else I can help you with today?").
- Do NOT mention the source, or say 'based on' or similar phrases. Respond as if you are a human expert from the company.
- If the provided "Knowledge Base Info" is completely irrelevant, say you couldn't find the specific information and ask a clarifying question.
- Be concise and conversational.

CONTEXT:
- User's Name: ${userContext.currentGoal?.collectedData?.userName || 'there'}
- Task Status: ${goalInProgressInfo}`;
    
    userPrompt = `Recent Conversation History:
${recentHistory}

---
Knowledge Base Info: 
"${rawResponse.text}"
---
User Question: 
"${userQuestion}"

---
Give a concise, conversational answer based on the knowledge base info.`;

  } else { // Default to 'rephrase'
    systemPrompt = `You are a friendly and helpful salon assistant for "Skedy". 
Your primary task is to rephrase the following system-generated message to sound more natural, warm, and conversational.

**CRITICAL RULES:**
1.  **ADD SOCIAL GREETINGS**: Check the 'Recent Conversation History'. If the user's last message is a greeting (like "hi", "hello") or a social question ("how are you?"), **you MUST respond to it naturally** before presenting the main message. For example, if the user says "Hi", you should start your response with "Hello there!" or similar.
2.  **PRESERVE KEY INFO:** You MUST NOT change, add, or remove any key information. This includes prices (e.g., $45), times and dates (e.g., Tuesday 17 Jun 7 am), durations (e.g., 60min), service names (e.g., Basic Pedicure), and addresses.
3.  **PRESERVE INTENT:** The core meaning and purpose of the message must remain identical. If it's asking a question, the rephrased version must ask the same question.
4.  **BE CONCISE:** Do not add unnecessary fluff. Enhance, don't bloat. Keep the response short and to the point.
5.  **STRUCTURE:** For lists that are NOT booking summaries, maintain the original list structure. For booking summaries, use the format above.

**CONTEXT:**
- User's Name: ${userContext.currentGoal?.collectedData?.userName || 'there'}
- The user is currently in the process of: ${userContext.currentGoal?.goalType || 'making a booking'}`;

    userPrompt = `Recent Conversation History:
${recentHistory}

Rephrase this system message: "${rawResponse.text}"`;
  }

  try {
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Call your existing OpenAI core function
    const llmResult = await executeChatCompletion(messages, 'gpt-4o', 0.5, 250);
    const enhancedMessage = llmResult.choices[0]?.message?.content?.trim();

    // --- Graceful Fallback Logic ---
    // 1. Check if the LLM returned a valid, non-empty response.
    if (enhancedMessage) {
      // 2. (Optional but recommended) Add a check to ensure key info wasn't dropped.
      // For example, if the original text had a '$', the new one should too.
      if (rawResponse.text.includes('$') && !enhancedMessage.includes('$')) {
        console.warn('[ResponseEnhancer] Fallback: LLM dropped price information.');
        return rawResponse; // Discard LLM response
      }

      // If checks pass, use the enhanced message.
      const enhancedResponse: BotResponse = {
        ...rawResponse,
        text: enhancedMessage,
      };
      return enhancedResponse;
    }

    // 3. If LLM response is invalid, return the original.
    console.warn('[ResponseEnhancer] Fallback: LLM returned an empty or invalid response.');
    return rawResponse;

  } catch (error) {
    console.error("[ResponseEnhancer] Fallback: LLM call failed.", error);
    // 4. CRITICAL: If the entire process fails, always return the original raw response.
    return rawResponse;
  }
}
