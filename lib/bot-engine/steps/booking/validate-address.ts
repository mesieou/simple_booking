import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, AddressValidator, BookingButtonGenerator } from './booking-utils';

export const validateAddressHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Let me validate your address...',
  autoAdvance: true,
  
  validateUserInput: async (userInput) => {
    // Handle address confirmation buttons
    if (userInput === 'address_confirmed' || userInput === 'address_edit' || userInput === 'try_again') {
      return { isValidInput: true };
    }
    // Accept empty input for initial validation
    if (!userInput || userInput === "") {
      return { isValidInput: true };
    }
    return { isValidInput: false, validationErrorMessage: '' };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    // Handle user clicking "edit address" or "try again"
    if (validatedInput === 'address_edit' || validatedInput === 'try_again') {
      return {
        ...currentGoalData,
        customerAddress: undefined,
        finalServiceAddress: undefined,
        isAddressValidated: false,
        addressValidationError: undefined,
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.PROVIDE_ADDRESS', { name: currentGoalData.customerName || '{name}' })
      };
    }
    
    // Handle user confirming the address
    if (validatedInput === 'address_confirmed') {
      return {
        ...currentGoalData,
        addressConfirmed: true,
        shouldAutoAdvance: true
      };
    }
    
    // Only validate if we have a customer address and haven't validated yet
    if (currentGoalData.customerAddress && !currentGoalData.isAddressValidated && !currentGoalData.addressValidationError) {
      const googleValidationResult = await AddressValidator.validateWithGoogleAPI(
        currentGoalData.customerAddress,
        chatContext
      );
      
      if (googleValidationResult.isValid && googleValidationResult.formattedAddress) {
        return {
          ...currentGoalData,
          finalServiceAddress: googleValidationResult.formattedAddress,
          isAddressValidated: true,
          confirmationMessage: `Is this address correct?\n\n${googleValidationResult.formattedAddress}`
        };
      }
      
      return {
        ...currentGoalData,
        addressValidationError: true,
        confirmationMessage: googleValidationResult.errorMessage || getLocalizedText(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS')
      };
    }
    
    // Return current data if no validation needed
    return currentGoalData;
  },
  
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.addressValidationError) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.TRY_AGAIN'), buttonValue: 'try_again' }];
    }
    
    if (currentGoalData.isAddressValidated && !currentGoalData.addressConfirmed) {
      return BookingButtonGenerator.createAddressConfirmationButtons(chatContext);
    }
    
    return [];
  }
};
