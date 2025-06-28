import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText } from './booking-utils';

export const askUserNameHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'What\'s your first name so I can create your account?',
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    if (currentGoalData.existingUserFound) {
      return { isValidInput: true };
    }
    
    if (userInput && userInput.length >= 2) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: getLocalizedText(chatContext, 'MESSAGES.FIRST_NAME_VALIDATION')
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    if (currentGoalData.existingUserFound) {
      return { ...currentGoalData, shouldAutoAdvance: true };
    }
    
    return {
      ...currentGoalData,
      customerName: validatedInput,
      confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.CREATE_ACCOUNT')
    };
  }
};
