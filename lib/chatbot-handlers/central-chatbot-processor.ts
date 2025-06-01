/**
 * Chat Logic
 * This module handles the chat logic for the customer service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 */
import { createUserSchema } from "@/lib/chatbot-handlers/openai-tool-schemas";
import { systemPrompt } from "@/lib/chatbot-handlers/customer-interaction-prompts";
import { User } from "@/lib/database/models/user";
import { Service } from "@/lib/database/models/service";
import { Business } from "@/lib/database/models/business";
import { computeQuoteEstimation, QuoteEstimation } from "@/lib/general-helpers/quote-cost-calculator";
import { executeChatCompletion, OpenAIChatMessage, MoodAnalysisResult, ChatMessage } from "@/lib/llm-actions/chat-interactions/openai-config/openai-core";
import { analyzeSentiment } from "@/lib/llm-actions/chat-interactions/functions/sentiment-analiser";
import { analyzeClientNeed } from "@/lib/llm-actions/chat-interactions/functions/intention-detector";
import { fetchDirectGoogleMapsDistance } from '@/lib/general-helpers/google-distance-calculator';
import { findAvailableDates, getSlotsForDate } from '@/lib/general-helpers/availability';

// Constants for mock IDs, consider moving to a config file or environment variables.
const MOCK_SERVICE_ID_FOR_QUOTE = "d27f606f-70ac-4798-9706-13d308d1c98e";
const MOCK_PROVIDER_ID_FOR_AVAILABILITY = "d27f606f-70ac-4798-9706-13d308d1c98e"; // This is a SERVICE ID used as providerId
const MOCK_BUSINESS_ID_FOR_AVAILABILITY = "5daa4f28-1ade-491b-be8b-b80025ffc2c4"; // Example Business ID

interface BookingState {
  step: 'idle' | 'getting_size' | 'getting_date' | 'getting_time' | 'confirming';
  size?: 'one' | 'few' | 'house';
  jobDurationMinutes?: number;
  date?: string; // ISO string "yyyy-MM-dd"
  time?: string;
}

/**
 * Fetches a mock service instance for quote calculation demonstrations.
 * @returns A Promise resolving to a Service instance.
 * @throws Error if the mock service cannot be fetched.
 */
async function getMockServiceForQuote(): Promise<Service> {
  try {
    const service = await Service.getById(MOCK_SERVICE_ID_FOR_QUOTE);
    if (!service) {
      throw new Error(`Mock service with ID ${MOCK_SERVICE_ID_FOR_QUOTE} not found.`);
    }
    return service;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CustomerInteraction] Error fetching mock service (ID: ${MOCK_SERVICE_ID_FOR_QUOTE}):`, errorMessage);
    throw new Error(`Failed to fetch mock service for quote: ${errorMessage}`);
  }
}

/**
 * Attempts to calculate and respond with a price estimation if recent messages suggest addresses were provided.
 * @param history The current chat history.
 * @param lastUserMessage The last message from the user.
 * @returns A Promise resolving to the updated history if estimation was handled, otherwise null.
 */
async function tryHandleAddressBasedPriceEstimation(
  history: OpenAIChatMessage[],
  lastUserMessage: OpenAIChatMessage
): Promise<OpenAIChatMessage[] | null> {
  // Price estimation requires at least 3 messages (user address1, bot prompt for address2, user address2)
  if (history.length < 3) return null;

  const lastBotMessage = history[history.length - 2];
  const previousUserMessage = history[history.length - 3];
  const lastAssistantMessageInFullHistory = history.slice().reverse().find(m => m.role === 'assistant');
  const lastBotResponseWasNotPriceCalc = !lastAssistantMessageInFullHistory?.content?.includes("total estimated price is $");

  const shouldAttemptEstimation =
    lastBotMessage?.role === 'assistant' &&
    lastBotMessage.content &&
    (lastBotMessage.content.toLowerCase().includes('drop-off address') || lastBotMessage.content.toLowerCase().includes('delivery address')) &&
    previousUserMessage?.role === 'user' && previousUserMessage.content &&
    lastUserMessage.role === 'user' && lastUserMessage.content &&
    lastBotResponseWasNotPriceCalc;

  if (!shouldAttemptEstimation) return null;

  const pickupAddress = previousUserMessage.content;
  const dropoffAddress = lastUserMessage.content;

  try {
    console.log(`[CustomerInteraction] Attempting distance & mock price calculation for Pickup: "${pickupAddress}", Dropoff: "${dropoffAddress}"`);
    const mapsData = await fetchDirectGoogleMapsDistance(pickupAddress, dropoffAddress);

    if (mapsData.status !== 'OK' || !mapsData.rows?.[0]?.elements?.[0] || mapsData.rows[0].elements[0].status !== 'OK') {
      throw new Error(`Maps API did not return OK status or valid element. Status: ${mapsData.status}, Message: ${mapsData.error_message || JSON.stringify(mapsData)}`);
    }

    const element = mapsData.rows[0].elements[0];
    const travelTimeInSeconds = element.duration.value;
    const travelTimeEstimateInMinutes = Math.ceil(travelTimeInSeconds / 60);
    const distanceText = element.distance.text;

    const mockServiceInstance = await getMockServiceForQuote();
    const actualBusiness = await Business.getById(mockServiceInstance.businessId);
    if (!actualBusiness) {
      throw new Error(`Business with ID ${mockServiceInstance.businessId} (from mock service) not found.`);
    }

    const quote = computeQuoteEstimation(mockServiceInstance, actualBusiness, travelTimeEstimateInMinutes);
    const assistantResponseContent = `Okay, for the trip from "${pickupAddress}" to "${dropoffAddress}", the estimated travel time is about ${travelTimeEstimateInMinutes} minutes (distance: ${distanceText}).\nUsing our example service ("${mockServiceInstance.name}"), the total estimated price is $${quote.totalJobCost.toFixed(2)}.\nThis includes a service cost of $${quote.serviceCost.toFixed(2)} and a travel cost of $${quote.travelCost.toFixed(2)}.\n(Please note: this is a test calculation based on a standard service).\n\nNow, could you tell me what type of removal service you specifically need?`;
    
    history.push({ role: 'assistant', content: assistantResponseContent });
    console.log("[CustomerInteraction] Distance and mock price calculated and sent to user.");
    return history;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[CustomerInteraction] Critical error during distance/price calculation step:', errorMessage);
    const errorResponseContent = `I'm sorry, I encountered an issue while calculating the travel information: ${errorMessage}. Please double-check the addresses. If the problem continues, we can proceed without this estimate for now. Could you please tell me the type of removal service you need?`;
    history.push({ role: 'assistant', content: errorResponseContent });
    return history;
  }
}

