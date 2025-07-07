import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { BookingDataManager } from './booking-utils';

export const handleTimeChoiceHandler: IndividualStepHandler = {
  autoAdvance: true,
  
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
  
  processAndExtractData: async (validatedInput, currentGoalData) => {
    console.log('[HandleTimeChoice] Processing input:', validatedInput);
    
    if (validatedInput.startsWith('slot_')) {
      const parts = validatedInput.split('_');
      const selectedDate = parts[2];
      const selectedTime = parts[3];
      
      console.log('[HandleTimeChoice] Quick booking selected:', { selectedDate, selectedTime });
      return BookingDataManager.setQuickBooking(currentGoalData, selectedDate, selectedTime);
    }
    
    if (validatedInput === 'choose_another_day') {
      console.log('[HandleTimeChoice] Browse mode selected - clearing time data');
      return BookingDataManager.setBrowseMode(currentGoalData);
    }
    
    console.log('[HandleTimeChoice] Unexpected input, returning current data');
    return currentGoalData;
  }
};
