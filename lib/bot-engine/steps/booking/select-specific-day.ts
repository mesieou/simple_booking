import type { IndividualStepHandler } from '@/lib/bot-engine/types';

export const selectSpecificDayHandler: IndividualStepHandler = {
  
  validateUserInput: async (userInput, currentGoalData) => {
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true };
    }
    
    if (userInput.startsWith('day_')) {
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select a valid day.'
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData) => {
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
        shouldAutoAdvance: true,
        confirmationMessage: 'Got it. Let me get available times...'
      };
    }
    
    return currentGoalData;
  }
};
