import type { IndividualStepHandler, LLMProcessingResult, ChatContext, ButtonConfig } from '../bot-manager';
import { Service, type ServiceData } from '../../database/models/service';
import { Business } from '../../database/models/business';

// Configuration constants for booking steps
const BOOKING_CONFIG = {
  WELCOME_MESSAGE: '👋 Welcome to Beauty Asiul! I can help you book an appointment today.',
  ADDRESS_REQUEST_MESSAGE: '📍 To show you accurate pricing and availability, I need your address first.',
  ADDRESS_CONFIRMATION_MESSAGE: '✅ Perfect! Here are our available services with pricing:',
  BUSINESS_ADDRESS_MESSAGE: '📍 Great choice! Our service is available at our location:',
  ERROR_MESSAGES: {
    BUSINESS_CONFIG_ERROR: 'Business configuration error',
    NO_SERVICES_AVAILABLE: 'No services available', 
    SERVICES_LOAD_ERROR: 'Unable to load services at the moment',
    SERVICE_SELECTION_ERROR: 'Could not process service selection.',
    INVALID_SERVICE_SELECTION: 'Please select a valid service from the options provided.',
    NO_SERVICES_TO_CHOOSE: 'No services are currently available to choose from.',
    INVALID_ADDRESS: 'Please provide a valid address with street, suburb, and postcode.',
    ADDRESS_VALIDATION_FAILED: 'We couldn\'t validate that address. Please check and try again.'
  },
  VALIDATION: {
    MIN_ADDRESS_LENGTH: 10,
    REQUIRED_ADDRESS_COMPONENTS: ['street', 'suburb']
  }
} as const;

// Address validation utilities
class AddressValidator {
  
  // Validates address format and completeness
  static validateAddress(address: string): LLMProcessingResult {
    if (address.length < BOOKING_CONFIG.VALIDATION.MIN_ADDRESS_LENGTH) {
      return {
        isValidInput: false,
        validationErrorMessage: BOOKING_CONFIG.ERROR_MESSAGES.INVALID_ADDRESS
      };
    }
    
    // Check for basic address components
    const lowercaseAddress = address.toLowerCase();
    const hasStreetInfo = /\d+.*[a-zA-Z]/.test(address); // Has numbers followed by letters (street number + name)
    const hasSuburb = lowercaseAddress.split(' ').length >= 3; // Minimum words for proper address
    
    if (hasStreetInfo && hasSuburb) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: BOOKING_CONFIG.ERROR_MESSAGES.INVALID_ADDRESS
    };
  }

  // Simulates Google Address validation (placeholder for actual API integration)
  static async validateWithGoogleAPI(address: string): Promise<{
    isValid: boolean;
    formattedAddress?: string;
    errorMessage?: string;
  }> {
    // TODO: Integrate with Google Places API
    // For now, return mock validation
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
    
    const basicValidation = AddressValidator.validateAddress(address);
    if (!basicValidation.isValidInput) {
      return {
        isValid: false,
        errorMessage: basicValidation.validationErrorMessage
      };
    }
    
    // Mock successful validation with formatted address
    return {
      isValid: true,
      formattedAddress: address.trim().replace(/\s+/g, ' ')
    };
  }
}

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
        price: s.fixedPrice,
        mobile: s.mobile
      })));
      
      return { services: serviceData };
    } catch (error) {
      console.error(`[ServiceProcessor] Error fetching services for business ${businessId}:`, error);
      return { services: [], error: BOOKING_CONFIG.ERROR_MESSAGES.SERVICES_LOAD_ERROR };
    }
  }

  // Checks if any services are mobile
  static hasMobileServices(services: ServiceData[]): boolean {
    return services.some(service => service.mobile === true);
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
      const mobileIcon = service.mobile ? '🚗 ' : '🏪 ';
      
      return {
        buttonText: `${mobileIcon}${service.name}${priceDisplay}${durationDisplay}`,
        buttonValue: service.id || 'error_service_id_missing'
      };
    });
  }

  // Creates address confirmation buttons
  static createAddressConfirmationButtons(): ButtonConfig[] {
    return [
      { buttonText: '✅ Yes, that\'s correct', buttonValue: 'address_confirmed' },
      { buttonText: '✏️ No, let me edit it', buttonValue: 'address_edit' }
    ];
  }
}

// Validation utilities
class BookingValidator {
  
