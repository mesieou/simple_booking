import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, AddressValidator, BookingButtonGenerator } from './booking-utils';

export const validateAddressHandler: IndividualStepHandler = {
  autoAdvance: true, // Auto-advance but controlled by shouldAutoAdvance flag
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    console.log('[ValidateAddress] Validating input:', userInput);
    
    // Detect context: determine which address needs validation based on validation flags
    // Priority: check which validation flag is false (indicates unvalidated address)
    const needsPickupValidation = !!currentGoalData.pickupAddress && !currentGoalData.pickupAddressValidated;
    const needsDropoffValidation = !!currentGoalData.dropoffAddress && !currentGoalData.dropoffAddressValidated;
    
    let isValidatingDropoff = false;
    if (needsPickupValidation && !needsDropoffValidation) {
      isValidatingDropoff = false; // Validate pickup
    } else if (!needsPickupValidation && needsDropoffValidation) {
      isValidatingDropoff = true; // Validate dropoff  
    } else if (needsPickupValidation && needsDropoffValidation) {
      // Both need validation - default to pickup first
      isValidatingDropoff = false;
    } else {
      // Fallback to old logic if no clear indicators
      isValidatingDropoff = !!currentGoalData.dropoffAddress;
    }
    
    const currentValidationFlag = isValidatingDropoff ? currentGoalData.dropoffAddressValidated : currentGoalData.pickupAddressValidated;
    
    console.log('[ValidateAddress] Current validation state:', {
      isValidatingDropoff,
      currentValidationFlag,
      isAddressValidated: currentGoalData.isAddressValidated,
      lastErrorMessage: currentGoalData.lastErrorMessage,
      hasCustomerAddress: !!currentGoalData.customerAddress,
      needsPickupValidation,
      needsDropoffValidation,
      pickupAddress: currentGoalData.pickupAddress,
      dropoffAddress: currentGoalData.dropoffAddress,
      pickupAddressValidated: currentGoalData.pickupAddressValidated,
      dropoffAddressValidated: currentGoalData.dropoffAddressValidated
    });
    
    // Handle address confirmation buttons - always valid
    if (userInput === 'address_confirmed' || userInput === 'address_edit') {
      console.log('[ValidateAddress] Button input - valid');
      return { isValidInput: true };
    }
    
    // For empty input (auto-advance from previous step), check if we need to validate
    if (!userInput || userInput === "") {
      // If address is already validated, allow advancement
      if (currentValidationFlag) {
        console.log('[ValidateAddress] Empty input with validated address - valid');
        return { isValidInput: true };
      }
      
      // If we have an unvalidated address, validate it now and FAIL validation if it doesn't pass
      if (currentGoalData.customerAddress && !currentGoalData.lastErrorMessage) {
        console.log('[ValidateAddress] Empty input with unvalidated address - calling Google API for validation');
        
        const googleValidationResult = await AddressValidator.validateWithGoogleAPI(
          currentGoalData.customerAddress,
          chatContext
        );

        console.log('[ValidateAddress] Google API validation result in validateUserInput:', googleValidationResult);

        if (googleValidationResult.isValid && googleValidationResult.formattedAddress) {
          console.log('[ValidateAddress] Google validation successful in validateUserInput');
          return { isValidInput: true };
        } else {
          console.log('[ValidateAddress] Google validation failed in validateUserInput - FAILING VALIDATION');
          const customerName = currentGoalData.customerName || 'there';
          const errorMessage = googleValidationResult.errorMessage || getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS', { name: customerName });
          const finalErrorMessage = errorMessage.replace('{name}', customerName);
          return { 
            isValidInput: false, 
            validationErrorMessage: finalErrorMessage
          };
        }
      }
      
      // If there was a previous validation error, show it
      if (currentGoalData.lastErrorMessage) {
        console.log('[ValidateAddress] Previous validation error exists - FAILING VALIDATION');
        const customerName = currentGoalData.customerName || 'there';
        const errorMessage = currentGoalData.lastErrorMessage || getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS', { name: customerName });
        const finalErrorMessage = errorMessage.replace('{name}', customerName);
        return { 
          isValidInput: false, 
          validationErrorMessage: finalErrorMessage
        };
      }
      
      console.log('[ValidateAddress] Empty input with no address - valid for initial display');
      return { isValidInput: true };
    }
    
    // For new address input, validate it immediately with Google API
    if (userInput && userInput.length > 5) {
      console.log('[ValidateAddress] New address input - calling Google API:', userInput);
      
      const googleValidationResult = await AddressValidator.validateWithGoogleAPI(
        userInput,
        chatContext
      );

      console.log('[ValidateAddress] Google API validation result for new input:', googleValidationResult);

      if (googleValidationResult.isValid && googleValidationResult.formattedAddress) {
        console.log('[ValidateAddress] New address validation successful');
        const successResult = { 
          isValidInput: true,
          transformedInput: userInput // Pass the address to processing
        };
        console.log('[ValidateAddress] Returning success result:', successResult);
        return successResult;
      } else {
        console.log('[ValidateAddress] New address validation failed - FAILING VALIDATION');
        const customerName = currentGoalData.customerName || 'there';
        const errorMessage = googleValidationResult.errorMessage || getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS', { name: customerName });
        const finalErrorMessage = errorMessage.replace('{name}', customerName);
        console.log('[ValidateAddress] Generated error message:', finalErrorMessage);
        const errorResult = { 
          isValidInput: false, 
          validationErrorMessage: finalErrorMessage
        };
        console.log('[ValidateAddress] Returning error result:', errorResult);
        return errorResult;
      }
    }
    
    console.log('[ValidateAddress] Input too short - FAILING VALIDATION');
    const customerName = currentGoalData.customerName || 'there';
    const errorMessage = getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS', { name: customerName });
    const finalErrorMessage = errorMessage.replace('{name}', customerName);
    return { 
      isValidInput: false, 
      validationErrorMessage: finalErrorMessage
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[ValidateAddress] Processing input:', validatedInput);
    console.log('[ValidateAddress] Current customerAddress:', currentGoalData.customerAddress);
    console.log('[ValidateAddress] IsAddressValidated:', currentGoalData.isAddressValidated);
    
    // Detect context: determine which address needs validation based on validation flags
    // Priority: check which validation flag is false (indicates unvalidated address)
    const needsPickupValidation = !!currentGoalData.pickupAddress && !currentGoalData.pickupAddressValidated;
    const needsDropoffValidation = !!currentGoalData.dropoffAddress && !currentGoalData.dropoffAddressValidated;
    
    let isValidatingDropoff = false;
    if (needsPickupValidation && !needsDropoffValidation) {
      isValidatingDropoff = false; // Validate pickup
    } else if (!needsPickupValidation && needsDropoffValidation) {
      isValidatingDropoff = true; // Validate dropoff  
    } else if (needsPickupValidation && needsDropoffValidation) {
      // Both need validation - default to pickup first
      isValidatingDropoff = false;
    } else {
      // Fallback to old logic if no clear indicators
      isValidatingDropoff = !!currentGoalData.dropoffAddress;
    }
    
    const currentValidationFlag = isValidatingDropoff ? currentGoalData.dropoffAddressValidated : currentGoalData.pickupAddressValidated;
    console.log('[ValidateAddress] Context detected - validating dropoff:', isValidatingDropoff);
    console.log('[ValidateAddress] Context detection details:', {
      needsPickupValidation,
      needsDropoffValidation,
      pickupAddress: currentGoalData.pickupAddress,
      dropoffAddress: currentGoalData.dropoffAddress,
      pickupAddressValidated: currentGoalData.pickupAddressValidated,
      dropoffAddressValidated: currentGoalData.dropoffAddressValidated,
      customerAddress: currentGoalData.customerAddress
    });
    
    // Handle user clicking "edit address" - clear validation and go back to ask for address
    if (validatedInput === 'address_edit') {
      console.log('[ValidateAddress] User wants to edit address - clearing validation state');
      
      if (isValidatingDropoff) {
        return {
          ...currentGoalData,
          customerAddress: undefined,
          customerDropoffAddress: undefined,
          dropoffAddress: undefined,
          isAddressValidated: false,
          dropoffAddressValidated: false,
          lastErrorMessage: undefined,
          confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.DROPOFF_ADDRESS_REQUEST', { name: currentGoalData.customerName || 'there' })
        };
      } else {
        return {
          ...currentGoalData,
          customerAddress: undefined,
          pickupAddress: undefined,
          isAddressValidated: false,
          pickupAddressValidated: false,
          lastErrorMessage: undefined,
          confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.PICKUP_ADDRESS_REQUEST', { name: currentGoalData.customerName || 'there' })
        };
      }
    }

    // If we reach here, validation already passed in validateUserInput, so we can safely process
    
    // If user provided a new address, update it (validation already passed)
    if (validatedInput && validatedInput.length > 5 && validatedInput !== 'address_confirmed') {
      console.log('[ValidateAddress] Processing new validated address:', validatedInput);
      
      // Get the formatted address from Google API (validation already passed)
      const googleValidationResult = await AddressValidator.validateWithGoogleAPI(
        validatedInput,
        chatContext
      );
      
      console.log('[ValidateAddress] NEW ADDRESS VALIDATION SUCCEEDED - Silent success:', {
        validatedInput,
        formattedAddress: googleValidationResult.formattedAddress,
        isValidatingDropoff
      });
      
      if (isValidatingDropoff) {
        return {
          ...currentGoalData,
          customerAddress: validatedInput,
          customerDropoffAddress: validatedInput,
          dropoffAddress: validatedInput,
          finalDropoffAddress: googleValidationResult.formattedAddress || validatedInput,
          isAddressValidated: true,
          dropoffAddressValidated: true,
          lastErrorMessage: undefined,
          shouldAutoAdvance: true // ALLOW auto-advance on validation success
          // NO confirmationMessage - let the next step handle user messaging
        };
      } else {
        return {
          ...currentGoalData,
          customerAddress: validatedInput,
          pickupAddress: validatedInput,
          finalServiceAddress: googleValidationResult.formattedAddress || validatedInput,
          isAddressValidated: true,
          pickupAddressValidated: true,
          lastErrorMessage: undefined,
          shouldAutoAdvance: true // ALLOW auto-advance on validation success
          // NO confirmationMessage - let the next step handle user messaging
        };
      }
    }

    // If auto-advance with unvalidated address that passed validation, process it
    if (currentGoalData.customerAddress && !currentValidationFlag) {
      console.log('[ValidateAddress] Processing unvalidated address that passed validation:', currentGoalData.customerAddress);
      
      // Get the formatted address from Google API (validation already passed in validateUserInput)
      const googleValidationResult = await AddressValidator.validateWithGoogleAPI(
        currentGoalData.customerAddress,
        chatContext
      );
      
      console.log('[ValidateAddress] Google API result for confirmed valid address:', googleValidationResult);
      
      // Check if validation actually succeeded before proceeding
      if (googleValidationResult.isValid && googleValidationResult.formattedAddress) {
        console.log('[ValidateAddress] VALIDATION SUCCEEDED - Silent success, advancing to next step:', {
          address: currentGoalData.customerAddress,
          formattedAddress: googleValidationResult.formattedAddress,
          isValidatingDropoff
        });
        
        if (isValidatingDropoff) {
          return {
            ...currentGoalData,
            finalDropoffAddress: googleValidationResult.formattedAddress,
            isAddressValidated: true,
            dropoffAddressValidated: true,
            lastErrorMessage: undefined,
            shouldAutoAdvance: true // ALLOW auto-advance on validation success
            // NO confirmationMessage - let the next step handle user messaging
          };
        } else {
          return {
            ...currentGoalData,
            finalServiceAddress: googleValidationResult.formattedAddress,
            isAddressValidated: true,
            pickupAddressValidated: true,
            lastErrorMessage: undefined,
            shouldAutoAdvance: true // ALLOW auto-advance on validation success
            // NO confirmationMessage - let the next step handle user messaging  
          };
        }
      } else {
        // Validation failed - set error state and don't auto-advance  
        const customerName = currentGoalData.customerName || 'there';
        const errorMessage = googleValidationResult.errorMessage || getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.INVALID_ADDRESS', { name: customerName });
        
        // Replace {name} placeholder in the Google API error message if it exists
        const finalErrorMessage = errorMessage.replace('{name}', customerName);
        
        console.log('[ValidateAddress] VALIDATION FAILED - Setting error state:', {
          address: currentGoalData.customerAddress,
          googleApiError: googleValidationResult.errorMessage,
          processedErrorMessage: errorMessage,
          finalErrorMessage: finalErrorMessage,
          customerName: customerName,
          isValidatingDropoff
        });
        
        if (isValidatingDropoff) {
          const errorResult = {
            ...currentGoalData,
            isAddressValidated: false,
            dropoffAddressValidated: false,
            lastErrorMessage: finalErrorMessage,
            confirmationMessage: `❌ Invalid drop-off address: ${currentGoalData.customerAddress}. ${finalErrorMessage}`,
            shouldAutoAdvance: false // STOP auto-advance on validation error
          };
          console.log('[ValidateAddress] Returning dropoff error result:', {
            confirmationMessage: errorResult.confirmationMessage,
            lastErrorMessage: errorResult.lastErrorMessage
          });
          return errorResult;
        } else {
          const errorResult = {
            ...currentGoalData,
            isAddressValidated: false,
            pickupAddressValidated: false,
            lastErrorMessage: finalErrorMessage,
            confirmationMessage: `❌ Invalid pickup address: ${currentGoalData.customerAddress}. ${finalErrorMessage}`,
            shouldAutoAdvance: false // STOP auto-advance on validation error
          };
          console.log('[ValidateAddress] Returning pickup error result:', {
            confirmationMessage: errorResult.confirmationMessage,
            lastErrorMessage: errorResult.lastErrorMessage
          });
          return errorResult;
        }
      }
    }

    // If address is already validated and user confirmed it
    if (validatedInput === 'address_confirmed' && currentValidationFlag) {
      console.log('[ValidateAddress] User confirmed validated address - Silent success, advancing to next step');
      
      return {
        ...currentGoalData
        // NO confirmationMessage - let the next step handle user messaging
      };
    }

    console.log('[ValidateAddress] No validation action taken, returning current data');
    return currentGoalData;
  },
  
  fixedUiButtons: async (currentGoalData, chatContext) => {
    // For address validation errors, don't show buttons - user should just type a new address
    return [];
  }
};
