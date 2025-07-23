import { ChatContext, LLMProcessingResult, ButtonConfig } from "@/lib/bot-engine/types";
import { Service, type ServiceData } from '@/lib/database/models/service';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { User } from '@/lib/database/models/user';
import { BOOKING_TRANSLATIONS } from "@/lib/bot-engine/config/translations";
import { DateTime } from 'luxon';

// Re-export translations for use in other booking modules
export { BOOKING_TRANSLATIONS };

export const getUserLanguage = (chatContext: ChatContext): 'en' | 'es' => {
  const userLanguage = chatContext.participantPreferences.language || 'en';
  return (userLanguage === 'es') ? 'es' : 'en';
};

export const getLocalizedText = (chatContext: ChatContext, key: string): string => {
  const language = getUserLanguage(chatContext);
  const translations = BOOKING_TRANSLATIONS[language];
  
  const keys = key.split('.');
  let value: any = translations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`[Localization] Key not found: ${key} for language: ${language}`);
      return key;
    }
  }
  
  return typeof value === 'string' ? value : key;
};

export const getLocalizedTextWithVars = (chatContext: ChatContext, key: string, variables: Record<string, string> = {}): string => {
  let text = getLocalizedText(chatContext, key);
  
  Object.entries(variables).forEach(([varName, varValue]) => {
    text = text.replace(new RegExp(`\\{${varName}\\}`, 'g'), varValue);
  });
  
  return text;
};

export const BOOKING_CONFIG = {
  VALIDATION: {
    MIN_ADDRESS_LENGTH: 10
  }
} as const;

export class AddressValidator {
  private static readonly MIN_ADDRESS_LENGTH = 5;
  private static readonly GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
  
