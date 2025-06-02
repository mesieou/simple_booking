import { OpenAIChatMessage } from "@/lib/conversation-engine/llm-actions/chat-interactions/openai-config/openai-core";
import { findAvailableDates, getSlotsForDate } from '@/lib/general-helpers/availability';
import { BookingState } from './booking.state';

// Constants for mock IDs, specific to the create booking flow using mock availability.
// Consider moving to a shared config or passing them as parameters if they vary or are used elsewhere.
const MOCK_PROVIDER_ID_FOR_AVAILABILITY = "d27f606f-70ac-4798-9706-13d308d1c98e";
const MOCK_BUSINESS_ID_FOR_AVAILABILITY = "5daa4f28-1ade-491b-be8b-b80025ffc2c4";

/**
 * Handles the 'getting_size' step of the booking creation process.
 */
export async function handleCreateBookingGettingSize(
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
      console.error("[CreateBookingFlow] Error finding available dates:", e);
      history.push({ role: 'assistant', content: "I had trouble finding available dates right now. Please try again in a moment, or specify a date you have in mind." });
    }
  } else {
    history.push({ role: 'assistant', content: "I didn\'t quite catch the size. Please choose from: 'one item', 'few items', or 'house'." });
  }
  return { updatedHistory: history, updatedBookingState };
}

/**
 * Handles the 'getting_date' step of the booking creation process.
 */
export async function handleCreateBookingGettingDate(
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
      console.error("[CreateBookingFlow] Error getting slots for date:", e);
      history.push({ role: 'assistant', content: `I had trouble checking slots for ${parsedDate.toLocaleDateString()}. Please try another date or try again later.` });
    }
  } else {
    history.push({ role: 'assistant', content: "I didn\'t understand the date. Please try MM/DD/YYYY, or pick from the suggestions if any were provided." });
  }
  return { updatedHistory: history, updatedBookingState };
}

/**
 * Handles the 'getting_time' step of the booking creation process.
 */
export async function handleCreateBookingGettingTime(
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
 * Handles the 'confirming' step of the booking creation process.
 */
export function handleCreateBookingConfirming(
  userMessageText: string,
  currentBookingState: BookingState,
  history: OpenAIChatMessage[]
): { updatedHistory: OpenAIChatMessage[]; updatedBookingState: BookingState } {
  const updatedBookingState = { ...currentBookingState };
  if (userMessageText.includes('yes')) {
    const friendlyDate = new Date(updatedBookingState.date!).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    history.push({ role: 'assistant', content: `Excellent! Your '${updatedBookingState.size}' service is booked for ${friendlyDate} at ${updatedBookingState.time}. You\'ll receive a confirmation shortly. Is there anything else?` });
    updatedBookingState.step = 'completed'; // Mark as completed
  } else if (userMessageText.includes('no')) {
    history.push({ role: 'assistant', content: "Okay, booking cancelled. We can start over if you like. What size of service do you need?" });
    updatedBookingState.step = 'cancelled'; // Mark as cancelled, could also go to 'getting_size' or 'idle'
  } else {
    history.push({ role: 'assistant', content: "Please confirm with 'yes' or 'no'." });
    // State remains 'confirming'
  }
  return { updatedHistory: history, updatedBookingState };
} 