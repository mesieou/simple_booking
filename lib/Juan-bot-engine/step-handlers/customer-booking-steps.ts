import type { IndividualStepHandler, LLMProcessingResult, ChatContext, ButtonConfig } from '../bot-manager';
import { Service, type ServiceData } from '../../database/models/service';
import { Business } from '../../database/models/business';
import { AvailabilitySlots } from '../../database/models/availability-slots';
import { User } from '../../database/models/user';

// Configuration constants for booking steps
const BOOKING_CONFIG = {
  ADDRESS_REQUEST_MESSAGE: '📍 To show you accurate pricing and availability, I need your address first.',
  ERROR_MESSAGES: {
    BUSINESS_CONFIG_ERROR: 'Business configuration error',
    NO_SERVICES_AVAILABLE: 'No services available', 
    SERVICES_LOAD_ERROR: 'Unable to load services at the moment',
    SERVICE_SELECTION_ERROR: 'Could not process service selection.',
    INVALID_SERVICE_SELECTION: 'Please select a valid service from the options provided.',
    NO_SERVICES_TO_CHOOSE: 'No services are currently available to choose from.',
    INVALID_ADDRESS: 'Please provide a valid address with street, suburb, and postcode.'
  },
  VALIDATION: {
    MIN_ADDRESS_LENGTH: 10
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
    const hasStreetInfo = /\d+.*[a-zA-Z]/.test(address); // Has numbers followed by letters (street number + name)
    const hasSuburb = address.toLowerCase().split(' ').length >= 3; // Minimum words for proper address
    
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

// Simplified availability service
class AvailabilityService {
  
  // Gets the actual user UUID by looking up which business owns this WhatsApp number
  static async findUserIdByBusinessWhatsappNumber(businessWhatsappNumber: string): Promise<string | null> {
    try {
      const userOwningThisBusinessWhatsapp = await User.findUserByBusinessWhatsappNumber(businessWhatsappNumber);
      return userOwningThisBusinessWhatsapp ? userOwningThisBusinessWhatsapp.id : null;
    } catch (error) {
      console.error('[AvailabilityService] Error finding user by business WhatsApp number:', error);
      return null;
    }
  }
  
  // Gets next 3 chronologically available time slots for the business that owns this WhatsApp number
  static async getNext3AvailableSlotsForBusinessWhatsapp(
    businessWhatsappNumber: string, 
    serviceDuration: number
  ): Promise<Array<{ date: string; time: string; displayText: string }>> {
    try {
      console.log(`[AvailabilityService] Getting next 3 slots for business with WhatsApp ${businessWhatsappNumber}, service duration ${serviceDuration} minutes`);
      
      const userIdOfBusinessOwner = await this.findUserIdByBusinessWhatsappNumber(businessWhatsappNumber);
      if (!userIdOfBusinessOwner) {
        console.error('[AvailabilityService] No business owner found for this WhatsApp number');
        return [];
      }
      
      const rawSlots = await AvailabilitySlots.getNext3AvailableSlots(userIdOfBusinessOwner, serviceDuration);
      
      // Simple display formatting
      return rawSlots.map(slot => {
        const date = new Date(slot.date);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        let dateText = '';
        if (date.toDateString() === today.toDateString()) {
          dateText = 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
          dateText = 'Tomorrow';
        } else {
          dateText = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
        }
        
        // Simple time formatting
        const [hours, minutes] = slot.time.split(':');
        const hour24 = parseInt(hours);
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
        const ampm = hour24 >= 12 ? 'pm' : 'am';
        const timeText = `${hour12}${minutes !== '00' ? `:${minutes}` : ''} ${ampm}`;
        
        return {
          ...slot,
          displayText: `${dateText} ${timeText}`
        };
      });
      
    } catch (error) {
      console.error('[AvailabilityService] Error getting next 3 available slots for business WhatsApp:', error);
      return [];
    }
  }
  
  // Gets available hours for a specific date for the business that owns this WhatsApp number
  static async getAvailableHoursForDateByBusinessWhatsapp(
    businessWhatsappNumber: string,
    date: string,
    serviceDuration: number
  ): Promise<string[]> {
    try {
      const userIdOfBusinessOwner = await this.findUserIdByBusinessWhatsappNumber(businessWhatsappNumber);
      if (!userIdOfBusinessOwner) {
        console.error('[AvailabilityService] No business owner found for this WhatsApp number');
        return [];
      }
      
      return await AvailabilitySlots.getAvailableHoursForDate(userIdOfBusinessOwner, date, serviceDuration);
    } catch (error) {
      console.error('[AvailabilityService] Error getting available hours for business WhatsApp:', error);
      return [];
    }
  }
  
  // Validates if a custom date has availability for the business that owns this WhatsApp number
  static async validateCustomDateForBusinessWhatsapp(
    businessWhatsappNumber: string,
    date: string,
    serviceDuration: number
  ): Promise<boolean> {
    try {
      const availableHoursForThisBusinessAndDate = await AvailabilityService.getAvailableHoursForDateByBusinessWhatsapp(businessWhatsappNumber, date, serviceDuration);
      return availableHoursForThisBusinessAndDate.length > 0;
    } catch (error) {
      console.error('[AvailabilityService] Error validating custom date for business WhatsApp:', error);
      return false;
    }
  }
}

// =====================================
// NEW SIMPLIFIED STEP HANDLERS
// =====================================

// Step 1: Show next 2 available times + "choose another day" button
// Job: ONLY display times, no input processing
export const showAvailableTimesHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here are the next available appointment times:',
  
  // Only accept empty input (first display), reject button clicks so they go to next step
  validateUserInput: async (userInput) => {
    console.log('[ShowAvailableTimes] Validating input:', userInput);
    
    // If this is empty input (first display), accept it
    if (!userInput || userInput === "") {
      console.log('[ShowAvailableTimes] Empty input - accepting for first display');
      return { isValidInput: true };
    }
    
    // If this is a button click, reject it so it goes to handleTimeChoice
    if (userInput.startsWith('slot_') || userInput === 'choose_another_day') {
      console.log('[ShowAvailableTimes] Button click detected - rejecting to pass to next step');
      return { 
        isValidInput: false,
        validationErrorMessage: '' // No error message, just advance to next step
      };
    }
    
    // Other input types also rejected
    console.log('[ShowAvailableTimes] Other input - rejecting');
    return { isValidInput: false };
  },
  
  // Get and display available times only on first display
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[ShowAvailableTimes] Processing input:', validatedInput);
    
    // Only process empty input (first display)
    if (validatedInput !== "") {
      console.log('[ShowAvailableTimes] Non-empty input - not processing');
      return currentGoalData;
    }
    
    const businessWhatsappNumberCustomersMessagedTo = chatContext.currentParticipant.businessWhatsappNumber;
    const selectedServiceByCustomer = currentGoalData.selectedService;
    
    if (!businessWhatsappNumberCustomersMessagedTo || !selectedServiceByCustomer?.durationEstimate) {
      return {
        ...currentGoalData,
        availabilityError: 'Configuration error'
      };
    }
    
    // Get next 3 available slots for the business that owns this WhatsApp number
    const next3AvailableSlotsFromBusiness = await AvailabilityService.getNext3AvailableSlotsForBusinessWhatsapp(
      businessWhatsappNumberCustomersMessagedTo,
      selectedServiceByCustomer.durationEstimate
    );
    
    if (next3AvailableSlotsFromBusiness.length === 0) {
      return {
        ...currentGoalData,
        availabilityError: 'No appointments currently available'
      };
    }
    
    return {
      ...currentGoalData,
      next3AvailableSlots: next3AvailableSlotsFromBusiness
    };
  },
  
  // Show exactly 2 time slots + "Choose another day" button
  fixedUiButtons: async (currentGoalData) => {
    const next3Slots = currentGoalData.next3AvailableSlots as Array<{ date: string; time: string; displayText: string }> | undefined;
    const availabilityError = currentGoalData.availabilityError as string | undefined;
    
    if (availabilityError) {
      return [{ buttonText: '📞 Contact us directly', buttonValue: 'contact_support' }];
    }
    
    if (!next3Slots || next3Slots.length === 0) {
      return [{ buttonText: '📅 Choose another day', buttonValue: 'choose_another_day' }];
    }
    
    // Show first 2 slots + choose another day
    const timeSlotButtons = next3Slots.slice(0, 2).map((slot, index) => ({
      buttonText: slot.displayText,
      buttonValue: `slot_${index}_${slot.date}_${slot.time}`
    }));
    
    return [
      ...timeSlotButtons,
      { buttonText: '📅 Choose another day', buttonValue: 'choose_another_day' }
    ];
  }
};