  static validateAddress(address: string, chatContext: ChatContext): LLMProcessingResult {
    try {
      // Only basic length check - Google API will do the real validation
      if (!address || address.trim().length < this.MIN_ADDRESS_LENGTH) {
        return {
          isValidInput: false,
          validationErrorMessage: getLocalizedText(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS')
        };
      }
      
      return { isValidInput: true };
    } catch (error) {
      console.error('[AddressValidator] Error in validateAddress:', error);
      return {
        isValidInput: false,
        validationErrorMessage: getLocalizedText(chatContext, 'ERROR_MESSAGES.SYSTEM_ERROR_ADDRESS_VALIDATION')
      };
    }
  }

  static async validateWithGoogleAPI(address: string, chatContext: ChatContext): Promise<{
    isValid: boolean;
    formattedAddress?: string;
    errorMessage?: string;
    isSystemError?: boolean;
  }> {
    try {
      const customerName = '{name}'; // Will be replaced by localization
      console.log('[AddressValidator] Starting Google API validation for address:', address);

      if (!process.env.GOOGLE_MAPS_API_KEY) {
        console.error('[AddressValidator] No Google Maps API key found in environment');
        return {
          isValid: false,
          errorMessage: getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.SYSTEM_ERROR_ADDRESS_VALIDATION', { name: customerName }),
          isSystemError: true
        };
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      const encodedAddress = encodeURIComponent(address);
      const url = `${this.GEOCODING_API_URL}?address=${encodedAddress}&key=${apiKey}`;
      
      console.log('[AddressValidator] Making request to Google API for address:', address);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('[AddressValidator] Google API response:', {
        status: data.status,
        resultsCount: data.results?.length || 0,
        hasResults: data.results && data.results.length > 0
      });

      switch (data.status) {
        case 'OK':
          if (data.results && data.results.length > 0) {
            const result = data.results[0];
            console.log('[AddressValidator] Google API validation successful');
            return {
              isValid: true,
              formattedAddress: result.formatted_address
            };
          }
          break;
          
        case 'ZERO_RESULTS':
        case 'INVALID_REQUEST':
          console.log(`[AddressValidator] Google API: ${data.status}`);
          return {
            isValid: false,
            errorMessage: getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS', { name: customerName })
          };
          
        case 'REQUEST_DENIED':
        case 'OVER_QUERY_LIMIT':
        case 'REQUEST_ERROR':
          console.error(`[AddressValidator] Google API system error: ${data.status}`);
          return {
            isValid: false,
            errorMessage: getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.SYSTEM_ERROR_ADDRESS_VALIDATION', { name: customerName }),
            isSystemError: true
          };
          
        default:
          console.error(`[AddressValidator] Unknown Google API status: ${data.status}`);
          return {
            isValid: false,
            errorMessage: getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.SYSTEM_ERROR_ADDRESS_VALIDATION', { name: customerName }),
            isSystemError: true
          };
      }
    } catch (error) {
      console.error('[AddressValidator] Error calling Google Maps API:', error);
      const customerName = '{name}';
      
      return {
        isValid: false,
        errorMessage: getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.SYSTEM_ERROR_ADDRESS_VALIDATION', { name: customerName }),
        isSystemError: true
      };
    }
  }
}

export class ServiceDataProcessor {
  
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

  static findServiceById(serviceId: string, availableServices: ServiceData[]): ServiceData | undefined {
    return availableServices.find(service => service.id === serviceId);
  }

  static findServiceByName(serviceName: string, availableServices: ServiceData[]): ServiceData | undefined {
    if (!serviceName || !availableServices.length) return undefined;
    
    const normalizedInput = serviceName.toLowerCase().trim();
    console.log(`[ServiceProcessor] Looking for service by name: "${normalizedInput}"`);
    
    // Spanish to English service name mapping
    const spanishToEnglishMapping: { [key: string]: string[] } = {
      'manicura': ['manicure'],
      'manicura básica': ['basic manicure'],
      'manicura express': ['express manicure'],
      'manicura con gel': ['gel manicure'],
      'pedicura': ['pedicure'],
      'pedicura básica': ['basic pedicure'],
      'pedicura con gel': ['gel pedicure'],
      'manicura presionada': ['press on manicure'],
      'corte de cabello': ['haircut', 'ladies haircut'],
      'peinado': ['hair styling'],
      'trenzas': ['braids'],
      'secado': ['blow dry'],
      'ondas': ['waves'],
      'tratamientos': ['treatments'],
      'gel': ['gel'],
      'básica': ['basic'],
      'express': ['express'],
      'presionada': ['press on'],
      'cabello': ['hair'],
      'damas': ['ladies']
    };
    
    // 1. Exact match (English)
    let found = availableServices.find(service => 
      service.name.toLowerCase() === normalizedInput
    );
    
    if (found) {
      console.log(`[ServiceProcessor] Found exact English match: ${found.name}`);
      return found;
    }
    
    // 2. Spanish-to-English mapping match
    for (const [spanishTerm, englishTerms] of Object.entries(spanishToEnglishMapping)) {
      if (normalizedInput.includes(spanishTerm)) {
        console.log(`[ServiceProcessor] Found Spanish term "${spanishTerm}" in input`);
        
        // Try to match with English equivalents
        for (const englishTerm of englishTerms) {
          found = availableServices.find(service => 
            service.name.toLowerCase().includes(englishTerm)
          );
          if (found) {
            console.log(`[ServiceProcessor] Found Spanish-to-English match: "${spanishTerm}" -> "${englishTerm}" -> ${found.name}`);
            return found;
          }
        }
      }
    }
    
    // 3. Multi-word Spanish matching (e.g., "manicura con gel" -> "gel manicure")
    const inputWords = normalizedInput.split(/\s+/).filter(word => word.length >= 3);
    if (inputWords.length >= 2) {
      for (const service of availableServices) {
        const serviceWords = service.name.toLowerCase().split(/\s+/);
        let matchCount = 0;
        
        for (const inputWord of inputWords) {
          const englishEquivalents = spanishToEnglishMapping[inputWord] || [inputWord];
          for (const englishWord of englishEquivalents) {
            if (serviceWords.some(serviceWord => serviceWord.includes(englishWord) || englishWord.includes(serviceWord))) {
              matchCount++;
              break;
            }
          }
        }
        
        // Require at least half the words to match
        if (matchCount >= Math.ceil(inputWords.length / 2)) {
          console.log(`[ServiceProcessor] Found multi-word Spanish match: ${service.name} (${matchCount}/${inputWords.length} words matched)`);
          return service;
        }
      }
    }
    
    // 4. Full service name contained in input or vice versa (but only if meaningful)
    found = availableServices.find(service => {
      const serviceName = service.name.toLowerCase();
      const minLength = 4; // Require at least 4 characters for partial matching
      
      return (serviceName.length >= minLength && normalizedInput.includes(serviceName)) ||
             (normalizedInput.length >= minLength && serviceName.includes(normalizedInput));
    });
    
    if (found) {
      console.log(`[ServiceProcessor] Found partial match: ${found.name}`);
      return found;
    }
    
    // 5. Conservative word-based matching - require exact word matches and meaningful overlap
    const englishInputWords = inputWords.filter(word => word.length >= 3);
    
    if (englishInputWords.length === 0) {
      console.log(`[ServiceProcessor] Input too short or no meaningful words for: "${serviceName}"`);
      return undefined;
    }
    
    found = availableServices.find(service => {
      const serviceWords = service.name.toLowerCase().split(/\s+/).filter(word => word.length >= 3);
      const matchingWords = englishInputWords.filter(inputWord => 
        serviceWords.some(serviceWord => serviceWord === inputWord)
      );
      
      // Require at least one exact word match and reasonable overlap
      const overlapRatio = matchingWords.length / Math.min(englishInputWords.length, serviceWords.length);
      return matchingWords.length >= 1 && overlapRatio >= 0.5;
    });
    
    if (found) {
      console.log(`[ServiceProcessor] Found conservative word-based match: ${found.name}`);
      return found;
    }
    
    console.log(`[ServiceProcessor] No match found for: "${serviceName}"`);
    return undefined;
  }

  static findServiceSmart(input: string, availableServices: ServiceData[]): ServiceData | undefined {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(input)) {
      return this.findServiceById(input, availableServices);
    }
    
    return this.findServiceByName(input, availableServices);
  }

  static extractServiceDetails(service: ServiceData) {
    return {
      id: service.id,
      name: service.name,
      durationEstimate: service.durationEstimate,
      fixedPrice: service.fixedPrice,
      pricingType: service.pricingType,
      mobile: service.mobile,
      ratePerMinute: service.ratePerMinute,
      baseCharge: service.baseCharge
    };
  }

  static filterAvailableServices(allServices: ServiceData[], selectedServices: any[]): ServiceData[] {
    if (!selectedServices || selectedServices.length === 0) {
      return allServices;
    }
    
    const selectedServiceIds = selectedServices.map(service => service.id);
    return allServices.filter(service => !selectedServiceIds.includes(service.id));
  }

  static formatSelectedServicesList(selectedServices: any[], chatContext: ChatContext): string {
    if (!selectedServices || selectedServices.length === 0) {
      return '';
    }
    
    return selectedServices.map((service, index) => {
      const serviceName = service.name || 'Unknown Service';
      const price = service.fixedPrice ? `$${service.fixedPrice}` : '';
      const duration = service.durationEstimate ? `${service.durationEstimate}min` : '';
      const mobile = service.mobile ? '🚗 Mobile' : '🏪 In-store';
      
      // Build details array
      const details = [price, duration, mobile].filter(Boolean);
      const detailsText = details.length > 0 ? ` (${details.join(' • ')})` : '';
      
      return `${index + 1}. ${serviceName}${detailsText}`;
    }).join('\n');
  }

  // Calculate total duration from multiple selected services
  static calculateTotalServiceDuration(currentGoalData: any): number {
    const selectedServices = currentGoalData.selectedServices || [];
    const selectedService = currentGoalData.selectedService;
    
    // If we have multiple services, calculate total duration
    if (selectedServices.length > 0) {
      const totalDuration = selectedServices.reduce((total: number, service: any) => {
        return total + (service.durationEstimate || 0);
      }, 0);
      
      console.log(`[ServiceDataProcessor] Calculated total duration from ${selectedServices.length} services: ${totalDuration} minutes`);
      console.log(`[ServiceDataProcessor] Services: ${selectedServices.map((s: any) => `${s.name} (${s.durationEstimate}min)`).join(', ')}`);
      
      return totalDuration;
    }
    
    // Fallback to single service duration
    const singleServiceDuration = selectedService?.durationEstimate || 0;
    console.log(`[ServiceDataProcessor] Using single service duration: ${singleServiceDuration} minutes`);
    
    return singleServiceDuration;
  }
}

export class BookingButtonGenerator {
  
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

