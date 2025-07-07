import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, AddressValidator } from './booking-utils';

export const askAddressHandler: IndividualStepHandler = {
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    const customerName = currentGoalData.customerName || '{name}';
    const validationErrorMessage = getLocalizedTextWithVars(chatContext, 'MESSAGES.INVALID_ADDRESS', { name: customerName });
    return AddressValidator.validateAddress(userInput, chatContext);
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const customerName = currentGoalData.customerName || '{name}';
    
    if (validatedInput) {
      return {
        ...currentGoalData,
        customerAddress: validatedInput,
        validationErrorMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.INVALID_ADDRESS', { name: customerName }),
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.PROVIDE_ADDRESS', { name: customerName })
      };
    }
    
    // Handle initial display (empty input)
    return {
      ...currentGoalData,
      confirmationMessage: '📍 To show you accurate pricing and availability, I need your address first.'
    };
  }
};
