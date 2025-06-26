import type { IndividualStepHandler, LLMProcessingResult, ChatContext, ButtonConfig } from '../bot-manager';
import { Service, type ServiceData } from '@/lib/database/models/service';
import { Business } from '@/lib/database/models/business';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { User } from '@/lib/database/models/user';
import { Quote, type QuoteData } from '@/lib/database/models/quote';
import { Booking, type BookingData, BookingStatus } from '@/lib/database/models/booking';
import { computeQuoteEstimation, type QuoteEstimation } from '@/lib/general-helpers/quote-cost-calculator';
import { StripePaymentService } from '@/lib/payments/stripe-utils';
import { v4 as uuidv4 } from 'uuid';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { DateTime } from 'luxon';
import { CreatePaymentLink } from '@/lib/database/models/payment';
import { GoogleMapsService } from '@/lib/general-helpers/google-distance-calculator';
import { BookingDataChecker, DateTimeFormatter, BookingDataManager, BookingButtonGenerator as UtilityButtonGenerator, StepProcessorBase, BookingMessageGenerator } from './booking-utilities';
import { LanguageDetectionService } from '../services/language-detection';

// Translation constants for booking steps
const BOOKING_TRANSLATIONS = {
  en: {
    ADDRESS_REQUEST_MESSAGE: '📍 To show you accurate pricing and availability, I need your address first.',
    ERROR_MESSAGES: {
      BUSINESS_CONFIG_ERROR: 'Business configuration error',
      NO_SERVICES_AVAILABLE: 'No services available', 
      SERVICES_LOAD_ERROR: 'Unable to load services at the moment',
      SERVICE_SELECTION_ERROR: 'Could not process service selection.',
      INVALID_SERVICE_SELECTION: 'Please select a valid service from the options provided or type the name of the service you\'d like.',
      NO_SERVICES_TO_CHOOSE: 'No services are currently available to choose from.',
      INVALID_ADDRESS: 'Please provide a valid address with street, suburb, and postcode.'
    },
    BUTTONS: {
      SYSTEM_ERROR: '❌ System Error',
      CONTACT_SERVICES: '📞 Contact us',
      SERVICES_UNAVAILABLE: '⚠️ Service Error',
      ADDRESS_CORRECT: '✅ Yes, that\'s correct',
      ADDRESS_EDIT: '✏️ No, let me edit it',
      CONTACT_DIRECTLY: '📞 Contact us directly',
      OTHER_DAYS: '📅 Other days',
      CHOOSE_ANOTHER_DAY: '📅 Other days',
      NO_AVAILABILITY: '📞 No availability - Contact us',
      CONTACT_US: '📞 Contact us',
      CHOOSE_DATE_FIRST: '📅 Choose a date first',
      TRY_AGAIN: '🔄 Try again',
      CONFIRM: 'Confirm',
      EDIT: 'Edit',
      CHANGE_SERVICE: 'Change Service',
      CHANGE_TIME: 'Change Date/Time',
      SELECT: 'Select'
    },
    MESSAGES: {
      AVAILABLE_TIMES: 'Next available times:',
      CONFIGURATION_ERROR: 'Sorry, there was a configuration error. Please contact us directly.',
      CONFIGURATION_ERROR_SUPPORT: 'Sorry, there was a configuration error. Please try again or contact support.',
      NO_AVAILABILITY_10_DAYS: 'Sorry, no availability found in the next 10 days. Please contact us directly to check for other options.',
      AVAILABLE_DAYS: 'Available days:',
      GETTING_TIMES: 'Got it. Let me get available times...',
      ERROR_LOADING_TIMES: 'Sorry, there was an error loading times. Please try again.',
      NO_APPOINTMENTS_DATE: 'Sorry, no appointments are available on this date. Please choose another day.',
      SELECT_TIME: 'Please select a time:',
      ERROR_LOADING_AVAILABLE_TIMES: 'Sorry, there was an error loading available times. Please try selecting a date again.',
      SELECT_DATE_FIRST: 'Please select a date first to see available times.',
      SELECTED_TIME_CONFIRM: 'Great! You\'ve selected {time}. Let\'s confirm your details.',
      BOOK_SERVICE: 'Great! Let\'s book a {service} appointment.',
      SERVICE_NOT_AVAILABLE: 'Sorry, that service is not available. Please use the buttons below.',
      ISSUE_PREPARING_QUOTE: 'Sorry, there was an issue preparing your quote. Let me try again.',
      QUOTE_CONFIRMED: 'Perfect! Your quote is confirmed. Let\'s create your booking.',
      WHAT_TO_CHANGE: 'What would you like to change?',
      CHOOSE_DIFFERENT_SERVICE: 'Let\'s choose a different service...',
      PICK_DIFFERENT_TIME: 'Let\'s pick a different time...',
      WELCOME_BACK: 'Welcome back, {name}! I found your account.',
      NOT_IN_SYSTEM: 'I don\'t see you in our system yet.',
      CREATE_ACCOUNT: 'Let me create your account.',
      FIRST_NAME_PROMPT: 'What\'s your first name so I can create your account?',
      FIRST_NAME_VALIDATION: 'Please provide your first name (at least 2 characters).',
      THANKS_CREATING: 'Thanks {name}! Creating your account...',
      ACCOUNT_CREATED: 'Perfect! I\'ve created your account, {name}. Let\'s continue with your booking.',
      ACCOUNT_EXISTS: 'This WhatsApp number may already have an account. Please contact support.',
      ACCOUNT_CREATION_FAILED: 'Failed to create user account. Please try again.',
      SELECT_SERVICE: 'Please select a service from the list below:',
      MOBILE_SERVICE_LOCATION: '🚗 Excellent! We\'ll come to you at:\n📍 {address}',
      BOOKING_PROBLEM: 'Sorry, there was a problem confirming your booking. Please contact us.',
      PROVIDE_ADDRESS: 'Please provide the correct address:',
      EMAIL_PROMPT: 'Please provide your email address for booking confirmation:',
      EMAIL_VALIDATION: 'Please provide a valid email address.',
      VALIDATING_ADDRESS: 'Let me validate your address...',
      CREATING_BOOKING: 'Creating your booking...',
      CHECKING_SYSTEM: 'Let me check if you\'re in our system...',
      CHECKING_STATUS: 'Checking your account status...',
      CREATING_ACCOUNT: 'Creating your account...',
      PROCESSING_CHOICE: 'Processing your choice...',
      CONFIRMING_DETAILS: 'Perfect! Let me confirm your service details...'
    },
    TIME_LABELS: {
      TODAY: 'Today',
      TOMORROW: 'Tomorrow',
      AM: 'am',
      PM: 'pm'
    },
    LIST_SECTIONS: {
      SERVICES: 'Services', // Short title for WhatsApp list (24 char limit)
      AVAILABLE_OPTIONS: 'Available Options'
    },
    QUOTE_SUMMARY: {
      TITLE: '📋 *Booking Quote Summary*',
      SERVICE: '💼 *Service:*',
      DATE: '📅 *Date:*',
      TIME: '⏰ *Time:*',
      DURATION: '⏱️ *Duration:*',
      ESTIMATED_COMPLETION: '🏁 *Estimated completion:*',
      LOCATION: '📍 *Location:*',
      PRICING: '💰 *Pricing:*',
      SERVICE_COST: '• Service:',
      TRAVEL_COST: '• Travel:',
      TOTAL_COST: '• *Total:*',
      QUOTE_ID: 'Quote ID:',
      CONFIRM_QUESTION: 'Would you like to confirm this quote?',
      MINUTES: 'minutes'
    },
    BOOKING_CONFIRMATION: {
      TITLE: '🎉 Your booking is confirmed!',
      SERVICE: '📅 Service:',
      DATE: '🗓️ Date:',
      TIME: '⏰ Time:',
      LOCATION: '📍 Location:',
      PRICING: '💰 *Pricing:*',
      SERVICE_COST: '• Service:',
      TRAVEL_COST: '• Travel:',
      TOTAL_COST: '• *Total Cost:*',
      BOOKING_ID: 'Booking ID:',
      LOOKING_FORWARD: 'We look forward to seeing you! You can ask me anything else if you have more questions.'
    }
  },
  es: {
    ADDRESS_REQUEST_MESSAGE: '📍 Para mostrarte precios y disponibilidad precisos, necesito tu dirección primero.',
    ERROR_MESSAGES: {
      BUSINESS_CONFIG_ERROR: 'Error de configuración del negocio',
      NO_SERVICES_AVAILABLE: 'No hay servicios disponibles', 
      SERVICES_LOAD_ERROR: 'No se pueden cargar los servicios en este momento',
      SERVICE_SELECTION_ERROR: 'No se pudo procesar la selección del servicio.',
      INVALID_SERVICE_SELECTION: 'Por favor selecciona un servicio válido de las opciones proporcionadas o escribe el nombre del servicio que te gustaría.',
      NO_SERVICES_TO_CHOOSE: 'No hay servicios disponibles para elegir en este momento.',
      INVALID_ADDRESS: 'Por favor proporciona una dirección válida con calle, barrio y código postal.'
    },
    BUTTONS: {
      SYSTEM_ERROR: '❌ Error del Sistema',
      CONTACT_SERVICES: '📞 Contáctanos',
      SERVICES_UNAVAILABLE: '⚠️ Error de Servicios',
      ADDRESS_CORRECT: '✅ Sí, es correcto',
      ADDRESS_EDIT: '✏️ No, déjame editarlo',
      CONTACT_DIRECTLY: '📞 Contáctanos directamente',
      OTHER_DAYS: '📅 Otros días',
      CHOOSE_ANOTHER_DAY: '📅 Otros días',
      NO_AVAILABILITY: '📞 Sin disponibilidad - Contáctanos',
      CONTACT_US: '📞 Contáctanos',
      CHOOSE_DATE_FIRST: '📅 Elige una fecha primero',
      TRY_AGAIN: '🔄 Intentar de nuevo',
      CONFIRM: 'Confirmar',
      EDIT: 'Editar',
      CHANGE_SERVICE: 'Cambiar Servicio',
      CHANGE_TIME: 'Cambiar Fecha/Hora',
      SELECT: 'Seleccionar'
    },
    MESSAGES: {
      AVAILABLE_TIMES: 'Próximos horarios:',
      CONFIGURATION_ERROR: 'Lo siento, hubo un error de configuración. Por favor contáctanos directamente.',
      CONFIGURATION_ERROR_SUPPORT: 'Lo siento, hubo un error de configuración. Por favor intenta de nuevo o contacta soporte.',
      NO_AVAILABILITY_10_DAYS: 'Lo siento, no se encontró disponibilidad en los próximos 10 días. Por favor contáctanos directamente para verificar otras opciones.',
      AVAILABLE_DAYS: 'Días disponibles:',
      GETTING_TIMES: 'Entendido. Déjame obtener los horarios disponibles...',
      ERROR_LOADING_TIMES: 'Lo siento, hubo un error cargando los horarios. Por favor intenta de nuevo.',
      NO_APPOINTMENTS_DATE: 'Lo siento, no hay citas disponibles en esta fecha. Por favor elige otro día.',
      SELECT_TIME: 'Por favor selecciona un horario:',
      ERROR_LOADING_AVAILABLE_TIMES: 'Lo siento, hubo un error cargando los horarios disponibles. Por favor intenta seleccionar otra fecha.',
      SELECT_DATE_FIRST: 'Por favor selecciona una fecha primero para ver los horarios disponibles.',
      SELECTED_TIME_CONFIRM: '¡Excelente! Has seleccionado {time}. Confirmemos tus detalles.',
      BOOK_SERVICE: '¡Excelente! Reservemos una cita de {service}.',
      SERVICE_NOT_AVAILABLE: 'Lo siento, ese servicio no está disponible. Por favor usa los botones de abajo.',
      ISSUE_PREPARING_QUOTE: 'Lo siento, hubo un problema preparando tu cotización. Déjame intentar de nuevo.',
      QUOTE_CONFIRMED: '¡Perfecto! Tu cotización está confirmada. Creemos tu reserva.',
      WHAT_TO_CHANGE: '¿Qué te gustaría cambiar?',
      CHOOSE_DIFFERENT_SERVICE: 'Elijamos un servicio diferente...',
      PICK_DIFFERENT_TIME: 'Elijamos un horario diferente...',
      WELCOME_BACK: '¡Bienvenido de vuelta, {name}! Encontré tu cuenta.',
      NOT_IN_SYSTEM: 'No te veo en nuestro sistema aún.',
      CREATE_ACCOUNT: 'Déjame crear tu cuenta.',
      FIRST_NAME_PROMPT: '¿Cuál es tu nombre para crear tu cuenta?',
      FIRST_NAME_VALIDATION: 'Por favor proporciona tu nombre (al menos 2 caracteres).',
      THANKS_CREATING: '¡Gracias {name}! Creando tu cuenta...',
      ACCOUNT_CREATED: '¡Perfecto! He creado tu cuenta, {name}. Continuemos con tu reserva.',
      ACCOUNT_EXISTS: 'Este número de WhatsApp ya puede tener una cuenta. Por favor contacta soporte.',
      ACCOUNT_CREATION_FAILED: 'Falló la creación de la cuenta de usuario. Por favor intenta de nuevo.',
      SELECT_SERVICE: 'Por favor selecciona un servicio de la lista de abajo:',
      MOBILE_SERVICE_LOCATION: '🚗 ¡Excelente! Iremos a ti a:\n📍 {address}',
      BOOKING_PROBLEM: 'Lo siento, hubo un problema confirmando tu reserva. Por favor contáctanos.',
      PROVIDE_ADDRESS: 'Por favor proporciona la dirección correcta:',
      EMAIL_PROMPT: 'Por favor proporciona tu dirección de correo electrónico para confirmación de la reserva:',
      EMAIL_VALIDATION: 'Por favor proporciona una dirección de correo electrónico válida.',
      VALIDATING_ADDRESS: 'Déjame validar tu dirección...',
      CREATING_BOOKING: 'Creando tu reserva...',
      CHECKING_SYSTEM: 'Déjame verificar si estás en nuestro sistema...',
      CHECKING_STATUS: 'Verificando el estado de tu cuenta...',
      CREATING_ACCOUNT: 'Creando tu cuenta...',
      PROCESSING_CHOICE: 'Procesando tu elección...',
      CONFIRMING_DETAILS: '¡Perfecto! Déjame confirmar los detalles de tu servicio...'
    },
    TIME_LABELS: {
      TODAY: 'Hoy',
      TOMORROW: 'Mañana',
      AM: 'am',
      PM: 'pm'
    },
    LIST_SECTIONS: {
      SERVICES: 'Servicios', // Short title for WhatsApp list (24 char limit)
      AVAILABLE_OPTIONS: 'Opciones Disponibles'
    },
    QUOTE_SUMMARY: {
      TITLE: '📋 *Resumen de Cotización de Reserva*',
      SERVICE: '💼 *Servicio:*',
      DATE: '📅 *Fecha:*',
      TIME: '⏰ *Hora:*',
      DURATION: '⏱️ *Duración:*',
      ESTIMATED_COMPLETION: '🏁 *Finalización estimada:*',
      LOCATION: '📍 *Ubicación:*',
      PRICING: '💰 *Precios:*',
      SERVICE_COST: '• Servicio:',
      TRAVEL_COST: '• Viaje:',
      TOTAL_COST: '• *Total:*',
      QUOTE_ID: 'ID de Cotización:',
      CONFIRM_QUESTION: '¿Te gustaría confirmar esta cotización?',
      MINUTES: 'minutos'
    },
    BOOKING_CONFIRMATION: {
      TITLE: '🎉 ¡Tu reserva está confirmada!',
      SERVICE: '📅 Servicio:',
      DATE: '🗓️ Fecha:',
      TIME: '⏰ Hora:',
      LOCATION: '📍 Ubicación:',
      PRICING: '💰 *Precios:*',
      SERVICE_COST: '• Servicio:',
      TRAVEL_COST: '• Viaje:',
      TOTAL_COST: '• *Costo Total:*',
      BOOKING_ID: 'ID de Reserva:',
      LOOKING_FORWARD: '¡Esperamos verte! Puedes preguntarme cualquier otra cosa si tienes más preguntas.'
    }
  }
} as const;

