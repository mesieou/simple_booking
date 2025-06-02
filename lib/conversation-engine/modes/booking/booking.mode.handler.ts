import { ParsedMessage, BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { ConversationContext, ConversationMode } from "../../conversation.context";
import { BookingState } from "./booking-sub-modes/booking.state";
import {
  handleCreateBookingGettingSize,
  handleCreateBookingGettingDate,
  handleCreateBookingGettingTime,
  handleCreateBookingConfirming
} from "./booking-sub-modes/create-booking.flow";
import { OpenAIChatMessage } from "@/lib/conversation-engine/llm-actions/chat-interactions/openai-config/openai-core";

/**
 * Handles all interactions when the conversation is in BookingMode.
 * It orchestrates sub-flows like creating, viewing, or cancelling bookings.
 * @param parsedMessage The standardized incoming message.
 * @param context The current conversation context (will be modified).
 * @returns A Promise resolving to a BotResponse.
 */
export async function handleBookingModeInteraction(
  parsedMessage: ParsedMessage,
  context: ConversationContext
): Promise<BotResponse> {
  console.log(`[BookingModeHandler] Handling message for user ${context.userId}: "${parsedMessage.text}". Current booking state:`, context.bookingState);

  // Ensure bookingState exists in the context, initialize if not (e.g., when first entering BookingMode)
  if (!context.bookingState || typeof context.bookingState !== 'object') {
    console.log("[BookingModeHandler] Initializing bookingState.");
    context.bookingState = { step: 'idle' };
  }
  // Ensure we are working with a mutable copy of the history for this turn if needed by step handlers
  // However, step handlers primarily return new state and history, not modify context.chatHistory directly.
  let currentTurnHistory: OpenAIChatMessage[] = [...context.chatHistory]; 

  const userMessageText = parsedMessage.text?.toLowerCase() || "";
  let stepResult: { updatedHistory: OpenAIChatMessage[]; updatedBookingState: BookingState } | null = null;
  let botResponseText: string | undefined;

  // Decision logic: Is it a new booking creation, or continuation of one?
  // Or is it a request to view or cancel (placeholder for now)?

  // TODO: Refine intent checking for view/cancel once those intents are clearly defined by analyzeClientNeed
  if (context.lastUserIntent?.intent === 'request_view_booking') {
    console.log("[BookingModeHandler] Intent to view booking recognized (placeholder).");
    // In future, call view-booking.flow.ts logic here
    botResponseText = "Viewing bookings is coming soon!";
    context.currentMode = 'IdleMode'; // Example: view might be a one-off, then back to idle
  } else if (context.lastUserIntent?.intent === 'request_cancel_booking') {
    console.log("[BookingModeHandler] Intent to cancel booking recognized (placeholder).");
    // In future, call cancel-booking.flow.ts logic here
    botResponseText = "Cancelling bookings is coming soon!";
    context.currentMode = 'IdleMode'; // Example: cancel might be a one-off, then back to idle
  } 
  // If it's an intent to book and current booking state is idle, start the process.
  else if ((context.lastUserIntent?.intent === 'request_booking' || context.lastUserIntent?.intent === 'start_booking') && context.bookingState.step === 'idle') {
    console.log("[BookingModeHandler] Starting new booking flow (request_booking intent and idle state).");
    context.bookingState.step = 'getting_size';
    botResponseText = "Okay, I can help you with a booking. What size of service do you need? (e.g., 'one item', 'few items', or 'house')";
    // Add this initial bot prompt to the history that the create-booking.flow functions will use/append to
    currentTurnHistory.push({role: 'assistant', content: botResponseText});
  }
  // If already in a booking step (not idle), continue the create booking flow.
  else if (context.bookingState.step !== 'idle' && context.bookingState.step !== 'completed' && context.bookingState.step !== 'cancelled') {
    console.log(`[BookingModeHandler] Continuing booking flow. Current step: ${context.bookingState.step}`);
    switch (context.bookingState.step) {
      case 'getting_size':
        stepResult = await handleCreateBookingGettingSize(userMessageText, context.bookingState, currentTurnHistory);
        break;
      case 'getting_date':
        stepResult = await handleCreateBookingGettingDate(userMessageText, context.bookingState, currentTurnHistory);
        break;
      case 'getting_time':
        stepResult = await handleCreateBookingGettingTime(userMessageText, context.bookingState, currentTurnHistory);
        break;
      case 'confirming':
        stepResult = handleCreateBookingConfirming(userMessageText, context.bookingState, currentTurnHistory);
        break;
      default:
        console.error(`[BookingModeHandler] Unknown booking step: ${context.bookingState.step}`);
        botResponseText = "I seem to be a bit lost in the booking process. Could we start over?";
        context.bookingState.step = 'idle'; // Reset
        context.currentMode = 'IdleMode';
        break;
    }

    if (stepResult) {
      context.bookingState = stepResult.updatedBookingState;
      // The last message in updatedHistory is the assistant's response for this step.
      botResponseText = stepResult.updatedHistory[stepResult.updatedHistory.length - 1]?.content || "Error: No response content.";
      // Update the main conversation history with the messages from this step
      // This ensures that context.chatHistory is the single source of truth for history.
      context.chatHistory = stepResult.updatedHistory;
    }
  } else {
    // If in BookingMode but bookingState is idle, completed, or cancelled, 
    // and no new booking/view/cancel intent, something is off or flow ended.
    // Default to exiting booking mode or asking for clarification.
    console.log(`[BookingModeHandler] In BookingMode but step is ${context.bookingState.step}. No clear next action based on intent. Reverting to IdleMode.`);
    botResponseText = "Is there anything else I can help you with regarding bookings, or something else entirely?";
    context.currentMode = 'IdleMode';
  }

  // If booking is completed or cancelled, transition out of BookingMode.
  if (context.bookingState.step === 'completed' || context.bookingState.step === 'cancelled') {
    console.log(`[BookingModeHandler] Booking flow ended with step: ${context.bookingState.step}. Transitioning to IdleMode.`);
    context.currentMode = 'IdleMode';
  }

  console.log(`[BookingModeHandler] Responding. Final booking state:`, context.bookingState, `Transitioning to mode: ${context.currentMode}`);
  return { text: botResponseText };
} 