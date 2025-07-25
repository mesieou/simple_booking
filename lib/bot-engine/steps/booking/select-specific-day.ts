import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { DateTime as LuxonDateTime } from 'luxon';
import { getLocalizedText } from './booking-utils';
import { Business } from '@/lib/database/models/business';

// Helper function to parse natural language dates - simplified and more flexible
function parseUserDateInput(userInput: string, timezone: string = 'Australia/Sydney'): string | null {
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

export const selectSpecificDayHandler: IndividualStepHandler = {
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true };
    }
    
    // Handle button selection (existing functionality)
    if (userInput.startsWith('day_')) {
      return { isValidInput: true };
    }
    
    // Handle text input for dates
    if (userInput && !userInput.startsWith('day_')) {
      const businessId = chatContext.currentParticipant.associatedBusinessId;
      if (!businessId) {
        return { isValidInput: false };
      }
      
      const business = await Business.getById(businessId);
      const businessTimezone = business.timeZone;
      const parsedDate = parseUserDateInput(userInput, businessTimezone);
      
      if (parsedDate) {
        console.log(`[SelectSpecificDay] Parsed user input "${userInput}" to date: ${parsedDate}`);
        return { isValidInput: true };
      } else {
        return {
          isValidInput: false,
          validationErrorMessage: getLocalizedText(chatContext, 'ERROR_MESSAGES.INVALID_DATE_FORMAT')
        };
      }
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: getLocalizedText(chatContext, 'ERROR_MESSAGES.INVALID_DATE_SELECTION')
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    if (currentGoalData.quickBookingSelected) {
      return currentGoalData;
    }
    
    let selectedDate: string;
    let confirmationMessage: string;
    
    if (validatedInput.startsWith('day_')) {
      // Handle button selection (existing functionality)
      selectedDate = validatedInput.replace('day_', '');
      confirmationMessage = 'Got it. Let me get available times...';
      
      console.log(`[SelectSpecificDay] === DAY SELECTION DEBUG (BUTTON) ===`);
      console.log(`[SelectSpecificDay] User clicked button with value: ${validatedInput}`);
      console.log(`[SelectSpecificDay] Extracted date: ${selectedDate}`);
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
        
        console.log(`[SelectSpecificDay] === DAY SELECTION DEBUG (TEXT) ===`);
        console.log(`[SelectSpecificDay] User typed: ${validatedInput}`);
        console.log(`[SelectSpecificDay] Parsed to date: ${selectedDate}`);
        console.log(`[SelectSpecificDay] Formatted display: ${dayName}, ${dateFormatted}`);
      } else {
        console.log(`[SelectSpecificDay] Failed to parse user input: ${validatedInput}`);
        return currentGoalData;
      }
    }
    
    console.log(`[SelectSpecificDay] Date object from selected date: ${new Date(selectedDate).toISOString()}`);
    console.log(`[SelectSpecificDay] Day of week: ${new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long' })}`);
    console.log(`[SelectSpecificDay] === END DAY SELECTION DEBUG ===`);
    
    return {
      ...currentGoalData,
      selectedDate,
      shouldAutoAdvance: true,
      confirmationMessage
    };
  }
};
