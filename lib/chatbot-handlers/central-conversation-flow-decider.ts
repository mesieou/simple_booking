/**
 * Chat Logic
 * This module handles the chat logic for the customer service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 */
import { systemPrompt } from "@/lib/chatbot-handlers/customer-interaction-prompts";
import { executeChatCompletion, OpenAIChatMessage, MoodAnalysisResult, ChatMessage } from "@/lib/llm-actions/chat-interactions/openai-config/openai-core";
import { analyzeSentiment } from "@/lib/llm-actions/chat-interactions/functions/sentiment-analiser";
import { analyzeClientNeed } from "@/lib/llm-actions/chat-interactions/functions/intention-detector";
import { BookingState, manageBookingProcess } from "./task-processors/booking-handler";
import { tryHandleAddressBasedPriceEstimation } from "./task-processors/price-estimation-handler";
// handleCreateUserFunctionCall import to be removed
import { formatMessagesForOpenAI } from "./task-processors/openai-message-formatter"; 

// MOCK_BUSINESS_ID_FOR_USER_CREATION to be removed

/**
 * Main handler for processing incoming chat messages and generating responses.
 * It orchestrates various sub-modules like price estimation, booking management, and direct OpenAI calls.
 * @param parsedMessages The current chat history, potentially including an attached _bookingState.
 * @param initialBookingState Optional initial booking state if not already part of parsedMessages.
 * @returns A Promise resolving to an object containing the new chat history and the updated booking state.
 */
export async function processIncomingMessage(
  parsedMessages: OpenAIChatMessage[],
  // Allow initialBookingState to be passed explicitly, otherwise try to get from parsedMessages
  // This provides a transition path. Eventually, _bookingState should not be on parsedMessages.
  initialBookingState?: BookingState 
): Promise<{ messages: OpenAIChatMessage[]; bookingState: BookingState }> {
  console.log("[CentralDecider] processIncomingMessage called with parsedMessages:", parsedMessages, "initialBookingState:", initialBookingState);
  let history = [...parsedMessages];
  const lastUserMessage = history.slice().reverse().find(m => m.role === 'user');
  
  // Prioritize explicitly passed initialBookingState, then try to extract from history, then default.
  let currentBookingState: BookingState = initialBookingState || (history as any)._bookingState || { step: 'idle' };
  // Avoid further direct manipulation of _bookingState on history arrays.
  if ((history as any)._bookingState) {
    // conceptually remove it from the history array for internal processing if it was there
    // though we are working with a copy 'history', the source 'parsedMessages' might still have it.
  }

  if (lastUserMessage && lastUserMessage.content) {
    // tryHandleAddressBasedPriceEstimation is assumed to return the full history if it handles the message,
    // or null/undefined otherwise. It does not manage booking state itself in its return.
    const priceEstimationHistory = await tryHandleAddressBasedPriceEstimation([...history], lastUserMessage);
    if (priceEstimationHistory) {
      // Return the history from price estimation and the current booking state.
      return { messages: priceEstimationHistory, bookingState: currentBookingState };
    }

    const [moodAnalysisResult, clientNeedAnalysisResult] = await Promise.all([
      analyzeSentiment(lastUserMessage.content || "").catch(e => { console.error('[CentralProcessor] Mood Analysis Error:', e); return undefined; }),
      analyzeClientNeed(
        lastUserMessage.content || "", 
        history.filter(m => m.role === 'user' || m.role === 'assistant') as ChatMessage[]
      ).catch(e => { console.error('[CentralProcessor] Client Need Analysis Error:', e); return null; })
    ]);

    if (moodAnalysisResult) {
      console.log(`[CentralProcessor] Mood: ${moodAnalysisResult.score}/10 (${moodAnalysisResult.category}: ${moodAnalysisResult.description})`);
    }
    if (clientNeedAnalysisResult) {
      console.log(`[CentralProcessor] Client Need: Type=${clientNeedAnalysisResult.need_type}, Intent=${clientNeedAnalysisResult.intent}, Confidence=${clientNeedAnalysisResult.confidence?.toFixed(2)}`);
    }

    // manageBookingProcess is expected to return an object { updatedHistory, updatedBookingState }
    const bookingProcessResult = await manageBookingProcess(lastUserMessage, currentBookingState, [...history], clientNeedAnalysisResult);
    if (bookingProcessResult) {
      // Return the updated history and booking state from the booking process.
      return { messages: bookingProcessResult.updatedHistory, bookingState: bookingProcessResult.updatedBookingState };
    }
  }

  // If no specialized handlers (price estimation, booking) managed the conversation, proceed with a general OpenAI call.
  let historyForOpenAICall = [...history];
  const messagesForOpenAI = formatMessagesForOpenAI(historyForOpenAICall, systemPrompt);
  const completion = await executeChatCompletion(messagesForOpenAI, "gpt-4o", 0.3, 1000 /* No functions/tools sent */);
  const assistantChoice = completion.choices[0].message;

  // Add the assistant's response to the history.
  history.push({
    role: 'assistant',
    content: assistantChoice.content || '',
    // No tool_calls expected or handled here based on executeChatCompletion params
  });
  
  // Return the final history and the current booking state (which wasn't modified in this path).
  return { messages: history, bookingState: currentBookingState };
} 