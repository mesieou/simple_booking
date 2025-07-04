import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, AddressValidator } from './booking-utils';

export const askAddressHandler: IndividualStepHandler = {
  defaultChatbotPrompt: '📍 To show you accurate pricing and availability, I need your address first.',
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    const customerName = currentGoalData.customerName || '{name}';
    const validationErrorMessage = getLocalizedTextWithVars(chatContext, 'MESSAGES.INVALID_ADDRESS', { name: customerName });
    return AddressValidator.validateAddress(userInput, chatContext);
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const customerName = currentGoalData.customerName || '{name}';
    return {
      ...currentGoalData,
      customerAddress: validatedInput,
      validationErrorMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.INVALID_ADDRESS', { name: customerName }),
      confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.PROVIDE_ADDRESS', { name: customerName })
    };
  }
};
