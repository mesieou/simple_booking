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
  
  static validateAddress(address: string, chatContext: ChatContext): LLMProcessingResult {
    if (address.length < BOOKING_CONFIG.VALIDATION.MIN_ADDRESS_LENGTH) {
      return {
        isValidInput: false,
        validationErrorMessage: getLocalizedText(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS')
      };
    }
    
    const hasStreetInfo = /\d+.*[a-zA-Z]/.test(address);
    const hasSuburb = address.toLowerCase().split(' ').length >= 3;
    
    if (hasStreetInfo && hasSuburb) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: getLocalizedText(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS')
    };
  }

  static async validateWithGoogleAPI(address: string, chatContext: ChatContext): Promise<{
    isValid: boolean;
    formattedAddress?: string;
    errorMessage?: string;
  }> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const basicValidation = AddressValidator.validateAddress(address, chatContext);
    if (!basicValidation.isValidInput) {
      return {
        isValid: false,
        errorMessage: basicValidation.validationErrorMessage
      };
    }
    
    return {
      isValid: true,
      formattedAddress: address.trim().replace(/\s+/g, ' ')
    };
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
    
    let found = availableServices.find(service => 
      service.name.toLowerCase() === normalizedInput
    );
    
    if (found) {
      console.log(`[ServiceProcessor] Found exact match: ${found.name}`);
      return found;
    }
    
    found = availableServices.find(service => 
      service.name.toLowerCase().includes(normalizedInput) || 
      normalizedInput.includes(service.name.toLowerCase())
    );
    
    if (found) {
      console.log(`[ServiceProcessor] Found partial match: ${found.name}`);
      return found;
    }
    
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
      mobile: service.mobile
    };
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
}

export class BookingValidator {
  
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
        const slotsForDuration = dayData.slots[durationKey] || [];
        
        for (const timeSlot of slotsForDuration) {
          const [hours, minutes] = timeSlot.split(':');
          
          if (minutes === '00') {
            const datePart = dayData.date.substring(0, 10);
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
