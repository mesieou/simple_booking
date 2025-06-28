import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { User } from '@/lib/database/models/user';
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
      const newUser = new User(
        currentGoalData.customerName,
        '', // lastName
        'customer',
        chatContext.currentParticipant.associatedBusinessId || ''
      );
      
      await newUser.add({
        whatsappNumber: chatContext.currentParticipant.customerWhatsappNumber
      });
      
      return {
        ...currentGoalData,
        userId: newUser.id,
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.ACCOUNT_CREATED', { name: newUser.firstName })
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
