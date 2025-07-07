import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars } from './booking-utils';

export const askUserNameHandler: IndividualStepHandler = {
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    if (currentGoalData.existingUserFound) {
      return { isValidInput: true };
    }
    
    if (userInput && userInput.length >= 2) {
      return { isValidInput: true };
    }
    
    const customerName = currentGoalData.customerName || '{name}';
    return {
      isValidInput: false,
      validationErrorMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.FIRST_NAME_VALIDATION', { name: customerName })
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    if (currentGoalData.existingUserFound) {
      return { ...currentGoalData, shouldAutoAdvance: true };
    }
    
    if (validatedInput) {
      const customerName = currentGoalData.customerName || '{name}';
      return {
        ...currentGoalData,
        customerName: validatedInput,
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.CREATE_ACCOUNT', { name: customerName })
      };
    }
    
    // Handle initial display (empty input)
    return {
      ...currentGoalData,
      confirmationMessage: 'What\'s your first name so I can create your account?'
    };
  }
};