// Utility function to get user's language from chat context
const getUserLanguage = (chatContext: ChatContext): 'en' | 'es' => {
  // Use the same language source as FAQ handler for consistency
  const userLanguage = chatContext.participantPreferences.language || 'en';
  return (userLanguage === 'es') ? 'es' : 'en';
};

// Utility function to get localized text
const getLocalizedText = (chatContext: ChatContext, key: string): string => {
  const language = getUserLanguage(chatContext);
  const translations = BOOKING_TRANSLATIONS[language];
  
  // Navigate through nested keys (e.g., "ERROR_MESSAGES.INVALID_ADDRESS")
  const keys = key.split('.');
  let value: any = translations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`[Localization] Key not found: ${key} for language: ${language}`);
      return key; // Return the key as fallback
    }
  }
  
  return typeof value === 'string' ? value : key;
};

// Utility function to get localized text with variable substitution
const getLocalizedTextWithVars = (chatContext: ChatContext, key: string, variables: Record<string, string> = {}): string => {
  let text = getLocalizedText(chatContext, key);
  
  // Replace variables in the format {variable}
  Object.entries(variables).forEach(([varName, varValue]) => {
    text = text.replace(new RegExp(`\\{${varName}\\}`, 'g'), varValue);
  });
  
  return text;
};

// Configuration constants for booking steps (now using localized text)
const BOOKING_CONFIG = {
  VALIDATION: {
    MIN_ADDRESS_LENGTH: 10
  }
} as const;

// Address validation utilities
class AddressValidator {
  
