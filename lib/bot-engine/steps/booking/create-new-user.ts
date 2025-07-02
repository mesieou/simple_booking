import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedTextWithVars, getLocalizedText } from './booking-utils';

export const createNewUserHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Creating your account...',
  autoAdvance: true,
  
  validateUserInput: async (userInput, currentGoalData) => {
    if (currentGoalData.existingUserFound) {
      return { isValidInput: true };
    }
    return { isValidInput: true };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    if (currentGoalData.existingUserFound) {
      return currentGoalData;
    }
    
    try {
      // Use the new GoalManager method for user creation
      const { GoalManager } = await import('@/lib/bot-engine/core/goal-manager');
      const goalManager = new GoalManager();
      
      const userCreationResult = await goalManager.createUserForBookingGoal(
        currentGoalData.customerName,
        chatContext
      );
      
      return {
        ...currentGoalData,
        userId: userCreationResult.userId,
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.ACCOUNT_CREATED', { name: userCreationResult.customerName })
      };
      
    } catch (error) {
      console.error('[CreateNewUser] Error creating user:', error);
      return {
        ...currentGoalData,
        userCreationError: 'Failed to create user',
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.ACCOUNT_CREATION_FAILED')
      };
    }
  }
};