// Step 2: Handle user's choice between quick booking or browsing
// Job: ONLY route user choice, set appropriate flags
export const handleTimeChoiceHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Processing your selection...',
  autoAdvance: true,
  
  // Accept slot selection or "choose another day"
  validateUserInput: async (userInput) => {
    console.log('[HandleTimeChoice] Validating input:', userInput);
    if (userInput.startsWith('slot_') || userInput === 'choose_another_day') {
      return { isValidInput: true };
    }
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select one of the available options.'
    };
  },
  
  // Process user choice and set flags for subsequent steps
  processAndExtractData: async (validatedInput, currentGoalData) => {
    console.log('[HandleTimeChoice] Processing input:', validatedInput);
    console.log('[HandleTimeChoice] Current goal data keys:', Object.keys(currentGoalData));
    
    if (validatedInput.startsWith('slot_')) {
      // User selected a quick time slot
      const parts = validatedInput.split('_');
      const selectedDate = parts[2];
      const selectedTime = parts[3];
      
      console.log('[HandleTimeChoice] Quick booking selected:', { selectedDate, selectedTime });
      
      return {
        ...currentGoalData,
        selectedDate,
        selectedTime,
        quickBookingSelected: true, // Flag to skip browse steps
        confirmationMessage: 'Great! Your time slot has been selected.'
      };
    }
    
    if (validatedInput === 'choose_another_day') {
      // User wants to browse more options
      console.log('[HandleTimeChoice] Browse mode selected - advancing to day browser');
      
      return {
        ...currentGoalData,
        browseModeSelected: true, // Flag to show browse steps
        confirmationMessage: 'Let me show you all available days...'
      };
    }
    
    console.log('[HandleTimeChoice] Unexpected input, returning current data');
    return currentGoalData;
  }
};

