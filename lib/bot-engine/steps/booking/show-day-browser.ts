import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { AvailabilityService, getUserLanguage, getLocalizedText, ServiceDataProcessor } from './booking-utils';
import { DateTime as LuxonDateTime } from 'luxon';
import { Business } from '@/lib/database/models/business';

// Helper function to parse natural language dates - simplified and more flexible
function parseUserDateInput(userInput: string, timezone: string): string | null {
  const input = userInput.toLowerCase().trim();
  const now = LuxonDateTime.now().setZone(timezone);
  
  // Handle common natural language patterns
  if (input.includes('today')) {
    return now.toISODate();
  }
  
  if (input.includes('tomorrow')) {
    return now.plus({ days: 1 }).toISODate();
  }
  
  if (input.includes('next week')) {
    return now.plus({ weeks: 1 }).toISODate();
  }
  
  // Handle specific day names (this week)
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (let i = 0; i < dayNames.length; i++) {
    if (input.includes(dayNames[i])) {
      const targetDay = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7; // Luxon uses 1=Monday
      let targetDate = now.set({ weekday: targetDay });
      
      // If the day has passed this week, go to next week
      if (targetDate <= now) {
        targetDate = targetDate.plus({ weeks: 1 });
      }
      
      // Handle "next friday" specifically
      if (input.includes('next')) {
        targetDate = targetDate.plus({ weeks: 1 });
      }
      
      return targetDate.toISODate();
    }
  }
  
  // Simple month mapping for easier maintenance
  const monthMap: { [key: string]: number } = {
    'jan': 1, 'january': 1,
    'feb': 2, 'february': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'september': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12
  };
  
  // Extract numbers and month names from the input - much more flexible
  const numbers = input.match(/\b(\d{1,2})\b/g) || [];
  const monthMatches = input.match(/\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)\b/i);
  
  if (monthMatches && numbers.length > 0 && numbers[0]) {
    const monthName = monthMatches[0].toLowerCase();
    const month = monthMap[monthName];
    const day = parseInt(numbers[0]); // Take the first number found
    
    if (month && day >= 1 && day <= 31) {
      let year = now.year;
      
      // If the date would be in the past, use next year
      const targetDate = LuxonDateTime.fromObject({ year, month, day }, { zone: timezone });
      const finalDate = targetDate < now.startOf('day') ? targetDate.plus({ years: 1 }) : targetDate;
      
      if (finalDate.isValid) {
        return finalDate.toISODate();
      }
    }
  }
  
  // Handle numeric formats like "15/7", "15-7", "15/07"
  const numericMatch = input.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]);
    let year = now.year;
    
    if (numericMatch[3]) {
      year = parseInt(numericMatch[3]);
      if (year < 100) year += 2000; // Handle 2-digit years
    }
    
    const targetDate = LuxonDateTime.fromObject({ year, month, day }, { zone: timezone });
    const finalDate = targetDate < now.startOf('day') ? targetDate.plus({ years: 1 }) : targetDate;
    
    if (finalDate.isValid && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return finalDate.toISODate();
    }
  }
  
  return null;
}

