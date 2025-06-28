import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, ServiceDataProcessor, BookingButtonGenerator, BookingValidator } from './booking-utils';
import { Business } from '@/lib/database/models/business';

// Combined service display and selection - single responsibility
export const selectServiceHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Service selection', // This will be overridden by confirmationMessage
  
  // Use booking validator for intelligent matching
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    console.log('[SelectService] Validating input:', userInput);
    return BookingValidator.validateServiceSelection(userInput, currentGoalData.availableServices, chatContext);
  },
  
  // Fetch services on first display, or process selection
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const { businessId, availableServices } = {
      businessId: chatContext.currentParticipant.associatedBusinessId,
      availableServices: currentGoalData.availableServices || []
    };

    // If first display (validatedInput is empty), fetch and/or display services
    if (validatedInput === "") {
      // If services aren't loaded yet, fetch them.
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
      
      // If services are already loaded, just return them for display.
      return {
        ...currentGoalData,
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.SELECT_SERVICE'),
        listActionText: getLocalizedText(chatContext, 'BUTTONS.SELECT'),
        listSectionTitle: getLocalizedText(chatContext, 'LIST_SECTIONS.SERVICES')
      }
    }
    
    // Process validated service selection (which is an ID from the validator)
    console.log('[SelectService] Processing validated selection:', validatedInput);
    const selectedServiceData = ServiceDataProcessor.findServiceById(validatedInput, availableServices);
    
    if (selectedServiceData) {
      console.log('[SelectService] Service found:', selectedServiceData.name);
      
      let finalServiceAddress;
      let serviceLocation;
      
      if (!selectedServiceData.mobile) {
        // For non-mobile services, fetch actual business address
        const businessId = chatContext.currentParticipant.associatedBusinessId;
        let businessAddress = 'Our salon location';
        
        if (businessId) {
          try {
            const business = await Business.getById(businessId);
            businessAddress = business.businessAddress || business.name || 'Our salon location';
          } catch (error) {
            console.error('[SelectService] Error fetching business address:', error);
          }
        }
        
        finalServiceAddress = businessAddress;
        serviceLocation = 'business_address';
      }
      
      return {
        ...currentGoalData,
        selectedService: ServiceDataProcessor.extractServiceDetails(selectedServiceData),
        finalServiceAddress,
        serviceLocation,
      };
    }

    console.log('[SelectService] Service not found after validation, should not happen');
    return { 
      ...currentGoalData, 
      serviceError: getLocalizedText(chatContext, 'ERROR_MESSAGES.SERVICE_SELECTION_ERROR')
    };
  },
  
  // Generate service buttons from fetched data
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.serviceError) {
      return BookingButtonGenerator.createErrorButtons(currentGoalData.serviceError, chatContext);
    }
    
    if (!currentGoalData.availableServices) {
      return []; // No buttons if services not loaded yet
    }
    
    console.log('[SelectService] Creating service buttons for:', currentGoalData.availableServices.length, 'services');
    const buttons = BookingButtonGenerator.createServiceButtons(currentGoalData.availableServices);
    console.log('[SelectService] Created buttons:', buttons.map(b => ({ text: b.buttonText, desc: b.buttonDescription })));
    return buttons;
  }
};
