import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText } from './booking-utils';

export const askEmailHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please provide your email address for booking confirmation:',
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(userInput)) {
      return { isValidInput: true };
    }
    return {
      isValidInput: false,
      validationErrorMessage: getLocalizedText(chatContext, 'MESSAGES.EMAIL_VALIDATION')
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData) => {
    return {
      ...currentGoalData,
      customerEmail: validatedInput
    };
  }
};