  // Validates address format and completeness
  static validateAddress(address: string, chatContext: ChatContext): LLMProcessingResult {
    if (address.length < BOOKING_CONFIG.VALIDATION.MIN_ADDRESS_LENGTH) {
      return {
        isValidInput: false,
        validationErrorMessage: getLocalizedText(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS')
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
      validationErrorMessage: getLocalizedText(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS')
    };
  }

  // Simulates Google Address validation (placeholder for actual API integration)
  static async validateWithGoogleAPI(address: string, chatContext: ChatContext): Promise<{
    isValid: boolean;
    formattedAddress?: string;
    errorMessage?: string;
  }> {
    // TODO: Integrate with Google Places API
    // For now, return mock validation
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
    
    const basicValidation = AddressValidator.validateAddress(address, chatContext);
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
  static async fetchServicesForBusiness(businessId: string, chatContext: ChatContext): Promise<{ services: ServiceData[]; error?: string }> {
    if (!businessId) {
      console.error('[ServiceProcessor] Business ID not found in chat context.');
      return { services: [], error: getLocalizedText(chatContext, 'ERROR_MESSAGES.BUSINESS_CONFIG_ERROR') };
    }

    try {
      console.log(`[ServiceProcessor] Fetching services for business: ${businessId}`);
      const services = await Service.getByBusiness(businessId);
      console.log(`[ServiceProcessor] Successfully fetched ${services.length} services`);
      
      if (services.length === 0) {
        console.log(`[ServiceProcessor] No services found for business ${businessId}`);
        return { services: [], error: getLocalizedText(chatContext, 'ERROR_MESSAGES.NO_SERVICES_AVAILABLE') };
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
      return { services: [], error: getLocalizedText(chatContext, 'ERROR_MESSAGES.SERVICES_LOAD_ERROR') };
    }
  }

  // Finds a service by ID from available services
  static findServiceById(serviceId: string, availableServices: ServiceData[]): ServiceData | undefined {
    return availableServices.find(service => service.id === serviceId);
  }

  // NEW: Finds a service by name (intelligent matching)
  static findServiceByName(serviceName: string, availableServices: ServiceData[]): ServiceData | undefined {
    if (!serviceName || !availableServices.length) return undefined;
    
    const normalizedInput = serviceName.toLowerCase().trim();
    console.log(`[ServiceProcessor] Looking for service by name: "${normalizedInput}"`);
    
    // Try exact name match first
    let found = availableServices.find(service => 
      service.name.toLowerCase() === normalizedInput
    );
    
    if (found) {
      console.log(`[ServiceProcessor] Found exact match: ${found.name}`);
      return found;
    }
    
    // Try partial/contains matching
    found = availableServices.find(service => 
      service.name.toLowerCase().includes(normalizedInput) || 
      normalizedInput.includes(service.name.toLowerCase())
    );
    
    if (found) {
      console.log(`[ServiceProcessor] Found partial match: ${found.name}`);
      return found;
    }
    
    // Try word-based matching (for compound service names)
    const inputWords = normalizedInput.split(/\s+/);
    found = availableServices.find(service => {
      const serviceWords = service.name.toLowerCase().split(/\s+/);
      return inputWords.some(inputWord => 
        serviceWords.some(serviceWord => 
          serviceWord.includes(inputWord) || inputWord.includes(serviceWord)
        )
      );
    });
    
    if (found) {
      console.log(`[ServiceProcessor] Found word-based match: ${found.name}`);
      return found;
    }
    
    console.log(`[ServiceProcessor] No match found for: "${serviceName}"`);
    return undefined;
  }

  // NEW: Smart service finding (tries ID first, then name)
  static findServiceSmart(input: string, availableServices: ServiceData[]): ServiceData | undefined {
    // Try UUID pattern first
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(input)) {
      return this.findServiceById(input, availableServices);
    }
    
    // Otherwise try name matching
    return this.findServiceByName(input, availableServices);
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
export class BookingButtonGenerator {
  
  // Creates error buttons based on error type
  static createErrorButtons(errorType: string, chatContext: ChatContext): ButtonConfig[] {
    const businessConfigError = getLocalizedText(chatContext, 'ERROR_MESSAGES.BUSINESS_CONFIG_ERROR');
    const noServicesError = getLocalizedText(chatContext, 'ERROR_MESSAGES.NO_SERVICES_AVAILABLE');
    
    const errorButtonMap: Record<string, ButtonConfig> = {
      [businessConfigError]: {
        buttonText: getLocalizedText(chatContext, 'BUTTONS.SYSTEM_ERROR'),
        buttonValue: 'system_error'
      },
      [noServicesError]: {
        buttonText: getLocalizedText(chatContext, 'BUTTONS.CONTACT_SERVICES'),
        buttonValue: 'contact_support'
      }
    };

    return [errorButtonMap[errorType] || {
      buttonText: getLocalizedText(chatContext, 'BUTTONS.SERVICES_UNAVAILABLE'),
      buttonValue: 'services_unavailable'
    }];
  }

  // Creates service selection buttons with pricing and duration
  static createServiceButtons(services: ServiceData[]): ButtonConfig[] {
    return services.map(service => {
      const mobileIcon = service.mobile ? '🚗 ' : '🏪 ';
      const description = service.description || '';
      
      // Essential parts that must always show
      const priceText = service.fixedPrice ? `$${service.fixedPrice}` : '';
      const durationText = service.durationEstimate ? `${service.durationEstimate}min` : '';
      const essentials = [priceText, durationText].filter(Boolean);
      const essentialsText = essentials.join(' • ');
      
      // Calculate available space for description (WhatsApp limit ~72 chars, reserve space for essentials)
      const maxDescriptionLength = 72 - essentialsText.length - (essentialsText ? 3 : 0); // 3 for ' • '
      
      let finalDescription = '';
      if (description && maxDescriptionLength > 10) { // Only include description if we have meaningful space
        const abbreviatedDesc = this.abbreviateServiceDescription(description, maxDescriptionLength);
        finalDescription = essentialsText ? `${abbreviatedDesc} • ${essentialsText}` : abbreviatedDesc;
      } else {
        // If no space for description, just show essentials
        finalDescription = essentialsText;
      }

      return {
        buttonText: `${mobileIcon}${service.name}`,
        buttonDescription: finalDescription,
        buttonValue: service.id || 'error_service_id_missing'
      };
    });
  }

  // Intelligently truncate service descriptions while preserving essential info
  static abbreviateServiceDescription(description: string, maxLength: number): string {
    if (description.length <= maxLength) {
      return description;
    }

    // Truncate at word boundaries to preserve readability
    const words = description.split(' ');
    let truncated = '';
    
    for (const word of words) {
      const testLength = truncated + (truncated ? ' ' : '') + word + '...';
      if (testLength.length <= maxLength) {
        truncated += (truncated ? ' ' : '') + word;
      } else {
        break;
      }
    }
    
    // Only add ellipsis if we actually truncated
    return truncated + (truncated.length < description.length ? '...' : '');
  }

  // Creates address confirmation buttons
  static createAddressConfirmationButtons(chatContext: ChatContext): ButtonConfig[] {
    return [
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.ADDRESS_CORRECT'), buttonValue: 'address_confirmed' },
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.ADDRESS_EDIT'), buttonValue: 'address_edit' }
    ];
  }
}

// Validation utilities
class BookingValidator {
  
  // Enhanced service selection validation with intelligent matching
  static validateServiceSelection(userInput: string, availableServices: ServiceData[], chatContext: ChatContext): LLMProcessingResult {
    console.log('[BookingValidator] Validating service selection:');
    console.log('[BookingValidator] User input:', userInput);
    console.log('[BookingValidator] Available services:', availableServices?.map(s => ({ id: s.id, name: s.name })));
    
    if (!availableServices || availableServices.length === 0) {
      console.log('[BookingValidator] No available services found');
      return {
        isValidInput: false,
        validationErrorMessage: getLocalizedText(chatContext, 'ERROR_MESSAGES.NO_SERVICES_TO_CHOOSE')
      };
    }

    // Use smart service finding (tries ID first, then name matching)
    const chosenService = ServiceDataProcessor.findServiceSmart(userInput, availableServices);
    console.log('[BookingValidator] Found service:', chosenService ? { id: chosenService.id, name: chosenService.name } : 'NOT FOUND');
    
    if (chosenService) {
      return { 
        isValidInput: true,
        // Store the actual service ID for later processing
        transformedInput: chosenService.id
      };
    }

    console.log('[BookingValidator] Service validation failed - service not found');
    
    // Provide helpful error message with available options
    const serviceNames = availableServices.map(s => s.name).join(', ');
    const language = getUserLanguage(chatContext);
    const errorPrefix = language === 'es' ? 'No pude encontrar ese servicio. Por favor selecciona una de estas opciones:' : 'I couldn\'t find that service. Please select one of these options:';
    
    return {
      isValidInput: false,
      validationErrorMessage: `${errorPrefix} ${serviceNames}`
    };
  }
}

// Simplified availability service
class AvailabilityService {
  
  // Gets the actual user UUID by looking up which business owns this WhatsApp number
  static async findUserIdByBusinessWhatsappNumber(businessWhatsappNumber: string, chatContext: ChatContext): Promise<string | null> {
    try {
      // --- START MODIFICATION: Find user by hardcoded business ID ---
      const businessId = chatContext.currentParticipant.associatedBusinessId;
      if (!businessId) {
        console.error('[AvailabilityService] No business ID found in context for user lookup.');
        return null;
      }
      
      console.log(`[AvailabilityService] Finding user (provider) for business ID: ${businessId}`);
      const userOwningThisBusiness = await User.findUserByBusinessId(businessId);
      
      if (userOwningThisBusiness) {
        console.log(`[AvailabilityService] Found provider user ID: ${userOwningThisBusiness.id} for business ID: ${businessId}`);
        return userOwningThisBusiness.id;
      } else {
        console.error(`[AvailabilityService] No provider user found for business ID: ${businessId}`);
        return null;
      }
      // --- END MODIFICATION ---
    } catch (error) {
      console.error('[AvailabilityService] Error finding user by business ID:', error);
      return null;
    }
  }
  
  // Gets next 2 whole-hour chronologically available time slots for the business that owns this WhatsApp number
  static async getNext2WholeHourSlotsForBusinessWhatsapp(
    businessWhatsappNumber: string, 
    serviceDuration: number,
    chatContext: ChatContext
  ): Promise<Array<{ date: string; time: string; displayText: string }>> {
    try {
      console.log(`[AvailabilityService] Getting next 2 whole-hour slots for business with WhatsApp ${businessWhatsappNumber}, service duration ${serviceDuration} minutes`);
      
      const userOwningThisBusinessId = await this.findUserIdByBusinessWhatsappNumber(businessWhatsappNumber, chatContext);
      if (!userOwningThisBusinessId) {
        console.error('[AvailabilityService] No business owner found for this WhatsApp number');
        return [];
      }
      
      const businessId = chatContext.currentParticipant.associatedBusinessId;
      if (!businessId) {
        console.error('[AvailabilityService] No associated business ID found in context for calendar settings lookup.');
        return [];
      }
      
      const calendarSettings = await CalendarSettings.getByUserAndBusiness(userOwningThisBusinessId, businessId);
      const providerTimezone = calendarSettings?.settings?.timezone || 'UTC';

      // Custom implementation to find whole hour slots by searching through raw availability data
      // getNext3AvailableSlots is hardcoded to return only 3 slots total, so we need a different approach
      
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30); // Search 30 days ahead
      
      console.log(`[AvailabilityService] Searching for whole hour slots from ${today.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      // Get raw availability data for the date range
      const availabilityData = await AvailabilitySlots.getByProviderAndDateRange(
        userOwningThisBusinessId,
        today.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      console.log(`[AvailabilityService] Found ${availabilityData.length} days of availability data`);
      
      if (availabilityData.length === 0) {
        console.log(`[AvailabilityService] No availability data found for provider ${userOwningThisBusinessId}`);
        console.log(`[AvailabilityService] Checking if provider has calendar settings...`);
        
        try {
          const calendarSettings = await CalendarSettings.getByUserAndBusiness(userOwningThisBusinessId, businessId);
          if (!calendarSettings) {
            console.error(`[AvailabilityService] Provider ${userOwningThisBusinessId} has NO calendar settings`);
          } else {
            console.log(`[AvailabilityService] Provider has calendar settings, timezone: ${calendarSettings.settings?.timezone}`);
          }
        } catch (error) {
          console.error(`[AvailabilityService] Error checking calendar settings:`, error);
        }
        
        // Check what availability data exists for this provider (any date range)
        try {
          const allAvailability = await AvailabilitySlots.getByProviderAndDateRange(
            userOwningThisBusinessId,
            '2020-01-01', // Very wide date range
            '2030-12-31'
          );
          console.log(`[AvailabilityService] Provider has ${allAvailability.length} total availability records in database`);
          if (allAvailability.length > 0) {
            console.log(`[AvailabilityService] Date range of existing availability:`, 
              allAvailability.map(slot => slot.date).sort());
          }
        } catch (error) {
          console.error(`[AvailabilityService] Error checking all availability:`, error);
        }
      }
      
      // Find the suitable duration for the service
      const availableDurations = [60, 90, 120, 150, 180, 240, 300, 360];
      const suitableDuration = availableDurations.find(duration => duration >= serviceDuration);
      
      if (!suitableDuration) {
        console.log(`[AvailabilityService] No suitable duration found for ${serviceDuration} minutes`);
        return [];
      }
      
      const durationKey = suitableDuration.toString();
      console.log(`[AvailabilityService] Using duration ${durationKey} for service duration ${serviceDuration}`);
      
      // Collect all available slots and filter for whole hours
      const wholeHourSlots: Array<{ date: string; time: string }> = [];
      const nowInProviderTz = DateTime.now().setZone(providerTimezone);
      
      // Sort availability data by date
      availabilityData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      for (const dayData of availabilityData) {
        const slotsForDuration = dayData.slots[durationKey] || [];
        
        // Filter for whole hours and future times only
        for (const timeSlot of slotsForDuration) {
          const [hours, minutes] = timeSlot.split(':');
          
          // Only consider whole hours (minutes = '00')
          if (minutes === '00') {
            const datePart = dayData.date.substring(0, 10);
            const slotDateTime = DateTime.fromISO(`${datePart}T${timeSlot}`, { zone: providerTimezone });
            
            // Only consider slots that are in the future
            if (slotDateTime.isValid && slotDateTime > nowInProviderTz) {
              wholeHourSlots.push({
                date: dayData.date,
                time: timeSlot
              });
              
              // Stop once we have 2 whole hour slots
              if (wholeHourSlots.length >= 2) {
                break;
              }
            }
          }
        }
        
        // Stop searching if we have enough slots
        if (wholeHourSlots.length >= 2) {
          break;
        }
      }
      
      console.log(`[AvailabilityService] Found ${wholeHourSlots.length} whole hour slots:`, wholeHourSlots.map(s => ({ date: s.date, time: s.time })));
      
      if (wholeHourSlots.length === 0) {
        console.log(`[AvailabilityService] No whole hour slots found. This might indicate availability data only has 30-minute intervals.`);
        return [];
      }
      
      // Use all the whole hour slots we found (up to 2)
      const selectedSlots = wholeHourSlots;
      
             // Format for display with localized text
       return selectedSlots.map((slot: { date: string; time: string }) => {
        const date = new Date(slot.date);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        let dateText = '';
        if (date.toDateString() === today.toDateString()) {
          dateText = getLocalizedText(chatContext, 'TIME_LABELS.TODAY');
        } else if (date.toDateString() === tomorrow.toDateString()) {
          dateText = getLocalizedText(chatContext, 'TIME_LABELS.TOMORROW');
        } else {
          // Use appropriate locale for date formatting
          const language = getUserLanguage(chatContext);
          const locale = language === 'es' ? 'es-ES' : 'en-GB';
          dateText = date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
        }
        
        // Simple time formatting for whole hours with localized AM/PM
        const [hours] = slot.time.split(':');
        const hour24 = parseInt(hours);
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
        const ampm = hour24 >= 12 ? getLocalizedText(chatContext, 'TIME_LABELS.PM') : getLocalizedText(chatContext, 'TIME_LABELS.AM');
        
        // Format time text based on language
        const language = getUserLanguage(chatContext);
        let displayText = '';
        if (language === 'es') {
          displayText = `${dateText} a las ${hour12} ${ampm}`;
        } else {
          displayText = `${dateText} ${hour12} ${ampm}`;
        }
        
        return {
          ...slot,
          displayText: displayText
        };
      });
      
    } catch (error) {
      console.error('[AvailabilityService] Error getting next 2 whole-hour slots for business WhatsApp:', error);
      return [];
    }
  }
  
  // Gets available hours for a specific date for the business that owns this WhatsApp number
  static async getAvailableHoursForDateByBusinessWhatsapp(
    businessWhatsappNumber: string,
    date: string,
    serviceDuration: number,
    chatContext: ChatContext
  ): Promise<string[]> {
    try {
      const userIdOfBusinessOwner = await this.findUserIdByBusinessWhatsappNumber(businessWhatsappNumber, chatContext);
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
    serviceDuration: number,
    chatContext: ChatContext
  ): Promise<boolean> {
    try {
      const availableHoursForThisBusinessAndDate = await AvailabilityService.getAvailableHoursForDateByBusinessWhatsapp(businessWhatsappNumber, date, serviceDuration, chatContext);
      console.log(`[ValidateCustomDate] Date: ${date}, Service Duration: ${serviceDuration}, Available Hours: [${availableHoursForThisBusinessAndDate.join(', ')}], Has Availability: ${availableHoursForThisBusinessAndDate.length > 0}`);
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
  defaultChatbotPrompt: 'Here are the next available appointment times:', // This will be overridden by confirmationMessage
  
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
    
    return { 
      isValidInput: false,
      validationErrorMessage: 'Please select one of the available options.' 
    };
  },
  
  // Use generic processor with custom availability fetching logic
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
    
    console.log('[ShowAvailableTimes] Business WhatsApp number customers messaged TO:', businessWhatsappNumberCustomersMessagedTo);
    console.log('[ShowAvailableTimes] Service selected by customer:', selectedServiceByCustomer);
    
    if (!businessWhatsappNumberCustomersMessagedTo || !selectedServiceByCustomer?.durationEstimate) {
      return {
        ...currentGoalData,
        availabilityError: 'Configuration error - missing business or service information',
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.CONFIGURATION_ERROR')
      };
    }
    
    const next2WholeHourSlots = await AvailabilityService.getNext2WholeHourSlotsForBusinessWhatsapp(
      businessWhatsappNumberCustomersMessagedTo,
      selectedServiceByCustomer.durationEstimate,
      chatContext
    );
    
    console.log('[ShowAvailableTimes] Next 2 whole hour slots:', next2WholeHourSlots);
    
    return {
      ...currentGoalData,
      next2WholeHourSlots: next2WholeHourSlots,
      confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.AVAILABLE_TIMES'),
      listSectionTitle: getLocalizedText(chatContext, 'LIST_SECTIONS.AVAILABLE_OPTIONS')
    };
  },
  
  // Show exactly 2 whole hour time slots + "Choose another day" button
  fixedUiButtons: async (currentGoalData, chatContext) => {
    const availabilityError = currentGoalData.availabilityError as string | undefined;
    if (availabilityError) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.CONTACT_DIRECTLY'), buttonValue: 'contact_support' }];
    }
    
    const next2WholeHourSlots = currentGoalData.next2WholeHourSlots as Array<{ date: string; time: string; displayText: string }> | undefined;
    
    if (!next2WholeHourSlots || next2WholeHourSlots.length === 0) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.OTHER_DAYS'), buttonValue: 'choose_another_day' }];
    }
    
    const timeSlotButtons = next2WholeHourSlots.map((slot, index) => ({
      buttonText: slot.displayText,
      buttonValue: `slot_${index}_${slot.date}_${slot.time}`
    }));
    
    return [
      ...timeSlotButtons,
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.OTHER_DAYS'), buttonValue: 'choose_another_day' }
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
  
  // Process user choice and set flags for subsequent steps using utilities
  processAndExtractData: async (validatedInput, currentGoalData) => {
    console.log('[HandleTimeChoice] Processing input:', validatedInput);
    
    if (validatedInput.startsWith('slot_')) {
      // User selected a quick time slot - use utility to set quick booking
      const parts = validatedInput.split('_');
      const selectedDate = parts[2];
      const selectedTime = parts[3];
      
      console.log('[HandleTimeChoice] Quick booking selected:', { selectedDate, selectedTime });
      return BookingDataManager.setQuickBooking(currentGoalData, selectedDate, selectedTime);
    }
    
    if (validatedInput === 'choose_another_day') {
      // User wants to browse more options - use utility to set browse mode and clear time data
      console.log('[HandleTimeChoice] Browse mode selected - clearing time data');
      return BookingDataManager.setBrowseMode(currentGoalData);
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
    return { 
      isValidInput: false,
      validationErrorMessage: 'Please select one of the available days.' 
    };
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
      
      console.log(`[ShowDayBrowser] === DAY ${i} DEBUG ===`);
      console.log(`[ShowDayBrowser] Today reference: ${today.toISOString()}`);
      console.log(`[ShowDayBrowser] Adding ${i} days to today`);
      console.log(`[ShowDayBrowser] Calculated date object: ${date.toISOString()}`);
      console.log(`[ShowDayBrowser] Date string for availability check: ${dateString}`);
      console.log(`[ShowDayBrowser] Date.getDay() (0=Sun, 6=Sat): ${date.getDay()}`);
      console.log(`[ShowDayBrowser] Date breakdown - Year: ${date.getFullYear()}, Month: ${date.getMonth() + 1}, Day: ${date.getDate()}`);
      
      try {
        const businessHasAvailabilityOnThisDate = await AvailabilityService.validateCustomDateForBusinessWhatsapp(
          businessWhatsappNumberCustomersMessagedTo,
          dateString,
          selectedServiceByCustomer.durationEstimate,
          chatContext
        );
        
        // Calculate display text for all days with localization
        let displayText = '';
        if (i === 0) {
          displayText = getLocalizedText(chatContext, 'TIME_LABELS.TODAY');
        } else if (i === 1) {
          displayText = getLocalizedText(chatContext, 'TIME_LABELS.TOMORROW');
        } else {
          const language = getUserLanguage(chatContext);
          const locale = language === 'es' ? 'es-ES' : 'en-GB';
          displayText = date.toLocaleDateString(locale, { 
            weekday: 'short', day: 'numeric', month: 'short'
          });
        }
        
        console.log(`[ShowDayBrowser] Business has availability on ${dateString}: ${businessHasAvailabilityOnThisDate}`);
        console.log(`[ShowDayBrowser] Calculated display text: ${displayText}`);
        
        if (businessHasAvailabilityOnThisDate) {
          // Enhanced debug logging
          console.log(`[ShowDayBrowser] === ADDING AVAILABLE DAY ===`);
          console.log(`[ShowDayBrowser] Date value (what goes in button): ${dateString}`);
          console.log(`[ShowDayBrowser] Display text (what user sees): ${displayText}`);
          console.log(`[ShowDayBrowser] Date object for display: ${date.toISOString()}`);
          console.log(`[ShowDayBrowser] toLocaleDateString result: ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`);
          console.log(`[ShowDayBrowser] Weekday: ${date.toLocaleDateString('en-GB', { weekday: 'short' })}`);
          console.log(`[ShowDayBrowser] Day of month: ${date.toLocaleDateString('en-GB', { day: 'numeric' })}`);
          console.log(`[ShowDayBrowser] Month: ${date.toLocaleDateString('en-GB', { month: 'short' })}`);
          console.log(`[ShowDayBrowser] === END AVAILABLE DAY ===`);
          
          availableDaysForThisBusiness.push({
            date: dateString,
            displayText: displayText
          });
        } else {
          console.log(`[ShowDayBrowser] No availability on ${dateString} (${displayText}), skipping`);
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
      confirmationMessage: 'Available days:'
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
    
    // Show up to 8 days as buttons (WhatsApp actual limit observed)
    const buttons = availableDays.slice(0, 8).map(day => ({
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
  // No autoAdvance - only advance when user actually selects a day
  
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
      
      console.log(`[SelectSpecificDay] === DAY SELECTION DEBUG ===`);
      console.log(`[SelectSpecificDay] User clicked button with value: ${validatedInput}`);
      console.log(`[SelectSpecificDay] Extracted date: ${selectedDate}`);
      console.log(`[SelectSpecificDay] Date object from extracted date: ${new Date(selectedDate).toISOString()}`);
      console.log(`[SelectSpecificDay] Day of week: ${new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long' })}`);
      console.log(`[SelectSpecificDay] === END DAY SELECTION DEBUG ===`);
      
      return {
        ...currentGoalData,
        selectedDate,
        shouldAutoAdvance: true, // Only auto-advance when day is successfully selected
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
      selectedServiceByCustomer.durationEstimate,
      chatContext
    );
    
    if (availableHoursForBusinessOnSelectedDate.length === 0) {
      return {
        ...currentGoalData,
        availabilityError: 'No appointments available on this date',
        confirmationMessage: 'Sorry, no appointments are available on this date. Please choose another day.'
      };
    }
    
    // Filter to only rounded times (00 minutes) and format for display
    const roundedTimesOnly = availableHoursForBusinessOnSelectedDate.filter(time => {
      const [hours, minutes] = time.split(':');
      return minutes === '00'; // Only show rounded hours (7:00, 8:00, etc.)
    });
    
    const formattedHoursForDisplay = roundedTimesOnly.map(time => {
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';  
      return {
        time24: time,
        display: `${hour12} ${ampm}` // Always rounded, so no minutes needed
      };
    });
    
    return {
      ...currentGoalData,
      availableHours: availableHoursForBusinessOnSelectedDate,
      formattedAvailableHours: formattedHoursForDisplay,
      confirmationMessage: 'Please select a time:' // Simple prompt, buttons only
    };
  },
  
  // Show all available rounded time buttons (up to 10 to fit WhatsApp limits)
  fixedUiButtons: async (currentGoalData) => {
    if (currentGoalData.quickBookingSelected) {
      return []; // No buttons when skipping
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours;
    const availabilityError = currentGoalData.availabilityError;
    
    if (availabilityError) {
      return [
        { buttonText: '📞 Contact us', buttonValue: 'contact_support' },
        { buttonText: '📅 Other days', buttonValue: 'choose_different_date' }
      ];
    }
    
          if (!formattedHours || formattedHours.length === 0) {
        return [{ buttonText: '📅 Other days', buttonValue: 'choose_different_date' }];
      }
    
    // Show all available rounded time slots as buttons (up to 8 for WhatsApp limit)
    return formattedHours.slice(0, 8).map((hour: any) => ({
      buttonText: hour.display,
      buttonValue: hour.display
    }));
  }
};

// Step 6: Handle time selection
// Job: ONLY process time selection when in browse mode
export const selectSpecificTimeHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please select your preferred time:',
  // No autoAdvance - only advance when user actually selects a time
  
  // Skip if quick booking, validate time if browsing
  validateUserInput: async (userInput, currentGoalData) => {
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true }; // Skip
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours || [];
    
    // If no time options are available but we're in browse mode, we need to go back to load hours
    if (formattedHours.length === 0 && currentGoalData.selectedDate) {
      return {
        isValidInput: false,
        validationErrorMessage: 'Loading available times...'
      };
    }
    
    // If no time options and no selected date, there's a bigger issue
    if (formattedHours.length === 0) {
      return {
        isValidInput: false,
        validationErrorMessage: 'Please select a date first.'
      };
    }
    
    // Check if the user input is one of the displayed options
    if (formattedHours.some((h: any) => h.display === userInput)) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select a valid time.'
    };
  },
  
  // Process time selection or load time data if missing
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    if (currentGoalData.quickBookingSelected) {
      return currentGoalData; // Skip, time already set
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours || [];
    
    // If we don't have time data but have a selected date, load the time data now
    if (formattedHours.length === 0 && currentGoalData.selectedDate) {
      const businessWhatsappNumber = chatContext.currentParticipant.businessWhatsappNumber;
      const selectedService = currentGoalData.selectedService;
      const selectedDate = currentGoalData.selectedDate;
      
      if (businessWhatsappNumber && selectedService?.durationEstimate && selectedDate) {
        try {
          // Load available hours for the selected date
          const availableHours = await AvailabilityService.getAvailableHoursForDateByBusinessWhatsapp(
            businessWhatsappNumber,
            selectedDate,
            selectedService.durationEstimate,
            chatContext
          );
          
          // Filter to only rounded times (00 minutes) and format for display
          const roundedTimesOnly = availableHours.filter(time => {
            const [hours, minutes] = time.split(':');
            return minutes === '00'; // Only show rounded hours (7:00, 8:00, etc.)
          });
          
          const formattedHoursForDisplay = roundedTimesOnly.map(time => {
            const [hours, minutes] = time.split(':');
            const hour24 = parseInt(hours);
            const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
            const ampm = hour24 >= 12 ? 'PM' : 'AM';
            return {
              time24: time,
              display: `${hour12} ${ampm}`
            };
          });
          
          return {
            ...currentGoalData,
            availableHours,
            formattedAvailableHours: formattedHoursForDisplay,
            confirmationMessage: 'Please select a time:'
          };
          
        } catch (error) {
          console.error('[SelectSpecificTime] Error loading hours:', error);
          return {
            ...currentGoalData,
            confirmationMessage: 'Sorry, there was an error loading available times. Please try selecting a date again.'
          };
        }
      }
    }
    
    // If we still don't have time data, there's an issue
    if (formattedHours.length === 0) {
      return {
        ...currentGoalData,
        confirmationMessage: 'Please select a date first to see available times.'
      };
    }
    
    // Process time selection - convert display format back to 24h if needed
    let selectedTime = validatedInput;
    const matchedHour = formattedHours.find((h: any) => h.display === validatedInput);
    if (matchedHour) {
      selectedTime = matchedHour.time24;
    }
    
    return {
      ...currentGoalData,
      selectedTime,
      shouldAutoAdvance: true, // Only auto-advance when time is successfully selected
      confirmationMessage: `Great! You've selected ${validatedInput}. Let's confirm your details.`
    };
  },
  
  // Show time buttons if available
  fixedUiButtons: async (currentGoalData) => {
    if (currentGoalData.quickBookingSelected) {
      return []; // No buttons needed for quick booking
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours || [];
    
    if (formattedHours.length === 0) {
      return [{ buttonText: '📅 Choose a date first', buttonValue: 'choose_date' }];
    }
    
    // Create buttons for each available time
    const timeButtons = formattedHours.map((hour: any) => ({
      buttonText: hour.display,
      buttonValue: hour.display
    }));
    
    return timeButtons;
  }
};

// =====================================
// QUOTE AND BOOKING SUMMARY HANDLERS
// =====================================

// Step: Create quote and show comprehensive summary with all details
// Job: Calculate quote using proper helpers, persist to database, and display summary asking for confirmation
export const quoteSummaryHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here\'s your booking summary:',
  
  // Accept empty input (first display) and detect service selections
  validateUserInput: async (userInput, currentGoalData) => {
    console.log('[QuoteSummary] Validating input:', userInput);
    
    // If this is empty input (first display), accept it
    if (!userInput || userInput === "") {
      console.log('[QuoteSummary] Empty input - accepting for first display');
      return { isValidInput: true };
    }
    
    // If this is a button click, reject it so it goes to handleQuoteChoice
    if (userInput === 'confirm_quote' || userInput === 'edit_quote') {
      console.log('[QuoteSummary] Button click detected - rejecting to pass to next step');
      return { 
        isValidInput: false,
        validationErrorMessage: '' // No error message, just advance to next step
      };
    }
    
    // Check if this looks like a service ID (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userInput)) {
      console.log('[QuoteSummary] Service ID detected - accepting to restart booking process');
      return { isValidInput: true };
    }
    
    // Other input types rejected with a more helpful message
    console.log('[QuoteSummary] Other input - rejecting');
    return { 
      isValidInput: false,
      validationErrorMessage: 'Please use the buttons below to confirm or edit your quote.' 
    };
  },
  
  // Calculate quote using proper helpers, persist to database, and generate comprehensive summary
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[QuoteSummary] Processing input:', validatedInput);
    
    // Check if user selected a different service (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(validatedInput)) {
      console.log('[QuoteSummary] User selected different service, restarting booking process');
      
      // Find the service they selected
      const availableServices = currentGoalData.availableServices;
      const selectedServiceData = ServiceDataProcessor.findServiceById(validatedInput, availableServices);
      
      if (selectedServiceData) {
        console.log('[QuoteSummary] Found new service:', selectedServiceData.name);
        
        // Reset the booking process with the new service
        return {
          availableServices: availableServices, // Keep the services list
          selectedService: ServiceDataProcessor.extractServiceDetails(selectedServiceData),
          // Clear all other booking data to restart the process
          selectedDate: undefined,
          selectedTime: undefined,
          quickBookingSelected: undefined,
          browseModeSelected: undefined,
          finalServiceAddress: undefined,
          serviceLocation: undefined,
          persistedQuote: undefined,
          quoteId: undefined,
          bookingSummary: undefined,
          // Set a flag to restart from the appropriate step
          restartBookingFlow: true,
          shouldAutoAdvance: true,
          confirmationMessage: `Great! Let's book a ${selectedServiceData.name} appointment.`
        };
      } else {
        console.log('[QuoteSummary] Service not found in available services');
        return {
          ...currentGoalData,
          confirmationMessage: 'Sorry, that service is not available. Please use the buttons below.'
        };
      }
    }
    
    // Only process empty input (first display) for normal quote generation
    if (validatedInput !== "") {
      console.log('[QuoteSummary] Non-empty input - not processing');
      return currentGoalData;
    }
    
    const selectedService = currentGoalData.selectedService;
    const selectedDate = currentGoalData.selectedDate;
    const selectedTime = currentGoalData.selectedTime;
    const finalServiceAddress = currentGoalData.finalServiceAddress;
    const serviceLocation = currentGoalData.serviceLocation;
    const userId = currentGoalData.userId;
    const businessId = chatContext.currentParticipant.associatedBusinessId;
    
    if (!selectedService || !selectedDate || !selectedTime || !finalServiceAddress || !userId || !businessId) {
      return {
        ...currentGoalData,
        summaryError: 'Missing booking information'
      };
    }

    try {
      // Step 1: Calculate quote using proper helpers
      const service = new Service({
        id: selectedService.id,
        name: selectedService.name,
        durationEstimate: selectedService.durationEstimate,
        fixedPrice: selectedService.fixedPrice,
        pricingType: selectedService.pricingType,
        mobile: selectedService.mobile,
        ratePerMinute: selectedService.ratePerMinute,
        baseCharge: selectedService.baseCharge,
        businessId: businessId
      });

      // For mobile services, we need travel time estimate
      let travelTimeEstimate = 0;
      if (serviceLocation === 'customer_address') {
        // TODO: Replace with actual travel time calculation from Google API
        travelTimeEstimate = 25; // Mock travel time in minutes
      }

      // Use the proper quote calculation
      const quoteEstimation: QuoteEstimation = computeQuoteEstimation(service, travelTimeEstimate);

      // Step 2: Get business address for quote persistence
      let businessAddress = 'Business Location'; // Fallback
      try {
        const business = await Business.getById(businessId);
        businessAddress = business.businessAddress || business.name || 'Business Location';
      } catch (error) {
        console.warn('[QuoteSummary] Could not fetch business address, using fallback');
      }

      // Determine pickup and dropoff based on service type
      let pickUp = '';
      let dropOff = '';
      
      if (serviceLocation === 'customer_address') {
        // For mobile services: business location -> customer location
        pickUp = businessAddress;
        dropOff = finalServiceAddress;
      } else {
        // For non-mobile services: customer location -> business location  
        pickUp = finalServiceAddress;
        dropOff = businessAddress;
      }

      // Step 3: Create and persist the quote
      const quoteData: QuoteData = {
        userId,
        pickUp,
        dropOff,
        businessId,
        serviceId: selectedService.id,
        travelTimeEstimate,
        totalJobDurationEstimation: quoteEstimation.totalJobDuration,
        travelCostEstimate: quoteEstimation.travelCost,
        totalJobCostEstimation: quoteEstimation.totalJobCost,
        status: 'pending',
      };

      const quote = new Quote(quoteData, selectedService.mobile); // Pass mobile flag for validation

      // Persist to database
      const savedQuoteData = await quote.add();
      console.log('[QuoteSummary] Quote successfully created with ID:', savedQuoteData.id);

      // Step 4: Generate display formatting
      // Calculate estimated completion time
      const duration = quoteEstimation.totalJobDuration;
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
      
      // Calculate payment details using Quote model
      let depositAmount = savedQuoteData.depositAmount;
      let remainingBalance = savedQuoteData.remainingBalance;
      let requiresDeposit = false;
      
      if (!depositAmount || !remainingBalance) {
        try {
          const { Quote } = await import('@/lib/database/models/quote');
          if (!savedQuoteData.id) {
            throw new Error('No quote ID available');
          }
          const quote = await Quote.getById(savedQuoteData.id);
          const paymentDetails = await quote.calculatePaymentDetails();
          
          depositAmount = paymentDetails.depositAmount;
          remainingBalance = paymentDetails.remainingBalance;
          requiresDeposit = depositAmount !== undefined && depositAmount !== null && depositAmount > 0;
          
          console.log('[QuoteSummary] Calculated payment details:', { depositAmount, remainingBalance, requiresDeposit });
        } catch (error) {
          console.warn('[QuoteSummary] Could not calculate payment details from Quote model:', error);
          // Fallback to no deposit required
          requiresDeposit = false;
        }
      } else {
        requiresDeposit = depositAmount > 0;
      }
      
      // Create detailed summary message using localized text
      const t = BOOKING_TRANSLATIONS[getUserLanguage(chatContext)];
      
      let summaryMessage = `${t.QUOTE_SUMMARY.TITLE}\n\n` +
        `${t.QUOTE_SUMMARY.SERVICE} ${selectedService.name}\n` +
        `${t.QUOTE_SUMMARY.DATE} ${formattedDate}\n` +
        `${t.QUOTE_SUMMARY.TIME} ${formattedTime}\n` +
        `${t.QUOTE_SUMMARY.DURATION} ${duration} ${t.QUOTE_SUMMARY.MINUTES}\n` +
        `${t.QUOTE_SUMMARY.ESTIMATED_COMPLETION} ${estimatedEndTime}\n` +
        `${t.QUOTE_SUMMARY.LOCATION} ${finalServiceAddress}\n\n` +
        `${t.QUOTE_SUMMARY.PRICING}\n` +
        `   ${t.QUOTE_SUMMARY.SERVICE_COST} $${quoteEstimation.serviceCost.toFixed(2)}\n` +
        `${quoteEstimation.travelCost > 0 ? `   ${t.QUOTE_SUMMARY.TRAVEL_COST} $${quoteEstimation.travelCost.toFixed(2)}\n` : ''}` +
        `   ${t.QUOTE_SUMMARY.TOTAL_COST} $${quoteEstimation.totalJobCost.toFixed(2)}*\n\n`;
      
      // Only show deposit/payment info if business requires deposits
      if (requiresDeposit && depositAmount) {
        const totalPayNow = depositAmount + 4;
        
        // Get business preferred payment method for balance due
        const businessId = chatContext.currentParticipant.associatedBusinessId;
        let preferredPaymentMethod = getUserLanguage(chatContext) === 'es' ? 'efectivo/tarjeta' : 'cash/card';
        
        if (businessId) {
          try {
            const business = await Business.getById(businessId);
            if (business.preferredPaymentMethod) {
              preferredPaymentMethod = business.preferredPaymentMethod;
            }
          } catch (error) {
            console.warn('[QuoteSummary] Could not fetch business payment method');
          }
        }
        
        summaryMessage += `💳 *Booking Payment:*\n` +
          `   • Paid Now: $${totalPayNow.toFixed(2)}\n` +
          `   • Balance Due: $${remainingBalance.toFixed(2)} (${preferredPaymentMethod})\n` +
          `   • Total Service Cost: $${quoteEstimation.totalJobCost.toFixed(2)}\n\n`;
      }
      
      summaryMessage += `${t.QUOTE_SUMMARY.QUOTE_ID} ${savedQuoteData.id}\n\n`;
      
      if (requiresDeposit) {
        summaryMessage += `Ready to secure your booking?`;
      } else {
        summaryMessage += `${t.QUOTE_SUMMARY.CONFIRM_QUESTION}`;
      }
      
              return {
          ...currentGoalData,
          persistedQuote: savedQuoteData,
          quoteId: savedQuoteData.id,
          quoteEstimation,
          travelTimeEstimate,
          requiresDeposit,
          depositAmount: requiresDeposit ? depositAmount : undefined,
          remainingBalance: remainingBalance,
          totalPaymentAmount: requiresDeposit && depositAmount ? depositAmount + 4 : undefined,
          bookingSummary: {
            serviceCost: quoteEstimation.serviceCost,
            travelCost: quoteEstimation.travelCost,
            totalCost: quoteEstimation.totalJobCost,
            requiresDeposit,
            depositAmount: requiresDeposit ? depositAmount : undefined,
            remainingBalance: remainingBalance,
            totalPaymentAmount: requiresDeposit && depositAmount ? depositAmount + 4 : undefined,
            duration,
            estimatedEndTime,
            formattedDate,
            formattedTime
          },
          shouldAutoAdvance: false, // Don't auto-advance, show buttons for user choice
          confirmationMessage: summaryMessage
        };

    } catch (error) {
      console.error('[QuoteSummary] Error creating quote:', error);
      
      return {
        ...currentGoalData,
        summaryError: 'Failed to create quote and summary. Please try again.',
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.ISSUE_PREPARING_QUOTE')
      };
    }
  },
  
  // Show payment or confirmation buttons based on deposit requirements
  fixedUiButtons: async (currentGoalData, chatContext) => {
    const summaryError = currentGoalData.summaryError;
    
    if (summaryError) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.TRY_AGAIN'), buttonValue: 'restart_booking' }];
    }
    
    const requiresDeposit = currentGoalData.requiresDeposit || currentGoalData.bookingSummary?.requiresDeposit;
    
    if (requiresDeposit) {
      const depositAmount = currentGoalData.depositAmount || currentGoalData.bookingSummary?.depositAmount;
      const totalPaymentAmount = currentGoalData.totalPaymentAmount || currentGoalData.bookingSummary?.totalPaymentAmount;
      
      if (totalPaymentAmount) {
        const payDepositText = getUserLanguage(chatContext) === 'es' 
          ? `💳 Pagar $${totalPaymentAmount.toFixed(2)}`
          : `💳 Pay $${totalPaymentAmount.toFixed(2)}`;
        
        return [
          { buttonText: payDepositText, buttonValue: 'confirm_quote' },
          { buttonText: getLocalizedText(chatContext, 'BUTTONS.EDIT'), buttonValue: 'edit_quote' }
        ];
      }
    }
    
    // No deposit required - show regular confirm button
    return [
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.CONFIRM'), buttonValue: 'confirm_quote' },
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.EDIT'), buttonValue: 'edit_quote' }
    ];
  }
};

// Step: Handle user's choice from quote summary
// Job: Process confirmation (trigger payment) or show edit options
export const handleQuoteChoiceHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Processing your choice...',
  // Conditionally auto-advance: only when quote is confirmed, not when showing edit options
  
  // Accept confirmation, edit choice, or payment completion
  validateUserInput: async (userInput) => {
    console.log('[HandleQuoteChoice] Validating input:', userInput);
    if (userInput === 'confirm_quote' || userInput === 'edit_quote') {
      return { isValidInput: true };
    }
    
    // Handle edit sub-choices (service, time)
    if (userInput === 'edit_service' || userInput === 'edit_time') {
      return { isValidInput: true };
    }
    
    // Handle payment completion messages
    if (userInput && userInput.startsWith('PAYMENT_COMPLETED_')) {
      console.log('[HandleQuoteChoice] Payment completion message detected - accepting for processing');
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select one of the available options.'
    };
  },
  
  // Process user choice and set flags for subsequent steps
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[HandleQuoteChoice] Processing input:', validatedInput);
    
    if (validatedInput === 'confirm_quote') {
      // Clear any previous payment errors when retrying
      const isRetry = currentGoalData.paymentError;
      if (isRetry) {
        console.log('[HandleQuoteChoice] Clearing previous payment error for retry');
      }
      
      const requiresDeposit = currentGoalData.requiresDeposit || currentGoalData.bookingSummary?.requiresDeposit;
      
      if (requiresDeposit) {
        console.log('[HandleQuoteChoice] Quote confirmed - creating payment link for deposit');
        
        try {
          const quoteId = currentGoalData.quoteId || currentGoalData.persistedQuote?.id;
          if (!quoteId) {
            console.error('[HandleQuoteChoice] No quote ID found for payment');
            const errorMessage = getUserLanguage(chatContext) === 'es'
              ? 'Lo siento, hubo un problema procesando tu reserva. Por favor intenta de nuevo.'
              : 'Sorry, there was an issue processing your booking. Please try again.';
            return {
              ...currentGoalData,
              paymentError: true,
              confirmationMessage: errorMessage
            };
          }

          // Get payment details
          const depositAmount = currentGoalData.depositAmount || currentGoalData.bookingSummary?.depositAmount;
          const totalChargeAmount = currentGoalData.totalPaymentAmount || currentGoalData.bookingSummary?.totalPaymentAmount;

          if (!depositAmount || !totalChargeAmount) {
            console.error('[HandleQuoteChoice] No deposit amount found');
            const errorMessage = getUserLanguage(chatContext) === 'es'
              ? 'Lo siento, hubo un problema calculando el monto del pago. Por favor intenta de nuevo.'
              : 'Sorry, there was an issue calculating payment amount. Please try again.';
            return {
              ...currentGoalData,
              paymentError: true,
              confirmationMessage: errorMessage
            };
          }

          // Create payment link
          console.log(`[HandleQuoteChoice] Creating payment link for quote ${quoteId}`);
          const paymentResult = await StripePaymentService.createPaymentLinkForQuote(quoteId);
          
          if (!paymentResult.success) {
            console.error('[HandleQuoteChoice] Failed to create payment link:', paymentResult.error);
            return {
              ...currentGoalData,
              paymentError: true,
              confirmationMessage: 'Sorry, there was an issue setting up payment. Please contact us directly to complete your booking.'
            };
          }

          console.log('[HandleQuoteChoice] Payment link created successfully');
          
          // Get business info for personalization
          const businessId = chatContext.currentParticipant.associatedBusinessId;
          let businessName = 'the business';
          if (businessId) {
            try {
              const business = await Business.getById(businessId);
              businessName = business.name;
            } catch (error) {
              console.warn('[HandleQuoteChoice] Could not fetch business name');
            }
          }

          const language = getUserLanguage(chatContext);
          
          // Get balance breakdown from Quote model or goal data
          const serviceTotal = currentGoalData.selectedService?.fixedPrice || 0;
          const remainingBalance = currentGoalData.remainingBalance || currentGoalData.bookingSummary?.remainingBalance || (serviceTotal - depositAmount);
          
          // Get business preferred payment method
          let preferredPaymentMethod = language === 'es' ? 'efectivo o tarjeta' : 'cash or card';
          
          if (businessId) {
            try {
              const business = await Business.getById(businessId);
              if (business.preferredPaymentMethod) {
                preferredPaymentMethod = business.preferredPaymentMethod;
              }
            } catch (error) {
              console.warn('[HandleQuoteChoice] Could not fetch business payment method');
            }
          }
          
          const paymentMessage = language === 'es' 
            ? `💳 *¡Listo para Reservar!*\n\n` +
              `Para asegurar tu cita, por favor completa el pago del depósito de reserva:\n\n` +
              `💰 *Desglose del Pago:*\n` +
              `   • Servicio total: $${serviceTotal.toFixed(2)}\n` +
              `   • Depósito (ahora): $${depositAmount.toFixed(2)}\n` +
              `   • Tarifa de reserva: $4.00\n` +
              `   • *Total a pagar ahora: $${totalChargeAmount.toFixed(2)}*\n\n` +
              `📍 *Balance restante: $${remainingBalance.toFixed(2)}*\n` +
              `   💳 A pagar en la cita (${preferredPaymentMethod})\n\n` +
              `🔗 *Enlace de Pago:*\n${paymentResult.paymentLink}\n\n` +
              `¡Después del pago, serás redirigido de vuelta a WhatsApp y tu reserva será confirmada automáticamente!\n\n` +
              `✅ Pago seguro y protegido por Stripe\n` +
              `🔒 Tu pago va directamente a ${businessName}`
            : `💳 *Ready to Book!*\n\n` +
              `To secure your appointment, please complete your booking deposit payment:\n\n` +
              `💰 *Payment Breakdown:*\n` +
              `   • Service total: $${serviceTotal.toFixed(2)}\n` +
              `   • Deposit (now): $${depositAmount.toFixed(2)}\n` +
              `   • Booking fee: $4.00\n` +
              `   • *Total to pay now: $${totalChargeAmount.toFixed(2)}*\n\n` +
              `📍 *Remaining balance: $${remainingBalance.toFixed(2)}*\n` +
              `   💳 Pay at appointment (${preferredPaymentMethod})\n\n` +
              `🔗 *Payment Link:*\n${paymentResult.paymentLink}\n\n` +
              `After payment, you'll be redirected back to WhatsApp and your booking will be confirmed automatically!\n\n` +
              `✅ Safe & secure payment powered by Stripe\n` +
              `🔒 Your payment goes directly to ${businessName}`;

          return {
            ...currentGoalData,
            paymentLinkGenerated: true,
            paymentLink: paymentResult.paymentLink,
            paymentError: false, // Clear any previous payment errors
            shouldAutoAdvance: false, // Don't auto-advance, wait for payment
            confirmationMessage: paymentMessage
          };

        } catch (error) {
          console.error('[HandleQuoteChoice] Error creating payment link:', error);
          return {
            ...currentGoalData,
            paymentError: true,
            confirmationMessage: 'Sorry, there was an issue setting up payment. Please contact us directly to complete your booking.'
          };
        }
      } else {
        // No deposit required - proceed directly to booking creation
        console.log('[HandleQuoteChoice] Quote confirmed - no deposit required, proceeding to booking creation');
        return {
          ...currentGoalData,
          quoteConfirmedFromSummary: true,
          shouldAutoAdvance: true, // Auto-advance to createBooking step
          confirmationMessage: 'Perfect! Your quote is confirmed. Creating your booking...'
        };
      }
    }
    
    if (validatedInput === 'edit_quote') {
      console.log('[HandleQuoteChoice] Edit requested - showing edit options');
      return {
        ...currentGoalData,
        showEditOptions: true,
        shouldAutoAdvance: false, // Don't auto-advance, stay to show edit options
        confirmationMessage: 'What would you like to change?'
      };
    }
    
    // Handle specific edit choices
    if (validatedInput === 'edit_service') {
      console.log('[HandleQuoteChoice] Service edit requested - navigating back to selectService');
      return {
        ...currentGoalData,
        navigateBackTo: 'selectService',
        shouldAutoAdvance: true, // Auto-advance to navigate back
        confirmationMessage: 'Let\'s choose a different service...'
      };
    }
    
    if (validatedInput === 'edit_time') {
      console.log('[HandleQuoteChoice] Time edit requested - navigating back to showAvailableTimes');
      return {
        ...currentGoalData,
        navigateBackTo: 'showAvailableTimes',
        shouldAutoAdvance: true, // Auto-advance to navigate back
        confirmationMessage: 'Let\'s pick a different time...'
      };
    }
    
    // Handle payment completion
    if (validatedInput && validatedInput.startsWith('PAYMENT_COMPLETED_')) {
      console.log('[HandleQuoteChoice] Payment completion detected - advancing to booking creation');
      const quoteId = validatedInput.replace('PAYMENT_COMPLETED_', '');
      console.log(`[HandleQuoteChoice] Payment completed for quote: ${quoteId}`);
      
      return {
        ...currentGoalData,
        paymentCompleted: true,
        paymentLinkGenerated: false, // Clear payment link state
        shouldAutoAdvance: true, // Auto-advance to createBooking step
        confirmationMessage: 'Payment received! Creating your booking...'
      };
    }
    
    console.log('[HandleQuoteChoice] Unexpected input, returning current data');
    return currentGoalData;
  },
  
