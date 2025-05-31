// lib/bot/chatLogic.ts
/**
 * Chat Logic
 * This module handles the chat logic for the customer service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 */
import { createUserSchema } from "@/lib/rename-categorise-better/schemas";
import { systemPrompt } from "@/lib/rename-categorise-better/prompts";
import { User } from "@/lib/database/models/user";
import { Service } from "@/lib/database/models/service";
import { Business } from "@/lib/database/models/business";
import { computeQuoteEstimation, QuoteEstimation } from "@/lib/general-helpers/quote-cost-calculator";
import { executeChatCompletion, OpenAIChatMessage, MoodAnalysisResult } from "@/lib/llm-actions/chat-interactions/openai-config/openai-core";
import { analyzeSentiment } from "@/lib/llm-actions/chat-interactions/functions/sentiment-analiser";
import { analyzeClientNeed } from "@/lib/rename-categorise-better/client-need";
import { fetchDirectGoogleMapsDistance } from '@/lib/general-helpers/google-distance-calculator';
import { findAvailableDates, getSlotsForDate } from '@/lib/general-helpers/availability';

// Helper function to fetch the mock service for quote calculation.
// This service (ID: d27f606f-70ac-4798-9706-13d308d1c98e) is used for testing the price calculation flow.
async function getMockServiceForQuote(): Promise<Service> {
  const mockServiceId = "d27f606f-70ac-4798-9706-13d308d1c98e"; // As per user's provided service details
  try {
    const service = await Service.getById(mockServiceId);
    if (!service) {
        // Assuming Service.getById throws an error if not found, or returns a type that needs checking.
        // If Service.getById could return null/undefined, that check should be more explicit here.
        throw new Error(`Mock service with ID ${mockServiceId} not found.`);
    }
    return service;
  } catch (error) {
    console.error(`[ChatLogic] Error fetching mock service (ID: ${mockServiceId}):`, error);
    const message = error instanceof Error ? error.message : String(error);
    // Rethrow to be handled by the caller or to halt if critical for this flow
    throw new Error(`Failed to fetch mock service for quote: ${message}`);
  }
}

