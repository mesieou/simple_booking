import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, ServiceDataProcessor, BookingButtonGenerator, BookingValidator } from './booking-utils';

// Initial service selection handler - selects first service only
export const selectServiceHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please select a service from the list below:',
  
  // Validate service selection
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    console.log('[SelectService] Validating input:', userInput);
    
    const availableServices = currentGoalData.availableServices || [];
    return BookingValidator.validateServiceSelection(userInput, availableServices, chatContext);
  },
  
  // Handle initial service selection
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const businessId = chatContext.currentParticipant.associatedBusinessId;
    const availableServices = currentGoalData.availableServices || [];

    console.log('[SelectService] Processing initial service selection');
    console.log('[SelectService] Validated input:', validatedInput);

    // Handle first display - fetch services if needed
    if (validatedInput === "") {
      if (availableServices.length === 0) {
        console.log('[SelectService] First time display - fetching services');
        const { services, error } = await ServiceDataProcessor.fetchServicesForBusiness(businessId as string, chatContext);
        
        if (error) {
          return { ...currentGoalData, serviceError: error };
        }
        
        return { 
          ...currentGoalData, 
          availableServices: services,
          confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.SELECT_SERVICE'),
          listActionText: getLocalizedText(chatContext, 'BUTTONS.SELECT'),
          listSectionTitle: getLocalizedText(chatContext, 'LIST_SECTIONS.SERVICES')
        };
      }
      
      // Services already loaded, show them
      return {
        ...currentGoalData,
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.SELECT_SERVICE'),
        listActionText: getLocalizedText(chatContext, 'BUTTONS.SELECT'),
        listSectionTitle: getLocalizedText(chatContext, 'LIST_SECTIONS.SERVICES')
      };
    }
    
    // Handle service selection
    if (validatedInput) {
      console.log('[SelectService] Processing service selection:', validatedInput);
      const selectedServiceData = ServiceDataProcessor.findServiceById(validatedInput, availableServices);
      
      if (selectedServiceData) {
        console.log('[SelectService] Service found:', selectedServiceData.name);
        
        const extractedService = ServiceDataProcessor.extractServiceDetails(selectedServiceData);
        
        return {
          ...currentGoalData,
          selectedServices: [extractedService], // Initialize array with first service
          selectedService: extractedService, // Keep for backward compatibility
          confirmationMessage: `Great! You've selected ${selectedServiceData.name}.`
        };
      }
    }

    console.log('[SelectService] Fallback - returning error state');
    return { 
      ...currentGoalData, 
      serviceError: getLocalizedText(chatContext, 'ERROR_MESSAGES.SERVICE_SELECTION_ERROR')
    };
  },
  
  // Generate service selection buttons
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.serviceError) {
      return BookingButtonGenerator.createErrorButtons(currentGoalData.serviceError, chatContext);
    }
    
    const availableServices = currentGoalData.availableServices || [];
    
    if (availableServices.length > 0) {
      console.log('[SelectService] Creating service buttons for:', availableServices.length, 'services');
      const buttons = BookingButtonGenerator.createServiceButtons(availableServices);
      console.log('[SelectService] Created buttons:', buttons.map(b => ({ text: b.buttonText, desc: b.buttonDescription })));
      return buttons;
    }
    
    return []; // No buttons if services not loaded yet
  }
};
