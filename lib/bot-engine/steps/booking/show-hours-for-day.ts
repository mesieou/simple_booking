import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, AvailabilityService, ServiceDataProcessor } from './booking-utils';

export const showHoursForDayHandler: IndividualStepHandler = {
  autoAdvance: false,
  
  validateUserInput: async (userInput, currentGoalData) => {
    if (!userInput || userInput === "") {
      return { isValidInput: true };
    }
    
    if (currentGoalData.quickBookingSelected) {
      return { isValidInput: true };
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours || [];
    const isTimeSelection = formattedHours.some((hour: any) => hour.display === userInput);
    
    if (isTimeSelection || userInput === 'contact_support' || userInput === 'choose_different_date') {
      return { 
        isValidInput: false,
        validationErrorMessage: ''
      };
    }
    
    return { 
      isValidInput: false,
      validationErrorMessage: 'Please select a time from the available options.'
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[ShowHoursForDay] Processing input:', validatedInput);
    console.log('[ShowHoursForDay] Quick booking selected:', currentGoalData.quickBookingSelected);
    console.log('[ShowHoursForDay] Selected date:', currentGoalData.selectedDate);
    
    if (currentGoalData.quickBookingSelected) {
      return currentGoalData;
    }
    
    if (validatedInput && validatedInput !== "") {
      console.log('[ShowHoursForDay] Non-empty input detected, returning current data');
      return currentGoalData;
    }
    
    const businessWhatsappNumberCustomersMessagedTo = chatContext.currentParticipant.businessWhatsappNumber;
    const selectedServiceByCustomer = currentGoalData.selectedService;
    const dateSelectedByCustomer = currentGoalData.selectedDate;
    
    console.log('[ShowHoursForDay] Fetching hours for date:', dateSelectedByCustomer);
    
    // Calculate total duration from all selected services
    const totalServiceDuration = ServiceDataProcessor.calculateTotalServiceDuration(currentGoalData);
    
    console.log('[ShowHoursForDay] Total service duration for availability check:', totalServiceDuration, 'minutes');
    
    if (!businessWhatsappNumberCustomersMessagedTo || totalServiceDuration <= 0 || !dateSelectedByCustomer) {
      console.log('[ShowHoursForDay] Missing required data for hours lookup');
      const customerName = currentGoalData.customerName || '{name}';
      return {
        ...currentGoalData,
        availabilityError: 'Missing information for time lookup',
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.ERROR_LOADING_TIMES', { name: customerName })
      };
    }
    
    try {
      const availableHoursForBusinessOnSelectedDate = await AvailabilityService.getAvailableHoursForDateByBusinessWhatsapp(
        businessWhatsappNumberCustomersMessagedTo,
        dateSelectedByCustomer,
        totalServiceDuration,
        chatContext
      );
      
      console.log('[ShowHoursForDay] Found hours:', availableHoursForBusinessOnSelectedDate);
      
      if (availableHoursForBusinessOnSelectedDate.length === 0) {
        const customerName = currentGoalData.customerName || '{name}';
        return {
          ...currentGoalData,
          availabilityError: 'No appointments available on this date',
          confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.NO_APPOINTMENTS_DATE', { name: customerName })
        };
      }
      
      const roundedTimesOnly = availableHoursForBusinessOnSelectedDate.filter(time => {
        const [hours, minutes] = time.split(':');
        return minutes === '00';
      });
      
      console.log('[ShowHoursForDay] Filtered to whole hours:', roundedTimesOnly);
      
      const formattedHoursForDisplay = roundedTimesOnly.map(time => {
        const [hours, minutes] = time.split(':');
        const hour24 = parseInt(hours);
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
        const ampm = hour24 >= 12 ? 'PM' : 'AM';  
        return {
          time24: time,
          display: `${hour12} ${ampm}`
        };
      });
      
      console.log('[ShowHoursForDay] Formatted hours for display:', formattedHoursForDisplay);
      
      const customerName = currentGoalData.customerName || '{name}';
      return {
        ...currentGoalData,
        availableHours: availableHoursForBusinessOnSelectedDate,
        formattedAvailableHours: formattedHoursForDisplay,
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.SELECT_TIME', { name: customerName })
      };
    } catch (error) {
      console.error('[ShowHoursForDay] Error loading hours:', error);
      const customerName = currentGoalData.customerName || '{name}';
      return {
        ...currentGoalData,
        availabilityError: 'Error loading times',
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.ERROR_LOADING_TIMES', { name: customerName })
      };
    }
  },
  
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.quickBookingSelected) {
      return [];
    }
    
    const formattedHours = currentGoalData.formattedAvailableHours;
    const availabilityError = currentGoalData.availabilityError;
    
    if (availabilityError) {
      return [
        { buttonText: getLocalizedText(chatContext, 'BUTTONS.CONTACT_US'), buttonValue: 'contact_support' },
        { buttonText: getLocalizedText(chatContext, 'BUTTONS.OTHER_DAYS'), buttonValue: 'choose_different_date' }
      ];
    }
    
    if (!formattedHours || formattedHours.length === 0) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.OTHER_DAYS'), buttonValue: 'choose_different_date' }];
    }
    
    return formattedHours.slice(0, 10).map((hour: any) => ({
      buttonText: hour.display,
      buttonValue: hour.display
    }));
  }
};
