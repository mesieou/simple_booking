import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { AvailabilityService, getUserLanguage, getLocalizedText } from './booking-utils';

export const showDayBrowserHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here are the available days:',
  
  validateUserInput: async (userInput, currentGoalData) => {
    console.log('[ShowDayBrowser] Validating input:', userInput);
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true };
    }
    
    if (!userInput || userInput === "") {
        console.log('[ShowDayBrowser] Empty input, accepting for first display');
        return { isValidInput: true };
    }

    if (userInput.startsWith('day_')) {
        console.log('[ShowDayBrowser] Day selection detected, rejecting to pass to next step');
        return { 
            isValidInput: false,
            validationErrorMessage: ''
        };
    }
    
    console.log('[ShowDayBrowser] Other input, rejecting');
    return { 
      isValidInput: false,
      validationErrorMessage: 'Please select one of the available days.' 
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    if (currentGoalData.quickBookingSelected || validatedInput !== "") {
        return currentGoalData;
    }

    console.log('[ShowDayBrowser] Starting processAndExtractData');
    console.log('[ShowDayBrowser] Current goal data keys:', Object.keys(currentGoalData));
    console.log('[ShowDayBrowser] Quick booking selected:', currentGoalData.quickBookingSelected);
    console.log('[ShowDayBrowser] Browse mode selected:', currentGoalData.browseModeSelected);
    
    if (currentGoalData.quickBookingSelected) {
      console.log('[ShowDayBrowser] Skipping - quick booking selected');
      return {
        ...currentGoalData,
        confirmationMessage: ''
      };
    }
    
    const businessWhatsappNumberCustomersMessagedTo = chatContext.currentParticipant.businessWhatsappNumber;
    const selectedServiceByCustomer = currentGoalData.selectedService;
    
    console.log('[ShowDayBrowser] Business WhatsApp number customers messaged TO:', businessWhatsappNumberCustomersMessagedTo);
    console.log('[ShowDayBrowser] Service selected by customer:', selectedServiceByCustomer);
    
    if (!businessWhatsappNumberCustomersMessagedTo || !selectedServiceByCustomer?.durationEstimate) {
      console.error('[ShowDayBrowser] Missing required data', {
        businessWhatsappNumberCustomersMessagedTo,
        selectedServiceByCustomer: selectedServiceByCustomer ? { name: selectedServiceByCustomer.name, duration: selectedServiceByCustomer.durationEstimate } : 'null'
      });
      return {
        ...currentGoalData,
        availabilityError: 'Configuration error',
        confirmationMessage: 'Sorry, there was a configuration error. Please try again or contact support.'
      };
    }
    
    const availableDaysForThisBusiness = [];
    const today = new Date();
    
    console.log('[ShowDayBrowser] Checking availability for next 10 days for this business...');
    
    for (let i = 0; i < 10; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      console.log(`[ShowDayBrowser] === DAY ${i} DEBUG ===`);
      console.log(`[ShowDayBrowser] Today reference: ${today.toISOString()}`);
      console.log(`[ShowDayBrowser] Adding ${i} days to today`);
      console.log(`[ShowDayBrowser] Calculated date object: ${date.toISOString()}`);
      console.log(`[ShowDayBrowser] Date string for availability check: ${dateString}`);
      console.log(`[ShowDayBrowser] Date.getDay() (0=Sun, 6=Sat): ${date.getDay()}`);
      console.log(`[ShowDayBrowser] Date breakdown - Year: ${date.getFullYear()}, Month: ${date.getMonth() + 1}, Day: ${date.getDate()}`);
      
      try {
        const businessHasAvailabilityOnThisDate = await AvailabilityService.validateCustomDateForBusinessWhatsapp(
          businessWhatsappNumberCustomersMessagedTo,
          dateString,
          selectedServiceByCustomer.durationEstimate,
          chatContext
        );
        
        let displayText = '';
        if (i === 0) {
          displayText = getLocalizedText(chatContext, 'TIME_LABELS.TODAY');
        } else if (i === 1) {
          displayText = getLocalizedText(chatContext, 'TIME_LABELS.TOMORROW');
        } else {
          const language = getUserLanguage(chatContext);
          const locale = language === 'es' ? 'es-ES' : 'en-GB';
          displayText = date.toLocaleDateString(locale, { 
            weekday: 'short', day: 'numeric', month: 'short'
          });
        }
        
        console.log(`[ShowDayBrowser] Business has availability on ${dateString}: ${businessHasAvailabilityOnThisDate}`);
        console.log(`[ShowDayBrowser] Calculated display text: ${displayText}`);
        
        if (businessHasAvailabilityOnThisDate) {
          console.log(`[ShowDayBrowser] === ADDING AVAILABLE DAY ===`);
          console.log(`[ShowDayBrowser] Date value (what goes in button): ${dateString}`);
          console.log(`[ShowDayBrowser] Display text (what user sees): ${displayText}`);
          console.log(`[ShowDayBrowser] Date object for display: ${date.toISOString()}`);
          console.log(`[ShowDayBrowser] toLocaleDateString result: ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`);
          console.log(`[ShowDayBrowser] Weekday: ${date.toLocaleDateString('en-GB', { weekday: 'short' })}`);
          console.log(`[ShowDayBrowser] Day of month: ${date.toLocaleDateString('en-GB', { day: 'numeric' })}`);
          console.log(`[ShowDayBrowser] Month: ${date.toLocaleDateString('en-GB', { month: 'short' })}`);
          console.log(`[ShowDayBrowser] === END AVAILABLE DAY ===`);
          
          availableDaysForThisBusiness.push({
            date: dateString,
            displayText: displayText
          });
        } else {
          console.log(`[ShowDayBrowser] No availability on ${dateString} (${displayText}), skipping`);
        }
      } catch (error) {
        console.error(`[ShowDayBrowser] Error checking business availability for ${dateString}:`, error);
      }
    }
    
    console.log('[ShowDayBrowser] Available days found for this business:', availableDaysForThisBusiness.length);
    
    if (availableDaysForThisBusiness.length === 0) {
      return {
        ...currentGoalData,
        availableDays: [],
        confirmationMessage: 'Sorry, no availability found in the next 10 days. Please contact us directly to check for other options.'
      };
    }
    
    return {
      ...currentGoalData,
      availableDays: availableDaysForThisBusiness,
      confirmationMessage: 'Available days:'
    };
  },
  
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.quickBookingSelected) {
      console.log('[ShowDayBrowser] No buttons - quick booking selected');
      return [];
    }
    
    const availableDays = currentGoalData.availableDays as Array<{ date: string; displayText: string }> | undefined;
    
    console.log('[ShowDayBrowser] Available days for buttons:', availableDays?.length || 0);
    
    if (!availableDays || availableDays.length === 0) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.NO_AVAILABILITY'), buttonValue: 'contact_support' }];
    }
    
    const buttons = availableDays.slice(0, 8).map(day => ({
      buttonText: day.displayText,
      buttonValue: `day_${day.date}`
    }));
    
    console.log('[ShowDayBrowser] Generated buttons:', buttons);
    
    return buttons;
  }
};
