import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { User } from '@/lib/database/models/user';

export const checkExistingUserHandler: IndividualStepHandler = {
  autoAdvance: true,
  
  validateUserInput: async () => ({ isValidInput: true }),
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const customerWhatsappNumber = chatContext.currentParticipant.customerWhatsappNumber;
    
    if (!customerWhatsappNumber) {
      return { ...currentGoalData, existingUserFound: false };
    }
    
    try {
      const user = await User.findUserByCustomerWhatsappNumber(customerWhatsappNumber);
      
      if (user) {
        return {
          ...currentGoalData,
          existingUserFound: true,
          userId: user.id,
          customerName: user.firstName
        };
      }
      
      return { ...currentGoalData, existingUserFound: false };
      
    } catch (error) {
      console.error('[CheckExistingUser] Error checking for user:', error);
      return { ...currentGoalData, existingUserFound: false };
    }
  }
};