/**
 * Handles the 'getting_size' step of the booking process.
 * @returns Updated history and booking state.
 */
async function handleBookingGettingSize(
  userMessageText: string,
  currentBookingState: BookingState,
  history: OpenAIChatMessage[]
): Promise<{ updatedHistory: OpenAIChatMessage[]; updatedBookingState: BookingState }> {
  let determinedSize: 'one' | 'few' | 'house' | null = null;
  let jobDuration = 0;

  if (userMessageText.includes('one item') || userMessageText.includes('one')) { determinedSize = 'one'; jobDuration = 60; }
  else if (userMessageText.includes('few items') || userMessageText.includes('few')) { determinedSize = 'few'; jobDuration = 90; }
  else if (userMessageText.includes('house')) { determinedSize = 'house'; jobDuration = 120; }

  const updatedBookingState = { ...currentBookingState };

  if (determinedSize) {
    updatedBookingState.size = determinedSize;
    updatedBookingState.jobDurationMinutes = jobDuration;
    updatedBookingState.step = 'getting_date';
    try {
      const availableDateStrings = await findAvailableDates(MOCK_PROVIDER_ID_FOR_AVAILABILITY, MOCK_BUSINESS_ID_FOR_AVAILABILITY, jobDuration, new Date(), 5, 30);
      let responseContent;
      if (availableDateStrings.length > 0) {
        const formattedDates = availableDateStrings.map(dateStr => new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })).join('\n - ');
        responseContent = `Great! You\'ve selected '${determinedSize}'. Here are some upcoming available dates:\n - ${formattedDates}\n\nWhich date would you prefer? Or you can specify another date (e.g., MM/DD/YYYY).`;
      } else {
        responseContent = `Great! You\'ve selected '${determinedSize}'. Unfortunately, I don\'t see any availability in the near future. You can try specifying a date further out.`;
      }
      history.push({ role: 'assistant', content: responseContent });
    } catch (e) {
      console.error("[CustomerInteraction Booking] Error finding available dates:", e);
      history.push({ role: 'assistant', content: "I had trouble finding available dates right now. Please try again in a moment, or specify a date you have in mind." });
    }
  } else {
    history.push({ role: 'assistant', content: "I didn\'t quite catch the size. Please choose from: 'one item', 'few items', or 'house'." });
  }
  return { updatedHistory: history, updatedBookingState };
}