  // Show edit options if user chose to edit, or no buttons if payment link was generated
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.paymentError) {
      return [
        { buttonText: getLocalizedText(chatContext, 'BUTTONS.TRY_AGAIN'), buttonValue: 'confirm_quote' },
        { buttonText: getLocalizedText(chatContext, 'BUTTONS.EDIT'), buttonValue: 'edit_quote' }
      ];
    }

    if (currentGoalData.paymentLinkGenerated) {
      // No buttons needed - user should click the payment link
      return [];
    }

    if (currentGoalData.showEditOptions) {
      return [
        { buttonText: 'Change Service', buttonValue: 'edit_service' },
        { buttonText: 'Change Date/Time', buttonValue: 'edit_time' }
      ];
    }
    
    // No buttons if quote confirmed or navigating back
    return [];
  }
};

// =====================================
// USER MANAGEMENT STEPS
// =====================================

// Step 1: Check if user exists in system
// Job: ONLY check user existence, no input processing
export const checkExistingUserHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Checking system...', // This will be overridden by confirmationMessage
  autoAdvance: true, // Auto-advance to next step after checking user existence
  
  // Only accept empty input (first check), reject any other input
  validateUserInput: async (userInput) => {
    console.log('[CheckExistingUser] Validating input:', userInput);
    
    // If this is empty input (first check), accept it
    if (!userInput || userInput === "") {
      console.log('[CheckExistingUser] Empty input - accepting for first check');
      return { isValidInput: true };
    }
    
    // Reject any other input so it goes to next step
    console.log('[CheckExistingUser] Non-empty input - rejecting to pass to next step');
    return { 
      isValidInput: false,
      validationErrorMessage: '' // No error message, just advance
    };
  },
  
  // Check user existence only on first execution
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[CheckExistingUser] Processing input:', validatedInput);
    
    // Only process empty input (first check)
    if (validatedInput !== "") {
      console.log('[CheckExistingUser] Non-empty input - not processing');
      return currentGoalData;
    }
    
    // Show initial checking message
    if (!currentGoalData.userExistenceChecked) {
      // Set the checking message first
      console.log('[CheckExistingUser] Setting initial checking message');
    }
    
    const customerWhatsappNumber = chatContext.currentParticipant.customerWhatsappNumber;
    
    if (!customerWhatsappNumber) {
      console.error('[CheckExistingUser] No customer WhatsApp number found');
      return {
        ...currentGoalData,
        userCheckError: 'Unable to identify customer WhatsApp number'
      };
    }
    
    try {
      console.log('[CheckExistingUser] Checking if user exists for WhatsApp:', customerWhatsappNumber);
      const existingUser = await User.findUserByCustomerWhatsappNumber(customerWhatsappNumber);
      
      if (existingUser) {
        console.log('[CheckExistingUser] Found existing user:', existingUser.id);
        return {
          ...currentGoalData,
          userExistenceChecked: true,
          existingUserFound: true,
          userId: existingUser.id,
          userName: existingUser.firstName,
          confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.WELCOME_BACK', { name: existingUser.firstName })
        };
      } else {
        console.log('[CheckExistingUser] No existing user found');
        return {
          ...currentGoalData,
          userExistenceChecked: true,
          needsUserCreation: true,
          confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.NOT_IN_SYSTEM')
        };
      }
    } catch (error) {
      console.error('[CheckExistingUser] Error checking for existing user:', error);
      return {
        ...currentGoalData,
        userExistenceChecked: true,
        needsUserCreation: true,
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.CREATE_ACCOUNT')
      };
    }
  }
};

