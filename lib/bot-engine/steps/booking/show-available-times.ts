import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, AvailabilityService, ServiceDataProcessor } from './booking-utils';

// Step 1: Show next 2 available times + "choose another day" button
// Job: ONLY display times, no input processing
export const showAvailableTimesHandler: IndividualStepHandler = {
  
  // Only accept empty input (first display), reject button clicks so they go to next step
  validateUserInput: async (userInput) => {
    console.log('[ShowAvailableTimes] Validating input:', userInput);
    
    // If this is empty input (first display), accept it
    if (!userInput || userInput === "") {
      console.log('[ShowAvailableTimes] Empty input - accepting for first display');
      return { isValidInput: true };
    }
    
    // If this is a button click, reject it so it goes to handleTimeChoice
    if (userInput.startsWith('slot_') || userInput === 'choose_another_day') {
      console.log('[ShowAvailableTimes] Button click detected - rejecting to pass to next step');
      return { 
        isValidInput: false,
        validationErrorMessage: '' // No error message, just advance to next step
      };
    }
    
    return { 
      isValidInput: false,
      validationErrorMessage: 'Please select one of the available options.' 
    };
  },
  
  // Use generic processor with custom availability fetching logic
  // Get and display available times only on first display
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[ShowAvailableTimes] Processing input:', validatedInput);
    
    // Only process empty input (first display)
    if (validatedInput !== "") {
      console.log('[ShowAvailableTimes] Non-empty input - not processing');
      return currentGoalData;
    }
    
    const businessWhatsappNumberCustomersMessagedTo = chatContext.currentParticipant.businessWhatsappNumber;
    const selectedServiceByCustomer = currentGoalData.selectedService;
    
    console.log('[ShowAvailableTimes] Business WhatsApp number customers messaged TO:', businessWhatsappNumberCustomersMessagedTo);
    console.log('[ShowAvailableTimes] Service selected by customer:', selectedServiceByCustomer);
    
    // Calculate total duration from all selected services
    const totalServiceDuration = ServiceDataProcessor.calculateTotalServiceDuration(currentGoalData);
    
    console.log('[ShowAvailableTimes] Total service duration for availability check:', totalServiceDuration, 'minutes');
    
    if (!businessWhatsappNumberCustomersMessagedTo || totalServiceDuration <= 0) {
      // Simple pattern - check goal data, then session, then fallback (ONLY CHANGE)
      const customerName = currentGoalData.customerName || 
                          chatContext?.currentConversationSession?.userData?.customerName || 
                          'there';
      
      console.log('[ShowAvailableTimes] DEBUG - Customer name resolution (error case):', {
        fromGoalData: currentGoalData.customerName,
        fromSession: chatContext?.currentConversationSession?.userData?.customerName,
        finalName: customerName,
        hasGoalData: !!currentGoalData.customerName,
        hasSessionData: !!chatContext?.currentConversationSession?.userData?.customerName
      });
      
      return {
        ...currentGoalData,
        customerName, // Store the resolved name in goal data
        availabilityError: 'Configuration error - missing business or service information',
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.CONFIGURATION_ERROR', { name: customerName })
      };
    }
    
    const next2WholeHourSlots = await AvailabilityService.getNext2WholeHourSlotsForBusinessWhatsapp(
      businessWhatsappNumberCustomersMessagedTo,
      totalServiceDuration,
      chatContext
    );
    
    console.log('[ShowAvailableTimes] Next 2 whole hour slots:', next2WholeHourSlots);
    
    // Simple pattern - check goal data, then session, then fallback (ONLY CHANGE)
    const customerName = currentGoalData.customerName || 
                        chatContext?.currentConversationSession?.userData?.customerName || 
                        'there';
    
    console.log('[ShowAvailableTimes] DEBUG - Customer name resolution:', {
      fromGoalData: currentGoalData.customerName,
      fromSession: chatContext?.currentConversationSession?.userData?.customerName,
      finalName: customerName,
      hasGoalData: !!currentGoalData.customerName,
      hasSessionData: !!chatContext?.currentConversationSession?.userData?.customerName
    });
    
    return {
      ...currentGoalData,
      customerName, // Store the resolved name in goal data
      next2WholeHourSlots: next2WholeHourSlots,
      confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.AVAILABLE_TIMES', { name: customerName }),
      listSectionTitle: getLocalizedText(chatContext, 'LIST_SECTIONS.AVAILABLE_OPTIONS')
    };
  },
  
  // Show exactly 2 whole hour time slots + "Choose another day" button
  fixedUiButtons: async (currentGoalData, chatContext) => {
    const availabilityError = currentGoalData.availabilityError as string | undefined;
    if (availabilityError) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.CONTACT_DIRECTLY'), buttonValue: 'contact_support' }];
    }
    
    const next2WholeHourSlots = currentGoalData.next2WholeHourSlots as Array<{ date: string; time: string; displayText: string }> | undefined;
    
    if (!next2WholeHourSlots || next2WholeHourSlots.length === 0) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.OTHER_DAYS'), buttonValue: 'choose_another_day' }];
    }
    
    const timeSlotButtons = next2WholeHourSlots.map((slot, index) => ({
      buttonText: slot.displayText,
      buttonValue: `slot_${index}_${slot.date}_${slot.time}`
    }));
    
    return [
      ...timeSlotButtons,
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.OTHER_DAYS'), buttonValue: 'choose_another_day' }
    ];
  }
}; 