  // Validates service selection input
  static validateServiceSelection(userInput: string, availableServices: ServiceData[]): LLMProcessingResult {
    console.log('[BookingValidator] Validating service selection:');
    console.log('[BookingValidator] User input:', userInput);
    console.log('[BookingValidator] Available services:', availableServices?.map(s => ({ id: s.id, name: s.name })));
    
    if (!availableServices || availableServices.length === 0) {
      console.log('[BookingValidator] No available services found');
      return {
        isValidInput: false,
        validationErrorMessage: BOOKING_CONFIG.ERROR_MESSAGES.NO_SERVICES_TO_CHOOSE
      };
    }

    const chosenService = ServiceDataProcessor.findServiceById(userInput, availableServices);
    console.log('[BookingValidator] Found service:', chosenService ? { id: chosenService.id, name: chosenService.name } : 'NOT FOUND');
    
    if (chosenService) {
      return { isValidInput: true };
    }

    console.log('[BookingValidator] Service validation failed - service not found');
    return {
      isValidInput: false,
      validationErrorMessage: BOOKING_CONFIG.ERROR_MESSAGES.INVALID_SERVICE_SELECTION
    };
  }
}

// --- Step Handler Implementations ---

// Asks for customer address - single responsibility
export const askAddressHandler: IndividualStepHandler = {
  defaultChatbotPrompt: BOOKING_CONFIG.ADDRESS_REQUEST_MESSAGE,
  
  // Validates address input meets requirements
  validateUserInput: async (userInput) => {
    return AddressValidator.validateAddress(userInput);
  },
  
  // Simply stores the address
  processAndExtractData: async (validatedInput, currentGoalData) => {
    return { ...currentGoalData, customerAddress: validatedInput };
  }
};

// Validates customer address with Google API - single responsibility
export const validateAddressHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Let me validate your address...',
  
  // Handle address confirmation or re-entry
  validateUserInput: async (userInput, currentGoalData) => {
    // If we haven't validated yet, always accept to trigger validation
    if (!currentGoalData.addressValidated && !currentGoalData.addressValidationError) {
      return { isValidInput: true };
    }
    
    // Handle user response to address confirmation
    if (userInput === 'address_confirmed') {
      return { isValidInput: true };
    } else if (userInput === 'address_edit' || userInput === 'retry_address') {
      return { 
        isValidInput: false, 
        validationErrorMessage: 'Please provide the correct address:' 
      };
    }
    
    return { isValidInput: true };
  },
  
  // Validates address through Google API
  processAndExtractData: async (validatedInput, currentGoalData) => {
    // If user wants to edit, reset validation
    if (validatedInput === 'address_edit' || validatedInput === 'retry_address') {
      return { 
        ...currentGoalData, 
        customerAddress: undefined,
        addressValidated: false,
        addressValidationError: undefined
      };
    }
    
    // If user confirmed address, mark as confirmed
    if (validatedInput === 'address_confirmed') {
      return { ...currentGoalData, addressConfirmed: true };
    }
    
    // If we haven't validated yet, validate the address
    if (!currentGoalData.addressValidated && !currentGoalData.addressValidationError) {
      const addressToValidate = currentGoalData.customerAddress as string;
      const validationResult = await AddressValidator.validateWithGoogleAPI(addressToValidate);
      
      if (validationResult.isValid) {
        return {
          ...currentGoalData,
          validatedCustomerAddress: validationResult.formattedAddress,
          addressValidated: true
        };
      } else {
        return {
          ...currentGoalData,
          addressValidationError: validationResult.errorMessage,
          addressValidated: false
        };
      }
    }
    
    return currentGoalData;
  },
  
  // Show appropriate buttons based on validation state
  fixedUiButtons: async (currentGoalData) => {
    // If address validation succeeded, show confirmation buttons
    if (currentGoalData.addressValidated && !currentGoalData.addressConfirmed) {
      return BookingButtonGenerator.createAddressConfirmationButtons();
    }
    
    // If address validation failed, show retry button
    if (currentGoalData.addressValidated === false) {
      return [{ buttonText: '🔄 Try again', buttonValue: 'retry_address' }];
    }
    
    // No buttons needed (either validating or confirmed)
    return [];
  }
};