  static createServiceButtons(services: ServiceData[]): ButtonConfig[] {
    return services.map(service => {
      const mobileIcon = service.mobile ? '🚗 ' : '🏪 ';
      const description = service.description || '';
      
      // Ensure button text stays under 20 characters
      const maxServiceNameLength = 17; // Account for 2-3 chars for icon
      const buttonText = this.truncateServiceButtonText(mobileIcon + service.name, maxServiceNameLength + 3);
      
      const priceText = service.fixedPrice ? `$${service.fixedPrice}` : '';
      const durationText = service.durationEstimate ? `${service.durationEstimate}min` : '';
      const essentials = [priceText, durationText].filter(Boolean);
      const essentialsText = essentials.join(' • ');
      
      const maxDescriptionLength = 72 - essentialsText.length - (essentialsText ? 3 : 0);
      
      let finalDescription = '';
      if (description && maxDescriptionLength > 10) {
        const abbreviatedDesc = this.abbreviateServiceDescription(description, maxDescriptionLength);
        finalDescription = essentialsText ? `${abbreviatedDesc} • ${essentialsText}` : abbreviatedDesc;
      } else {
        finalDescription = essentialsText;
      }

      return {
        buttonText: buttonText,
        buttonDescription: finalDescription,
        buttonValue: service.id || 'error_service_id_missing'
      };
    });
  }