/**
 * Handles the 'getting_date' step of the booking process.
 * @returns Updated history and booking state.
 */
async function handleBookingGettingDate(
  userMessageText: string,
  currentBookingState: BookingState,
  history: OpenAIChatMessage[]
): Promise<{ updatedHistory: OpenAIChatMessage[]; updatedBookingState: BookingState }> {
  let parsedDate: Date | null = null;
  const dateMatch = userMessageText.match(/(\d{1,2})[\/\-](\d{1,2})([\/\-](\d{2}|\d{4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[2]);
    const month = parseInt(dateMatch[1]) - 1; // Month is 0-indexed
    const year = dateMatch[4] ? (dateMatch[4].length === 2 ? 2000 + parseInt(dateMatch[4]) : parseInt(dateMatch[4])) : new Date().getFullYear();
    parsedDate = new Date(year, month, day);
  } else {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (userMessageText.includes("today")) parsedDate = today;
    else if (userMessageText.includes("tomorrow")) parsedDate = tomorrow;
  }

  const updatedBookingState = { ...currentBookingState };

  if (parsedDate && updatedBookingState.jobDurationMinutes) {
    const targetDateISO = parsedDate.toISOString().split('T')[0];
    updatedBookingState.date = targetDateISO;
    try {
      const slots = await getSlotsForDate(MOCK_PROVIDER_ID_FOR_AVAILABILITY, MOCK_BUSINESS_ID_FOR_AVAILABILITY, updatedBookingState.jobDurationMinutes, targetDateISO);
      if (slots.length > 0) {
        updatedBookingState.step = 'getting_time';
        const formattedSlots = slots.join(', ');
        history.push({ role: 'assistant', content: `Okay, for ${parsedDate.toLocaleDateString()}. Available times are: ${formattedSlots}. Which time works for you?` });
      } else {
        updatedBookingState.step = 'getting_date'; // Stay on date step
        history.push({ role: 'assistant', content: `Sorry, no slots available on ${parsedDate.toLocaleDateString()}. Would you like to try another date?` });
      }
    } catch (e) {
      console.error("[CustomerInteraction Booking] Error getting slots for date:", e);
      history.push({ role: 'assistant', content: `I had trouble checking slots for ${parsedDate.toLocaleDateString()}. Please try another date or try again later.` });
    }
  } else {
    history.push({ role: 'assistant', content: "I didn\'t understand the date. Please try MM/DD/YYYY, or pick from the suggestions if any were provided." });
  }
  return { updatedHistory: history, updatedBookingState };
}

/**
 * Handles the 'getting_time' step of the booking process.
 * @returns Updated history and booking state.
 */
async function handleBookingGettingTime(
  userMessageText: string,
  currentBookingState: BookingState,
  history: OpenAIChatMessage[]
): Promise<{ updatedHistory: OpenAIChatMessage[]; updatedBookingState: BookingState }> {
  const timeMatch = userMessageText.match(/(\d{1,2}):(\d{2})/);
  const updatedBookingState = { ...currentBookingState };

  if (timeMatch && updatedBookingState.date && updatedBookingState.jobDurationMinutes) {
    const selectedTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    const slotsForValidation = await getSlotsForDate(MOCK_PROVIDER_ID_FOR_AVAILABILITY, MOCK_BUSINESS_ID_FOR_AVAILABILITY, updatedBookingState.jobDurationMinutes, updatedBookingState.date);
    if (slotsForValidation.includes(selectedTime)) {
      updatedBookingState.time = selectedTime;
      updatedBookingState.step = 'confirming';
      const friendlyDate = new Date(updatedBookingState.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      history.push({ role: 'assistant', content: `Great! So that\'s a '${updatedBookingState.size}' service on ${friendlyDate} at ${selectedTime}. Correct? (yes/no)` });
    } else {
      history.push({ role: 'assistant', content: `Hmm, ${selectedTime} doesn\'t seem to be available on that day, or it\'s not in the HH:MM format I expected. Available times were: ${slotsForValidation.join(', ')}. Please pick one.` });
    }
  } else {
    history.push({ role: 'assistant', content: "Please provide the time in HH:MM format (e.g., 09:00 or 14:30)." });
  }
  return { updatedHistory: history, updatedBookingState };
}

/**
 * Handles the 'confirming' step of the booking process.
 * @returns Updated history and booking state.
 */
function handleBookingConfirming(
  userMessageText: string,
  currentBookingState: BookingState,
  history: OpenAIChatMessage[]
): { updatedHistory: OpenAIChatMessage[]; updatedBookingState: BookingState } {
  const updatedBookingState = { ...currentBookingState };
  if (userMessageText.includes('yes')) {
    const friendlyDate = new Date(updatedBookingState.date!).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    history.push({ role: 'assistant', content: `Excellent! Your '${updatedBookingState.size}' service is booked for ${friendlyDate} at ${updatedBookingState.time}. You\'ll receive a confirmation shortly. Is there anything else?` });
    updatedBookingState.step = 'idle'; // Reset for next booking
  } else if (userMessageText.includes('no')) {
    history.push({ role: 'assistant', content: "Okay, booking cancelled. We can start over if you like. What size of service do you need?" });
    updatedBookingState.step = 'getting_size';
  } else {
    history.push({ role: 'assistant', content: "Please confirm with 'yes' or 'no'." });
  }
  return { updatedHistory: history, updatedBookingState };
}

/**
 * Manages the booking process based on the current state and user message.
 * @returns A Promise resolving to the updated history and booking state if booking was handled, otherwise null.
 */
async function manageBookingProcess(
  lastUserMessage: OpenAIChatMessage,
  bookingState: BookingState,
  history: OpenAIChatMessage[],
  clientNeedResult: any // Type this more accurately if possible
): Promise<{ updatedHistory: OpenAIChatMessage[]; updatedBookingState: BookingState } | null> {
  const userMessageText = lastUserMessage.content?.toLowerCase() || "";
  let currentBookingState = { ...bookingState }; // Ensure we're working with a mutable copy for updates

  const isBookingIntent = clientNeedResult?.need_type === 'booking_service' || clientNeedResult?.intent === 'request_booking' || currentBookingState.step !== 'idle';
  
  if (isBookingIntent && currentBookingState.step === 'idle') {
    currentBookingState.step = 'getting_size';
    const responseContent = "Okay, I can help you with a booking. What size of service do you need? (e.g., 'one item', 'few items', or 'house')";
    history.push({ role: 'assistant', content: responseContent });
    return { updatedHistory: history, updatedBookingState: currentBookingState };
  }

  if (currentBookingState.step !== 'idle') {
    let stepResult;
    switch (currentBookingState.step) {
      case 'getting_size':
        stepResult = await handleBookingGettingSize(userMessageText, currentBookingState, history);
        break;
      case 'getting_date':
        stepResult = await handleBookingGettingDate(userMessageText, currentBookingState, history);
        break;
      case 'getting_time':
        stepResult = await handleBookingGettingTime(userMessageText, currentBookingState, history);
        break;
      case 'confirming':
        stepResult = handleBookingConfirming(userMessageText, currentBookingState, history);
        break;
      default:
        return null; // Should not happen
    }
    return { updatedHistory: stepResult.updatedHistory, updatedBookingState: stepResult.updatedBookingState };
  }
  return null;
}

/**
 * Handles the 'createUser' function call from OpenAI.
 * @returns A Promise resolving to the updated history.
 */
async function handleCreateUserFunctionCall(
  functionCallArguments: string,
  history: OpenAIChatMessage[],
  currentSystemPrompt: string // Renamed from systemPrompt to avoid conflict if it's a global
): Promise<OpenAIChatMessage[]> {
  const { firstName, lastName } = JSON.parse(functionCallArguments || "{}");
  try {
    const user = new User(firstName, lastName, "customer", MOCK_BUSINESS_ID_FOR_AVAILABILITY); // Using MOCK_BUSINESS_ID
    const result = await user.add();
    history.push({ role: 'assistant', content: '', function_call: { name: "createUser", arguments: functionCallArguments } }); // Re-add assistant msg with func call
    history.push({ role: "function", name: "createUser", content: JSON.stringify({ success: true, userId: result.data.id }) });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("User creation error:", errorMessage);
    history.push({ role: 'assistant', content: '', function_call: { name: "createUser", arguments: functionCallArguments } });
    history.push({ role: "function", name: "createUser", content: JSON.stringify({ success: false, error: errorMessage }) });
  }
  // Get a follow-up response from OpenAI after the function call.
  const followUp = await executeChatCompletion([{ role: "system", content: currentSystemPrompt }, ...history], "gpt-4o");
  history.push({ role: 'assistant', content: followUp.choices[0].message.content || '' });
  return history;
}

/**
 * Formats the chat history for OpenAI API compatibility.
 * @param history The current chat history.
 * @returns An array of OpenAIChatMessage formatted for the API.
 */
function formatMessagesForOpenAI(history: OpenAIChatMessage[], currentSystemPrompt: string): OpenAIChatMessage[] {
  return [
    { role: "system", content: currentSystemPrompt },
    ...history.map((msg): OpenAIChatMessage => {
      if (msg.role === 'system') return { role: 'system', content: msg.content || '' };
      if (msg.role === 'user') return { role: 'user', content: msg.content || '' };
      if (msg.role === 'assistant') {
        return { role: 'assistant', content: msg.content || '', function_call: msg.function_call };
      }
      if (msg.role === 'function') return { role: 'function', name: msg.name, content: msg.content || '' };
      console.error("[CustomerInteraction] Unknown message role in history:", msg);
      return { role: 'user', content: JSON.stringify(msg) }; // Fallback
    })
  ];
}


/**
 * Main handler for processing incoming chat messages and generating responses.
 * @param incomingHistory The current chat history.
 * @returns A Promise resolving to the new chat history including the assistant's response.
 */
export async function handleChat(incomingHistory: OpenAIChatMessage[]): Promise<OpenAIChatMessage[]> {
  let history = [...incomingHistory]; // Work with a mutable copy
  const lastUserMessage = history.slice().reverse().find(m => m.role === 'user');
  
  // Initialize booking state from history or set to default
  let currentBookingState: BookingState = (history as any)._bookingState || { step: 'idle' };

  if (lastUserMessage && lastUserMessage.content) {
    // Attempt to handle address-based price estimation first
    const priceEstimationHistory = await tryHandleAddressBasedPriceEstimation([...history], lastUserMessage);
    if (priceEstimationHistory) {
      // Price estimation handled and returned history. Persist booking state if changed by this flow (though unlikely).
      (priceEstimationHistory as any)._bookingState = currentBookingState;
      return priceEstimationHistory;
    }

    // Perform sentiment and client need analysis
    const [moodAnalysisResult, clientNeedAnalysisResult] = await Promise.all([
      analyzeSentiment(lastUserMessage.content || "").catch(e => { console.error('[CustomerInteraction] Mood Analysis Error:', e); return undefined; }),
      analyzeClientNeed(
        lastUserMessage.content || "", 
        history.filter(m => m.role === 'user' || m.role === 'assistant') as ChatMessage[]
      ).catch(e => { console.error('[CustomerInteraction] Client Need Analysis Error:', e); return null; })
    ]);

    if (moodAnalysisResult) {
      console.log(`[CustomerInteraction] Mood: ${moodAnalysisResult.score}/10 (${moodAnalysisResult.category}: ${moodAnalysisResult.description})`);
    }
    if (clientNeedAnalysisResult) {
      console.log(`[CustomerInteraction] Client Need: Type=${clientNeedAnalysisResult.need_type}, Intent=${clientNeedAnalysisResult.intent}, Confidence=${clientNeedAnalysisResult.confidence?.toFixed(2)}`);
    }

    // Attempt to manage the booking process
    const bookingProcessResult = await manageBookingProcess(lastUserMessage, currentBookingState, [...history], clientNeedAnalysisResult);
    if (bookingProcessResult) {
      // Booking process handled a step and returned history.
      (bookingProcessResult.updatedHistory as any)._bookingState = bookingProcessResult.updatedBookingState;
      return bookingProcessResult.updatedHistory;
    }
  }

  // If no specific flow handled the message, proceed to general OpenAI completion
  const messagesForOpenAI = formatMessagesForOpenAI(history, systemPrompt);
  const completion = await executeChatCompletion(messagesForOpenAI, "gpt-4o", 0.3, 1000, [createUserSchema]);
  const assistantChoice = completion.choices[0].message;

  // Handle function calls if any
  if (assistantChoice.function_call?.name === "createUser") {
    const updatedHistoryWithFunctionCall = await handleCreateUserFunctionCall(assistantChoice.function_call.arguments || "{}", history, systemPrompt);
    (updatedHistoryWithFunctionCall as any)._bookingState = currentBookingState; // Persist booking state
    return updatedHistoryWithFunctionCall;
  }
  
  // Add standard assistant response to history
  const responseMessage: OpenAIChatMessage = {
    role: 'assistant',
    content: assistantChoice.content || '',
  };
  if (assistantChoice.function_call) { // Should be caught by specific handlers like createUser, but as a fallback
      responseMessage.function_call = assistantChoice.function_call;
  }
  history.push(responseMessage);
  
  // Persist booking state at the end of the interaction
  (history as any)._bookingState = currentBookingState;
  return history;
} 