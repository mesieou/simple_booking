import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedTextWithVars, getLocalizedText } from './booking-utils';

export const handleUserStatusHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Let me check your account status...',
  autoAdvance: true,
  
  validateUserInput: async () => ({ isValidInput: true }),
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    if (currentGoalData.existingUserFound) {
      return {
        ...currentGoalData,
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.WELCOME_BACK', { name: currentGoalData.customerName })
      };
    }
    
    return {
      ...currentGoalData,
      confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.NEW_USER_WELCOME')
    };
  }
};