// Step 3: Show available days for browsing
// Job: ONLY show days when user wants to browse
export const showDayBrowserHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here are the available days:',
  
  // Only accept empty input (first display), reject button clicks
  validateUserInput: async (userInput, currentGoalData) => {
    console.log('[ShowDayBrowser] Validating input:', userInput);
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true }; // Skip silently
    }
    
    // Accept empty input for first display
    if (!userInput || userInput === "") {
        console.log('[ShowDayBrowser] Empty input, accepting for first display');
        return { isValidInput: true };
    }

    // Reject day selection so it's passed to the next step
    if (userInput.startsWith('day_')) {
        console.log('[ShowDayBrowser] Day selection detected, rejecting to pass to next step');
        return { 
            isValidInput: false,
            validationErrorMessage: '' // No error message, just advance
        };
    }
    
    console.log('[ShowDayBrowser] Other input, rejecting');
    return { isValidInput: false };
  },
  
  // Show days only if in browse mode
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    // If quick booking is selected, or if this step is being re-run after a selection, skip it
    if (currentGoalData.quickBookingSelected || validatedInput !== "") {
        return currentGoalData;
    }

    console.log('[ShowDayBrowser] Starting processAndExtractData');
    console.log('[ShowDayBrowser] Current goal data keys:', Object.keys(currentGoalData));
    console.log('[ShowDayBrowser] Quick booking selected:', currentGoalData.quickBookingSelected);
    console.log('[ShowDayBrowser] Browse mode selected:', currentGoalData.browseModeSelected);
    
    // Skip if user already made quick selection
    if (currentGoalData.quickBookingSelected) {
      console.log('[ShowDayBrowser] Skipping - quick booking selected');
      return {
        ...currentGoalData,
        confirmationMessage: '' // No message when skipping
      };
    }
    
    // Generate available days
    const businessWhatsappNumberCustomersMessagedTo = chatContext.currentParticipant.businessWhatsappNumber;
    const selectedServiceByCustomer = currentGoalData.selectedService;
    
    console.log('[ShowDayBrowser] Business WhatsApp number customers messaged TO:', businessWhatsappNumberCustomersMessagedTo);
    console.log('[ShowDayBrowser] Service selected by customer:', selectedServiceByCustomer);
    
    if (!businessWhatsappNumberCustomersMessagedTo || !selectedServiceByCustomer?.durationEstimate) {
      console.error('[ShowDayBrowser] Missing required data', {
        businessWhatsappNumberCustomersMessagedTo,
        selectedServiceByCustomer: selectedServiceByCustomer ? { name: selectedServiceByCustomer.name, duration: selectedServiceByCustomer.durationEstimate } : 'null'
      });
      return {
        ...currentGoalData,
        availabilityError: 'Configuration error',
        confirmationMessage: 'Sorry, there was a configuration error. Please try again or contact support.'
      };
    }
    
    // Get next 10 days with availability for this business
    const availableDaysForThisBusiness = [];
    const today = new Date();
    
    console.log('[ShowDayBrowser] Checking availability for next 10 days for this business...');
    
    for (let i = 0; i < 10; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      console.log(`[ShowDayBrowser] Checking if business has availability on ${dateString}`);
      
      try {
        const businessHasAvailabilityOnThisDate = await AvailabilityService.validateCustomDateForBusinessWhatsapp(
          businessWhatsappNumberCustomersMessagedTo,
          dateString,
          selectedServiceByCustomer.durationEstimate
        );
        
        console.log(`[ShowDayBrowser] Business has availability on ${dateString}: ${businessHasAvailabilityOnThisDate}`);
        
        if (businessHasAvailabilityOnThisDate) {
          let displayText = '';
          if (i === 0) {
            displayText = `Today ${date.getDate()} ${date.toLocaleDateString('en-GB', { month: 'short' })}`;
          } else if (i === 1) {
            displayText = `Tomorrow ${date.getDate()} ${date.toLocaleDateString('en-GB', { month: 'short' })}`;
          } else {
            displayText = date.toLocaleDateString('en-GB', { 
              weekday: 'long', day: 'numeric', month: 'short'
            });
          }
          
          availableDaysForThisBusiness.push({
            date: dateString,
            displayText: displayText
          });
        }
      } catch (error) {
        console.error(`[ShowDayBrowser] Error checking business availability for ${dateString}:`, error);
      }
    }
    
    console.log('[ShowDayBrowser] Available days found for this business:', availableDaysForThisBusiness.length);
    
    if (availableDaysForThisBusiness.length === 0) {
      return {
        ...currentGoalData,
        availableDays: [],
        confirmationMessage: 'Sorry, no availability found in the next 10 days. Please contact us directly to check for other options.'
      };
    }
    
    // Just show buttons, no text list
    return {
      ...currentGoalData,
      availableDays: availableDaysForThisBusiness,
      confirmationMessage: 'Please select a day:'
    };
  },
  
  // Show all available days as buttons (up to 10 to fit WhatsApp limits)
  fixedUiButtons: async (currentGoalData) => {
    if (currentGoalData.quickBookingSelected) {
      console.log('[ShowDayBrowser] No buttons - quick booking selected');
      return []; // No buttons when skipping
    }
    
    const availableDays = currentGoalData.availableDays as Array<{ date: string; displayText: string }> | undefined;
    
    console.log('[ShowDayBrowser] Available days for buttons:', availableDays?.length || 0);
    
    if (!availableDays || availableDays.length === 0) {
      return [{ buttonText: '📞 No availability - Contact us', buttonValue: 'contact_support' }];
    }
    
    // Show up to 10 days as buttons (WhatsApp limit)
    const buttons = availableDays.slice(0, 10).map(day => ({
      buttonText: day.displayText,
      buttonValue: `day_${day.date}`
    }));
    
    console.log('[ShowDayBrowser] Generated buttons:', buttons);
    
    return buttons;
  }
};

