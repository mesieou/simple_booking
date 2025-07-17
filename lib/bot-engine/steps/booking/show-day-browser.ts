import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { AvailabilityService, getUserLanguage, getLocalizedText, ServiceDataProcessor } from './booking-utils';

export const showDayBrowserHandler: IndividualStepHandler = {
  
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
    console.log('[ShowDayBrowser] Starting processAndExtractData');
    console.log('[ShowDayBrowser] Current goal data keys:', Object.keys(currentGoalData));
    
    const quickBookingSelected = currentGoalData.quickBookingSelected;
    const browseModeSelected = currentGoalData.browseModeSelected;
    
    console.log('[ShowDayBrowser] Quick booking selected:', quickBookingSelected);
    console.log('[ShowDayBrowser] Browse mode selected:', browseModeSelected);
    
    // Skip processing if we're in quick booking mode
    if (quickBookingSelected) {
      console.log('[ShowDayBrowser] Skipping day browser due to quick booking selection');
      return currentGoalData;
    }
    
    // Should only process if we're in browse mode
    if (!browseModeSelected) {
      console.log('[ShowDayBrowser] Not in browse mode, returning current data');
      return currentGoalData;
    }
    
    // Only process empty input (first display)
    if (validatedInput !== "") {
      console.log('[ShowDayBrowser] Non-empty input - not processing');
      return currentGoalData;
    }
    
    const businessWhatsappNumberCustomersMessagedTo = chatContext.currentParticipant.businessWhatsappNumber;
    const selectedServiceByCustomer = currentGoalData.selectedService;
    
    console.log('[ShowDayBrowser] Business WhatsApp number customers messaged TO:', businessWhatsappNumberCustomersMessagedTo);
    console.log('[ShowDayBrowser] Service selected by customer:', selectedServiceByCustomer);
    console.log('[ShowDayBrowser] Checking availability for next 10 days for this business...');
    
    // Calculate total duration from all selected services
    const totalServiceDuration = ServiceDataProcessor.calculateTotalServiceDuration(currentGoalData);
    
    console.log('[ShowDayBrowser] Total service duration for availability check:', totalServiceDuration, 'minutes');
    
    // Validate required data before proceeding
    if (!businessWhatsappNumberCustomersMessagedTo || totalServiceDuration <= 0) {
      console.error('[ShowDayBrowser] Missing required data', {
        businessWhatsappNumber: businessWhatsappNumberCustomersMessagedTo,
        totalServiceDuration
      });
      return {
        ...currentGoalData,
        availableDays: [],
        confirmationMessage: 'Sorry, there was a configuration error. Please try again or contact support.'
      };
    }
    
    // Get business timezone (same pattern as other availability services)
    const userIdOfBusinessOwner = await AvailabilityService.findUserIdByBusinessWhatsappNumber(businessWhatsappNumberCustomersMessagedTo, chatContext);
    const businessId = chatContext.currentParticipant.associatedBusinessId;
    
    let providerTimezone = 'UTC';
    if (userIdOfBusinessOwner && businessId) {
      try {
        const { CalendarSettings } = await import('@/lib/database/models/calendar-settings');
        const calendarSettings = await CalendarSettings.getByUserAndBusiness(userIdOfBusinessOwner, businessId);
        providerTimezone = calendarSettings?.settings?.timezone || 'UTC';
        console.log('[ShowDayBrowser] Using business timezone:', providerTimezone);
      } catch (error) {
        console.warn('[ShowDayBrowser] Could not get business timezone, using UTC:', error);
      }
    }
    
    const availableDaysForThisBusiness = [];
    
    // Check next 10 days for any availability using business timezone
    const { DateTime } = await import('luxon');
    const nowInBusinessTz = DateTime.now().setZone(providerTimezone);
    
    for (let i = 0; i < 10; i++) {
      // Calculate date in business timezone
      const targetDate = nowInBusinessTz.plus({ days: i }).startOf('day');
      const dateString = targetDate.toISODate(); // YYYY-MM-DD format in business timezone
      
      // Skip if dateString is null (invalid date)
      if (!dateString) {
        console.error(`[ShowDayBrowser] Invalid date calculated for day ${i}, skipping`);
        continue;
      }
      
      console.log(`[ShowDayBrowser] === DAY ${i} DEBUG ===`);
      console.log(`[ShowDayBrowser] Business timezone: ${providerTimezone}`);
      console.log(`[ShowDayBrowser] Current time in business timezone: ${nowInBusinessTz.toISO()}`);
      console.log(`[ShowDayBrowser] Adding ${i} days to today in business timezone`);
      console.log(`[ShowDayBrowser] Calculated date in business timezone: ${targetDate.toISO()}`);
      console.log(`[ShowDayBrowser] Date string for availability check: ${dateString}`);
      console.log(`[ShowDayBrowser] Date.weekday (1=Mon, 7=Sun): ${targetDate.weekday}`);
      console.log(`[ShowDayBrowser] Date breakdown - Year: ${targetDate.year}, Month: ${targetDate.month}, Day: ${targetDate.day}`);
      
      try {
        const businessHasAvailabilityOnThisDate = await AvailabilityService.validateCustomDateForBusinessWhatsapp(
          businessWhatsappNumberCustomersMessagedTo,
          dateString,
          totalServiceDuration,
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
          // Convert to JavaScript Date for display formatting (keeps timezone info)
          const jsDate = targetDate.toJSDate();
          displayText = jsDate.toLocaleDateString(locale, { 
            weekday: 'short', day: 'numeric', month: 'short',
            timeZone: providerTimezone // Ensure display uses business timezone
          });
        }
        
        console.log(`[ShowDayBrowser] Business has availability on ${dateString}: ${businessHasAvailabilityOnThisDate}`);
        console.log(`[ShowDayBrowser] Calculated display text: ${displayText}`);
        
        if (businessHasAvailabilityOnThisDate) {
          console.log(`[ShowDayBrowser] === ADDING AVAILABLE DAY ===`);
          console.log(`[ShowDayBrowser] Date value (what goes in button): ${dateString}`);
          console.log(`[ShowDayBrowser] Display text (what user sees): ${displayText}`);
          console.log(`[ShowDayBrowser] Date object in business timezone: ${targetDate.toISO()}`);
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
