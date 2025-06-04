import { OpenAIChatMessage } from "@/lib/conversation-engine/llm-actions/chat-interactions/openai-config/openai-core";
import { Service } from "@/lib/database/models/service";
import { Business } from "@/lib/database/models/business";
import { computeQuoteEstimation, QuoteEstimation } from "@/lib/general-helpers/quote-cost-calculator";
import { fetchDirectGoogleMapsDistance } from '@/lib/general-helpers/google-distance-calculator';
import { BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";

// Constant for mock ID, consider moving to a shared config or passing as parameter.
const MOCK_SERVICE_ID_FOR_QUOTE = "d27f606f-70ac-4798-9706-13d308d1c98e";

/**
 * Fetches a mock service instance for quote calculation demonstrations.
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
    console.error(`[PriceEstimationHandler] Error fetching mock service (ID: ${MOCK_SERVICE_ID_FOR_QUOTE}):`, errorMessage);
    throw new Error(`Failed to fetch mock service for quote: ${errorMessage}`);
  }
}

/**
 * Attempts to calculate and respond with a price estimation if recent messages suggest addresses were provided.
 * @param history The current chat history (used for context, not modified directly).
 * @param lastUserMessage The last message from the user.
 * @returns A Promise resolving to a BotResponse if estimation was handled, otherwise null.
 */
export async function tryHandleAddressBasedPriceEstimation(
  history: Readonly<OpenAIChatMessage[]>,
  lastUserMessage: OpenAIChatMessage
): Promise<BotResponse | null> {
  if (history.length < 2) return null;

  if (history.length < 3) return null;

  const currentUserMessageIndex = history.length - 1;
  const botMessagePromptingForDropoff = history[currentUserMessageIndex - 1];
  const previousUserMessageWithPickup = history[currentUserMessageIndex - 2];

  const lastAssistantMessageInFullHistory = history.slice(0, -1).reverse().find(m => m.role === 'assistant');
  const lastBotResponseWasNotPriceCalc = !lastAssistantMessageInFullHistory?.content?.includes("total estimated price is $");

  const shouldAttemptEstimation =
    botMessagePromptingForDropoff?.role === 'assistant' &&
    botMessagePromptingForDropoff.content &&
    (botMessagePromptingForDropoff.content.toLowerCase().includes('drop-off address') || botMessagePromptingForDropoff.content.toLowerCase().includes('delivery address')) &&
    previousUserMessageWithPickup?.role === 'user' && previousUserMessageWithPickup.content &&
    lastUserMessage.role === 'user' && lastUserMessage.content &&
    lastBotResponseWasNotPriceCalc;

  if (!shouldAttemptEstimation) return null;

  const pickupAddress = previousUserMessageWithPickup.content;
  const dropoffAddress = lastUserMessage.content;

  try {
    console.log(`[PriceEstimationHandler] Attempting distance & mock price calculation for Pickup: "${pickupAddress}", Dropoff: "${dropoffAddress}"`);
    const mapsData = await fetchDirectGoogleMapsDistance(pickupAddress, dropoffAddress);

    if (mapsData.status !== 'OK' || !mapsData.rows?.[0]?.elements?.[0] || mapsData.rows[0].elements[0].status !== 'OK') {
      throw new Error(`Maps API did not return OK status or valid element. Status: ${mapsData.status}, Message: ${mapsData.error_message || JSON.stringify(mapsData)}`);
    }

    const element = mapsData.rows[0].elements[0];
    const travelTimeInSeconds = element.duration.value;
    const travelTimeEstimateInMinutes = Math.ceil(travelTimeInSeconds / 60);
    const distanceText = element.distance.text;

    const mockServiceInstance = await getMockServiceForQuote();
    
    // Business is no longer needed for quote calculation since mobile property is on the service
    const quote = computeQuoteEstimation(mockServiceInstance, travelTimeEstimateInMinutes);
    const assistantResponseContent = `Okay, for the trip from "${pickupAddress}" to "${dropoffAddress}", the estimated travel time is about ${travelTimeEstimateInMinutes} minutes (distance: ${distanceText}).\nUsing our example service ("${mockServiceInstance.name}"), the total estimated price is $${quote.totalJobCost.toFixed(2)}.\nThis includes a service cost of $${quote.serviceCost.toFixed(2)} and a travel cost of $${quote.travelCost.toFixed(2)}.\n(Please note: this is a test calculation based on a standard service).\n\nNow, could you tell me what type of removal service you specifically need?`;
    
    console.log("[PriceEstimationHandler] Distance and mock price calculated.");
    return { text: assistantResponseContent };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[PriceEstimationHandler] Critical error during distance/price calculation step:', errorMessage);
    const errorResponseContent = `I'm sorry, I encountered an issue while calculating the travel information: ${errorMessage}. Please double-check the addresses. If the problem continues, we can proceed without this estimate for now. Could you please tell me the type of removal service you need?`;
    return { text: errorResponseContent };
  }
} 