// Step 4: Handle day selection
// Job: ONLY process day selection when in browse mode
export const selectSpecificDayHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please select a day:',
  autoAdvance: true, // Auto-advance to next step after processing
  
  // Skip if quick booking, validate day selection if browsing
  validateUserInput: async (userInput, currentGoalData) => {
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true }; // Skip
    }
    
    if (userInput.startsWith('day_')) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select a valid day.'
    };
  },
  
  // Process day selection
  processAndExtractData: async (validatedInput, currentGoalData) => {
    // If quick booking is selected, skip this step
    if (currentGoalData.quickBookingSelected) {
      return currentGoalData;
    }
    
    if (validatedInput.startsWith('day_')) {
      const selectedDate = validatedInput.replace('day_', '');
      return {
        ...currentGoalData,
        selectedDate,
        confirmationMessage: 'Got it. Let me get available times...' // Give feedback
      };
    }
    
    return currentGoalData;
  }
};

// Step 5: Show available hours for selected day
// Job: ONLY show hours when day is selected
export const showHoursForDayHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please select a time:',
  
  // Only accept empty input (for first display), reject button clicks
  validateUserInput: async (userInput, currentGoalData) => {
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true }; // Skip if already booked
    }
    
    // Accept empty input for the initial display of hours
    if (!userInput || userInput === "") {
      return { isValidInput: true };
    }
    
    // Any other input (i.e., a button click) is for the next step, so reject it
    return { 
      isValidInput: false,
      validationErrorMessage: '' // No message, just signal to advance
    };
  },
  
  // Show hours for selected date, but only on first execution
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    // If quick booking is selected, or if this step is being re-run, skip it
    if (currentGoalData.quickBookingSelected || validatedInput !== "") {
      return currentGoalData;
    }

    if (currentGoalData.quickBookingSelected) {
      return {
        ...currentGoalData,
        confirmationMessage: '' // Skip silently
      };
    }
    
    const businessWhatsappNumberCustomersMessagedTo = chatContext.currentParticipant.businessWhatsappNumber;
    const selectedServiceByCustomer = currentGoalData.selectedService;
    const dateSelectedByCustomer = currentGoalData.selectedDate;
    
    if (!businessWhatsappNumberCustomersMessagedTo || !selectedServiceByCustomer?.durationEstimate || !dateSelectedByCustomer) {
      return {
        ...currentGoalData,
        availabilityError: 'Missing information for time lookup',
        confirmationMessage: 'Sorry, there was an error loading times. Please try again.'
      };
    }
    
    // Get available hours for this business on the selected date
    const availableHoursForBusinessOnSelectedDate = await AvailabilityService.getAvailableHoursForDateByBusinessWhatsapp(
      businessWhatsappNumberCustomersMessagedTo,
      dateSelectedByCustomer,
      selectedServiceByCustomer.durationEstimate
    );
    
    if (availableHoursForBusinessOnSelectedDate.length === 0) {
      return {
        ...currentGoalData,
        availabilityError: 'No appointments available on this date',
        confirmationMessage: 'Sorry, no appointments are available on this date. Please choose another day.'
      };
    }
    
    // Format hours for display
    const formattedHoursForDisplay = availableHoursForBusinessOnSelectedDate.map(time => {
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return {
        time24: time,
        display: `${hour12}${minutes !== '00' ? `:${minutes}` : ''} ${ampm}`
      };
    });
    
    return {
      ...currentGoalData,
      availableHours: availableHoursForBusinessOnSelectedDate,
      formattedAvailableHours: formattedHoursForDisplay,
      confirmationMessage: 'Please select a time:' // Simple prompt, buttons only
    };
  },
  
  // Show all available time buttons (up to 10 to fit WhatsApp limits)
  fixedUiButtons: async (currentGoalData) => {
    if (currentGoalData.quickBookingSelected) {
      return []; // No buttons when skipping
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours;
    const availabilityError = currentGoalData.availabilityError;
    
    if (availabilityError) {
      return [
        { buttonText: '📞 Contact us for available times', buttonValue: 'contact_support' },
        { buttonText: '📅 Choose different date', buttonValue: 'choose_different_date' }
      ];
    }
    
    if (!formattedHours || formattedHours.length === 0) {
      return [{ buttonText: '📅 Choose different date', buttonValue: 'choose_different_date' }];
    }
    
    // Show up to 10 time slots as buttons (WhatsApp limit)
    return formattedHours.slice(0, 10).map((hour: any) => ({
      buttonText: hour.display,
      buttonValue: hour.display
    }));
  }
};

