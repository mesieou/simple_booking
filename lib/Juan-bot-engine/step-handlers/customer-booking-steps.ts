import type { IndividualStepHandler, LLMProcessingResult, ChatContext, ButtonConfig } from '../bot-manager';
import { Service, type ServiceData } from '../../database/models/service';

// Configuration constants for booking steps
const BOOKING_CONFIG = {
  WELCOME_MESSAGE: '👋 Welcome to Beauty Asiul! I can help you book an appointment today. Here are our available services:',
  ERROR_MESSAGES: {
    BUSINESS_CONFIG_ERROR: 'Business configuration error',
    NO_SERVICES_AVAILABLE: 'No services available', 
    SERVICES_LOAD_ERROR: 'Unable to load services at the moment',
    SERVICE_SELECTION_ERROR: 'Could not process service selection.',
    INVALID_SERVICE_SELECTION: 'Please select a valid service from the options provided.',
    NO_SERVICES_TO_CHOOSE: 'No services are currently available to choose from.',
    INVALID_ADDRESS: 'Please provide a valid address.'
  },
  VALIDATION: {
    MIN_ADDRESS_LENGTH: 5
  }
} as const;

// Service data processing utilities
class ServiceDataProcessor {
  
  // Fetches services for a business with proper error handling
  static async fetchServicesForBusiness(businessId: string): Promise<{ services: ServiceData[]; error?: string }> {
    if (!businessId) {
      console.error('[ServiceProcessor] Business ID not found in chat context.');
      return { services: [], error: BOOKING_CONFIG.ERROR_MESSAGES.BUSINESS_CONFIG_ERROR };
    }

    try {
      console.log(`[ServiceProcessor] Fetching services for business: ${businessId}`);
      const services = await Service.getByBusiness(businessId);
      console.log(`[ServiceProcessor] Successfully fetched ${services.length} services`);
      
      if (services.length === 0) {
        console.log(`[ServiceProcessor] No services found for business ${businessId}`);
        return { services: [], error: BOOKING_CONFIG.ERROR_MESSAGES.NO_SERVICES_AVAILABLE };
      }

      const serviceData = services.map(s => s.getData());
      console.log(`[ServiceProcessor] Processed service data:`, serviceData.map(s => ({ 
        id: s.id, 
        name: s.name, 
        price: s.fixedPrice 
      })));
      
      return { services: serviceData };
    } catch (error) {
      console.error(`[ServiceProcessor] Error fetching services for business ${businessId}:`, error);
      return { services: [], error: BOOKING_CONFIG.ERROR_MESSAGES.SERVICES_LOAD_ERROR };
    }
  }

  // Finds a service by ID from available services
  static findServiceById(serviceId: string, availableServices: ServiceData[]): ServiceData | undefined {
    return availableServices.find(service => service.id === serviceId);
  }

  // Extracts essential service details for booking
  static extractServiceDetails(service: ServiceData) {
    return {
      id: service.id,
      name: service.name,
      durationEstimate: service.durationEstimate,
      fixedPrice: service.fixedPrice,
      pricingType: service.pricingType,
      mobile: service.mobile
    };
  }
}

// UI button generation utilities
class BookingButtonGenerator {
  
  // Creates error buttons based on error type
  static createErrorButtons(errorType: string): ButtonConfig[] {
    const errorButtonMap: Record<string, ButtonConfig> = {
      [BOOKING_CONFIG.ERROR_MESSAGES.BUSINESS_CONFIG_ERROR]: {
        buttonText: '❌ System Error - Please contact support',
        buttonValue: 'system_error'
      },
      [BOOKING_CONFIG.ERROR_MESSAGES.NO_SERVICES_AVAILABLE]: {
        buttonText: '📞 Contact us for available services',
        buttonValue: 'contact_support'
      }
    };

    return [errorButtonMap[errorType] || {
      buttonText: '⚠️ Services temporarily unavailable',
      buttonValue: 'services_unavailable'
    }];
  }

