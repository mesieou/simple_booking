/**
 * Booking Step Utilities
 * 
 * Centralized utilities for booking step handlers to eliminate code duplication
 * and provide consistent behavior across all booking steps.
 */

import { ButtonConfig } from "@/lib/conversation-engine/juan-bot-engine-v2/bot-manager";

// =====================================
// DATA CHECKING UTILITIES
// =====================================

export class BookingDataChecker {
  /**
   * Check if essential booking data exists
   */
  static hasTimeData(goalData: Record<string, any>): boolean {
    return !!(goalData.selectedDate && goalData.selectedTime);
  }

  static hasServiceData(goalData: Record<string, any>): boolean {
    return !!(goalData.selectedService);
  }

  static hasQuickBookingSelection(goalData: Record<string, any>): boolean {
    return !!goalData.quickBookingSelected;
  }

  static hasBrowseSelection(goalData: Record<string, any>): boolean {
    return !!goalData.browseModeSelected;
  }

  static hasExistingUser(goalData: Record<string, any>): boolean {
    return !!goalData.existingUserFound;
  }

  /**
   * Check if a step should be skipped based on goal data (enhanced version)
   * Extends the original shouldSkipStep with additional utility-specific logic
   */
  static shouldSkipStep(stepName: string, goalData: Record<string, any>): boolean {
    // Original skip logic (matches bot-manager.ts exactly)
    const skippableStepsForQuickBooking = [
      'showDayBrowser',
      'selectSpecificDay', 
      'showHoursForDay',
      'selectSpecificTime',
    ];

    const skippableStepsForExistingUser = [
      'handleUserStatus',
      'askUserName',
      'createNewUser',
    ];

    if (!!goalData.quickBookingSelected && skippableStepsForQuickBooking.includes(stepName)) {
      return true;
    }
    if (!!goalData.existingUserFound && skippableStepsForExistingUser.includes(stepName)) {
      return true;
    }

    // Enhanced utility-specific logic: Skip availability display if we already have time data
    if (stepName === 'showAvailableTimes' && this.hasTimeData(goalData)) {
      return true;
    }

    return false;
  }
}

// =====================================
// DATE/TIME FORMATTING UTILITIES
// =====================================