// Step 6: Handle time selection
// Job: ONLY process time selection when in browse mode
export const selectSpecificTimeHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please select your preferred time:',
  autoAdvance: true, // Auto-advance to the next step
  
  // Skip if quick booking, validate time if browsing
  validateUserInput: async (userInput, currentGoalData) => {
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true }; // Skip
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours || [];
    
    // Check if the user input is one of the displayed options
    if (formattedHours.some((h: any) => h.display === userInput)) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select a valid time.'
    };
  },
  
  // Process time selection
  processAndExtractData: async (validatedInput, currentGoalData) => {
    if (currentGoalData.quickBookingSelected) {
      return currentGoalData; // Skip, time already set
    }
    
    // Convert display format back to 24h if needed
    let selectedTime = validatedInput;
    const formattedHours = currentGoalData.formattedAvailableHours;
    if (formattedHours) {
      const matchedHour = formattedHours.find((h: any) => h.display === validatedInput);
      if (matchedHour) {
        selectedTime = matchedHour.time24;
      }
    }
    
    return {
      ...currentGoalData,
      selectedTime,
      confirmationMessage: `Great! You've selected ${validatedInput}. Let's confirm your details.`
    };
  }
};

// =====================================
// BOOKING SUMMARY HANDLERS
// =====================================

