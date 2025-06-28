import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText } from './booking-utils';

export const bookingConfirmationHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Your booking is confirmed!',
  
  validateUserInput: async () => ({ isValidInput: true }),
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const bookingSummary = currentGoalData.bookingSummary;
    
    let confirmationMessage = `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.TITLE')}\n\n`;
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.SERVICE')} ${bookingSummary.service}\n`;
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.DATE')} ${bookingSummary.date}\n`;
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.TIME')} ${bookingSummary.time}\n`;
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.LOCATION')} ${bookingSummary.location}\n\n`;
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.PRICING')}\n`;
    confirmationMessage += `  ${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.SERVICE_COST')} ${bookingSummary.serviceCost}\n`;
    confirmationMessage += `  ${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.TRAVEL_COST')} ${bookingSummary.travelCost}\n`;
    confirmationMessage += `  ${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.TOTAL_COST')} *${bookingSummary.totalCost}*\n\n`;
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.BOOKING_ID')} ${currentGoalData.bookingId}\n\n`;
    confirmationMessage += getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.LOOKING_FORWARD');
    
    return {
      ...currentGoalData,
      confirmationMessage
    };
  }
};
