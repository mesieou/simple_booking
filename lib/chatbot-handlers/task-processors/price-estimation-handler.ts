import { OpenAIChatMessage } from "@/lib/llm-actions/chat-interactions/openai-config/openai-core";
import { Service } from "@/lib/database/models/service";
import { Business } from "@/lib/database/models/business";
import { computeQuoteEstimation, QuoteEstimation } from "@/lib/general-helpers/quote-cost-calculator";
import { fetchDirectGoogleMapsDistance } from '@/lib/general-helpers/google-distance-calculator';

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
 */
export async function tryHandleAddressBasedPriceEstimation(
  history: OpenAIChatMessage[],
  lastUserMessage: OpenAIChatMessage
): Promise<OpenAIChatMessage[] | null> {
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
    const actualBusiness = await Business.getById(mockServiceInstance.businessId);
    if (!actualBusiness) {
      throw new Error(`Business with ID ${mockServiceInstance.businessId} (from mock service) not found.`);
    }

    const quote = computeQuoteEstimation(mockServiceInstance, actualBusiness, travelTimeEstimateInMinutes);
    const assistantResponseContent = `Okay, for the trip from "${pickupAddress}" to "${dropoffAddress}", the estimated travel time is about ${travelTimeEstimateInMinutes} minutes (distance: ${distanceText}).\nUsing our example service ("${mockServiceInstance.name}"), the total estimated price is $${quote.totalJobCost.toFixed(2)}.\nThis includes a service cost of $${quote.serviceCost.toFixed(2)} and a travel cost of $${quote.travelCost.toFixed(2)}.\n(Please note: this is a test calculation based on a standard service).\n\nNow, could you tell me what type of removal service you specifically need?`;
    
    history.push({ role: 'assistant', content: assistantResponseContent });
    console.log("[PriceEstimationHandler] Distance and mock price calculated and sent to user.");
    return history;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[PriceEstimationHandler] Critical error during distance/price calculation step:', errorMessage);
    const errorResponseContent = `I'm sorry, I encountered an issue while calculating the travel information: ${errorMessage}. Please double-check the addresses. If the problem continues, we can proceed without this estimate for now. Could you please tell me the type of removal service you need?`;
    history.push({ role: 'assistant', content: errorResponseContent });
    return history;
  }
} 