  // Creates service selection buttons with pricing and duration
  static createServiceButtons(services: ServiceData[]): ButtonConfig[] {
    return services.map(service => {
      const priceDisplay = service.fixedPrice ? ` - $${service.fixedPrice}` : '';
      const durationDisplay = service.durationEstimate ? ` (${service.durationEstimate}min)` : '';
      
      return {
        buttonText: `${service.name}${priceDisplay}${durationDisplay}`,
        buttonValue: service.id || 'error_service_id_missing'
      };
    });
  }
}

// Validation utilities
class BookingValidator {
  
  // Validates service selection input
  static validateServiceSelection(userInput: string, availableServices: ServiceData[]): LLMProcessingResult {
    if (!availableServices || availableServices.length === 0) {
      return {
        isValidInput: false,
        validationErrorMessage: BOOKING_CONFIG.ERROR_MESSAGES.NO_SERVICES_TO_CHOOSE
      };
    }

    const chosenService = ServiceDataProcessor.findServiceById(userInput, availableServices);
    if (chosenService) {
      return { isValidInput: true };
    }

    return {
      isValidInput: false,
      validationErrorMessage: BOOKING_CONFIG.ERROR_MESSAGES.INVALID_SERVICE_SELECTION
    };
  }

  // Validates address input
  static validateAddress(address: string): LLMProcessingResult {
    if (address.length > BOOKING_CONFIG.VALIDATION.MIN_ADDRESS_LENGTH) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: BOOKING_CONFIG.ERROR_MESSAGES.INVALID_ADDRESS
    };
  }
}

// --- Step Handler Implementations ---

// Displays available services to the customer
export const displayServicesHandler: IndividualStepHandler = {
  defaultChatbotPrompt: BOOKING_CONFIG.WELCOME_MESSAGE,
  
  // Always accept input for service display step
  validateUserInput: async () => true,
  
  // Loads and processes available services
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const businessId = chatContext.currentParticipant.associatedBusinessId;
    const { services, error } = await ServiceDataProcessor.fetchServicesForBusiness(businessId!);
    
    return {
      ...currentGoalData,
      availableServices: services,
      ...(error && { error })
    };
  },
  
  // Creates service selection buttons or error buttons
  fixedUiButtons: async (currentGoalData) => {
    const availableServices = currentGoalData.availableServices as ServiceData[] | undefined;
    const error = currentGoalData.error as string | undefined;

    if (!availableServices || availableServices.length === 0) {
      return BookingButtonGenerator.createErrorButtons(error || '');
    }

    return BookingButtonGenerator.createServiceButtons(availableServices);
  }
};

// Handles service selection from customer
export const getServicesChosenHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please select a service from the list, or tell me what you need.',
  
  // Validates that selected service exists in available options
  validateUserInput: async (userInput, currentGoalData) => {
    const availableServices = currentGoalData.availableServices as ServiceData[] | undefined;
    return BookingValidator.validateServiceSelection(userInput, availableServices || []);
  },
  
  // Processes the selected service and extracts its details
  processAndExtractData: async (validatedInput, currentGoalData) => {
    const availableServices = currentGoalData.availableServices as ServiceData[] | undefined;
    
    if (!availableServices) {
      return { ...currentGoalData, error: BOOKING_CONFIG.ERROR_MESSAGES.SERVICE_SELECTION_ERROR };
    }

    const selectedServiceData = ServiceDataProcessor.findServiceById(validatedInput, availableServices);
    
    if (!selectedServiceData) {
      return { ...currentGoalData, error: BOOKING_CONFIG.ERROR_MESSAGES.SERVICE_SELECTION_ERROR };
    }

    return {
      ...currentGoalData,
      selectedService: ServiceDataProcessor.extractServiceDetails(selectedServiceData)
    };
  }
};

// Collects service address from customer
export const askAddressesForChosenServiceHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Great! To proceed, I need the service address.',
  
  // Validates address input meets minimum requirements
  validateUserInput: async (userInput) => {
    return BookingValidator.validateAddress(userInput);
  },
  
  // Stores the provided service address
  processAndExtractData: async (validatedInput, currentGoalData) => {
    return { ...currentGoalData, serviceAddress: validatedInput };
  }
}; 