// Step: Show booking summary with all details
// Job: Display comprehensive booking summary and ask for confirmation
export const showBookingSummaryHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here\'s your booking summary:',
  
  // Only accept empty input (first display), reject button clicks so they go to next step
  validateUserInput: async (userInput) => {
    console.log('[ShowBookingSummary] Validating input:', userInput);
    
    // If this is empty input (first display), accept it
    if (!userInput || userInput === "") {
      console.log('[ShowBookingSummary] Empty input - accepting for first display');
      return { isValidInput: true };
    }
    
    // If this is a button click, reject it so it goes to handleSummaryChoice
    if (userInput === 'confirm_booking' || userInput === 'edit_booking') {
      console.log('[ShowBookingSummary] Button click detected - rejecting to pass to next step');
      return { 
        isValidInput: false,
        validationErrorMessage: '' // No error message, just advance to next step
      };
    }
    
    // Other input types also rejected
    console.log('[ShowBookingSummary] Other input - rejecting');
    return { isValidInput: false };
  },
  
  // Generate comprehensive booking summary
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[ShowBookingSummary] Processing input:', validatedInput);
    
    // Only process empty input (first display)
    if (validatedInput !== "") {
      console.log('[ShowBookingSummary] Non-empty input - not processing');
      return currentGoalData;
    }
    
    const selectedService = currentGoalData.selectedService;
    const selectedDate = currentGoalData.selectedDate;
    const selectedTime = currentGoalData.selectedTime;
    const finalServiceAddress = currentGoalData.finalServiceAddress;
    const serviceLocation = currentGoalData.serviceLocation;
    
    if (!selectedService || !selectedDate || !selectedTime || !finalServiceAddress) {
      return {
        ...currentGoalData,
        summaryError: 'Missing booking information'
      };
    }
    
    // Calculate costs - just use service price as total
    const serviceCost = selectedService.fixedPrice || 0;
    const totalCost = serviceCost; // No additional costs for now
    
    // Calculate estimated completion time
    const duration = selectedService.durationEstimate || 60;
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(hours, minutes, 0, 0);
    const endTime = new Date(startTime.getTime() + duration * 60000);
    const estimatedEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Format date for display
    const dateObj = new Date(selectedDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
    
    // Format time for display
    const [hour24] = selectedTime.split(':');
    const hour12 = parseInt(hour24) === 0 ? 12 : parseInt(hour24) > 12 ? parseInt(hour24) - 12 : parseInt(hour24);
    const ampm = parseInt(hour24) >= 12 ? 'PM' : 'AM';
    const formattedTime = `${hour12}:${selectedTime.split(':')[1]} ${ampm}`;
    
    // Create detailed summary message
    const summaryMessage = `📋 *Booking Summary*\n\n` +
      `💼 *Service:* ${selectedService.name}\n` +
      `📅 *Date:* ${formattedDate}\n` +
      `⏰ *Time:* ${formattedTime}\n` +
      `⏱️ *Duration:* ${duration} minutes\n` +
      `🏁 *Estimated completion:* ${estimatedEndTime}\n` +
      `📍 *Location:* ${finalServiceAddress}\n\n` +
      `💰 *Pricing:*\n` +
      `   • Service: $${serviceCost}\n` +
      `   • *Total: $${totalCost}*\n\n` +
      `Would you like to confirm this booking?`;
    
    return {
      ...currentGoalData,
      bookingSummary: {
        serviceCost,
        totalCost,
        duration,
        estimatedEndTime,
        formattedDate,
        formattedTime
      },
      confirmationMessage: summaryMessage
    };
  },
  
  // Show confirmation and edit buttons
  fixedUiButtons: async (currentGoalData) => {
    const summaryError = currentGoalData.summaryError;
    
    if (summaryError) {
      return [{ buttonText: '🔄 Try again', buttonValue: 'restart_booking' }];
    }
    
    return [
      { buttonText: '✅ Confirm Booking', buttonValue: 'confirm_booking' },
      { buttonText: '✏️ Edit Booking', buttonValue: 'edit_booking' }
    ];
  }
};

