/**
 * @fileoverview Step handler for selecting a service.
 * 
 * This handler is responsible for:
 * 1. Loading the list of available services for the business if not already present.
 * 2. Displaying the services to the user with buttons.
 * 3. Validating the user's selection to ensure it's a valid service.
 * 4. Storing the selected service details in the goal's collectedData.
 */

import { IndividualStepHandler } from "../../../conversation-engine/state-manager";
import { UserContext } from "../../../database/models/user-context";
import { Service } from "../../../database/models/service"; // Assuming this path is correct

// --- Helper Functions (specific to this step) ---

// Fetches services for a business with proper error handling
async function fetchServicesForBusiness(businessId: string): Promise<{ services: any[]; error?: string }> {
  if (!businessId) {
    console.error('[selectService.handler] Business ID not found in user context.');
    return { services: [], error: 'Business configuration error' };
  }

  try {
    const services = await Service.getByBusiness(businessId);
    if (services.length === 0) {
      return { services: [], error: 'No services are currently available.' };
    }
    return { services: services.map(s => s.getData()) };
  } catch (error) {
    console.error(`[selectService.handler] Error fetching services for business ${businessId}:`, error);
    return { services: [], error: 'Unable to load services at the moment.' };
  }
}

// --- Step Handler Definition ---

export const selectServiceHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Please choose one of the services below:',

  // This step should not be skipped automatically.
  autoAdvance: false,

  /**
   * Validates that the user's input matches one of the available service IDs.
   * If input is empty, it's the first time viewing, so it's valid.
   */
  validateUserInput: async (userInput: string, currentGoalData: Record<string, any>): Promise<boolean> => {
    // If userInput is empty, it means we are just displaying the services for the first time.
    if (!userInput) {
      return true;
    }

    const availableServices = currentGoalData.availableServices as any[] | undefined;
    if (!availableServices || availableServices.length === 0) {
      // This case should ideally not be hit if processAndExtractData runs first, but is a safeguard.
      return false;
    }

    // Check if the user's input is a valid service ID.
    const isIdValid = availableServices.some(service => service.id === userInput);
    return isIdValid;
  },

  /**
   * Loads services if they don't exist, then processes the user's selection.
   */
  processAndExtractData: async (validatedInput: string, currentGoalData: Record<string, any>, userContext: UserContext): Promise<Record<string, any>> => {
    let availableServices = currentGoalData.availableServices as any[] | undefined;

    // 1. Load services if they are not already in the context.
    if (!availableServices || availableServices.length === 0) {
      if (userContext.businessId) {
        const { services, error } = await fetchServicesForBusiness(userContext.businessId);
        if (error) {
          return { ...currentGoalData, stepError: error };
        }
        availableServices = services;
      } else {
        return { ...currentGoalData, stepError: 'No business associated with this user.' };
      }
    }
    
    // 2. If there's no input, it's the first view. Just return the loaded services.
    // The `fixedUiButtons` function will use this data to generate the buttons.
    if (!validatedInput) {
      const confirmationMessage = currentGoalData.stepError || 'Please choose one of the services below:';
      return { 
        ...currentGoalData, 
        availableServices,
        confirmationMessage
      };
    }

    // 3. Process the validated user selection.
    const selectedService = availableServices?.find(service => service.id === validatedInput);
    
    if (!selectedService) {
      // This should not happen if validateUserInput passed, but is a safeguard.
      return { 
        ...currentGoalData, 
        availableServices,
        stepError: 'The selected service is not valid. Please choose from the list.'
      };
    }

    // Return all existing data, plus the newly selected service and a confirmation.
    return {
      ...currentGoalData,
      availableServices,
      selectedService: {
        id: selectedService.id,
        name: selectedService.name,
        durationEstimate: selectedService.durationEstimate,
        fixedPrice: selectedService.fixedPrice,
        pricingType: selectedService.pricingType,
        mobile: selectedService.mobile
      },
      // This message will be used by the orchestrator to respond to the user.
      confirmationMessage: `You've selected "${selectedService.name}".`
    };
  },

  /**
   * Generates buttons for each available service.
   */
  fixedUiButtons: async (currentGoalData: Record<string, any>) => {
    const availableServices = currentGoalData.availableServices as any[] | undefined;

    if (!availableServices || availableServices.length === 0) {
      // If there's an error (e.g., no services), we could show an error button.
      // For now, we return an empty array. The prompt will show the error message.
      return [];
    }

    return availableServices.map(service => {
      const priceDisplay = service.fixedPrice ? ` - $${service.fixedPrice}` : '';
      const durationDisplay = service.durationEstimate ? ` (${service.durationEstimate}min)` : '';
      const mobileIcon = service.mobile ? '🚗 ' : '🏪 ';

      return {
        buttonText: `${mobileIcon}${service.name}${priceDisplay}${durationDisplay}`,
        buttonValue: service.id || 'error_id_missing'
      };
    });
  }
}; 