// Step 2: Route flow based on user status
// Job: Silently route to name collection for new users, or skip creation steps for existing users.
export const handleUserStatusHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Checking your account status...',
  autoAdvance: true,

  validateUserInput: async () => ({ isValidInput: true }),

  processAndExtractData: async (validatedInput, currentGoalData) => {
    // This handler is skipped by the message processor for existing users.
    // Its only job is to set the flag for new users to proceed to name collection.
    if (currentGoalData.needsUserCreation) {
      return {
        ...currentGoalData,
        proceedToNameCollection: true,
      };
    }

    // Fallback, should not be reached in a normal flow
    return currentGoalData;
  }
};

// Step 3: Ask for user name
// Job: ONLY ask for name if the user is new.
export const askUserNameHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'What\'s your first name so I can create your account?',
  
  validateUserInput: async (userInput, currentGoalData) => {
    // This step is skipped entirely for existing users by the message processor.
    // Validation only runs for new users.
    if (currentGoalData.proceedToNameCollection) {
      // Accept empty input for the first time the prompt is shown
      if (!userInput || userInput.trim() === "") {
        return { isValidInput: true };
      }
      // Validate the name once provided
      if (userInput.trim().length < 2) {
        return {
          isValidInput: false,
          validationErrorMessage: 'Please provide your first name (at least 2 characters).'
        };
      }
      return { isValidInput: true };
    }

    // Default pass-through, though it shouldn't be reached in a normal flow
    return { isValidInput: true };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData) => {
    // This step is skipped for existing users. It assumes it's running for a new user.
    if (!validatedInput || !validatedInput.trim()) {
      return {
        ...currentGoalData,
        confirmationMessage: 'What\'s your first name so I can create your account?'
      };
    }
    
    // We have a name, so store it and prepare for the next step.
    const firstName = validatedInput.trim();
    return {
      ...currentGoalData,
      providedUserName: firstName,
      readyForUserCreation: true,
      shouldAutoAdvance: true, // Auto-advance to the creation step
      confirmationMessage: `Thanks ${firstName}! Creating your account...`
    };
  }
};

