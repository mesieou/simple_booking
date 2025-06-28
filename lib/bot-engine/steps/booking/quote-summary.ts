import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText } from './booking-utils';
import { Service } from '@/lib/database/models/service';
import { Business } from '@/lib/database/models/business';
import { Quote, type QuoteData } from '@/lib/database/models/quote';
import { computeQuoteEstimation, type QuoteEstimation } from '@/lib/general-helpers/quote-cost-calculator';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';

// Step: Create quote and show comprehensive summary with all details
// Job: Calculate quote using proper helpers, persist to database, and display summary asking for confirmation
export const quoteSummaryHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Here\'s your booking summary:',
  
  // Accept empty input (first display) and detect service selections
  validateUserInput: async (userInput, currentGoalData) => {
    console.log('[QuoteSummary] Validating input:', userInput);
    
    // If this is empty input (first display), accept it
    if (!userInput || userInput === "") {
      console.log('[QuoteSummary] Empty input - accepting for first display');
      return { isValidInput: true };
    }
    
    // If this is a button click, reject it so it goes to handleQuoteChoice
    if (userInput === 'confirm_quote' || userInput === 'edit_quote') {
      console.log('[QuoteSummary] Button click detected - rejecting to pass to next step');
      return { 
        isValidInput: false,
        validationErrorMessage: '' // No error message, just advance to next step
      };
    }
    
    // Check if this looks like a service ID (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userInput)) {
      console.log('[QuoteSummary] Service ID detected - accepting to restart booking process');
      return { isValidInput: true };
    }
    
    // Other input types rejected with a more helpful message
    console.log('[QuoteSummary] Other input - rejecting');
    return { 
      isValidInput: false,
      validationErrorMessage: 'Please use the buttons below to confirm or edit your quote.' 
    };
  },
  
  // Calculate quote using proper helpers, persist to database, and generate comprehensive summary
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[QuoteSummary] Processing input:', validatedInput);
    
    // Check if user selected a different service (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(validatedInput)) {
      console.log('[QuoteSummary] User selected different service, restarting booking process');
      
      // Find the service they selected
      const availableServices = currentGoalData.availableServices;
      const { ServiceDataProcessor } = await import('./booking-utils');
      const selectedServiceData = ServiceDataProcessor.findServiceById(validatedInput, availableServices);
      
      if (selectedServiceData) {
        console.log('[QuoteSummary] Found new service:', selectedServiceData.name);
        
        // Reset the booking process with the new service
        return {
          availableServices: availableServices, // Keep the services list
          selectedService: ServiceDataProcessor.extractServiceDetails(selectedServiceData),
          // Clear all other booking data to restart the process
          selectedDate: undefined,
          selectedTime: undefined,
          quickBookingSelected: undefined,
          browseModeSelected: undefined,
          finalServiceAddress: undefined,
          serviceLocation: undefined,
          persistedQuote: undefined,
          quoteId: undefined,
          bookingSummary: undefined,
          // Set a flag to restart from the appropriate step
          restartBookingFlow: true,
          shouldAutoAdvance: true,
          confirmationMessage: `Great! Let's book a ${selectedServiceData.name} appointment.`
        };
      } else {
        console.log('[QuoteSummary] Service not found in available services');
        return {
          ...currentGoalData,
          confirmationMessage: 'Sorry, that service is not available. Please use the buttons below.'
        };
      }
    }
    
    // Only process empty input (first display) for normal quote generation
    if (validatedInput !== "") {
      console.log('[QuoteSummary] Non-empty input - not processing');
      return currentGoalData;
    }
    
    const selectedService = currentGoalData.selectedService;
    const selectedDate = currentGoalData.selectedDate;
    const selectedTime = currentGoalData.selectedTime;
    const finalServiceAddress = currentGoalData.finalServiceAddress;
    const serviceLocation = currentGoalData.serviceLocation;
    const userId = currentGoalData.userId;
    const businessId = chatContext.currentParticipant.associatedBusinessId;
    
    if (!selectedService || !selectedDate || !selectedTime || !finalServiceAddress || !userId || !businessId) {
      return {
        ...currentGoalData,
        summaryError: 'Missing booking information'
      };
    }

    try {
      // Step 1: Calculate quote using proper helpers
      const service = new Service({
        id: selectedService.id,
        name: selectedService.name,
        durationEstimate: selectedService.durationEstimate,
        fixedPrice: selectedService.fixedPrice,
        pricingType: selectedService.pricingType,
        mobile: selectedService.mobile,
        ratePerMinute: selectedService.ratePerMinute,
        baseCharge: selectedService.baseCharge,
        businessId: businessId
      });

      // For mobile services, we need travel time estimate
      let travelTimeEstimate = 0;
      if (serviceLocation === 'customer_address') {
        // TODO: Replace with actual travel time calculation from Google API
        travelTimeEstimate = 25; // Mock travel time in minutes
      }

      // Use the proper quote calculation
      const quoteEstimation: QuoteEstimation = computeQuoteEstimation(service, travelTimeEstimate);

      // Step 2: Get business address for quote persistence
      let businessAddress = 'Business Location'; // Fallback
      try {
        const business = await Business.getById(businessId);
        businessAddress = business.businessAddress || business.name || 'Business Location';
      } catch (error) {
        console.warn('[QuoteSummary] Could not fetch business address, using fallback');
      }

      // Determine pickup and dropoff based on service type
      let pickUp = '';
      let dropOff = '';
      
      if (serviceLocation === 'customer_address') {
        // For mobile services: business location -> customer location
        pickUp = businessAddress;
        dropOff = finalServiceAddress;
      } else {
        // For non-mobile services: customer location -> business location  
        pickUp = finalServiceAddress;
        dropOff = businessAddress;
      }

      // Step 3: Create and persist the quote
      const quoteData: QuoteData = {
        userId,
        pickUp,
        dropOff,
        businessId,
        serviceId: selectedService.id,
        travelTimeEstimate,
        totalJobDurationEstimation: quoteEstimation.totalJobDuration,
        travelCostEstimate: quoteEstimation.travelCost,
        totalJobCostEstimation: quoteEstimation.totalJobCost,
        status: 'pending',
      };

      const quote = new Quote(quoteData, selectedService.mobile); // Pass mobile flag for validation

      // Persist to database
      const savedQuoteData = await quote.add({ useServiceRole: true });
      console.log('[QuoteSummary] Quote successfully created with ID:', savedQuoteData.id);

      // Step 4: Generate display formatting
      // Calculate estimated completion time
      const duration = quoteEstimation.totalJobDuration;
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(hours, minutes, 0, 0);
      const endTime = new Date(startTime.getTime() + duration * 60000);
      const estimatedEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
      
      // Format date for display
      const dateObj = new Date(selectedDate);
      const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
      
      // Format time for display
      const [hour24] = selectedTime.split(':');
      const hour12 = parseInt(hour24) === 0 ? 12 : parseInt(hour24) > 12 ? parseInt(hour24) - 12 : parseInt(hour24);
      const ampm = parseInt(hour24) >= 12 ? 'PM' : 'AM';
      const formattedTime = `${hour12}:${selectedTime.split(':')[1]} ${ampm}`;
      
      // Calculate payment details using Quote model
      let depositAmount = savedQuoteData.depositAmount;
      let remainingBalance = savedQuoteData.remainingBalance;
      let requiresDeposit = false;
      
      if (!depositAmount || !remainingBalance) {
        try {
          const { Quote } = await import('@/lib/database/models/quote');
          if (!savedQuoteData.id) {
            throw new Error('No quote ID available');
          }
          const quote = await Quote.getById(savedQuoteData.id);
          const paymentDetails = await quote.calculatePaymentDetails();
          
          depositAmount = paymentDetails.depositAmount;
          remainingBalance = paymentDetails.remainingBalance;
          requiresDeposit = depositAmount !== undefined && depositAmount !== null && depositAmount > 0;
          
          console.log('[QuoteSummary] Calculated payment details:', { depositAmount, remainingBalance, requiresDeposit });
        } catch (error) {
          console.warn('[QuoteSummary] Could not calculate payment details from Quote model:', error);
          // Fallback to no deposit required
          requiresDeposit = false;
        }
      } else {
        requiresDeposit = depositAmount > 0;
      }
      
      // Create detailed summary message using localized text
      const { getUserLanguage, BOOKING_TRANSLATIONS } = await import('./booking-utils');
      
      // Debug the translation issue
      console.log('[QuoteSummary] DEBUG - chatContext:', chatContext ? 'exists' : 'undefined');
      console.log('[QuoteSummary] DEBUG - chatContext.participantPreferences:', chatContext?.participantPreferences);
      
      const detectedLanguage = getUserLanguage(chatContext);
      console.log('[QuoteSummary] DEBUG - detected language:', detectedLanguage);
      console.log('[QuoteSummary] DEBUG - BOOKING_TRANSLATIONS keys:', Object.keys(BOOKING_TRANSLATIONS));
      console.log('[QuoteSummary] DEBUG - BOOKING_TRANSLATIONS[detectedLanguage]:', BOOKING_TRANSLATIONS[detectedLanguage] ? 'exists' : 'undefined');
      
      const t = BOOKING_TRANSLATIONS[detectedLanguage];
      if (!t) {
        console.error('[QuoteSummary] ERROR - No translations found for language:', detectedLanguage);
        // Fallback to English translations to prevent crash
        const fallbackT = BOOKING_TRANSLATIONS['en'] || {};
        console.log('[QuoteSummary] Using English fallback translations');
        
        // Create simple summary message without full translations
        let summaryMessage = `📋 Booking Quote Summary\n\n` +
          `Service: ${selectedService.name}\n` +
          `Date: ${formattedDate}\n` +
          `Time: ${formattedTime}\n` +
          `Duration: ${duration} minutes\n` +
          `Estimated completion: ${estimatedEndTime}\n` +
          `Location: ${finalServiceAddress}\n\n` +
          `Pricing:\n` +
          `   Service: $${quoteEstimation.serviceCost.toFixed(2)}\n` +
          `${quoteEstimation.travelCost > 0 ? `   Travel: $${quoteEstimation.travelCost.toFixed(2)}\n` : ''}` +
          `   Total: $${quoteEstimation.totalJobCost.toFixed(2)}*\n\n`;
        
        // Add payment info if needed
        if (requiresDeposit && depositAmount) {
          const totalPayNow = depositAmount + 4;
          summaryMessage += `Payment:\n` +
            `   • Paid Now: $${totalPayNow.toFixed(2)}\n` +
            (remainingBalance !== undefined ? `   • Balance Due: $${remainingBalance.toFixed(2)}\n` : '') +
            `   • Total Service Cost: $${quoteEstimation.totalJobCost.toFixed(2)}\n\n`;
        }
        
        summaryMessage += `Quote ID: ${savedQuoteData.id}\n\n`;
        summaryMessage += requiresDeposit ? `Ready to secure your booking?` : `Would you like to confirm this quote?`;
        
        return {
          ...currentGoalData,
          persistedQuote: savedQuoteData,
          quoteId: savedQuoteData.id,
          quoteEstimation,
          travelTimeEstimate,
          requiresDeposit,
          depositAmount: requiresDeposit ? depositAmount : undefined,
          remainingBalance: remainingBalance,
          totalPaymentAmount: requiresDeposit && depositAmount ? depositAmount + 4 : undefined,
          bookingSummary: {
            serviceCost: quoteEstimation.serviceCost,
            travelCost: quoteEstimation.travelCost,
            totalCost: quoteEstimation.totalJobCost,
            requiresDeposit,
            depositAmount: requiresDeposit ? depositAmount : undefined,
            remainingBalance: remainingBalance,
            totalPaymentAmount: requiresDeposit && depositAmount ? depositAmount + 4 : undefined,
            duration,
            estimatedEndTime,
            formattedDate,
            formattedTime
          },
          shouldAutoAdvance: false,
          confirmationMessage: summaryMessage
        };
      }
      
      let summaryMessage = `${t.QUOTE_SUMMARY.TITLE}\n\n` +
        `${t.QUOTE_SUMMARY.SERVICE} ${selectedService.name}\n` +
        `${t.QUOTE_SUMMARY.DATE} ${formattedDate}\n` +
        `${t.QUOTE_SUMMARY.TIME} ${formattedTime}\n` +
        `${t.QUOTE_SUMMARY.DURATION} ${duration} ${t.QUOTE_SUMMARY.MINUTES}\n` +
        `${t.QUOTE_SUMMARY.ESTIMATED_COMPLETION} ${estimatedEndTime}\n` +
        `${t.QUOTE_SUMMARY.LOCATION} ${finalServiceAddress}\n\n` +
        `${t.QUOTE_SUMMARY.PRICING}\n` +
        `   ${t.QUOTE_SUMMARY.SERVICE_COST} $${quoteEstimation.serviceCost.toFixed(2)}\n` +
        `${quoteEstimation.travelCost > 0 ? `   ${t.QUOTE_SUMMARY.TRAVEL_COST} $${quoteEstimation.travelCost.toFixed(2)}\n` : ''}` +
        `   ${t.QUOTE_SUMMARY.TOTAL_COST} $${quoteEstimation.totalJobCost.toFixed(2)}*\n\n`;
      
      // Only show deposit/payment info if business requires deposits
      if (requiresDeposit && depositAmount) {
        const totalPayNow = depositAmount + 4;
        
        // Get business preferred payment method for balance due
        const businessId = chatContext.currentParticipant.associatedBusinessId;
        let preferredPaymentMethod = getUserLanguage(chatContext) === 'es' ? 'efectivo/tarjeta' : 'cash/card';
        
        if (businessId) {
          try {
            const business = await Business.getById(businessId);
            if (business.preferredPaymentMethod) {
              preferredPaymentMethod = business.preferredPaymentMethod;
            }
          } catch (error) {
            console.warn('[QuoteSummary] Could not fetch business payment method');
          }
        }
        
        summaryMessage += `💳 *Booking Payment:*
` +
          `   • Paid Now: $${totalPayNow.toFixed(2)}
` +
          (remainingBalance !== undefined ? `   • Balance Due: $${remainingBalance.toFixed(2)} (${preferredPaymentMethod})
` : '') +
          `   • Total Service Cost: $${quoteEstimation.totalJobCost.toFixed(2)}

`;
      }
      
      summaryMessage += `${t.QUOTE_SUMMARY.QUOTE_ID} ${savedQuoteData.id}\n\n`;
      
      if (requiresDeposit) {
        summaryMessage += `Ready to secure your booking?`;
      } else {
        summaryMessage += `${t.QUOTE_SUMMARY.CONFIRM_QUESTION}`;
      }
      
      return {
        ...currentGoalData,
        persistedQuote: savedQuoteData,
        quoteId: savedQuoteData.id,
        quoteEstimation,
        travelTimeEstimate,
        requiresDeposit,
        depositAmount: requiresDeposit ? depositAmount : undefined,
        remainingBalance: remainingBalance,
        totalPaymentAmount: requiresDeposit && depositAmount ? depositAmount + 4 : undefined,
        bookingSummary: {
          serviceCost: quoteEstimation.serviceCost,
          travelCost: quoteEstimation.travelCost,
          totalCost: quoteEstimation.totalJobCost,
          requiresDeposit,
          depositAmount: requiresDeposit ? depositAmount : undefined,
          remainingBalance: remainingBalance,
          totalPaymentAmount: requiresDeposit && depositAmount ? depositAmount + 4 : undefined,
          duration,
          estimatedEndTime,
          formattedDate,
          formattedTime
        },
        shouldAutoAdvance: false, // Don't auto-advance, show buttons for user choice
        confirmationMessage: summaryMessage
      };

    } catch (error) {
      console.error('[QuoteSummary] Error creating quote:', error);
      
      return {
        ...currentGoalData,
        summaryError: 'Failed to create quote and summary. Please try again.',
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.ISSUE_PREPARING_QUOTE')
      };
    }
  },
  
  // Show payment or confirmation buttons based on deposit requirements
  fixedUiButtons: async (currentGoalData, chatContext) => {
    const summaryError = currentGoalData.summaryError;
    
    if (summaryError) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.TRY_AGAIN'), buttonValue: 'restart_booking' }];
    }
    
    const requiresDeposit = currentGoalData.requiresDeposit || currentGoalData.bookingSummary?.requiresDeposit;
    
    if (requiresDeposit) {
      const depositAmount = currentGoalData.depositAmount || currentGoalData.bookingSummary?.depositAmount;
      const totalPaymentAmount = currentGoalData.totalPaymentAmount || currentGoalData.bookingSummary?.totalPaymentAmount;
      
      if (totalPaymentAmount) {
        const { getUserLanguage } = await import('./booking-utils');
        const language = getUserLanguage(chatContext);
        
        // Keep payment button under 20 characters
        const paymentAmount = totalPaymentAmount.toFixed(2);
        const payDepositText = language === 'es' 
          ? `💳 $${paymentAmount}`  // "💳 $XX.XX" format
          : `💳 Pay $${paymentAmount}`;  // "💳 Pay $XX.XX" format
        
        return [
          { buttonText: payDepositText, buttonValue: 'confirm_quote' },
          { buttonText: getLocalizedText(chatContext, 'BUTTONS.EDIT'), buttonValue: 'edit_quote' }
        ];
      }
    }
    
    // No deposit required - show regular confirm button
    return [
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.CONFIRM'), buttonValue: 'confirm_quote' },
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.EDIT'), buttonValue: 'edit_quote' }
    ];
  }
};