// Combined service display and selection - single responsibility
export const selectServiceHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here are our available services:',
  
  // Validates service selection (or accepts first-time display)
  validateUserInput: async (userInput, currentGoalData) => {
    console.log('[SelectService] Validating input:', userInput);
    
    // If this is the first time (empty input), just display services
    if (!userInput || userInput === "") {
      console.log('[SelectService] First time display - no validation needed');
      return { isValidInput: true };
    }
    
    // Otherwise validate the service selection
    const availableServices = currentGoalData.availableServices as ServiceData[] | undefined;
    console.log('[SelectService] Available services for validation:', availableServices?.map(s => ({ id: s.id, name: s.name })));
    
    if (!availableServices || availableServices.length === 0) {
      console.log('[SelectService] ERROR: No services available for validation');
      return {
        isValidInput: false,
        validationErrorMessage: BOOKING_CONFIG.ERROR_MESSAGES.NO_SERVICES_TO_CHOOSE
      };
    }
    
    const validationResult = BookingValidator.validateServiceSelection(userInput, availableServices);
    console.log('[SelectService] Validation result:', validationResult);
    return validationResult;
  },
  
  // Loads services and processes selection
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[SelectService] Processing input:', validatedInput);
    
    // Load services if not already available
    let availableServices = currentGoalData.availableServices as ServiceData[] | undefined;
    
    if (!availableServices || availableServices.length === 0) {
      console.log('[SelectService] Loading services from database...');
      const businessId = chatContext.currentParticipant.associatedBusinessId;
      if (businessId) {
        const { services, error } = await ServiceDataProcessor.fetchServicesForBusiness(businessId);
        if (services && services.length > 0) {
          availableServices = services;
          console.log('[SelectService] Successfully loaded services:', services.map(s => ({ id: s.id, name: s.name })));
        } else {
          console.log('[SelectService] Failed to load services:', error);
          return {
            ...currentGoalData,
            error: error || 'No services available'
          };
        }
      }
    }
    
    // If this is first time (no input) or empty input, just prepare services for display
    if (!validatedInput || validatedInput === "") {
      console.log('[SelectService] First time display - showing services');
      return {
        ...currentGoalData,
        availableServices: availableServices
      };
    }
    
    // Process the service selection
    const selectedServiceData = ServiceDataProcessor.findServiceById(validatedInput, availableServices || []);
    
    if (!selectedServiceData) {
      console.log('[SelectService] ERROR: Service not found by ID:', validatedInput);
      return { 
        ...currentGoalData, 
        availableServices: availableServices,
        error: BOOKING_CONFIG.ERROR_MESSAGES.SERVICE_SELECTION_ERROR 
      };
    }

    console.log('[SelectService] Successfully selected service:', selectedServiceData.name);
    return {
      ...currentGoalData,
      availableServices: availableServices,
      selectedService: ServiceDataProcessor.extractServiceDetails(selectedServiceData)
    };
  },
  
  // Creates service selection buttons
  fixedUiButtons: async (currentGoalData) => {
    const availableServices = currentGoalData.availableServices as ServiceData[] | undefined;
    const error = currentGoalData.error as string | undefined;

    if (!availableServices || availableServices.length === 0) {
      console.log('[SelectService] No services found, showing error buttons');
      return BookingButtonGenerator.createErrorButtons(error || 'No services available');
    }

    console.log('[SelectService] Creating service buttons for:', availableServices.length, 'services');
    const buttons = BookingButtonGenerator.createServiceButtons(availableServices);
    return buttons;
  }
};

// Confirms final service location - single responsibility
export const confirmLocationHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Perfect! Let me confirm your service details...',
  
  // Always accept input for location confirmation
  validateUserInput: async () => true,
  
  // Determines and confirms final service location
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const selectedService = currentGoalData.selectedService;
    
    if (selectedService?.mobile) {
      // For mobile services, use the customer address
      const finalAddress = currentGoalData.validatedCustomerAddress || currentGoalData.customerAddress;
      return {
        ...currentGoalData,
        finalServiceAddress: finalAddress,
        serviceLocation: 'customer_address',
        confirmationMessage: `🚗 Excellent! We'll come to you at:\n📍 ${finalAddress}`
      };
    } else {
      // For non-mobile services, use business address from database
      const businessId = chatContext.currentParticipant.associatedBusinessId;
      let businessAddress = 'Our salon location'; // Fallback
      
      if (businessId) {
        try {
          const business = await Business.getById(businessId);
          businessAddress = business.businessAddress || business.name;
        } catch (error) {
          console.error('[ConfirmLocation] Error fetching business address:', error);
          businessAddress = 'Our salon location';
        }
      }
      
      return {
        ...currentGoalData,
        finalServiceAddress: businessAddress,
        serviceLocation: 'business_address',
        confirmationMessage: `🏪 Great! Your appointment will be at our salon:\n📍 ${businessAddress}`
      };
    }
  }
};