// Step 4: Create new user
// Job: ONLY create user if a name has been provided
export const createNewUserHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Creating your account...',
  autoAdvance: true,
  
  validateUserInput: async () => ({ isValidInput: true }),
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    // This step is skipped for existing users.
    // It will only run if readyForUserCreation is true, which is set by the previous step.
    if (!currentGoalData.readyForUserCreation) {
      return currentGoalData;
    }
    
    const firstName = currentGoalData.providedUserName as string;
    const customerWhatsappNumber = chatContext.currentParticipant.customerWhatsappNumber;
    const businessId = chatContext.currentParticipant.associatedBusinessId;
    
    if (!customerWhatsappNumber || !businessId) {
      console.error('[CreateNewUser] Missing required data for user creation');
      return {
        ...currentGoalData,
        userCreationError: 'Missing required information for user creation'
      };
    }
    
    try {
      console.log('[CreateNewUser] Creating new user with name:', firstName);
      
      // Generate email and password
      const email = `wa_${customerWhatsappNumber}@skedy.ai`;
      const password = uuidv4();
      
      // Create new user
      const newUser = new User(firstName, '', 'customer', businessId);
      const { error } = await newUser.add({
        email: email,
        password: password,
        whatsappNumber: customerWhatsappNumber
      });
      
      if (error) {
        console.error('[CreateNewUser] Error creating user:', error);
        return {
          ...currentGoalData,
          userCreationError: 'This WhatsApp number may already have an account. Please contact support.'
        };
      }
      
      console.log('[CreateNewUser] Successfully created user:', newUser.id);
      
      return {
        ...currentGoalData,
        userId: newUser.id,
        userName: firstName,
        userEmail: email,
        userProcessingComplete: true, // Mark processing as complete
        confirmationMessage: `Perfect! I've created your account, ${firstName}. Let's continue with your booking.`
      };
      
    } catch (error) {
      console.error('[CreateNewUser] Error in user creation process:', error);
      return {
        ...currentGoalData,
        userCreationError: 'Failed to create user account. Please try again.'
      };
    }
  },
  
  // Show error button if creation failed
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.userCreationError) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.TRY_AGAIN'), buttonValue: 'retry_user_creation' }];
    }
    
    return [];
  }
};

