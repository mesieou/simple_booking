import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedTextWithVars, AddressValidator } from './booking-utils';

export const askPickupAddressHandler: IndividualStepHandler = {
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    console.log('[AskPickupAddress] validateUserInput called with:', { 
      userInput, 
      inputLength: userInput?.length,
      hasPickupAddress: !!currentGoalData.pickupAddress,
      hasCustomerAddress: !!currentGoalData.customerAddress
    });
    
    // Only do minimal length check - let Google API be the authoritative validator
    if (!userInput || userInput.trim().length < 5) {
      const customerName = currentGoalData.customerName || '{name}';
      console.log('[AskPickupAddress] Validation failed - input too short');
      return {
        isValidInput: false,
        validationErrorMessage: getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS', { name: customerName })
      };
    }
    
    console.log('[AskPickupAddress] Validation passed');
    return { isValidInput: true };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[AskPickupAddress] processAndExtractData called with:', {
      validatedInput,
      hasValidatedInput: !!validatedInput,
      currentPickupAddress: currentGoalData.pickupAddress,
      currentCustomerAddress: currentGoalData.customerAddress
    });
    
    if (validatedInput) {
      console.log('[AskPickupAddress] Processing pickup address:', validatedInput);
      const updatedData = {
        ...currentGoalData,
        customerAddress: validatedInput, // Set for generic validation step
        pickupAddress: validatedInput,   // Keep for pickup context
        pickupAddressValidated: false    // Clear validation flag to ensure validation runs
      };
      console.log('[AskPickupAddress] Returning updated data with pickup address set');
      return updatedData;
    }
    
    // Handle first display (empty input)
    const customerName = currentGoalData?.customerName || '{name}';
    console.log('[AskPickupAddress] No validated input - showing initial prompt');
    return {
      ...currentGoalData,
      confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.PICKUP_ADDRESS_REQUEST', { name: customerName })
    };
  }
}; 