// Central function: takes existing history, and returns new history
export async function handleChat(history: OpenAIChatMessage[]) {
    // Get the last user message from the history
    const lastUserMessage = history.slice().reverse().find(m => m.role === 'user');

    let moodResult: MoodAnalysisResult | undefined;
    let clientNeedResult: any = null;

    const MOCK_PROVIDER_ID = "d27f606f-70ac-4798-9706-13d308d1c98e"; // This is actually a SERVICE ID. Assuming provider is linked via service.businessId
    // TODO: We need to fetch the actual businessId (providerId for availability functions) from the service or a default one.
    // For now, let's assume MOCK_BUSINESS_ID can be derived or is known.
    const MOCK_BUSINESS_ID = "5daa4f28-1ade-491b-be8b-b80025ffc2c4"; // Example Business ID from your User model in createUser

    let bookingState: {
        step: 'idle' | 'getting_size' | 'getting_date' | 'getting_time' | 'confirming';
        size?: 'one' | 'few' | 'house';
        jobDurationMinutes?: number;
        date?: string; // Store date as ISO string "yyyy-MM-dd"
        time?: string;
        // suggestedDates?: string[]; // Storing raw dates from findAvailableDates
        // suggestedTimes?: string[];
    } = (history as any)._bookingState || { step: 'idle' }; 

    // Check if a user message exists to process
    if (lastUserMessage && lastUserMessage.content) {
      // --- Start: Logic for Distance and Price Calculation ---
      // This section attempts to calculate travel distance/time and a mock price
      // if both pickup and dropoff addresses seem to have just been provided by the user.

      if (history.length >= 3) {
        const lastBotMessage = history[history.length - 2];
        const previousUserMessage = history[history.length - 3];
        const lastAssistantMessageInFullHistory = history.slice().reverse().find(m => m.role === 'assistant');
        const lastBotResponseWasNotPriceCalc = !lastAssistantMessageInFullHistory?.content?.includes("total estimated price is $");

        if (
          lastBotMessage?.role === 'assistant' &&
          lastBotMessage.content &&
          (lastBotMessage.content.toLowerCase().includes('drop-off address') || lastBotMessage.content.toLowerCase().includes('delivery address')) &&
          previousUserMessage?.role === 'user' &&
          previousUserMessage.content &&
          lastUserMessage.role === 'user' &&
          lastUserMessage.content &&
          lastBotResponseWasNotPriceCalc
        ) {
          const pickupAddress = previousUserMessage.content;
          const dropoffAddress = lastUserMessage.content;

          try {
            console.log(`[ChatLogic] Attempting distance & mock price calculation for Pickup: "${pickupAddress}", Dropoff: "${dropoffAddress}"`);

            // 1. Fetch distance and duration from Google Maps API via our internal endpoint
            // const mapsApiResponse = await fetch(`/api/maps/mapsdistance?origen=${encodeURIComponent(pickupAddress)}&destino=${encodeURIComponent(dropoffAddress)}`);
            const mapsData = await fetchDirectGoogleMapsDistance(pickupAddress, dropoffAddress);

            if (mapsData.status !== 'OK' || !mapsData.rows?.[0]?.elements?.[0] || mapsData.rows[0].elements[0].status !== 'OK') {
              throw new Error(`Maps API did not return OK status or valid element. Status: ${mapsData.status}, Message: ${mapsData.error_message || JSON.stringify(mapsData)}`);
            }

            const element = mapsData.rows[0].elements[0];
            const travelTimeInSeconds = element.duration.value;
            const travelTimeEstimateInMinutes = Math.ceil(travelTimeInSeconds / 60);
            const distanceText = element.distance.text;

            const mockServiceInstance = await getMockServiceForQuote();
            console.log(`[ChatLogic] Mock service instance: ${mockServiceInstance}`);
            const actualBusiness = await Business.getById(mockServiceInstance.businessId);
             if (!actualBusiness) {
                throw new Error(`Business with ID ${mockServiceInstance.businessId} (from mock service) not found.`);
            }

            const quote: QuoteEstimation = computeQuoteEstimation(
                mockServiceInstance,
                actualBusiness,
                travelTimeEstimateInMinutes
            );

            const assistantResponseContent = `Okay, for the trip from \"${pickupAddress}\" to \"${dropoffAddress}\", the estimated travel time is about ${travelTimeEstimateInMinutes} minutes (distance: ${distanceText}).\nUsing our example service (\"${mockServiceInstance.name}\"), the total estimated price is $${quote.totalJobCost.toFixed(2)}.\nThis includes a service cost of $${quote.serviceCost.toFixed(2)} and a travel cost of $${quote.travelCost.toFixed(2)}.\n(Please note: this is a test calculation based on a standard service).\n\nNow, could you tell me what type of removal service you specifically need?`;
            
            history.push({ role: 'assistant', content: assistantResponseContent });
            console.log("[ChatLogic] Distance and mock price calculated and sent to user.");
            return history;

          } catch (error) {
            console.error('[ChatLogic] Critical error during distance/price calculation step:', error);
            const message = error instanceof Error ? error.message : String(error);
            const errorResponseContent = `I'm sorry, I encountered an issue while calculating the travel information: ${message}. Please double-check the addresses. If the problem continues, we can proceed without this estimate for now. Could you please tell me the type of removal service you need?`;
            history.push({ role: 'assistant', content: errorResponseContent });
            return history;
          }
        }
      }

      const [moodAnalysisResult, clientNeedAnalysis] = await Promise.all([
        (async () => { 
          try {
            const result = await analyzeSentiment(lastUserMessage.content || "");
            if (result !== undefined) {
              console.log(`[Mood Analysis] Message: \"${lastUserMessage.content}\"`);
              console.log(`[Mood Analysis] Score: ${result.score}/10 (${result.category}: ${result.description})`);
              return result;
            }
          } catch (error) { console.error('[Mood Analysis] Error:', error); }
          return undefined;
        })(),
        (async () => { 
          try {
            const chatHistoryForNeed = history.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content || ""
            }));
            return await analyzeClientNeed(lastUserMessage.content || "", chatHistoryForNeed);
          } catch (error) { console.error('[Client Need Analysis] Error:', error); return null; }
        })()
      ]);

      moodResult = moodAnalysisResult;
      clientNeedResult = clientNeedAnalysis;

      if (clientNeedResult) {
        console.log(`[Client Need] Message: \"${lastUserMessage.content}\"`);
        console.log(`[Client Need] Type: ${clientNeedResult.need_type}`);
        console.log(`[Client Need] Intent: ${clientNeedResult.intent}`);
        console.log(`[Client Need] Confidence: ${clientNeedResult.confidence.toFixed(2)}`);
      }

      // --- START: BOOKING LOGIC INTEGRATION ---
      const lastBotMessageContent = history.length > 1 ? history[history.length - 2]?.content?.toLowerCase() : "";

      // Check if we are actively in a booking flow or if client need indicates booking
      const isBookingIntent = clientNeedResult?.need_type === 'booking_service' || clientNeedResult?.intent === 'request_booking' || bookingState.step !== 'idle';
      const isBookingInProgress = bookingState.step !== 'idle';

      if (isBookingIntent && bookingState.step === 'idle') {
        // New booking request identified
        bookingState.step = 'getting_size';
        const responseContent = "Okay, I can help you with a booking. What size of service do you need? (e.g., 'one item', 'few items', or 'house')";
        history.push({ role: 'assistant', content: responseContent });
        (history as any)._bookingState = bookingState; // Persist state
        return history;
      }

      if (isBookingInProgress) {
        // Handle booking steps
        const userMessageText = lastUserMessage.content.toLowerCase();

        if (bookingState.step === 'getting_size') {
          let determinedSize: 'one' | 'few' | 'house' | null = null;
          let jobDuration = 0;
          if (userMessageText.includes('one item') || userMessageText.includes('one')) { determinedSize = 'one'; jobDuration = 60; }
          else if (userMessageText.includes('few items') || userMessageText.includes('few')) { determinedSize = 'few'; jobDuration = 90; }
          else if (userMessageText.includes('house')) { determinedSize = 'house'; jobDuration = 120; }

          if (determinedSize) {
            bookingState.size = determinedSize;
            bookingState.jobDurationMinutes = jobDuration;
            bookingState.step = 'getting_date';
            try {
              // Use MOCK_BUSINESS_ID as businessId for findAvailableDates
              const availableDateStrings = await findAvailableDates(MOCK_PROVIDER_ID, MOCK_BUSINESS_ID, jobDuration, new Date(), 5, 30);
              let responseContent;
              if (availableDateStrings.length > 0) {
                const formattedDates = availableDateStrings.map(dateStr => new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })).join('\n - ');
                responseContent = `Great! You've selected '${determinedSize}'. Here are some upcoming available dates:\n - ${formattedDates}\n\nWhich date would you prefer? Or you can specify another date (e.g., MM/DD/YYYY).`;
              } else {
                responseContent = `Great! You've selected '${determinedSize}'. Unfortunately, I don't see any availability in the near future. You can try specifying a date further out.`;
              }
              history.push({ role: 'assistant', content: responseContent });
            } catch (e) {
                console.error("[ChatLogic Booking] Error finding available dates:", e);
                history.push({ role: 'assistant', content: "I had trouble finding available dates right now. Please try again in a moment, or specify a date you have in mind." });
            }
          } else {
            history.push({ role: 'assistant', content: "I didn't quite catch the size. Please choose from: 'one item', 'few items', or 'house'." });
          }
          (history as any)._bookingState = bookingState; // Persist state
          return history;
        }
        
        if (bookingState.step === 'getting_date') {
          // Simplified date parsing - enhance for robustness
          let parsedDate: Date | null = null;
          const dateMatch = userMessageText.match(/(\d{1,2})[\/\-](\d{1,2})([\/\-](\d{2}|\d{4}))?/);
          if (dateMatch) {
            const day = parseInt(dateMatch[2]);
            const month = parseInt(dateMatch[1]) -1; // Month is 0-indexed
            const year = dateMatch[4] ? (dateMatch[4].length === 2 ? 2000 + parseInt(dateMatch[4]) : parseInt(dateMatch[4])) : new Date().getFullYear();
            parsedDate = new Date(year, month, day);
          } else {
             // Try to match named dates like "today", "tomorrow", or weekdays
            const today = new Date(); today.setHours(0,0,0,0);
            const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
            if (userMessageText.includes("today")) parsedDate = today;
            else if (userMessageText.includes("tomorrow")) parsedDate = tomorrow;
            // Add more sophisticated natural language date parsing here if needed
          }

          if (parsedDate && bookingState.jobDurationMinutes) {
            const targetDateISO = parsedDate.toISOString().split('T')[0];
            bookingState.date = targetDateISO;
            try {
              const slots = await getSlotsForDate(MOCK_PROVIDER_ID, MOCK_BUSINESS_ID, bookingState.jobDurationMinutes, targetDateISO);
              if (slots.length > 0) {
                bookingState.step = 'getting_time';
                // bookingState.suggestedTimes = slots; // Store for validation if needed
                const formattedSlots = slots.join(', ');
                history.push({ role: 'assistant', content: `Okay, for ${parsedDate.toLocaleDateString()}. Available times are: ${formattedSlots}. Which time works for you?` });
              } else {
                // No slots for this specific date, revert or ask for another date
                bookingState.step = 'getting_date'; // Stay on date step
                // Maybe suggest findAvailableDates again or ask for a broader range
                history.push({ role: 'assistant', content: `Sorry, no slots available on ${parsedDate.toLocaleDateString()}. Would you like to try another date?` });
              }
            } catch (e) {
              console.error("[ChatLogic Booking] Error getting slots for date:", e);
              history.push({ role: 'assistant', content: `I had trouble checking slots for ${parsedDate.toLocaleDateString()}. Please try another date or try again later.` });
            }
          } else {
             // If date parsing failed, ask again, maybe repeat suggestions from findAvailableDates if stored
            history.push({ role: 'assistant', content: "I didn't understand the date. Please try MM/DD/YYYY, or pick from the suggestions if any were provided." });
          }
          (history as any)._bookingState = bookingState; 
          return history;
        }

        if (bookingState.step === 'getting_time') {
          // Simplified time parsing. Expects HH:MM or HH:MM AM/PM (AM/PM is ignored for now, assumes 24hr format from slots)
          const timeMatch = userMessageText.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch && bookingState.date && bookingState.jobDurationMinutes) {
            const selectedTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
            // Validate against previously fetched slots (if we stored them, or fetch again)
            // For simplicity, we'll assume any HH:MM format given by user might be valid if getSlotsForDate returned it.
            // A more robust way is to check selectedTime against bookingState.suggestedTimes if stored.
            const slotsForValidation = await getSlotsForDate(MOCK_PROVIDER_ID, MOCK_BUSINESS_ID, bookingState.jobDurationMinutes, bookingState.date);
            if (slotsForValidation.includes(selectedTime)){
                bookingState.time = selectedTime;
                bookingState.step = 'confirming';
                const friendlyDate = new Date(bookingState.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                history.push({ role: 'assistant', content: `Great! So that's a '${bookingState.size}' service on ${friendlyDate} at ${selectedTime}. Correct? (yes/no)` });
            } else {
                 history.push({ role: 'assistant', content: `Hmm, ${selectedTime} doesn't seem to be available on that day, or it's not in the HH:MM format I expected. Available times were: ${slotsForValidation.join(', ')}. Please pick one.`});
            }
          } else {
            history.push({ role: 'assistant', content: "Please provide the time in HH:MM format (e.g., 09:00 or 14:30)." });
          }
          (history as any)._bookingState = bookingState; 
          return history;
        }

        if (bookingState.step === 'confirming') {
          if (userMessageText.includes('yes')) {
            // TODO: Add actual booking creation logic here (e.g., save to database)
            const friendlyDate = new Date(bookingState.date!).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            history.push({ role: 'assistant', content: `Excellent! Your '${bookingState.size}' service is booked for ${friendlyDate} at ${bookingState.time}. You'll receive a confirmation shortly. Is there anything else?` });
            bookingState.step = 'idle'; // Reset for next booking
          } else if (userMessageText.includes('no')) {
            history.push({ role: 'assistant', content: "Okay, booking cancelled. We can start over if you like. What size of service do you need?" });
            bookingState.step = 'getting_size'; // Or idle, depending on desired flow
          } else {
            history.push({ role: 'assistant', content: "Please confirm with 'yes' or 'no'." });
          }
          (history as any)._bookingState = bookingState; 
          return history;
        }
      }
      // --- END: BOOKING LOGIC INTEGRATION ---

    } 

    const messages: OpenAIChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((msg): OpenAIChatMessage => {
        // Ensure msg itself conforms to OpenAIChatMessage before processing
        // This map function reconstructs each message to ensure full type compliance for the API call.
        if (msg.role === 'system') {
          return { role: 'system', content: msg.content || '' }; // System content must be string
        }
        if (msg.role === 'user') {
          // User content must be string. The `name` property is not standard for user roles in input to OpenAI, 
          // but if your internal history items for users might have it from tool calls, it is better to omit it here for the API.
          return { role: 'user', content: msg.content || '' };
        }
        if (msg.role === 'assistant') {
          if (msg.function_call) {
            // If there's a function_call, content can be null (or an empty string if API expects string).
            // OpenAI API generally allows content to be null if function_call is present.
            // We will use empty string if msg.content is undefined/null, as the base type for assistant content is string.
            return { role: 'assistant', content: msg.content || '', function_call: msg.function_call };
          }
          // If no function_call, content must be a string.
          return { role: 'assistant', content: msg.content || '' };
        }
        if (msg.role === 'function') {
          // Function role requires name and string content.
          return { role: 'function', name: msg.name, content: msg.content || '' };
        }
        // This should not be reached if history contains valid OpenAIChatMessage objects.
        // Adding a fallback or error for unexpected roles, though TypeScript should catch this earlier.
        // For exhaustive checks, if OpenAIChatMessage was a discriminated union handled by a switch, TS would be happier.
        // Given the current structure, this direct mapping is clearer.
        // Fallback to a user message with stringified content if role is unknown, though this indicates an issue upstream.
        console.error("[ChatLogic] Unknown message role in history:", msg);
        return { role: 'user', content: JSON.stringify(msg) }; // Fallback, but indicates an issue
      })
    ];
    
    const completion = await executeChatCompletion(messages, "gpt-4o", 0.3, 1000, [createUserSchema]);
    const msg = completion.choices[0].message;

    if (msg.function_call?.name === "createUser") {
        const {firstName, lastName} = JSON.parse(msg.function_call.arguments || "{}");
        try {
            // Note: The businessId for User creation is hardcoded here. This should ideally be dynamic.
            const user = new User(firstName, lastName, "customer", "5daa4f28-1ade-491b-be8b-b80025ffc2c4");
            const result = await user.add();
            history.push({ role: 'assistant', content: msg.content || '', function_call: msg.function_call });
            history.push({ role: "function", name: "createUser", content: JSON.stringify({ success: true, userId: result.data.id }) });
        } catch (err) {
            console.error("User creation error (English):", err);
            const message = err instanceof Error ? err.message : String(err);
            history.push({ role: 'assistant', content: msg.content || '', function_call: msg.function_call });
            history.push({ role: "function", name: "createUser", content: JSON.stringify({ success: false, error: message }) });
        }
        const followUp = await executeChatCompletion([{ role: "system", content: systemPrompt}, ...history], "gpt-4o");
        history.push({ role: 'assistant', content: followUp.choices[0].message.content || '' });
        return history;
    }

    const responseMessage: OpenAIChatMessage = {
      role: 'assistant',
      content: msg.content || '',
    };
    if (msg.function_call) { 
        responseMessage.function_call = msg.function_call;
    }

    (history as any)._bookingState = bookingState; // Persist state even after falling through
    return [...history, responseMessage];
}