// =====================================
// END USER MANAGEMENT STEPS  
// =====================================

// Asks for customer address - single responsibility
export const askAddressHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Address required', // This will be overridden by dynamic prompt
  
  // Validates address input meets requirements
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    return AddressValidator.validateAddress(userInput, chatContext);
  },
  
  // Simply stores the address and sets localized prompt
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    if (!validatedInput || validatedInput === "") {
      return { 
        ...currentGoalData, 
        confirmationMessage: getLocalizedText(chatContext, 'ADDRESS_REQUEST_MESSAGE')
      };
    }
    return { ...currentGoalData, customerAddress: validatedInput };
  }
};

// Validates customer address with Google API - single responsibility
export const validateAddressHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Validating address...', // This will be overridden by confirmationMessage
  
  // Handle address confirmation or re-entry
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
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
        validationErrorMessage: getLocalizedText(chatContext, 'MESSAGES.PROVIDE_ADDRESS')
      };
    }
    
    return { isValidInput: true };
  },
  
  // Validates address through Google API
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
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
      const validationResult = await AddressValidator.validateWithGoogleAPI(addressToValidate, chatContext);
      
      if (validationResult.isValid) {
        return {
          ...currentGoalData,
          validatedCustomerAddress: validationResult.formattedAddress,
          addressValidated: true,
          confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.VALIDATING_ADDRESS')
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
  fixedUiButtons: async (currentGoalData, chatContext) => {
    // If address validation succeeded, show confirmation buttons
    if (currentGoalData.addressValidated && !currentGoalData.addressConfirmed) {
      return BookingButtonGenerator.createAddressConfirmationButtons(chatContext);
    }
    
    // If address validation failed, show retry button
    if (currentGoalData.addressValidated === false) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.TRY_AGAIN'), buttonValue: 'retry_address' }];
    }
    
    // No buttons needed (either validating or confirmed)
    return [];
  }
};

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
        serviceLocation = 'business_location';
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

// =====================================
// BOOKING CREATION & CONFIRMATION
// =====================================