  static truncateServiceButtonText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Try to preserve the icon and truncate the service name intelligently
    const iconMatch = text.match(/^(🚗 |🏪 )/);
    const icon = iconMatch ? iconMatch[1] : '';
    const serviceName = text.replace(/^(🚗 |🏪 )/, '');
    
    const availableLength = maxLength - icon.length;
    
    if (serviceName.length <= availableLength) {
      return icon + serviceName;
    }
    
    // Truncate service name, preferring word boundaries
    const words = serviceName.split(' ');
    let truncated = '';
    
    for (const word of words) {
      const testLength = truncated + (truncated ? ' ' : '') + word;
      if (testLength.length <= availableLength - 1) { // -1 for potential ellipsis
        truncated += (truncated ? ' ' : '') + word;
      } else {
        break;
      }
    }
    
    // If we couldn't fit any complete words, just cut it hard
    if (!truncated) {
      truncated = serviceName.substring(0, availableLength - 1);
    }
    
    return icon + truncated + (truncated.length < serviceName.length ? '…' : '');
  }

  static abbreviateServiceDescription(description: string, maxLength: number): string {
    if (description.length <= maxLength) {
      return description;
    }

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
    
    return truncated + (truncated.length < description.length ? '...' : '');
  }

  static createAddressConfirmationButtons(chatContext: ChatContext): ButtonConfig[] {
    return [
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.ADDRESS_CORRECT'), buttonValue: 'address_confirmed' },
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.ADDRESS_EDIT'), buttonValue: 'address_edit' }
    ];
  }

  static createServiceContinuationButtons(chatContext: ChatContext): ButtonConfig[] {
    return [
      { 
        buttonText: getLocalizedText(chatContext, 'BUTTONS.ADD_ANOTHER_SERVICE'), 
        buttonValue: 'add_another_service' 
      },
      { 
        buttonText: getLocalizedText(chatContext, 'BUTTONS.CONTINUE_WITH_SERVICES'), 
        buttonValue: 'continue_with_services' 
      }
    ];
  }
}

export class BookingValidator {
  
