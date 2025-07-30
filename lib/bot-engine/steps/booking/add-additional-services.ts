import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, ServiceDataProcessor, BookingButtonGenerator, BookingValidator } from './booking-utils';
import { Business } from '@/lib/database/models/business';

// Additional services selection handler - manages multi-service confirmation loop
export const addAdditionalServicesHandler: IndividualStepHandler = {
  autoAdvance: false, // Don't auto-advance to prevent LLM interference
  
  // Validate continuation choice or additional service selection
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    console.log('[AddAdditionalServices] Validating input:', userInput);
    console.log('[AddAdditionalServices] Current state:', currentGoalData.addServicesState);
    
    const addServicesState = currentGoalData.addServicesState || 'confirming';
    
    // If we're in confirmation state, validate continuation choice
    if (addServicesState === 'confirming') {
      return BookingValidator.validateServiceContinuation(userInput, chatContext);
    }
    
    // If we're in selection state, validate service selection
    if (addServicesState === 'selecting') {
      const availableServices = currentGoalData.availableServices || [];
      const selectedServices = currentGoalData.selectedServices || [];
      const filteredServices = ServiceDataProcessor.filterAvailableServices(availableServices, selectedServices);
      
      return BookingValidator.validateServiceSelection(userInput, filteredServices, chatContext);
    }
    
    return { isValidInput: true };
  },
  
  // Handle multi-service selection flow
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const businessId = chatContext.currentParticipant.associatedBusinessId;
    const availableServices = currentGoalData.availableServices || [];
    const selectedServices = currentGoalData.selectedServices || [];
    const addServicesState = currentGoalData.addServicesState || 'confirming';

    console.log('[AddAdditionalServices] Processing state:', addServicesState);
    console.log('[AddAdditionalServices] Selected services count:', selectedServices.length);
    console.log('[AddAdditionalServices] Validated input:', validatedInput);

    // Handle first display - show confirmation state
    if (validatedInput === "" && addServicesState === 'confirming') {
      console.log('[AddAdditionalServices] Displaying initial confirmation state');
      
      // Create confirmation message showing selected services
      const servicesList = ServiceDataProcessor.formatSelectedServicesList(selectedServices, chatContext);
      const customerName = currentGoalData.customerName || '{name}';
      let confirmationMessage;
      
      if (selectedServices.length === 1) {
        confirmationMessage = getLocalizedTextWithVars(chatContext, 'MESSAGES.SERVICE_SELECTED', {
          name: customerName,
          serviceName: selectedServices[0].name
        }) + '\n\n' + getLocalizedTextWithVars(chatContext, 'MESSAGES.ADD_MORE_SERVICES', { name: customerName });
      } else {
        confirmationMessage = getLocalizedTextWithVars(chatContext, 'MESSAGES.SERVICES_SELECTED', {
          name: customerName,
          servicesList: servicesList
        }) + '\n\n' + getLocalizedTextWithVars(chatContext, 'MESSAGES.ADD_MORE_SERVICES', { name: customerName });
      }
      
      return {
        ...currentGoalData,
        addServicesState: 'confirming',
        confirmationMessage
      };
    }

    // Handle return to selection state (when showing available services)
    if (validatedInput === "" && addServicesState === 'selecting') {
      const filteredServices = ServiceDataProcessor.filterAvailableServices(availableServices, selectedServices);
      const customerName = currentGoalData.customerName || '{name}';
      return {
        ...currentGoalData,
        addServicesState: 'selecting',
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.SELECT_SERVICE_PERSONALIZED', { name: customerName }),
        listActionText: getLocalizedText(chatContext, 'BUTTONS.SELECT'),
        listSectionTitle: getLocalizedText(chatContext, 'LIST_SECTIONS.SERVICES')
      };
    }

    // Handle continuation choice (add more or continue)
    if (addServicesState === 'confirming') {
      if (validatedInput === 'add_another_service') {
        console.log('[AddAdditionalServices] User wants to add another service');
        const filteredServices = ServiceDataProcessor.filterAvailableServices(availableServices, selectedServices);
        
        if (filteredServices.length === 0) {
          // No more services available - keep in confirmation state
          const customerName = currentGoalData.customerName || '{name}';
          return {
            ...currentGoalData,
            addServicesState: 'confirming',
            confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.MULTIPLE_SERVICES_CONFIRMED', {
              name: customerName,
              count: selectedServices.length.toString()
            })
          };
        }
        
        // Switch to selection state to show remaining services
        const customerName = currentGoalData.customerName || '{name}';
        return {
          ...currentGoalData,
          addServicesState: 'selecting',
          confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.SELECT_SERVICE_PERSONALIZED', { name: customerName }),
          listActionText: getLocalizedText(chatContext, 'BUTTONS.SELECT'),
          listSectionTitle: getLocalizedText(chatContext, 'LIST_SECTIONS.SERVICES')
        };
      }
      
      if (validatedInput === 'continue_with_services') {
        console.log('[AddAdditionalServices] User wants to continue with selected services');
        console.log('[AddAdditionalServices] Selected services:', selectedServices.map((s: any) => ({ name: s.name, mobile: s.mobile })));
        
        // Prepare final service data for next steps
        let finalServiceAddress;
        let serviceLocation;
        
        // Check if any service is mobile to determine location handling
        const hasMobileService = selectedServices.some((service: any) => service.mobile);
        const hasNonMobileService = selectedServices.some((service: any) => !service.mobile);
        
        console.log('[AddAdditionalServices] Service types - Mobile:', hasMobileService, 'Non-mobile:', hasNonMobileService);
        console.log('[AddAdditionalServices] DEBUG - Service mobile flags:', selectedServices.map((s: any) => ({
          name: s.name,
          mobile: s.mobile,
          mobileType: typeof s.mobile,
          notMobile: !s.mobile
        })));
        
        if (hasNonMobileService && !currentGoalData.finalServiceAddress) {
          // For services with non-mobile components, use business address
          // BUT only if we don't already have a pickup address
          let businessAddress = 'Our location';
          
          if (businessId) {
            try {
              const business = await Business.getById(businessId);
              businessAddress = business?.businessAddress || business?.name || 'Our location';
              console.log('[AddAdditionalServices] Business address resolved:', businessAddress);
            } catch (error) {
              console.error('[AddAdditionalServices] Error fetching business address:', error);
            }
          }
          
          finalServiceAddress = businessAddress;
          serviceLocation = 'business_address';
        } else if (currentGoalData.finalServiceAddress) {
          // Preserve existing pickup address
          finalServiceAddress = currentGoalData.finalServiceAddress;
          serviceLocation = 'customer_address';
        } else if (hasMobileService && !hasNonMobileService) {
          // All services are mobile - will need customer address later
          console.log('[AddAdditionalServices] All services are mobile - address will be requested later');
          serviceLocation = 'customer_address';
          // Don't set finalServiceAddress here - let confirmLocation or askAddress handle it
        }
        
        console.log('[AddAdditionalServices] Final service address:', finalServiceAddress);
        console.log('[AddAdditionalServices] Service location type:', serviceLocation);
        
        return {
          ...currentGoalData,
          selectedServices,
          selectedService: selectedServices[0], // Keep first service for backward compatibility
          finalServiceAddress,
          serviceLocation,
          addServicesState: 'completed', // Mark as completed
          servicesChanged: true, // Simple flag - let flow controller handle the rest
          confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.MULTIPLE_SERVICES_CONFIRMED', {
            name: currentGoalData.customerName || '{name}',
            count: selectedServices.length.toString()
          })
        };
      }
    }
    
    // Handle additional service selection
    if (addServicesState === 'selecting' && validatedInput) {
      console.log('[AddAdditionalServices] Processing additional service selection:', validatedInput);
      console.log('[AddAdditionalServices] Current selectedServices before adding:', selectedServices.map((s: any) => s.name));
      
      const filteredServices = ServiceDataProcessor.filterAvailableServices(availableServices, selectedServices);
      const selectedServiceData = ServiceDataProcessor.findServiceById(validatedInput, filteredServices);
      
      if (selectedServiceData) {
        console.log('[AddAdditionalServices] Service found:', selectedServiceData.name);
        
        const newSelectedServices = [
          ...selectedServices,
          ServiceDataProcessor.extractServiceDetails(selectedServiceData)
        ];
        
        console.log('[AddAdditionalServices] New selectedServices after adding:', newSelectedServices.map((s: any) => s.name));
        
        // Create confirmation message showing all selected services
        const servicesList = ServiceDataProcessor.formatSelectedServicesList(newSelectedServices, chatContext);
        const customerName = currentGoalData.customerName || '{name}';
        const confirmationMessage = getLocalizedTextWithVars(chatContext, 'MESSAGES.SERVICES_SELECTED', {
          name: customerName,
          servicesList: servicesList
        }) + '\n\n' + getLocalizedTextWithVars(chatContext, 'MESSAGES.ADD_MORE_SERVICES', { name: customerName });
        
        console.log('[AddAdditionalServices] Returning data with services:', newSelectedServices.map((s: any) => s.name));
        
        return {
          ...currentGoalData,
          selectedServices: newSelectedServices,
          selectedService: newSelectedServices[0], // Keep first service for backward compatibility
          addServicesState: 'confirming', // Return to confirmation state
          servicesChanged: true, // Simple flag - let flow controller handle the rest
          confirmationMessage
        };
      }
    }

    console.log('[AddAdditionalServices] Fallback - returning current state');
    return currentGoalData;
  },
  
  // Generate appropriate buttons based on current state
  fixedUiButtons: async (currentGoalData, chatContext) => {
    const addServicesState = currentGoalData.addServicesState || 'confirming';
    const availableServices = currentGoalData.availableServices || [];
    const selectedServices = currentGoalData.selectedServices || [];
    
    // If in confirmation state, show continuation buttons
    if (addServicesState === 'confirming') {
      return BookingButtonGenerator.createServiceContinuationButtons(chatContext);
    }
    
    // If in selection state, show available service buttons (filtered)
    if (addServicesState === 'selecting' && availableServices.length > 0) {
      const filteredServices = ServiceDataProcessor.filterAvailableServices(availableServices, selectedServices);
      console.log('[AddAdditionalServices] Creating service buttons for:', filteredServices.length, 'filtered services');
      
      if (filteredServices.length === 0) {
        // No more services to select, show continuation buttons
        return BookingButtonGenerator.createServiceContinuationButtons(chatContext);
      }
      
      const buttons = BookingButtonGenerator.createServiceButtons(filteredServices);
      console.log('[AddAdditionalServices] Created buttons:', buttons.map((b: any) => ({ text: b.buttonText, desc: b.buttonDescription })));
      return buttons;
    }
    
    return []; // No buttons if not in a valid state
  }
}; 