// Step: Creates the actual booking - single responsibility
export const createBookingHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Creating your booking...',
  // No autoAdvance - this is the final step that shows full confirmation
  
  // Accept empty input (auto-advanced) or payment confirmation message
  validateUserInput: async (userInput) => {
    if (!userInput || userInput === "" || userInput.startsWith('PAYMENT_COMPLETED_')) {
      return { isValidInput: true };
    }
    return { isValidInput: false, validationErrorMessage: '' };
  },
  
  // Create booking from quote data and complete the goal
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[CreateBooking] Starting booking creation...');
    let quoteId = '';
    let isPaymentCompletion = false;

    if (validatedInput && validatedInput.startsWith('PAYMENT_COMPLETED_')) {
        isPaymentCompletion = true;
        quoteId = validatedInput.replace('PAYMENT_COMPLETED_', '');
        console.log(`[CreateBooking] Creating booking from payment completion for quote ID: ${quoteId}`);
    } else {
        quoteId = currentGoalData.quoteId as string;
        console.log(`[CreateBooking] Creating booking from standard flow for quote ID: ${quoteId}`);
    }
    
    if (!quoteId) {
      console.error('[CreateBooking] No Quote ID found.');
      return {
        ...currentGoalData,
        bookingError: 'Missing quote information to create booking.'
      };
    }

    try {
      // Regardless of the path, we fetch the definitive quote from the DB
      const quote = await Quote.getById(quoteId);
      if (!quote) {
        console.error(`[CreateBooking] Quote with ID ${quoteId} not found.`);
        return {
          ...currentGoalData,
          bookingError: `Booking data not found (quote ${quoteId}).`
        };
      }
      
      const { 
        userId, 
        businessId, 
        serviceId, 
        pickUp, 
        dropOff, 
        totalJobCostEstimation,
        travelCostEstimate,
        totalJobDurationEstimation 
      } = quote;

      if (!userId || !businessId || !serviceId) {
        console.error('[CreateBooking] Quote is missing essential data:', { userId, businessId, serviceId });
        return {
          ...currentGoalData,
          bookingError: 'Quote data is incomplete.'
        };
      }

      // Get the provider ID (business owner)
      const businessWhatsappNumber = chatContext.currentParticipant.businessWhatsappNumber as string;
      const providerId = await AvailabilityService.findUserIdByBusinessWhatsappNumber(businessWhatsappNumber, chatContext);

      if (!providerId) {
        console.error('[CreateBooking] Cannot find provider for booking.');
        return {
          ...currentGoalData,
          bookingError: 'Unable to find business provider for booking creation.'
        };
      }

      // Get provider's timezone
      const calendarSettings = await CalendarSettings.getByUserAndBusiness(providerId, businessId);
      const providerTimezone = calendarSettings?.settings?.timezone || 'UTC';

      // Create booking dateTime from selectedDate and selectedTime in goal data or fallback to quote
      let selectedDate = currentGoalData.selectedDate as string;
      let selectedTime = currentGoalData.selectedTime as string;
      let bookingDTObject: DateTime;
      
      if (!selectedDate || !selectedTime) {
        console.warn('[CreateBooking] Missing booking date/time in session data, falling back to quote proposedDateTime');
        
        // Fallback to quote's proposedDateTime
        if (quote.proposedDateTime) {
          bookingDTObject = DateTime.fromISO(quote.proposedDateTime, { zone: providerTimezone });
          console.log(`[CreateBooking] Using quote proposedDateTime: ${quote.proposedDateTime}`);
        } else {
          console.error('[CreateBooking] No booking date/time available in session data or quote');
          return {
            ...currentGoalData,
            bookingError: 'Missing booking date or time information.'
          };
        }
      } else {
        // Create booking dateTime object from session data in the correct timezone
        // Ensure date is in YYYY-MM-DD format and time is in HH:mm format
        let cleanSelectedDate = selectedDate;
        let cleanSelectedTime = selectedTime;
        
        // Fix malformed date (if it contains timestamp info, extract just the date)
        if (selectedDate.includes('T')) {
          cleanSelectedDate = selectedDate.split('T')[0];
          console.log(`[CreateBooking] Fixed malformed selectedDate from "${selectedDate}" to "${cleanSelectedDate}"`);
        }
        
        // Fix malformed time (if it starts with T, remove it)
        if (selectedTime.startsWith('T')) {
          cleanSelectedTime = selectedTime.substring(1);
          console.log(`[CreateBooking] Fixed malformed selectedTime from "${selectedTime}" to "${cleanSelectedTime}"`);
        }
        
        const bookingDateTimeString = `${cleanSelectedDate}T${cleanSelectedTime}`;
        bookingDTObject = DateTime.fromISO(bookingDateTimeString, { zone: providerTimezone });
        console.log(`[CreateBooking] Using session dateTime: ${bookingDateTimeString}`);
        
        // Validate the resulting DateTime object
        if (!bookingDTObject.isValid) {
          console.error(`[CreateBooking] Invalid dateTime created from session data: ${bookingDateTimeString}`);
          console.error(`[CreateBooking] DateTime parse error: ${bookingDTObject.invalidReason}`);
          return {
            ...currentGoalData,
            bookingError: 'Invalid booking date or time format. Please try booking again.'
          };
        }
      }
      
      const bookingData = {
        quoteId,
        userId,
        businessId,
        providerId,
        dateTime: bookingDTObject.toISO() as string,
        status: 'confirmed' as BookingStatus
      };
      
      const newBooking = new Booking(bookingData);
      const savedBooking = await newBooking.add() as BookingData & { id: string };
      console.log('[CreateBooking] Booking successfully created:', savedBooking.id);

      // We need service and other details for the confirmation message
      const service = await Service.getById(serviceId);
      if (!service) {
         console.error(`[CreateBooking] Could not find service with ID ${serviceId}`);
         return {
            ...currentGoalData,
            bookingError: 'Could not retrieve service details for confirmation.'
         }
      }

      // Prepare details for final confirmation message
      const bookingConfirmationDetails = {
          bookingId: savedBooking.id,
          serviceName: service.name,
          formattedDate: bookingDTObject.toLocaleString(DateTime.DATE_FULL),
          formattedTime: bookingDTObject.toLocaleString(DateTime.TIME_SIMPLE),
          location: service.mobile ? dropOff : pickUp,
          totalCost: totalJobCostEstimation,
          serviceCost: totalJobCostEstimation - (travelCostEstimate || 0),
          travelCost: travelCostEstimate || 0,
      };
      
      // Generate the full booking confirmation message
      const t = BOOKING_TRANSLATIONS[getUserLanguage(chatContext)];
      
      // Include payment completion message if this was from payment
      const paymentMessage = isPaymentCompletion 
        ? (getUserLanguage(chatContext) === 'es' 
            ? '💳 ¡Gracias por tu pago!\n\n' 
            : '💳 Thank you for your payment!\n\n')
        : '';
      
      const confirmationMessage = `${paymentMessage}${t.BOOKING_CONFIRMATION.TITLE}\n\n` +
          `${t.BOOKING_CONFIRMATION.SERVICE} ${bookingConfirmationDetails.serviceName}\n` +
          `${t.BOOKING_CONFIRMATION.DATE} ${bookingConfirmationDetails.formattedDate}\n` +
          `${t.BOOKING_CONFIRMATION.TIME} ${bookingConfirmationDetails.formattedTime}\n` +
          `${t.BOOKING_CONFIRMATION.LOCATION} ${bookingConfirmationDetails.location}\n\n` +
          `${t.BOOKING_CONFIRMATION.PRICING}\n` +
          `   ${t.BOOKING_CONFIRMATION.SERVICE_COST} $${bookingConfirmationDetails.serviceCost.toFixed(2)}\n` +
          `${bookingConfirmationDetails.travelCost > 0 ? `   ${t.BOOKING_CONFIRMATION.TRAVEL_COST} $${bookingConfirmationDetails.travelCost.toFixed(2)}\n` : ''}` +
          `   ${t.BOOKING_CONFIRMATION.TOTAL_COST} $${bookingConfirmationDetails.totalCost.toFixed(2)}\n\n` +
          `${t.BOOKING_CONFIRMATION.BOOKING_ID} ${bookingConfirmationDetails.bookingId}\n\n` +
          `${t.BOOKING_CONFIRMATION.LOOKING_FORWARD}`;
      
      console.log(`[CreateBooking] Generated full confirmation for booking ${bookingConfirmationDetails.bookingId}. Goal completed.`);
      
      return {
        ...currentGoalData,
        goalStatus: 'completed', // Complete the goal since this is the final step
        persistedBooking: savedBooking,
        bookingConfirmationDetails: bookingConfirmationDetails,
        paymentCompleted: isPaymentCompletion,
        confirmationMessage
      };

    } catch (error) {
      console.error('[CreateBooking] Error during booking creation process:', error);
      return {
        ...currentGoalData,
        bookingError: 'Failed to save booking. Please try again.',
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.BOOKING_PROBLEM')
      };
    }
  },
};

// Step: Displays the final booking confirmation details
// Job: ONLY formats and displays the confirmation message
export const bookingConfirmationHandler: IndividualStepHandler = {
    defaultChatbotPrompt: 'Here are your booking details:',
    
    validateUserInput: async (userInput) => {
        // This step is for display only, triggered by auto-advance
        if (!userInput || userInput === "") {
            return { isValidInput: true };
        }
        return { isValidInput: false, validationErrorMessage: '' };
    },

    processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
        const { bookingConfirmationDetails, paymentCompleted } = currentGoalData;

        if (!bookingConfirmationDetails) {
            console.error('[BookingConfirmation] Missing booking details to display.');
            return {
                ...currentGoalData,
                goalStatus: 'completed',
                confirmationMessage: 'Your booking is confirmed. Please contact us if you need the details.'
            };
        }

        const t = BOOKING_TRANSLATIONS[getUserLanguage(chatContext)];
        
        // Include payment completion message if this was from payment
        const paymentMessage = paymentCompleted 
          ? (getUserLanguage(chatContext) === 'es' 
              ? '💳 ¡Gracias por tu pago!\n\n' 
              : '💳 Thank you for your payment!\n\n')
          : '';
        
        const confirmationMessage = `${paymentMessage}${t.BOOKING_CONFIRMATION.TITLE}\n\n` +
            `${t.BOOKING_CONFIRMATION.SERVICE} ${bookingConfirmationDetails.serviceName}\n` +
            `${t.BOOKING_CONFIRMATION.DATE} ${bookingConfirmationDetails.formattedDate}\n` +
            `${t.BOOKING_CONFIRMATION.TIME} ${bookingConfirmationDetails.formattedTime}\n` +
            `${t.BOOKING_CONFIRMATION.LOCATION} ${bookingConfirmationDetails.location}\n\n` +
            `${t.BOOKING_CONFIRMATION.PRICING}\n` +
            `   ${t.BOOKING_CONFIRMATION.SERVICE_COST} $${bookingConfirmationDetails.serviceCost.toFixed(2)}\n` +
            `${bookingConfirmationDetails.travelCost > 0 ? `   ${t.BOOKING_CONFIRMATION.TRAVEL_COST} $${bookingConfirmationDetails.travelCost.toFixed(2)}\n` : ''}` +
            `   ${t.BOOKING_CONFIRMATION.TOTAL_COST} $${bookingConfirmationDetails.totalCost.toFixed(2)}\n\n` +
            `${t.BOOKING_CONFIRMATION.BOOKING_ID} ${bookingConfirmationDetails.bookingId}\n\n` +
            `${t.BOOKING_CONFIRMATION.LOOKING_FORWARD}`;
        
        console.log(`[BookingConfirmation] Displaying confirmation for booking ${bookingConfirmationDetails.bookingId}. Goal completed.`);

        return {
            ...currentGoalData,
            goalStatus: 'completed',
            confirmationMessage: confirmationMessage
        };
    }
};

// =====================================
// FAQ STEP HANDLER
// =====================================

// Step: Handle FAQ question
// Job: Answer user's question using RAG and context, then allow booking to continue
export const handleFaqQuestionHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Let me help you with that question.',
  
  // Accept any user input as an FAQ question
  validateUserInput: async (userInput) => {
    return { isValidInput: true };
  },
  
  // Use the existing FAQ handler to answer the question
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    try {
      const { handleFaqOrChitchat } = await import('../step-handlers/faq-handler');
      
      // Create message history from current goal
      const messageHistory = currentGoalData.messageHistory?.map((msg: any) => ({
        role: msg.speakerRole === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.messageTimestamp
      })) || [];
      
      // Get FAQ response
      const faqResponse = await handleFaqOrChitchat(chatContext, validatedInput, messageHistory);
      
      return {
        ...currentGoalData,
        goalStatus: 'completed', // FAQ goal completes after answering
        confirmationMessage: faqResponse.text
      };
    } catch (error) {
      console.error('[HandleFaqQuestion] Error processing FAQ:', error);
      return {
        ...currentGoalData,
        goalStatus: 'completed',
        confirmationMessage: "I'm here to help! Is there anything specific you'd like to know? Or would you like to book an appointment?"
      };
    }
  }
};
  