  static validateServiceContinuation(userInput: string, chatContext: ChatContext): LLMProcessingResult {
    const normalizedInput = userInput.toLowerCase().trim();
    
    if (normalizedInput === 'add_another_service' || normalizedInput === 'continue_with_services') {
      return { 
        isValidInput: true,
        transformedInput: userInput
      };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: getLocalizedText(chatContext, 'MESSAGES.ADD_MORE_SERVICES')
    };
  }

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

    const chosenService = ServiceDataProcessor.findServiceSmart(userInput, availableServices);
    console.log('[BookingValidator] Found service:', chosenService ? { id: chosenService.id, name: chosenService.name } : 'NOT FOUND');
    
    if (chosenService) {
      return { 
        isValidInput: true,
        transformedInput: chosenService.id
      };
    }

    console.log('[BookingValidator] Service validation failed - service not found');
    
    const serviceNames = availableServices.map(s => s.name).join(', ');
    const language = getUserLanguage(chatContext);
    const errorPrefix = language === 'es' ? 'No pude encontrar ese servicio. Por favor selecciona una de estas opciones:' : 'I couldn\'t find that service. Please select one of these options:';
    
    return {
      isValidInput: false,
      validationErrorMessage: `${errorPrefix} ${serviceNames}`
    };
  }
}

export class AvailabilityService {
  