// Step: Handle user's choice from booking summary
// Job: Process confirmation or show edit options
export const handleSummaryChoiceHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Processing your choice...',
  autoAdvance: true, // Follow the same pattern as handleTimeChoiceHandler
  
  // Accept confirmation or edit choice
  validateUserInput: async (userInput) => {
    console.log('[HandleSummaryChoice] Validating input:', userInput);
    if (userInput === 'confirm_booking' || userInput === 'edit_booking') {
      return { isValidInput: true };
    }
    
    // Handle edit sub-choices (service, time)
    if (userInput === 'edit_service' || userInput === 'edit_time') {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select one of the available options.'
    };
  },
  
  // Process user choice and set flags for subsequent steps
  processAndExtractData: async (validatedInput, currentGoalData) => {
    console.log('[HandleSummaryChoice] Processing input:', validatedInput);
    
    if (validatedInput === 'confirm_booking') {
      console.log('[HandleSummaryChoice] Booking confirmed - proceeding to next step');
      return {
        ...currentGoalData,
        bookingConfirmedFromSummary: true,
        confirmationMessage: 'Perfect! Let\'s finalize your booking details.'
      };
    }
    
    if (validatedInput === 'edit_booking') {
      console.log('[HandleSummaryChoice] Edit requested - showing edit options');
      return {
        ...currentGoalData,
        showEditOptions: true,
        confirmationMessage: 'What would you like to change?'
      };
    }
    
    // Handle specific edit choices
    if (validatedInput === 'edit_service') {
      console.log('[HandleSummaryChoice] Service edit requested - navigating back to selectService');
      return {
        ...currentGoalData,
        navigateBackTo: 'selectService',
        confirmationMessage: 'Let\'s choose a different service...'
      };
    }
    
    if (validatedInput === 'edit_time') {
      console.log('[HandleSummaryChoice] Time edit requested - navigating back to showAvailableTimes');
      return {
        ...currentGoalData,
        navigateBackTo: 'showAvailableTimes',
        confirmationMessage: 'Let\'s pick a different time...'
      };
    }
    
    console.log('[HandleSummaryChoice] Unexpected input, returning current data');
    return currentGoalData;
  },
  
  // Show edit options if user chose to edit
  fixedUiButtons: async (currentGoalData) => {
    if (currentGoalData.showEditOptions) {
      return [
        { buttonText: '💼 Change Service', buttonValue: 'edit_service' },
        { buttonText: '🕐 Change Date/Time', buttonValue: 'edit_time' }
      ];
    }
    
    // No buttons if booking confirmed (will auto-advance)
    return [];
  }
};

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
  autoAdvance: true,
  
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

