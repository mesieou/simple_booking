import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars } from './booking-utils';
import { Business } from '@/lib/database/models/business';

export const confirmLocationHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Confirming service location...',
  autoAdvance: true,
  
  validateUserInput: async (userInput, currentGoalData) => {
    // Support both multi-service and single service
    const selectedServices = currentGoalData.selectedServices || [];
    const selectedService = currentGoalData.selectedService;
    const servicesToCheck = selectedServices.length > 0 ? selectedServices : (selectedService ? [selectedService] : []);
    
    // Always return valid since this step just determines location based on service type
    return { isValidInput: true };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    // Support both multi-service and single service
    const selectedServices = currentGoalData.selectedServices || [];
    const selectedService = currentGoalData.selectedService;
    const servicesToCheck = selectedServices.length > 0 ? selectedServices : (selectedService ? [selectedService] : []);
    
    if (servicesToCheck.length === 0) {
      console.error('[ConfirmLocation] No services found to process');
      return {
        ...currentGoalData,
        confirmationMessage: 'Error: No service selected. Please start over.'
      };
    }
    
    // Check if any service is mobile
    const hasMobileService = servicesToCheck.some((service: any) => service?.mobile);
    
    if (hasMobileService) {
      // For mobile services, use the validated customer address
      const finalAddress = currentGoalData.finalServiceAddress || currentGoalData.customerAddress;
      const customerName = currentGoalData.customerName || '{name}';
      
      return {
        ...currentGoalData,
        finalServiceAddress: finalAddress,
        serviceLocation: 'customer_address',
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.MOBILE_SERVICE_LOCATION', { address: finalAddress, name: customerName })
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