  static async findUserIdByBusinessWhatsappNumber(businessWhatsappNumber: string, chatContext: ChatContext): Promise<string | null> {
    try {
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
    } catch (error) {
      console.error('[AvailabilityService] Error finding user by business ID:', error);
      return null;
    }
  }
  
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

      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30);
      
      console.log(`[AvailabilityService] Searching for whole hour slots from ${today.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
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
        
        try {
          const allAvailability = await AvailabilitySlots.getByProviderAndDateRange(
            userOwningThisBusinessId,
            '2020-01-01',
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
      
      const availableDurations = [60, 90, 120, 150, 180, 240, 300, 360];
      const suitableDuration = availableDurations.find(duration => duration >= serviceDuration);
      
      if (!suitableDuration) {
        console.log(`[AvailabilityService] No suitable duration found for ${serviceDuration} minutes`);
        return [];
      }
      
      const durationKey = suitableDuration.toString();
      console.log(`[AvailabilityService] Using duration ${durationKey} for service duration ${serviceDuration}`);
      
      const wholeHourSlots: Array<{ date: string; time: string }> = [];
      const nowInProviderTz = DateTime.now().setZone(providerTimezone);
      
      availabilityData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      for (const dayData of availabilityData) {
        // Check if provider works on this day of the week before processing slots
        // Extract just the date part (YYYY-MM-DD) from the date string
        const dateOnly = dayData.date.split('T')[0]; // Get just "2025-06-30" part
        const targetDate = new Date(dateOnly + 'T00:00:00.000Z');
        const dayOfWeek = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayKey = dayNames[dayOfWeek] as keyof CalendarSettings["workingHours"];
        
        // Add debugging for the day calculation
        console.log(`[AvailabilityService] Date: ${dayData.date} -> ${dateOnly}, dayOfWeek: ${dayOfWeek}, dayKey: ${dayKey}`);
        console.log(`[AvailabilityService] targetDate: ${targetDate.toISOString()}, isValid: ${!isNaN(targetDate.getTime())}`);
        
        const workingHours = calendarSettings?.workingHours[dayKey];

        if (!workingHours) {
          console.log(`[AvailabilityService] Provider doesn't work on ${dayKey} (${dayData.date}), skipping day`);
          console.log(`[AvailabilityService] Calendar settings:`, calendarSettings?.workingHours);
          continue;
        }

        const slotsForDuration = dayData.slots[durationKey] || [];
        
        for (const timeSlot of slotsForDuration) {
          const [hours, minutes] = timeSlot.split(':');
          
          if (minutes === '00') {
            // Use the same dateOnly extraction for consistency
            const datePart = dateOnly; // Already extracted above
            const slotDateTime = DateTime.fromISO(`${datePart}T${timeSlot}`, { zone: providerTimezone });
            
            if (slotDateTime.isValid && slotDateTime > nowInProviderTz) {
              wholeHourSlots.push({
                date: dayData.date,
                time: timeSlot
              });
              
              if (wholeHourSlots.length >= 2) {
                break;
              }
            }
          }
        }
        
        if (wholeHourSlots.length >= 2) {
          break;
        }
      }
      
      console.log(`[AvailabilityService] Found ${wholeHourSlots.length} whole hour slots:`, wholeHourSlots.map(s => ({ date: s.date, time: s.time })));
      
      if (wholeHourSlots.length === 0) {
        console.log(`[AvailabilityService] No whole hour slots found. This might indicate availability data only has 30-minute intervals.`);
        return [];
      }
      
      const selectedSlots = wholeHourSlots;
      
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
          const language = getUserLanguage(chatContext);
          const locale = language === 'es' ? 'es-ES' : 'en-GB';
          dateText = date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
        }
        
        const [hours] = slot.time.split(':');
        const hour24 = parseInt(hours);
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
        const ampm = hour24 >= 12 ? getLocalizedText(chatContext, 'TIME_LABELS.PM') : getLocalizedText(chatContext, 'TIME_LABELS.AM');
        
        // Create compact button text that fits WhatsApp's 20-char limit
        const language = getUserLanguage(chatContext);
        let displayText = '';
        if (language === 'es') {
          // Compact Spanish format for buttons: "Lu 30/6 7am" (11 chars max)
          const shortDay = dateText.substring(0, 2); // "lunes" -> "Lu"
          const day = date.getDate();
          const month = date.getMonth() + 1;
          const shortTime = `${hour12}${ampm.toLowerCase()}`;
          
          if (date.toDateString() === today.toDateString()) {
            displayText = `Hoy ${shortTime}`;  // "Hoy 7am"
          } else if (date.toDateString() === tomorrow.toDateString()) {
            displayText = `Mañana ${shortTime}`;  // "Mañana 7am"
          } else {
            displayText = `${shortDay} ${day}/${month} ${shortTime}`;  // "Lu 30/6 7am"
          }
        } else {
          // English format: "Mon 7am" or "Today 7am"
          if (date.toDateString() === today.toDateString()) {
            displayText = `Today ${hour12}${ampm.toLowerCase()}`;
          } else if (date.toDateString() === tomorrow.toDateString()) {
            displayText = `Tomorrow ${hour12}${ampm.toLowerCase()}`;
          } else {
            const shortDay = dateText.split(' ')[0].substring(0, 3); // Get first 3 chars of day
            displayText = `${shortDay} ${hour12}${ampm.toLowerCase()}`;
          }
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
  
  static async validateCustomDateForBusinessWhatsapp(
    businessWhatsappNumber: string,
    date: string,
    serviceDuration: number,
    chatContext: ChatContext
  ): Promise<boolean> {
    try {
      // First, check if the provider works on this day of the week
      const userIdOfBusinessOwner = await this.findUserIdByBusinessWhatsappNumber(businessWhatsappNumber, chatContext);
      if (!userIdOfBusinessOwner) {
        console.error('[ValidateCustomDate] No business owner found for this WhatsApp number');
        return false;
      }

      const businessId = chatContext.currentParticipant.associatedBusinessId;
      if (!businessId) {
        console.error('[ValidateCustomDate] No associated business ID found in context for calendar settings lookup.');
        return false;
      }

      // Get calendar settings to check working hours
      const calendarSettings = await CalendarSettings.getByUserAndBusiness(userIdOfBusinessOwner, businessId);
      if (!calendarSettings) {
        console.error('[ValidateCustomDate] No calendar settings found for provider');
        return false;
      }

      // Check if provider works on this day of the week
      // Extract just the date part (YYYY-MM-DD) from the date string
      const dateOnly = date.split('T')[0]; // Get just "2025-06-30" part  
      const targetDate = new Date(dateOnly + 'T00:00:00.000Z');
      const dayOfWeek = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dayKey = dayNames[dayOfWeek] as keyof CalendarSettings["workingHours"];
      
      // Add debugging for the day calculation
      console.log(`[ValidateCustomDate] Date: ${date} -> ${dateOnly}, dayOfWeek: ${dayOfWeek}, dayKey: ${dayKey}`);
      console.log(`[ValidateCustomDate] targetDate: ${targetDate.toISOString()}, isValid: ${!isNaN(targetDate.getTime())}`);
      
      const workingHours = calendarSettings.workingHours[dayKey];

      console.log(`[ValidateCustomDate] Date: ${date}, Day of week: ${dayOfWeek} (${dayKey}), Working hours: ${workingHours ? `${workingHours.start}-${workingHours.end}` : 'NOT WORKING'}`);
      console.log(`[ValidateCustomDate] Calendar settings:`, calendarSettings.workingHours);

      if (!workingHours) {
        console.log(`[ValidateCustomDate] Provider doesn't work on ${dayKey}, rejecting date ${date}`);
        return false;
      }

      // If provider works on this day, check if there are available slots
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
// UTILITIES FROM booking-utilities.ts
// =====================================

export class BookingDataChecker {
  static hasTimeData(goalData: Record<string, any>): boolean {
    return !!(goalData.selectedDate && goalData.selectedTime);
  }
  static hasServiceData(goalData: Record<string, any>): boolean {
    return !!(goalData.selectedService);
  }
  static hasQuickBookingSelection(goalData: Record<string, any>): boolean {
    return !!goalData.quickBookingSelected;
  }
  static hasBrowseSelection(goalData: Record<string, any>): boolean {
    return !!goalData.browseModeSelected;
  }
  static hasExistingUser(goalData: Record<string, any>): boolean {
    return !!goalData.existingUserFound;
  }
  static shouldSkipStep(stepName: string, goalData: Record<string, any>): boolean {
    const skippableStepsForQuickBooking = [
      'showDayBrowser',
      'selectSpecificDay', 
      'showHoursForDay',
      'selectSpecificTime',
    ];
    const skippableStepsForExistingUser = [
      'handleUserStatus',
      'askUserName',
      'createNewUser',
    ];
    if (!!goalData.quickBookingSelected && skippableStepsForQuickBooking.includes(stepName)) {
      return true;
    }
    if (!!goalData.existingUserFound && skippableStepsForExistingUser.includes(stepName)) {
      return true;
    }
    if (stepName === 'showAvailableTimes' && this.hasTimeData(goalData)) {
      return true;
    }
    return false;
  }
}

export class DateTimeFormatter {
  static formatDateDisplay(dateString: string, chatContext: any, format: 'short' | 'long' = 'short'): string {
    const selectedDate = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const getUserLanguage = (ctx: any): 'en' | 'es' => {
      const userLang = ctx?.participantPreferences?.language;
      return userLang === 'es' ? 'es' : 'en';
    };
    const getLocalizedText = (ctx: any, key: string): string => {
      const language = getUserLanguage(ctx);
      if (key === 'TIME_LABELS.TODAY') {
        return language === 'es' ? 'Hoy' : 'Today';
      }
      if (key === 'TIME_LABELS.TOMORROW') {
        return language === 'es' ? 'Mañana' : 'Tomorrow';
      }
      return key;
    };
    if (selectedDate.toDateString() === today.toDateString()) {
      return getLocalizedText(chatContext, 'TIME_LABELS.TODAY');
    }
    if (selectedDate.toDateString() === tomorrow.toDateString()) {
      return getLocalizedText(chatContext, 'TIME_LABELS.TOMORROW');
    }
    const language = getUserLanguage(chatContext);
    const locale = language === 'es' ? 'es-ES' : 'en-GB';
    if (format === 'long') {
      return selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    }
    return selectedDate.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  static formatTimeDisplay(timeString: string): string {
    const [hours] = timeString.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12} ${ampm}`;
  }

  static formatDateTimeDisplay(dateString: string, timeString: string, chatContext: any, format: 'short' | 'long' = 'short'): string {
    const dateDisplay = this.formatDateDisplay(dateString, chatContext, format);
    const timeDisplay = this.formatTimeDisplay(timeString);
    return `${dateDisplay} at ${timeDisplay}`;
  }
}

export class BookingDataManager {
  static clearTimeData(goalData: Record<string, any>): Record<string, any> {
    return {
      ...goalData,
      selectedDate: undefined,
      selectedTime: undefined,
      quickBookingSelected: undefined,
      browseModeSelected: undefined,
      next2WholeHourSlots: undefined,
      availableHours: undefined,
      formattedAvailableHours: undefined,
      availableDays: undefined,
      persistedQuote: undefined,
      quoteId: undefined,
      bookingSummary: undefined
    };
  }
  static clearServiceData(goalData: Record<string, any>): Record<string, any> {
    return {
      ...goalData,
      selectedService: undefined,
      finalServiceAddress: undefined,
      serviceLocation: undefined,
      persistedQuote: undefined,
      quoteId: undefined,
      bookingSummary: undefined
    };
  }
  static setQuickBooking(goalData: Record<string, any>, date: string, time: string): Record<string, any> {
    return {
      ...goalData,
      selectedDate: date,
      selectedTime: time,
      quickBookingSelected: true,
      confirmationMessage: 'Great! Your time slot has been selected.'
    };
  }
  static setBrowseMode(goalData: Record<string, any>): Record<string, any> {
    return {
      ...this.clearTimeData(goalData),
      browseModeSelected: true,
      confirmationMessage: 'Let me show you all available days...'
    };
  }
}

export class StepProcessorBase {
  static async processWithSkipLogic<T>(
    stepName: string,
    validatedInput: string,
    goalData: Record<string, any>,
    chatContext: any,
    processor: (input: string, data: Record<string, any>, context: any) => Promise<T>
  ): Promise<Record<string, any>> {
    if (BookingDataChecker.shouldSkipStep(stepName, goalData)) {
      return { ...goalData, confirmationMessage: '' };
    }
    if (validatedInput !== "") {
      return goalData;
    }
    const result = await processor(validatedInput, goalData, chatContext);
    if (!result) {
      return goalData;
    }
    if (typeof result === 'object' && 'extractedInformation' in result && typeof result.extractedInformation === 'object' && result.extractedInformation !== null) {
      return { ...goalData, ...result.extractedInformation };
    }
    if (typeof result === 'object') {
      return result as Record<string, any>;
    }
    return goalData;
  }
  static validateWithSkipLogic(
    stepName: string,
    userInput: string,
    goalData: Record<string, any>,
    customValidator?: (input: string, data: Record<string, any>) => { isValidInput: boolean; validationErrorMessage?: string }
  ): { isValidInput: boolean; validationErrorMessage?: string } {
    if (!userInput || userInput === "") {
      return { isValidInput: true };
    }
    if (BookingDataChecker.shouldSkipStep(stepName, goalData)) {
      return { isValidInput: true };
    }
    if (customValidator) {
      return customValidator(userInput, goalData);
    }
    return { 
      isValidInput: false, 
      validationErrorMessage: '' 
    };
  }
}

export class BookingMessageGenerator {
  static generateTimeSelectionMessage(goalData: Record<string, any>, chatContext: any): string {
    if (BookingDataChecker.hasTimeData(goalData)) {
      const dateTimeText = DateTimeFormatter.formatDateTimeDisplay(
        goalData.selectedDate, 
        goalData.selectedTime, 
        chatContext,
        'long'
      );
      return `You currently have ${dateTimeText} selected. Would you like to keep this time or choose a different one?`;
    }
    return 'Here are the next available appointment times:';
  }
  static generateServiceChangeMessage(serviceName: string): string {
    return `Great! You've selected ${serviceName}. Let's continue with your booking.`;
  }
  static generateErrorMessage(errorType: string): string {
    switch (errorType) {
      case 'no_availability':
        return 'Sorry, no appointments are currently available. Please contact us directly or try different dates.';
      case 'config_error':
        return 'There was a configuration error. Please try again or contact support.';
      case 'missing_data':
        return 'Some required information is missing. Let\'s start over.';
      default:
        return 'Something went wrong. Please try again or contact support.';
    }
  }
}