// Displays booking quote - single responsibility
export const displayQuoteHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here\'s your booking quote:',
  
  // Always accept input for quote display
  validateUserInput: async () => true,
  
  // Calculate and display quote
  processAndExtractData: async (validatedInput, currentGoalData) => {
    const selectedService = currentGoalData.selectedService;
    const serviceLocation = currentGoalData.serviceLocation;
    
    // Calculate total cost
    let totalCost = selectedService?.fixedPrice || 0;
    let travelCost = 0;
    
    // For mobile services, add travel cost (if any)
    if (serviceLocation === 'customer_address') {
      travelCost = 25; // Mock travel cost
      totalCost += travelCost;
    }
    
    return {
      ...currentGoalData,
      quote: {
        serviceCost: selectedService?.fixedPrice || 0,
        travelCost,
        totalCost,
        duration: selectedService?.durationEstimate || 60
      }
    };
  }
};

// Displays detailed quote breakdown - single responsibility
export const displayQuoteInDetailHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here\'s the detailed breakdown:',
  
  // Always accept input
  validateUserInput: async () => true,
  
  // Show detailed quote breakdown
  processAndExtractData: async (validatedInput, currentGoalData) => {
    const quote = currentGoalData.quote;
    const selectedService = currentGoalData.selectedService;
    
    return {
      ...currentGoalData,
      quoteDetails: {
        serviceName: selectedService?.name,
        duration: `${quote?.duration || 60} minutes`,
        serviceCost: `$${quote?.serviceCost || 0}`,
        travelCost: quote?.travelCost ? `$${quote.travelCost}` : 'No travel cost',
        totalCost: `$${quote?.totalCost || 0}`
      }
    };
  }
};

// Asks customer to confirm booking - single responsibility
export const askToBookHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Would you like to proceed with this booking?',
  
  // Validates booking confirmation
  validateUserInput: async (userInput) => {
    const confirmation = userInput.toLowerCase();
    if (confirmation.includes('yes') || confirmation.includes('book') || confirmation.includes('confirm')) {
      return { isValidInput: true };
    }
    if (confirmation.includes('no') || confirmation.includes('cancel')) {
      return { isValidInput: true };
    }
    return {
      isValidInput: false,
      validationErrorMessage: 'Please confirm if you\'d like to proceed with the booking (yes/no).'
    };
  },
  
  // Process booking confirmation
  processAndExtractData: async (validatedInput, currentGoalData) => {
    const confirmation = validatedInput.toLowerCase();
    const wantsToBook = confirmation.includes('yes') || confirmation.includes('book') || confirmation.includes('confirm');
    
    return {
      ...currentGoalData,
      bookingConfirmed: wantsToBook
    };
  },
  
  // Show confirmation buttons
  fixedUiButtons: async () => {
    return [
      { buttonText: '✅ Yes, book it!', buttonValue: 'yes_book' },
      { buttonText: '❌ No, cancel', buttonValue: 'no_cancel' }
    ];
  }
};

// Displays next available appointment times - single responsibility
export const displayNextAvailableTimesHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here are the next available appointment times:',
  
  // Always accept input
  validateUserInput: async () => true,
  
  // Get available times (mock implementation)
  processAndExtractData: async (validatedInput, currentGoalData) => {
    // Mock available times for the next 7 days
    const availableTimes = [];
    const today = new Date();
    
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      availableTimes.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
        times: ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM']
      });
    }
    
    return {
      ...currentGoalData,
      availableTimes
    };
  }
};

// Gets selected date from customer - single responsibility
export const getDateHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please select your preferred date:',
  
  // Validates date selection
  validateUserInput: async (userInput, currentGoalData) => {
    const availableTimes = currentGoalData.availableTimes || [];
    const selectedDate = availableTimes.find((time: any) => time.date === userInput);
    
    if (selectedDate) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select a valid date from the available options.'
    };
  },
  
  // Stores selected date
  processAndExtractData: async (validatedInput, currentGoalData) => {
    const availableTimes = currentGoalData.availableTimes || [];
    const selectedDate = availableTimes.find((time: any) => time.date === validatedInput);
    
    return {
      ...currentGoalData,
      selectedDate: validatedInput,
      selectedDateInfo: selectedDate
    };
  },
  
  // Show date buttons
  fixedUiButtons: async (currentGoalData) => {
    const availableTimes = currentGoalData.availableTimes || [];
    return availableTimes.map((time: any) => ({
      buttonText: `${time.dayName} (${time.date})`,
      buttonValue: time.date
    }));
  }
};

// Displays available hours for selected day - single responsibility
export const displayAvailableHoursPerDayHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here are the available times for your selected date:',
  
  // Always accept input
  validateUserInput: async () => true,
  
  // Get available hours for selected date
  processAndExtractData: async (validatedInput, currentGoalData) => {
    const selectedDateInfo = currentGoalData.selectedDateInfo;
    
    return {
      ...currentGoalData,
      availableHours: selectedDateInfo?.times || []
    };
  }
};

