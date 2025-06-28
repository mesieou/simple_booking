import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, AddressValidator } from './booking-utils';

export const askAddressHandler: IndividualStepHandler = {
  defaultChatbotPrompt: '📍 To show you accurate pricing and availability, I need your address first.',
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    return AddressValidator.validateAddress(userInput, chatContext);
  },
  
  processAndExtractData: async (validatedInput, currentGoalData) => {
    return {
      ...currentGoalData,
      customerAddress: validatedInput
    };
  }
};
