import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, ServiceDataProcessor, BookingButtonGenerator, BookingValidator } from './booking-utils';

// Initial service selection handler - selects first service only
export const selectServiceHandler: IndividualStepHandler = {
  
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
        
        // Simple pattern - check goal data, then session, then fallback
        const resolvedCustomerName = currentGoalData.customerName || 
                                    chatContext?.currentConversationSession?.userData?.customerName || 
                                    'there';
        
        console.log('[SelectService] DEBUG - Customer name resolution (first display):', {
          fromGoalData: currentGoalData.customerName,
          fromSession: chatContext?.currentConversationSession?.userData?.customerName,
          finalName: resolvedCustomerName,
          hasGoalData: !!currentGoalData.customerName,
          hasSessionData: !!chatContext?.currentConversationSession?.userData?.customerName
        });
        
        // Create personalized message
        const confirmationMessage = getLocalizedTextWithVars(chatContext, 'MESSAGES.SELECT_SERVICE_PERSONALIZED', { name: resolvedCustomerName });
        
        return { 
          ...currentGoalData, 
          customerName: resolvedCustomerName, // Store the resolved name in goal data
          availableServices: services,
          confirmationMessage,
          listActionText: getLocalizedText(chatContext, 'BUTTONS.SELECT'),
          listSectionTitle: getLocalizedText(chatContext, 'LIST_SECTIONS.SERVICES')
        };
      }
      
      // Services already loaded, show them with personalized message
      // Simple pattern - check goal data, then session, then fallback
      const resolvedCustomerName = currentGoalData.customerName || 
                                  chatContext?.currentConversationSession?.userData?.customerName || 
                                  'there';
      
      console.log('[SelectService] DEBUG - Customer name resolution (services loaded):', {
        fromGoalData: currentGoalData.customerName,
        fromSession: chatContext?.currentConversationSession?.userData?.customerName,
        finalName: resolvedCustomerName,
        hasGoalData: !!currentGoalData.customerName,
        hasSessionData: !!chatContext?.currentConversationSession?.userData?.customerName
      });
      
      const confirmationMessage = getLocalizedTextWithVars(chatContext, 'MESSAGES.SELECT_SERVICE_PERSONALIZED', { name: resolvedCustomerName });
      
      return {
        ...currentGoalData,
        customerName: resolvedCustomerName, // Store the resolved name in goal data
        confirmationMessage,
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
        
        // Simple pattern - check goal data, then session, then fallback
        const customerName = currentGoalData.customerName || 
                            chatContext?.currentConversationSession?.userData?.customerName || 
                            'there';
        
        // Create personalized confirmation message
        let confirmationMessage;
        if (customerName && customerName !== 'there') {
          confirmationMessage = getLocalizedTextWithVars(chatContext, 'MESSAGES.SERVICE_SELECTED_PERSONALIZED', { 
            name: customerName, 
            serviceName: selectedServiceData.name 
          });
        } else {
          confirmationMessage = `Great! You've selected ${selectedServiceData.name}.`;
        }
        
        return {
          ...currentGoalData,
          selectedServices: [extractedService], // Initialize array with first service
          selectedService: extractedService, // Keep for backward compatibility
          confirmationMessage
        };
      }
    }

    console.log('[SelectService] Fallback - returning error state');
    
    // Simple pattern - check goal data, then session, then fallback
    const resolvedCustomerName = currentGoalData.customerName || 
                                chatContext?.currentConversationSession?.userData?.customerName || 
                                'there';
    
    console.log('[SelectService] DEBUG - Customer name resolution (error state):', {
      fromGoalData: currentGoalData.customerName,
      fromSession: chatContext?.currentConversationSession?.userData?.customerName,
      finalName: resolvedCustomerName,
      hasGoalData: !!currentGoalData.customerName,
      hasSessionData: !!chatContext?.currentConversationSession?.userData?.customerName
    });
    
    return { 
      ...currentGoalData, 
      customerName: resolvedCustomerName, // Store the resolved name in goal data
      serviceError: getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.SERVICE_SELECTION_ERROR', { name: resolvedCustomerName })
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