export const showDayBrowserHandler: IndividualStepHandler = {
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    console.log('[ShowDayBrowser] Validating input:', userInput);
    
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true };
    }
    
    if (!userInput || userInput === "") {
        console.log('[ShowDayBrowser] Empty input, accepting for first display');
        return { isValidInput: true };
    }

    // Accept button clicks starting with 'day_'
    if (userInput.startsWith('day_')) {
        console.log('[ShowDayBrowser] Day button selection detected');
        return { isValidInput: true };
    }
    
    // Accept text input for date parsing 
    console.log('[ShowDayBrowser] Text input detected, will parse as date');
    return { isValidInput: true };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[ShowDayBrowser] Starting processAndExtractData');
    console.log('[ShowDayBrowser] validatedInput:', validatedInput);
    console.log('[ShowDayBrowser] Current goal data keys:', Object.keys(currentGoalData));
    
    const quickBookingSelected = currentGoalData.quickBookingSelected;
    const browseModeSelected = currentGoalData.browseModeSelected;
    
    console.log('[ShowDayBrowser] Quick booking selected:', quickBookingSelected);
    console.log('[ShowDayBrowser] Browse mode selected:', browseModeSelected);
    
    // Handle date selection (button click or text input)
    if (validatedInput && validatedInput !== "") {
      let selectedDate: string;
      let confirmationMessage: string;
      
      if (validatedInput.startsWith('day_')) {
        // Handle button selection
        selectedDate = validatedInput.replace('day_', '');
        confirmationMessage = 'Got it. Let me get available times...';
        console.log('[ShowDayBrowser] Button selection - date:', selectedDate);
      } else {
        // Handle text input for dates
        const businessId = chatContext.currentParticipant.associatedBusinessId;
        if (!businessId) {
          return {
            isValidInput: false,
            confirmationMessage: 'Configuration error. Please try again.'
          };
        }
        
        const business = await Business.getById(businessId);
        const businessTimezone = business.timeZone;
        const parsedDate = parseUserDateInput(validatedInput, businessTimezone);
        
        if (parsedDate) {
          selectedDate = parsedDate;
          
          // Create a user-friendly confirmation message
          const dateObj = LuxonDateTime.fromISO(parsedDate, { zone: businessTimezone });
          const dayName = dateObj.toFormat('cccc'); // Full day name
          const dateFormatted = dateObj.toFormat('MMM d'); // "Jul 15"
          
          confirmationMessage = `Perfect! You chose ${dayName}, ${dateFormatted}. Let me check available times...`;
          
          console.log('[ShowDayBrowser] Text input parsed - original:', validatedInput, 'parsed:', selectedDate);
        } else {
          console.log('[ShowDayBrowser] Failed to parse date input:', validatedInput);
          return {
            ...currentGoalData,
            lastErrorMessage: getLocalizedText(chatContext, 'ERROR_MESSAGES.INVALID_DATE_FORMAT')
          };
        }
      }
      
      // Set the selected date and advance to next step
      return {
        ...currentGoalData,
        selectedDate,
        shouldAutoAdvance: true,
        confirmationMessage
      };
    }
    
    // Skip processing if we're in quick booking mode
    if (quickBookingSelected) {
      console.log('[ShowDayBrowser] Skipping day browser due to quick booking selection');
      return currentGoalData;
    }
    
    // Should only process if we're in browse mode
    if (!browseModeSelected) {
      console.log('[ShowDayBrowser] Not in browse mode, returning current data');
      return currentGoalData;
    }
    
    // Only process empty input (first display)
    if (validatedInput !== "") {
      console.log('[ShowDayBrowser] Non-empty input - not processing');
      return currentGoalData;
    }
    
    // Don't regenerate day browser if there's already an error message
    if (currentGoalData.lastErrorMessage) {
      console.log('[ShowDayBrowser] Error message exists, not regenerating day browser');
      return currentGoalData;
    }
    
    const businessWhatsappNumberCustomersMessagedTo = chatContext.currentParticipant.businessWhatsappNumber;
    const selectedServiceByCustomer = currentGoalData.selectedService;
    
    console.log('[ShowDayBrowser] Business WhatsApp number customers messaged TO:', businessWhatsappNumberCustomersMessagedTo);
    console.log('[ShowDayBrowser] Service selected by customer:', selectedServiceByCustomer);
    console.log('[ShowDayBrowser] Checking availability to find 10 available days for this business...');
    
    // Calculate total duration from all selected services
    const totalServiceDuration = ServiceDataProcessor.calculateTotalServiceDuration(currentGoalData);
    
    console.log('[ShowDayBrowser] Total service duration for availability check:', totalServiceDuration, 'minutes');
    
    // Validate required data before proceeding
    if (!businessWhatsappNumberCustomersMessagedTo || totalServiceDuration <= 0) {
      console.error('[ShowDayBrowser] Missing required data', {
        businessWhatsappNumber: businessWhatsappNumberCustomersMessagedTo,
        totalServiceDuration
      });
      return {
        ...currentGoalData,
        availableDays: [],
        confirmationMessage: 'Sorry, there was a configuration error. Please try again or contact support.'
      };
    }
    
    // Get business timezone (same pattern as other availability services)
    const userIdOfBusinessOwner = await AvailabilityService.findUserIdByBusinessWhatsappNumber(businessWhatsappNumberCustomersMessagedTo, chatContext);
    const businessId = chatContext.currentParticipant.associatedBusinessId;
    
    let providerTimezone = 'UTC';
    if (userIdOfBusinessOwner && businessId) {
      try {
        const { CalendarSettings } = await import('@/lib/database/models/calendar-settings');
        const calendarSettings = await CalendarSettings.getByUserAndBusiness(userIdOfBusinessOwner, businessId);
        providerTimezone = calendarSettings?.settings?.timezone || 'UTC';
        console.log('[ShowDayBrowser] Using business timezone:', providerTimezone);
      } catch (error) {
        console.warn('[ShowDayBrowser] Could not get business timezone, using UTC:', error);
      }
    }
    
    const availableDaysForThisBusiness = [];
    
    // Check days until we find 10 available days (max 20 days to prevent infinite loops)
    const nowInBusinessTz = LuxonDateTime.now().setZone(providerTimezone);
    const maxDaysToCheck = 20;
    const targetAvailableDays = 10;
    
    for (let i = 0; i < maxDaysToCheck && availableDaysForThisBusiness.length < targetAvailableDays; i++) {
      // Calculate date in business timezone
      const targetDate = nowInBusinessTz.plus({ days: i }).startOf('day');
      const dateString = targetDate.toISODate(); // YYYY-MM-DD format in business timezone
      
      // Skip if dateString is null (invalid date)
      if (!dateString) {
        console.error(`[ShowDayBrowser] Invalid date calculated for day ${i}, skipping`);
        continue;
      }
      
      console.log(`[ShowDayBrowser] === DAY ${i} DEBUG ===`);
      console.log(`[ShowDayBrowser] Business timezone: ${providerTimezone}`);
      console.log(`[ShowDayBrowser] Current time in business timezone: ${nowInBusinessTz.toISO()}`);
      console.log(`[ShowDayBrowser] Adding ${i} days to today in business timezone`);
      console.log(`[ShowDayBrowser] Calculated date in business timezone: ${targetDate.toISO()}`);
      console.log(`[ShowDayBrowser] Date string for availability check: ${dateString}`);
      console.log(`[ShowDayBrowser] Date.weekday (1=Mon, 7=Sun): ${targetDate.weekday}`);
      console.log(`[ShowDayBrowser] Date breakdown - Year: ${targetDate.year}, Month: ${targetDate.month}, Day: ${targetDate.day}`);
      
      try {
        const businessHasAvailabilityOnThisDate = await AvailabilityService.validateCustomDateForBusinessWhatsapp(
          businessWhatsappNumberCustomersMessagedTo,
          dateString,
          totalServiceDuration,
          chatContext
        );
        
        let displayText = '';
        if (i === 0) {
          displayText = getLocalizedText(chatContext, 'TIME_LABELS.TODAY');
        } else if (i === 1) {
          displayText = getLocalizedText(chatContext, 'TIME_LABELS.TOMORROW');
        } else {
          const language = getUserLanguage(chatContext);
          const locale = language === 'es' ? 'es-ES' : 'en-GB';
          // Convert to JavaScript Date for display formatting (keeps timezone info)
          const jsDate = targetDate.toJSDate();
          displayText = jsDate.toLocaleDateString(locale, { 
            weekday: 'short', day: 'numeric', month: 'short',
            timeZone: providerTimezone // Ensure display uses business timezone
          });
        }
        
        console.log(`[ShowDayBrowser] Business has availability on ${dateString}: ${businessHasAvailabilityOnThisDate}`);
        console.log(`[ShowDayBrowser] Calculated display text: ${displayText}`);
        
        if (businessHasAvailabilityOnThisDate) {
          console.log(`[ShowDayBrowser] === ADDING AVAILABLE DAY ===`);
          console.log(`[ShowDayBrowser] Date value (what goes in button): ${dateString}`);
          console.log(`[ShowDayBrowser] Display text (what user sees): ${displayText}`);
          console.log(`[ShowDayBrowser] Date object in business timezone: ${targetDate.toISO()}`);
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
        confirmationMessage: 'Sorry, no availability found in the coming weeks. Please contact us directly to check for other options.'
      };
    }
    
    return {
      ...currentGoalData,
      availableDays: availableDaysForThisBusiness,
      confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.SELECT_DAY_OR_TYPE')
    };
  },
  
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.quickBookingSelected) {
      console.log('[ShowDayBrowser] No buttons - quick booking selected');
      return [];
    }
    
    const availableDays = currentGoalData.availableDays as Array<{ date: string; displayText: string }> | undefined;
    
    console.log('[ShowDayBrowser] Available days for buttons:', availableDays?.length || 0);
    
    if (!availableDays || availableDays.length === 0) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.NO_AVAILABILITY'), buttonValue: 'contact_support' }];
    }
    
    const buttons = availableDays.slice(0, 10).map(day => ({
      buttonText: day.displayText,
      buttonValue: `day_${day.date}`
    }));
    
    console.log('[ShowDayBrowser] Generated buttons:', buttons);
    
    return buttons;
  }
};
