import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { Booking, type BookingData, BookingStatus } from '@/lib/database/models/booking';
import { getLocalizedText, getLocalizedTextWithVars } from './booking-utils';
import { Quote } from '@/lib/database/models/quote';
import { Service } from '@/lib/database/models/service';
import { Business } from '@/lib/database/models/business';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { DateTime } from 'luxon';

// Simple phone number formatting utility
const formatPhoneForDisplay = (normalizedPhone: string): string => {
  if (!normalizedPhone) return '';
  
  // Add + prefix
  const withPlus = `+${normalizedPhone}`;
  
  // Format based on length (basic formatting)
  if (normalizedPhone.length >= 10) {
    // International format: +XX XXX XXX XXX
    return withPlus.replace(/(\+\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
  }
  
  return withPlus;
};

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
      
      // Extract booking details from quote
      const userId = quote.userId;
      const businessId = quote.businessId;
      const serviceId = quote.getPrimaryServiceId();
      const pickUp = quote.pickUp;
      const dropOff = quote.dropOff;
      const totalJobCostEstimation = quote.totalJobCostEstimation;
      const travelCostEstimate = quote.travelCostEstimate;

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

      // Get service details for confirmation message
      const service = await Service.getById(serviceId);
      if (!service) {
         console.error(`[CreateBooking] Could not find service with ID ${serviceId}`);
         return {
            ...currentGoalData,
            bookingError: 'Could not retrieve service details for confirmation.'
         }
      }

      // Get all selected services if available (for multi-service support)
      const selectedServices = currentGoalData.selectedServices || [currentGoalData.selectedService].filter(Boolean);
      const serviceDetails = currentGoalData.serviceDetails || [];
      
      // Format services for display
      const formatServicesForConfirmation = (services: any[], details: any[]) => {
        if (services.length === 1) {
          return services[0]?.name || service.name;
        }
        
        // Use serviceDetails if available, otherwise fallback to service names
        if (details && details.length > 0) {
          return details.map((detail: any, index: number) => 
            `${index + 1}. ${detail.name} - $${detail.cost.toFixed(2)}`
          ).join('\n   ');
        }
        
        return services.map((service: any, index: number) => 
          `${index + 1}. ${service?.name || 'Service'}`
        ).join('\n   ');
      };

      // Prepare details for final confirmation message
      const bookingConfirmationDetails = {
          bookingId: savedBooking.id,
          serviceName: service.name, // Kept for backward compatibility
          servicesDisplay: formatServicesForConfirmation(selectedServices, serviceDetails),
          isMultiService: selectedServices.length > 1,
          serviceCount: selectedServices.length,
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
      
      // Get provider contact information and business payment preferences
      let providerContactInfo = '';
      let preferredPaymentMethod = getUserLanguage(chatContext) === 'es' ? 'efectivo/tarjeta' : 'cash/card';
      
      try {
        // Get provider (user) contact info
        const { User } = await import('@/lib/database/models/user');
        const provider = await User.findUserByBusinessId(businessId);
        if (provider) {
          // Format normalized phone for display
          const providerPhone = provider.phoneNormalized 
            ? formatPhoneForDisplay(provider.phoneNormalized)
            : '';
          const providerEmail = provider.email || '';
          providerContactInfo = [providerPhone, providerEmail].filter(Boolean).join(' • ');
          console.log('[CreateBooking] Provider contact info:', providerContactInfo);
        }
        
        // Get business payment preferences
        const business = await Business.getById(businessId);
        if (business && business.preferredPaymentMethod) {
          preferredPaymentMethod = business.preferredPaymentMethod;
        }
      } catch (error) {
        console.warn('[CreateBooking] Could not fetch provider/business details for confirmation');
      }

      // Calculate payment details from quote
      let amountPaid = 0;
      let amountOwed = totalJobCostEstimation;
      let showPaymentDetails = false;
      let totalCostIncludingFees = totalJobCostEstimation; // Default to base cost
      
      try {
        const paymentDetails = await quote.calculatePaymentDetails();
        if (paymentDetails.depositAmount && paymentDetails.depositAmount > 0) {
          showPaymentDetails = true;
          const bookingFee = 4;
          amountPaid = paymentDetails.depositAmount + bookingFee; // Include booking fee
          amountOwed = paymentDetails.remainingBalance || 0;
          totalCostIncludingFees = totalJobCostEstimation + bookingFee; // Add booking fee to total
        } else if (isPaymentCompletion) {
          showPaymentDetails = true;
          amountPaid = totalJobCostEstimation;
          amountOwed = 0;
          // For full payment, no additional fees shown in total
        }
      } catch (error) {
        console.warn('[CreateBooking] Could not calculate payment details for confirmation');
      }

      // Determine service type for arrival instructions
      const hasMobileService = selectedServices.some((s: any) => s.mobile) || service.mobile;
      const arrivalInstructions = hasMobileService 
        ? t.BOOKING_CONFIRMATION.MOBILE_INSTRUCTIONS
        : t.BOOKING_CONFIRMATION.SALON_INSTRUCTIONS;

      // Format services display similar to quote format
      const servicesDisplayFormatted = bookingConfirmationDetails.isMultiService 
        ? `${t.BOOKING_CONFIRMATION.SERVICES}\n   ${bookingConfirmationDetails.servicesDisplay}`
        : `${t.BOOKING_CONFIRMATION.SERVICE}\n   ${bookingConfirmationDetails.servicesDisplay}`;

      // Build cost breakdown
      let costBreakdown = '';
      if (showPaymentDetails && totalCostIncludingFees > totalJobCostEstimation) {
        // Show breakdown when booking fee is included
        const serviceCostLabel = bookingConfirmationDetails.isMultiService 
          ? t.BOOKING_CONFIRMATION.SERVICES_COST 
          : t.BOOKING_CONFIRMATION.SERVICE_COST;
        const bookingFeeLabel = getUserLanguage(chatContext) === 'es' ? '• Tarifa de Reserva:' : '• Booking Fee:';
        
        costBreakdown = `💰 ${t.BOOKING_CONFIRMATION.PRICING}\n` +
          `   ${serviceCostLabel} $${totalJobCostEstimation.toFixed(2)}\n` +
          `${bookingConfirmationDetails.travelCost > 0 ? `   🚗 ${t.BOOKING_CONFIRMATION.TRAVEL_COST} $${bookingConfirmationDetails.travelCost.toFixed(2)}\n` : ''}` +
          `   ${bookingFeeLabel} $4.00\n` +
          `   ${t.BOOKING_CONFIRMATION.TOTAL_COST} $${totalCostIncludingFees.toFixed(2)}\n\n`;
      } else {
        // Simple total when no booking fee
        costBreakdown = `${bookingConfirmationDetails.travelCost > 0 ? `🚗 ${t.BOOKING_CONFIRMATION.TRAVEL_COST} $${bookingConfirmationDetails.travelCost.toFixed(2)}\n` : ''}` +
          `💰 ${t.BOOKING_CONFIRMATION.TOTAL_COST} $${totalCostIncludingFees.toFixed(2)}\n\n`;
      }

      let confirmationMessage = `${paymentMessage}${t.BOOKING_CONFIRMATION.TITLE}\n\n` +
          `${servicesDisplayFormatted}\n` +
          `${costBreakdown}` +
          `${t.BOOKING_CONFIRMATION.DATE} ${bookingConfirmationDetails.formattedDate}\n` +
          `${t.BOOKING_CONFIRMATION.TIME} ${bookingConfirmationDetails.formattedTime}\n` +
          `${t.BOOKING_CONFIRMATION.LOCATION} ${bookingConfirmationDetails.location}\n\n`;

      // Add payment details if applicable
      if (showPaymentDetails) {
        confirmationMessage += `${t.BOOKING_CONFIRMATION.PAYMENT_DETAILS}\n` +
          `   ${t.BOOKING_CONFIRMATION.AMOUNT_PAID} $${amountPaid.toFixed(2)}\n` +
          (amountOwed > 0 ? `   ${t.BOOKING_CONFIRMATION.AMOUNT_OWED} $${amountOwed.toFixed(2)}\n` : '') +
          (amountOwed > 0 ? `   ${t.BOOKING_CONFIRMATION.PAYMENT_METHOD} ${preferredPaymentMethod}\n` : '') +
          `\n`;
      }

      // Add provider contact information if available
      if (providerContactInfo) {
        confirmationMessage += `${t.BOOKING_CONFIRMATION.CONTACT_INFO}\n   ${providerContactInfo}\n\n`;
      }

      // Add arrival instructions
      confirmationMessage += `${t.BOOKING_CONFIRMATION.ARRIVAL_INSTRUCTIONS}\n   ${arrivalInstructions}\n\n`;

      // Add booking ID and closing
      confirmationMessage += `${t.BOOKING_CONFIRMATION.BOOKING_ID} ${bookingConfirmationDetails.bookingId}\n\n` +
          `${t.BOOKING_CONFIRMATION.LOOKING_FORWARD}`;
      
      console.log(`[CreateBooking] Generated full confirmation for booking ${bookingConfirmationDetails.bookingId}. Goal completed.`);
      
      const customerName = currentGoalData.customerName || '{name}';
      return {
        ...currentGoalData,
        goalStatus: 'completed', // Complete the goal since this is the final step
        persistedBooking: savedBooking,
        bookingConfirmationDetails: bookingConfirmationDetails,
        paymentCompleted: isPaymentCompletion,
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.BOOKING_PROBLEM', { name: customerName })
      };

    } catch (error) {
      console.error('[CreateBooking] Error during booking creation process:', error);
      const customerName = currentGoalData.customerName || '{name}';
      return {
        ...currentGoalData,
        bookingError: 'Failed to save booking. Please try again.',
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.BOOKING_PROBLEM', { name: customerName })
      };
    }
  }
};
