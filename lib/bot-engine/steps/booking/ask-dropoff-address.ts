import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedTextWithVars, AddressValidator } from './booking-utils';

export const askDropoffAddressHandler: IndividualStepHandler = {
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    console.log('[AskDropoffAddress] validateUserInput called with:', { 
      userInput, 
      inputLength: userInput?.length,
      hasDropoffAddress: !!currentGoalData.dropoffAddress,
      hasCustomerAddress: !!currentGoalData.customerAddress
    });
    
    // Only do minimal length check - let Google API be the authoritative validator
    if (!userInput || userInput.trim().length < 5) {
      const customerName = currentGoalData.customerName || 'there';
      console.log('[AskDropoffAddress] Validation failed - input too short');
      return {
        isValidInput: false,
        validationErrorMessage: getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS', { name: customerName })
      };
    }
    
    console.log('[AskDropoffAddress] Validation passed');
    return { isValidInput: true };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[AskDropoffAddress] processAndExtractData called with:', {
      validatedInput,
      hasValidatedInput: !!validatedInput,
      currentDropoffAddress: currentGoalData.dropoffAddress,
      currentCustomerAddress: currentGoalData.customerAddress
    });
    
    if (validatedInput) {
      console.log('[AskDropoffAddress] Processing dropoff address:', validatedInput);
      const updatedData = {
        ...currentGoalData,
        customerAddress: validatedInput,       // Set for generic validation step
        dropoffAddress: validatedInput,        // Keep for dropoff context
        dropoffAddressValidated: false         // Clear validation flag to ensure validation runs
      };
      console.log('[AskDropoffAddress] Returning updated data with dropoff address set');
      return updatedData;
    }
    
    // Handle first display (empty input)
    const customerName = currentGoalData?.customerName || 'there';
    console.log('[AskDropoffAddress] No validated input - showing initial prompt');
    return {
      ...currentGoalData,
      confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.DROPOFF_ADDRESS_REQUEST', { name: customerName })
    };
  }
}; 