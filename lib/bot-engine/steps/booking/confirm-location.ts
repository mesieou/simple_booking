import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedTextWithVars } from './booking-utils';
import { Business } from '@/lib/database/models/business';

export const confirmLocationHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Confirming service location...',
  autoAdvance: true,
  
  validateUserInput: async (userInput, currentGoalData) => {
    if (currentGoalData.selectedService?.mobile) {
      return { isValidInput: true };
    }
    return { isValidInput: true };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const service = currentGoalData.selectedService;
    
    if (service.mobile) {
      // For mobile services, use the validated customer address
      const finalAddress = currentGoalData.finalServiceAddress || currentGoalData.customerAddress;
      
      return {
        ...currentGoalData,
        finalServiceAddress: finalAddress,
        serviceLocation: 'customer_address',
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.MOBILE_SERVICE_LOCATION', { address: finalAddress })
      };
    }
    
    // For non-mobile services, use business address
    const business = await Business.getById(chatContext.currentParticipant.associatedBusinessId as string);
    const businessAddress = business?.businessAddress || business?.name || 'Our location';
    
    return {
      ...currentGoalData,
      serviceLocation: 'business_address',
      finalServiceAddress: businessAddress,
      confirmationMessage: `The service will be at our location: ${businessAddress}`
    };
  }
};
