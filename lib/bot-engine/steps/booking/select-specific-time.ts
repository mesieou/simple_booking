import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, AvailabilityService } from './booking-utils';

export const selectSpecificTimeHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please select your preferred time:',
  autoAdvance: false,
  
  validateUserInput: async (userInput, currentGoalData) => {
    console.log('[SelectSpecificTime] Validating input:', userInput);
    console.log('[SelectSpecificTime] Available hours count:', currentGoalData.formattedAvailableHours?.length || 0);
    
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true };
    }
    
    if (!userInput || userInput === "") {
      return { isValidInput: true };
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours || [];
    
    if (formattedHours.length === 0 && currentGoalData.selectedDate) {
      return {
        isValidInput: false,
        validationErrorMessage: 'Loading available times...'
      };
    }
    
    if (formattedHours.length === 0) {
      return {
        isValidInput: false,
        validationErrorMessage: 'Please select a date first.'
      };
    }
    
    if (formattedHours.some((h: any) => h.display === userInput)) {
      console.log('[SelectSpecificTime] Valid time selection:', userInput);
      return { isValidInput: true };
    }
    
    console.log('[SelectSpecificTime] Invalid time selection:', userInput);
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select a valid time from the available options.'
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[SelectSpecificTime] Processing input:', validatedInput);
    console.log('[SelectSpecificTime] Selected date:', currentGoalData.selectedDate);
    console.log('[SelectSpecificTime] Quick booking:', currentGoalData.quickBookingSelected);
    
    if (currentGoalData.quickBookingSelected) {
      return currentGoalData;
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours || [];
    console.log('[SelectSpecificTime] Current formatted hours:', formattedHours.length);
    
    // If this is the first display (empty input), don't process time selection yet
    if (!validatedInput || validatedInput === "") {
      console.log('[SelectSpecificTime] Empty input - first display, checking if hours are loaded');
      
      // If hours aren't loaded yet, try to load them
      if (formattedHours.length === 0 && currentGoalData.selectedDate) {
        console.log('[SelectSpecificTime] Loading hours for first display');
        const businessWhatsappNumber = chatContext.currentParticipant.businessWhatsappNumber;
        const selectedService = currentGoalData.selectedService;
        const selectedDate = currentGoalData.selectedDate;
        
        if (businessWhatsappNumber && selectedService?.durationEstimate && selectedDate) {
          try {
            const availableHours = await AvailabilityService.getAvailableHoursForDateByBusinessWhatsapp(
              businessWhatsappNumber,
              selectedDate,
              selectedService.durationEstimate,
              chatContext
            );
            
            const roundedTimesOnly = availableHours.filter(time => {
              const [hours, minutes] = time.split(':');
              return minutes === '00';
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
            
            console.log('[SelectSpecificTime] Loaded and formatted hours:', formattedHoursForDisplay.length);
            return {
              ...currentGoalData,
              availableHours,
              formattedAvailableHours: formattedHoursForDisplay,
              confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.SELECT_TIME')
            };
            
          } catch (error) {
            console.error('[SelectSpecificTime] Error loading hours:', error);
            return {
              ...currentGoalData,
              confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.ERROR_LOADING_AVAILABLE_TIMES')
            };
          }
        }
      }
      
      // If hours are already loaded or no date selected, just return current data
      if (formattedHours.length === 0) {
        return {
          ...currentGoalData,
          confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.SELECT_DATE_FIRST')
        };
      }
      
      // Hours are loaded, display them
      return {
        ...currentGoalData,
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.SELECT_TIME')
      };
    }
    
    // Process the actual time selection
    console.log('[SelectSpecificTime] Processing time selection:', validatedInput);
    let selectedTime = validatedInput;
    const matchedHour = formattedHours.find((h: any) => h.display === validatedInput);
    if (matchedHour) {
      selectedTime = matchedHour.time24;
    }
    
    console.log('[SelectSpecificTime] Selected time (24h format):', selectedTime);
    
    return {
      ...currentGoalData,
      selectedTime,
      shouldAutoAdvance: true,
      confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.SELECTED_TIME_CONFIRM', { time: validatedInput })
    };
  },
  
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.quickBookingSelected) {
      return [];
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours || [];
    
    if (formattedHours.length === 0) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.CHOOSE_DATE_FIRST'), buttonValue: 'choose_date' }];
    }
    
    const timeButtons = formattedHours.map((hour: any) => ({
      buttonText: hour.display,
      buttonValue: hour.display
    }));
    
    return timeButtons;
  }
};
