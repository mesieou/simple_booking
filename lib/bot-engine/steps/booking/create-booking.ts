import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { Booking, type BookingData, BookingStatus } from '@/lib/database/models/booking';
import { getLocalizedText } from './booking-utils';
import { Quote } from '@/lib/database/models/quote';
import { Service } from '@/lib/database/models/service';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { DateTime } from 'luxon';

// Step: Creates the actual booking - single responsibility
export const createBookingHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Creating your booking...',
  // No autoAdvance - this is the final step that shows full confirmation
  
  // Accept empty input (auto-advanced) or payment confirmation message
  validateUserInput: async (userInput) => {
    if (!userInput || userInput === "" || userInput.startsWith('PAYMENT_COMPLETED_')) {
      return { isValidInput: true };
    }
    return { isValidInput: false, validationErrorMessage: '' };
  },
  
  // Create booking from quote data and complete the goal
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[CreateBooking] Starting booking creation...');
    let quoteId = '';
    let isPaymentCompletion = false;

    if (validatedInput && validatedInput.startsWith('PAYMENT_COMPLETED_')) {
        isPaymentCompletion = true;
        quoteId = validatedInput.replace('PAYMENT_COMPLETED_', '');
        console.log(`[CreateBooking] Creating booking from payment completion for quote ID: ${quoteId}`);
    } else {
        quoteId = currentGoalData.quoteId as string;
        console.log(`[CreateBooking] Creating booking from standard flow for quote ID: ${quoteId}`);
    }
    
    if (!quoteId) {
      console.error('[CreateBooking] No Quote ID found.');
      return {
        ...currentGoalData,
        bookingError: 'Missing quote information to create booking.'
      };
    }

    try {
      // Regardless of the path, we fetch the definitive quote from the DB
      const quote = await Quote.getById(quoteId);
      if (!quote) {
        console.error(`[CreateBooking] Quote with ID ${quoteId} not found.`);
        return {
          ...currentGoalData,
          bookingError: `Booking data not found (quote ${quoteId}).`
        };
      }
      
      const { 
        userId, 
        businessId, 
        serviceId, 
        pickUp, 
        dropOff, 
        totalJobCostEstimation,
        travelCostEstimate,
        totalJobDurationEstimation 
      } = quote;

      if (!userId || !businessId || !serviceId) {
        console.error('[CreateBooking] Quote is missing essential data:', { userId, businessId, serviceId });
        return {
          ...currentGoalData,
          bookingError: 'Quote data is incomplete.'
        };
      }

      // Get the provider ID (business owner)
      const businessWhatsappNumber = chatContext.currentParticipant.businessWhatsappNumber as string;
      const { AvailabilityService } = await import('./booking-utils');
      const providerId = await AvailabilityService.findUserIdByBusinessWhatsappNumber(businessWhatsappNumber, chatContext);

      if (!providerId) {
        console.error('[CreateBooking] Cannot find provider for booking.');
        return {
          ...currentGoalData,
          bookingError: 'Unable to find business provider for booking creation.'
        };
      }

      // Get provider's timezone
      const calendarSettings = await CalendarSettings.getByUserAndBusiness(providerId, businessId);
      const providerTimezone = calendarSettings?.settings?.timezone || 'UTC';

      // Create booking dateTime from selectedDate and selectedTime in goal data or fallback to quote
      let selectedDate = currentGoalData.selectedDate as string;
      let selectedTime = currentGoalData.selectedTime as string;
      let bookingDTObject: DateTime;
      
      if (!selectedDate || !selectedTime) {
        console.warn('[CreateBooking] Missing booking date/time in session data, falling back to quote proposedDateTime');
        
        // Fallback to quote's proposedDateTime
        if (quote.proposedDateTime) {
          bookingDTObject = DateTime.fromISO(quote.proposedDateTime, { zone: providerTimezone });
          console.log(`[CreateBooking] Using quote proposedDateTime: ${quote.proposedDateTime}`);
        } else {
          console.error('[CreateBooking] No booking date/time available in session data or quote');
          return {
            ...currentGoalData,
            bookingError: 'Missing booking date or time information.'
          };
        }
      } else {
        // Create booking dateTime object from session data in the correct timezone
        // Ensure date is in YYYY-MM-DD format and time is in HH:mm format
        let cleanSelectedDate = selectedDate;
        let cleanSelectedTime = selectedTime;
        
        // Fix malformed date (if it contains timestamp info, extract just the date)
        if (selectedDate.includes('T')) {
          cleanSelectedDate = selectedDate.split('T')[0];
          console.log(`[CreateBooking] Fixed malformed selectedDate from "${selectedDate}" to "${cleanSelectedDate}"`);
        }
        
        // Fix malformed time (if it starts with T, remove it)
        if (selectedTime.startsWith('T')) {
          cleanSelectedTime = selectedTime.substring(1);
          console.log(`[CreateBooking] Fixed malformed selectedTime from "${selectedTime}" to "${cleanSelectedTime}"`);
        }
        
        const bookingDateTimeString = `${cleanSelectedDate}T${cleanSelectedTime}`;
        bookingDTObject = DateTime.fromISO(bookingDateTimeString, { zone: providerTimezone });
        console.log(`[CreateBooking] Using session dateTime: ${bookingDateTimeString}`);
        
        // Validate the resulting DateTime object
        if (!bookingDTObject.isValid) {
          console.error(`[CreateBooking] Invalid dateTime created from session data: ${bookingDateTimeString}`);
          console.error(`[CreateBooking] DateTime parse error: ${bookingDTObject.invalidReason}`);
          return {
            ...currentGoalData,
            bookingError: 'Invalid booking date or time format. Please try booking again.'
          };
        }
      }
      
      const bookingData = {
        quoteId,
        userId,
        businessId,
        providerId,
        dateTime: bookingDTObject.toISO() as string,
        status: 'confirmed' as BookingStatus
      };
      
      const newBooking = new Booking(bookingData);
      const savedBooking = await newBooking.add() as BookingData & { id: string };
      console.log('[CreateBooking] Booking successfully created:', savedBooking.id);

      // We need service and other details for the confirmation message
      const service = await Service.getById(serviceId);
      if (!service) {
         console.error(`[CreateBooking] Could not find service with ID ${serviceId}`);
         return {
            ...currentGoalData,
            bookingError: 'Could not retrieve service details for confirmation.'
         }
      }

      // Prepare details for final confirmation message
      const bookingConfirmationDetails = {
          bookingId: savedBooking.id,
          serviceName: service.name,
          formattedDate: bookingDTObject.toLocaleString(DateTime.DATE_FULL),
          formattedTime: bookingDTObject.toLocaleString(DateTime.TIME_SIMPLE),
          location: service.mobile ? dropOff : pickUp,
          totalCost: totalJobCostEstimation,
          serviceCost: totalJobCostEstimation - (travelCostEstimate || 0),
          travelCost: travelCostEstimate || 0,
      };
      
      // Generate the full booking confirmation message
      const { getUserLanguage, BOOKING_TRANSLATIONS } = await import('./booking-utils');
      const t = BOOKING_TRANSLATIONS[getUserLanguage(chatContext)];
      
      // Include payment completion message if this was from payment
      const paymentMessage = isPaymentCompletion 
        ? (getUserLanguage(chatContext) === 'es' 
            ? '💳 ¡Gracias por tu pago!\n\n' 
            : '💳 Thank you for your payment!\n\n')
        : '';
      
      const confirmationMessage = `${paymentMessage}${t.BOOKING_CONFIRMATION.TITLE}\n\n` +
          `${t.BOOKING_CONFIRMATION.SERVICE} ${bookingConfirmationDetails.serviceName}\n` +
          `${t.BOOKING_CONFIRMATION.DATE} ${bookingConfirmationDetails.formattedDate}\n` +
          `${t.BOOKING_CONFIRMATION.TIME} ${bookingConfirmationDetails.formattedTime}\n` +
          `${t.BOOKING_CONFIRMATION.LOCATION} ${bookingConfirmationDetails.location}\n\n` +
          `${t.BOOKING_CONFIRMATION.PRICING}\n` +
          `   ${t.BOOKING_CONFIRMATION.SERVICE_COST} $${bookingConfirmationDetails.serviceCost.toFixed(2)}\n` +
          `${bookingConfirmationDetails.travelCost > 0 ? `   ${t.BOOKING_CONFIRMATION.TRAVEL_COST} $${bookingConfirmationDetails.travelCost.toFixed(2)}\n` : ''}` +
          `   ${t.BOOKING_CONFIRMATION.TOTAL_COST} $${bookingConfirmationDetails.totalCost.toFixed(2)}\n\n` +
          `${t.BOOKING_CONFIRMATION.BOOKING_ID} ${bookingConfirmationDetails.bookingId}\n\n` +
          `${t.BOOKING_CONFIRMATION.LOOKING_FORWARD}`;
      
      console.log(`[CreateBooking] Generated full confirmation for booking ${bookingConfirmationDetails.bookingId}. Goal completed.`);
      
      return {
        ...currentGoalData,
        goalStatus: 'completed', // Complete the goal since this is the final step
        persistedBooking: savedBooking,
        bookingConfirmationDetails: bookingConfirmationDetails,
        paymentCompleted: isPaymentCompletion,
        confirmationMessage
      };

    } catch (error) {
      console.error('[CreateBooking] Error during booking creation process:', error);
      return {
        ...currentGoalData,
        bookingError: 'Failed to save booking. Please try again.',
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.BOOKING_PROBLEM')
      };
    }
  }
};