// Consolidated quote display with detailed breakdown
export const displayQuoteHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here\'s your booking summary:',
  
  // Always accept input for quote display
  validateUserInput: async () => true,
  
  // Calculate and display complete quote with breakdown
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
    
    const quote = {
      serviceCost: selectedService?.fixedPrice || 0,
      travelCost,
      totalCost,
      duration: selectedService?.durationEstimate || 60
    };
    
    // Create detailed confirmation message
    const confirmationMessage = `📋 Booking Summary:\n\n` +
      `💼 Service: ${selectedService?.name}\n` +
      `⏱️ Duration: ${quote.duration} minutes\n` +
      `💰 Service Cost: $${quote.serviceCost}\n` +
      `${travelCost > 0 ? `🚗 Travel Cost: $${travelCost}\n` : ''}` +
      `💵 Total Cost: $${quote.totalCost}\n` +
      `📍 Location: ${currentGoalData.finalServiceAddress}`;
    
    return {
      ...currentGoalData,
      quote,
      confirmationMessage
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

// Checks if customer is new or existing - single responsibility
export const isNewUserHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Are you a new customer or do you have an account with us?',
  
  // Validates user type selection or edit options
  validateUserInput: async (userInput, currentGoalData) => {
    // If showing edit options, validate edit choices
    if (currentGoalData.showEditOptions) {
      if (userInput === 'edit_service' || userInput === 'edit_time') {
        return { isValidInput: true };
      }
      return {
        isValidInput: false,
        validationErrorMessage: 'Please select what you would like to change.'
      };
    }
    
    // Normal new/existing customer validation
    const response = userInput.toLowerCase();
    if (response.includes('new') || response.includes('existing') || response.includes('have')) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please let me know if you\'re a new customer or existing customer.'
    };
  },
  
  // Determines if user is new or handles edit navigation
  processAndExtractData: async (validatedInput, currentGoalData) => {
    // Handle edit choices by setting navigation flags
    if (currentGoalData.showEditOptions) {
      if (validatedInput === 'edit_service') {
        return {
          ...currentGoalData,
          navigateBackTo: 'selectService',
          showEditOptions: false // Clear the flag
        };
      }
      
      if (validatedInput === 'edit_time') {
        return {
          ...currentGoalData,
          navigateBackTo: 'showAvailableTimes',
          showEditOptions: false // Clear the flag
        };
      }
    }
    
    // Normal new/existing customer processing
    const response = validatedInput.toLowerCase();
    const isNewUser = response.includes('new');
    
    return {
      ...currentGoalData,
      isNewUser
    };
  },
  
  // Show edit options or user type buttons based on context
  fixedUiButtons: async (currentGoalData) => {
    if (currentGoalData.showEditOptions) {
      return [
        { buttonText: '💼 Change Service', buttonValue: 'edit_service' },
        { buttonText: '🕐 Change Date/Time', buttonValue: 'edit_time' }
      ];
    }
    
    // Normal new/existing customer buttons
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