// Gets selected time from customer - single responsibility
export const getTimeHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please select your preferred time:',
  
  // Validates time selection
  validateUserInput: async (userInput, currentGoalData) => {
    const availableHours = currentGoalData.availableHours || [];
    
    if (availableHours.includes(userInput)) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select a valid time from the available options.'
    };
  },
  
  // Stores selected time
  processAndExtractData: async (validatedInput, currentGoalData) => {
    return {
      ...currentGoalData,
      selectedTime: validatedInput
    };
  },
  
  // Show time buttons
  fixedUiButtons: async (currentGoalData) => {
    const availableHours = currentGoalData.availableHours || [];
    return availableHours.map((time: string) => ({
      buttonText: time,
      buttonValue: time
    }));
  }
};

// Checks if customer is new or existing - single responsibility
export const isNewUserHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Are you a new customer or do you have an account with us?',
  
  // Validates user type selection
  validateUserInput: async (userInput) => {
    const response = userInput.toLowerCase();
    if (response.includes('new') || response.includes('existing') || response.includes('have')) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please let me know if you\'re a new customer or existing customer.'
    };
  },
  
  // Determines if user is new
  processAndExtractData: async (validatedInput, currentGoalData) => {
    const response = validatedInput.toLowerCase();
    const isNewUser = response.includes('new');
    
    return {
      ...currentGoalData,
      isNewUser
    };
  },
  
  // Show user type buttons
  fixedUiButtons: async () => {
    return [
      { buttonText: '👤 New customer', buttonValue: 'new_customer' },
      { buttonText: '🔄 Existing customer', buttonValue: 'existing_customer' }
    ];
  }
};

// Asks for customer email - single responsibility
export const askEmailHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please provide your email address for booking confirmation:',
  
  // Validates email format
  validateUserInput: async (userInput) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (emailRegex.test(userInput)) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please provide a valid email address.'
    };
  },
  
  // Stores email
  processAndExtractData: async (validatedInput, currentGoalData) => {
    return {
      ...currentGoalData,
      customerEmail: validatedInput.trim().toLowerCase()
    };
  }
};

// Validates customer email - single responsibility
export const validateEmailHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Let me confirm your email address...',
  
  // Always accept input for email validation
  validateUserInput: async () => true,
  
  // Confirm email is valid
  processAndExtractData: async (validatedInput, currentGoalData) => {
    return {
      ...currentGoalData,
      emailValidated: true
    };
  }
};

// Creates the actual booking - single responsibility
export const createBookingHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Creating your booking...',
  
  // Always accept input for booking creation
  validateUserInput: async () => true,
  
  // Create booking in database
  processAndExtractData: async (validatedInput, currentGoalData) => {
    // Mock booking creation
    const bookingId = `BK-${Date.now()}`;
    
    return {
      ...currentGoalData,
      bookingId,
      bookingCreated: true,
      bookingDetails: {
        id: bookingId,
        service: currentGoalData.selectedService?.name,
        date: currentGoalData.selectedDate,
        time: currentGoalData.selectedTime,
        location: currentGoalData.finalServiceAddress,
        email: currentGoalData.customerEmail,
        status: 'confirmed'
      }
    };
  }
};

// Displays booking confirmation - single responsibility
export const displayConfirmedBookingHandler: IndividualStepHandler = {
  defaultChatbotPrompt: '✅ Booking confirmed! Here are your booking details:',
  
  // Always accept input
  validateUserInput: async () => true,
  
  // Show booking confirmation
  processAndExtractData: async (validatedInput, currentGoalData) => {
    const booking = currentGoalData.bookingDetails;
    
    return {
      ...currentGoalData,
      confirmationMessage: `Your booking is confirmed!\n\n📅 Service: ${booking?.service}\n🗓️ Date: ${booking?.date}\n⏰ Time: ${booking?.time}\n📍 Location: ${booking?.location}\n📧 Confirmation sent to: ${booking?.email}\n\nBooking ID: ${booking?.id}`
    };
  }
};

// Sends email confirmation - single responsibility
export const sendEmailBookingConfirmationHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Sending booking confirmation email...',
  
  // Always accept input
  validateUserInput: async () => true,
  
  // Send confirmation email (mock)
  processAndExtractData: async (validatedInput, currentGoalData) => {
    // Mock email sending
    console.log(`[EmailService] Sending confirmation to: ${currentGoalData.customerEmail}`);
    
    return {
      ...currentGoalData,
      emailSent: true,
      completionMessage: 'Thank you! Your booking is confirmed and a confirmation email has been sent.'
    };
  }
}; 