export class DateTimeFormatter {
  /**
   * Convert a date string to display text (Today, Tomorrow, or formatted date)
   */
  static formatDateDisplay(dateString: string, format: 'short' | 'long' = 'short'): string {
    const selectedDate = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (selectedDate.toDateString() === today.toDateString()) {
      return 'Today';
    }
    
    if (selectedDate.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }

    if (format === 'long') {
      return selectedDate.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });
    }

    return selectedDate.toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  }

  /**
   * Convert 24-hour time to 12-hour display format
   */
  static formatTimeDisplay(timeString: string): string {
    const [hours] = timeString.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12} ${ampm}`;
  }

  /**
   * Combine date and time into a user-friendly display
   */
  static formatDateTimeDisplay(dateString: string, timeString: string, format: 'short' | 'long' = 'short'): string {
    const dateDisplay = this.formatDateDisplay(dateString, format);
    const timeDisplay = this.formatTimeDisplay(timeString);
    return `${dateDisplay} at ${timeDisplay}`;
  }
}

// =====================================
// DATA MANAGEMENT UTILITIES
// =====================================

export class BookingDataManager {
  /**
   * Clear time-related data when user wants to change timing
   */
  static clearTimeData(goalData: Record<string, any>): Record<string, any> {
    return {
      ...goalData,
      selectedDate: undefined,
      selectedTime: undefined,
      quickBookingSelected: undefined,
      browseModeSelected: undefined,
      next2WholeHourSlots: undefined,
      availableHours: undefined,
      formattedAvailableHours: undefined,
      availableDays: undefined,
      // Clear quote data since timing affects pricing
      persistedQuote: undefined,
      quoteId: undefined,
      bookingSummary: undefined
    };
  }

  /**
   * Clear service-related data when user wants to change service
   */
  static clearServiceData(goalData: Record<string, any>): Record<string, any> {
    return {
      ...goalData,
      selectedService: undefined,
      finalServiceAddress: undefined,
      serviceLocation: undefined,
      // Clear quote data since service affects pricing
      persistedQuote: undefined,
      quoteId: undefined,
      bookingSummary: undefined
    };
  }

  /**
   * Set quick booking data
   */
  static setQuickBooking(goalData: Record<string, any>, date: string, time: string): Record<string, any> {
    return {
      ...goalData,
      selectedDate: date,
      selectedTime: time,
      quickBookingSelected: true,
      confirmationMessage: 'Great! Your time slot has been selected.'
    };
  }

  /**
   * Set browse mode
   */
  static setBrowseMode(goalData: Record<string, any>): Record<string, any> {
    return {
      ...this.clearTimeData(goalData),
      browseModeSelected: true,
      confirmationMessage: 'Let me show you all available days...'
    };
  }
}

// =====================================
// BUTTON GENERATION UTILITIES
// =====================================

export class BookingButtonGenerator {
  /**
   * Generate time selection buttons when user has existing time data
   */
  static createExistingTimeButtons(goalData: Record<string, any>): ButtonConfig[] {
    if (!BookingDataChecker.hasTimeData(goalData)) {
      return [];
    }

    const dateText = DateTimeFormatter.formatDateDisplay(goalData.selectedDate);
    const timeText = DateTimeFormatter.formatTimeDisplay(goalData.selectedTime);

    const buttons = [
      { 
        buttonText: `✅ Keep ${dateText} ${timeText}`, 
        buttonValue: 'keep_existing_time' 
      },
      { 
        buttonText: '📅 Other days', 
        buttonValue: 'choose_another_day' 
      }
    ];

    return buttons;
  }

  /**
   * Generate time slot buttons from availability data
   */
  static createTimeSlotButtons(
    slots: Array<{ date: string; time: string; displayText: string }>
  ): ButtonConfig[] {
    return slots.map((slot, index) => {
      const timeText = DateTimeFormatter.formatTimeDisplay(slot.time);
      const dateText = slot.displayText.split(' ')[0]; // "Tomorrow", "Today", etc.
      
      return {
        buttonText: `${dateText} ${timeText}`,
        buttonValue: `slot_${index}_${slot.date}_${slot.time}`
      };
    });
  }

  /**
   * Generate error/fallback buttons
   */
  static createErrorButtons(errorType: string): ButtonConfig[] {
    switch (errorType) {
      case 'no_availability':
        return [
          { buttonText: '📞 Contact us directly', buttonValue: 'contact_support' },
          { buttonText: '📅 Try other days', buttonValue: 'choose_another_day' }
        ];
      case 'config_error':
        return [
          { buttonText: '🔄 Try again', buttonValue: 'retry' },
          { buttonText: '📞 Contact support', buttonValue: 'contact_support' }
        ];
      default:
        return [
          { buttonText: '📞 Contact us', buttonValue: 'contact_support' }
        ];
    }
  }
}

// =====================================
// STEP PROCESSING UTILITIES
// =====================================

export class StepProcessorBase {
  /**
   * Generic step processor that handles common patterns
   */
  static async processWithSkipLogic<T>(
    stepName: string,
    validatedInput: string,
    goalData: Record<string, any>,
    chatContext: any,
    processor: (input: string, data: Record<string, any>, context: any) => Promise<T>
  ): Promise<Record<string, any>> {
    
    // Check if step should be skipped
    if (BookingDataChecker.shouldSkipStep(stepName, goalData)) {
      return {
        ...goalData,
        confirmationMessage: '' // Skip silently
      };
    }

    // Process non-empty input with the provided processor
    if (validatedInput !== "") {
      return goalData; // Let the specific handler deal with input
    }

    // Execute the custom processing logic for first display
    const result = await processor(validatedInput, goalData, chatContext);
    
    if (!result) {
      return goalData;
    }
    
    if (typeof result === 'object' && 'extractedInformation' in result && 
        typeof result.extractedInformation === 'object' && result.extractedInformation !== null) {
      return { ...goalData, ...result.extractedInformation };
    }
    
    if (typeof result === 'object') {
      return result as Record<string, any>;
    }
    
    return goalData;
  }

  /**
   * Generic validation that handles common skip scenarios
   */
  static validateWithSkipLogic(
    stepName: string,
    userInput: string,
    goalData: Record<string, any>,
    customValidator?: (input: string, data: Record<string, any>) => { isValidInput: boolean; validationErrorMessage?: string }
  ): { isValidInput: boolean; validationErrorMessage?: string } {
    
    // Always accept empty input for first display
    if (!userInput || userInput === "") {
      return { isValidInput: true };
    }

    // Check if this step should be skipped entirely
    if (BookingDataChecker.shouldSkipStep(stepName, goalData)) {
      return { isValidInput: true };
    }

    // Use custom validator if provided
    if (customValidator) {
      return customValidator(userInput, goalData);
    }

    // Default: reject input to let next step handle it
    return { 
      isValidInput: false, 
      validationErrorMessage: '' 
    };
  }
}

// =====================================
// MESSAGE UTILITIES
// =====================================

export class BookingMessageGenerator {
  /**
   * Generate contextual messages based on booking state
   */
  static generateTimeSelectionMessage(goalData: Record<string, any>): string {
    if (BookingDataChecker.hasTimeData(goalData)) {
      const dateTimeText = DateTimeFormatter.formatDateTimeDisplay(
        goalData.selectedDate, 
        goalData.selectedTime, 
        'long'
      );
      return `You currently have ${dateTimeText} selected. Would you like to keep this time or choose a different one?`;
    }

    return 'Here are the next available appointment times:';
  }

  static generateServiceChangeMessage(serviceName: string): string {
    return `Great! You've selected ${serviceName}. Let's continue with your booking.`;
  }

  static generateErrorMessage(errorType: string): string {
    switch (errorType) {
      case 'no_availability':
        return 'Sorry, no appointments are currently available. Please contact us directly or try different dates.';
      case 'config_error':
        return 'There was a configuration error. Please try again or contact support.';
      case 'missing_data':
        return 'Some required information is missing. Let\'s start over.';
      default:
        return 'Something went wrong. Please try again or contact support.';
    }
  }
} 