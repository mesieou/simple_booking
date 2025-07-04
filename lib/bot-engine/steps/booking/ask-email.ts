import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars } from './booking-utils';

export const askEmailHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please provide your email address for booking confirmation:',
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(userInput)) {
      return { isValidInput: true };
    }
    const customerName = currentGoalData.customerName || '{name}';
    return {
      isValidInput: false,
      validationErrorMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.EMAIL_VALIDATION', { name: customerName })
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const customerName = currentGoalData.customerName || '{name}';
    return {
      ...currentGoalData,
      customerEmail: validatedInput,
      confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.EMAIL_PROMPT', { name: customerName })
    };
  }
};
