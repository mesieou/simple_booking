import { IndividualStepHandler } from '@/lib/bot-engine/types';
import { Booking, type BookingData, BookingStatus } from '@/lib/database/models/booking';
import { getLocalizedText, getLocalizedTextWithVars, MessageComponentBuilder } from './booking-utils';
import { Quote } from '@/lib/database/models/quote';
import { Service } from '@/lib/database/models/service';
import { Business } from '@/lib/database/models/business';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { DateTime } from 'luxon';
import { ScalableNotificationService } from '@/lib/bot-engine/services/scalable-notification-service';
import { productionErrorTracker } from "@/lib/general-helpers/error-handling/production-error-tracker";

// Formats normalized phone number for user-friendly display
const formatPhoneForDisplay = (normalizedPhone: string): string => {
  if (!normalizedPhone) return '';
  
  const withPlus = `+${normalizedPhone}`;
  
  if (normalizedPhone.length >= 10) {
    return withPlus.replace(/(\+\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
  }
  
  return withPlus;
};

// Extracts quote ID from user input (handles payment completion messages)
const extractQuoteIdFromInput = (userInput: string, currentGoalData: any): { quoteId: string; isPaymentCompletion: boolean } => {
  if (userInput && userInput.startsWith('PAYMENT_COMPLETED_')) {
    return {
      quoteId: userInput.replace('PAYMENT_COMPLETED_', ''),
      isPaymentCompletion: true
    };
  }
  
  return {
    quoteId: currentGoalData.quoteId as string,
    isPaymentCompletion: false
  };
};

// Validates essential booking requirements from quote data
const validateBookingRequirements = (quote: any): { isValid: boolean; error?: string } => {
  if (!quote || !quote.userId || !quote.businessId) {
    console.error('[CreateBooking] Quote missing basic data:', { quote: !!quote, userId: quote?.userId, businessId: quote?.businessId });
    productionErrorTracker.logCriticalError('BOOKING_QUOTE_MISSING_DATA', 'Quote missing basic data for booking creation', {
      userId: quote?.userId,
      businessId: quote?.businessId,
      additionalContext: {
        component: 'CreateBooking',
        operation: 'validateBookingRequirements',
        hasQuote: !!quote,
        hasUserId: !!quote?.userId,
        hasBusinessId: !!quote?.businessId,
        quoteId: quote?.id
      }
    }).catch(console.error);
    return { isValid: false, error: 'Quote data is incomplete.' };
  }

  // Check if quote has serviceIds data
  const serviceIds = quote.serviceIds;
  if (!serviceIds || serviceIds.length === 0) {
    console.error('[CreateBooking] Quote missing serviceIds data:', { serviceIds });
    return { isValid: false, error: 'Quote data is incomplete.' };
  }

  return { isValid: true };
};

// Creates and validates booking DateTime from session data or quote fallback
const createBookingDateTime = async (
  currentGoalData: any,
  quote: any,
  providerTimezone: string
): Promise<{ dateTime?: DateTime; error?: string }> => {
  let selectedDate = currentGoalData.selectedDate as string;
  let selectedTime = currentGoalData.selectedTime as string;
  
  // Use session data if available
  if (selectedDate && selectedTime) {
    // Clean malformed date/time data
    const cleanDate = selectedDate.includes('T') ? selectedDate.split('T')[0] : selectedDate;
    const cleanTime = selectedTime.startsWith('T') ? selectedTime.substring(1) : selectedTime;
    
    const dateTimeString = `${cleanDate}T${cleanTime}`;
    const bookingDateTime = DateTime.fromISO(dateTimeString, { zone: providerTimezone });
    
    if (!bookingDateTime.isValid) {
      console.error(`[CreateBooking] Invalid dateTime: ${dateTimeString}, error: ${bookingDateTime.invalidReason}`);
      return { error: 'Invalid booking date or time format. Please try booking again.' };
    }
    
    console.log(`[CreateBooking] Using session dateTime: ${dateTimeString}`);
    return { dateTime: bookingDateTime };
  }
  
  // Fallback to quote's proposed datetime
  if (quote.proposedDateTime) {
    const bookingDateTime = DateTime.fromISO(quote.proposedDateTime, { zone: providerTimezone });
    console.log(`[CreateBooking] Using quote proposedDateTime: ${quote.proposedDateTime}`);
    return { dateTime: bookingDateTime };
  }
  
  return { error: 'Missing booking date or time information.' };
};

// Creates and saves booking record to database
const createBookingRecord = async (
  quoteId: string,
  quote: any,
  providerId: string,
  bookingDateTime: DateTime
): Promise<BookingData & { id: string }> => {
  const bookingData = {
    quoteId,
    userId: quote.userId,
    businessId: quote.businessId,
    providerId,
    dateTime: bookingDateTime.toISO() as string,
    status: 'confirmed' as BookingStatus
  };
  
  const newBooking = new Booking(bookingData);
  const savedBooking = await newBooking.add() as BookingData & { id: string };
  console.log('[CreateBooking] Booking successfully created:', savedBooking.id);
  
  return savedBooking;
};

// Updates quote status to 'accepted' after successful booking creation
const updateQuoteStatus = async (quoteId: string, quote: any): Promise<void> => {
  try {
    const existingQuote = await Quote.getById(quoteId);
    if (!existingQuote) {
      console.log(`[CreateBooking] Quote ${quoteId} no longer exists - skipping status update`);
      return;
    }

    const updatedQuoteData = {
      userId: quote.userId,
      pickUp: quote.pickUp,
      dropOff: quote.dropOff,
      businessId: quote.businessId,
      serviceIds: quote.serviceIds,
      travelTimeEstimate: quote.travelTimeEstimate,
      totalJobDurationEstimation: quote.totalJobDurationEstimation,
      travelCostEstimate: quote.travelCostEstimate,
      totalJobCostEstimation: quote.totalJobCostEstimation,
      depositAmount: quote.depositAmount,
      remainingBalance: quote.remainingBalance,
      proposedDateTime: quote.proposedDateTime,
      status: 'accepted'
    };
    
    await Quote.update(quoteId, updatedQuoteData, { useServiceRole: true });
    console.log(`[CreateBooking] Quote ${quoteId} marked as 'accepted'`);
  } catch (error) {
    console.warn(`[CreateBooking] Could not update quote status for ${quoteId}:`, error instanceof Error ? error.message : String(error));
  }
};

// Calculates comprehensive payment details including fees
const calculatePaymentDetails = async (quote: any, isPaymentCompletion: boolean, totalJobCostEstimation: number, businessBookingFee: number = 0) => {
  let amountPaid = 0;
  let amountOwed = totalJobCostEstimation;
  let showPaymentDetails = false;
  let totalCostIncludingFees = totalJobCostEstimation;
  
  try {
    const paymentDetails = await quote.calculatePaymentDetails();
    if (paymentDetails.depositAmount && paymentDetails.depositAmount > 0) {
      showPaymentDetails = true;
      amountPaid = paymentDetails.depositAmount + businessBookingFee;
      amountOwed = paymentDetails.remainingBalance || 0;
      totalCostIncludingFees = totalJobCostEstimation + businessBookingFee;
    } else if (isPaymentCompletion) {
      showPaymentDetails = true;
      amountPaid = totalJobCostEstimation;
      amountOwed = 0;
    }
  } catch (error) {
    console.warn('[CreateBooking] Could not calculate payment details');
  }
  
  return { amountPaid, amountOwed, showPaymentDetails, totalCostIncludingFees };
};

// Formats services display for confirmations and notifications
const formatServicesDisplay = (services: any[], serviceDetails: any[], fallbackService: any): string => {
  if (services.length === 1) {
    return services[0]?.name || fallbackService.name;
  }
  
  if (serviceDetails && serviceDetails.length > 0) {
    return serviceDetails.map((detail: any, index: number) => 
      `${index + 1}. ${detail.name} - $${detail.cost.toFixed(2)}`
    ).join('\n   ');
  }
  
  return services.map((service: any, index: number) => 
    `${index + 1}. ${service?.name || 'Service'}`
  ).join('\n   ');
};

// Generates cost breakdown section for confirmation message using new component system
const generateCostBreakdown = (
  services: any[],
  totalJobCostEstimation: number,
  travelCostEstimate: number,
  language: string
): string => {
  // Determine if any service uses per-minute pricing
  const hasPerMinuteService = services.some(s => s.pricingType === 'per_minute');
  const pricingType = hasPerMinuteService ? 'per_minute' : 'fixed_price';
  
  const costs = {
    labour: totalJobCostEstimation - (travelCostEstimate || 0),
    travel: travelCostEstimate || 0,
    total: totalJobCostEstimation
  };
  
  return MessageComponentBuilder.buildBreakdownCosts(pricingType, costs, language, null);
};

// Retrieves provider contact information and business preferences
const getProviderAndBusinessInfo = async (businessId: string) => {
  let providerContactInfo = '';
  let preferredPaymentMethod = 'cash/card';
  let businessType = 'unknown';
  
  try {
    const { User } = await import('@/lib/database/models/user');
    const provider = await User.findUserByBusinessId(businessId);
    if (provider) {
      const providerPhone = provider.phoneNormalized ? formatPhoneForDisplay(provider.phoneNormalized) : '';
      const providerEmail = provider.email || '';
      providerContactInfo = [providerPhone, providerEmail].filter(Boolean).join(' • ');
    }
    
    const business = await Business.getById(businessId);
    if (business) {
      if (business.preferredPaymentMethod) {
        preferredPaymentMethod = business.preferredPaymentMethod;
      }
      businessType = business.businessCategory || 'unknown';
    }
  } catch (error) {
    console.warn('[CreateBooking] Could not fetch provider/business details');
  }
  
  return { providerContactInfo, preferredPaymentMethod, businessType };
};

// Builds complete booking confirmation message using new component system
const buildConfirmationMessage = async (
  savedBooking: BookingData & { id: string },
  quote: any,
  service: any,
  currentGoalData: any,
  chatContext: any,
  bookingDateTime: DateTime,
  isPaymentCompletion: boolean,
  paymentDetails: any,
  business: any
): Promise<string> => {
  const { getUserLanguage, BOOKING_TRANSLATIONS } = await import('./booking-utils');
  const language = getUserLanguage(chatContext);
  const t = BOOKING_TRANSLATIONS[language];
  
  // Get customer and service information
  const customerName = currentGoalData.customerName || 'Customer';
  const selectedServices = currentGoalData.selectedServices || [currentGoalData.selectedService].filter(Boolean);
  
  // Get provider and business information
  const { providerContactInfo, preferredPaymentMethod, businessType } = await getProviderAndBusinessInfo(quote.businessId);
  
  // Determine business type for component building
  const isRemovalist = businessType?.toLowerCase() === 'removalist';
  const businessTypeForComponents: 'removalist' | 'mobile' | 'non_mobile' = isRemovalist ? 'removalist' 
    : selectedServices.some((s: Service | { mobile?: boolean }) => s.mobile) ? 'mobile' : 'non_mobile';

  // Determine business template for confirmation messages  
  const businessTemplate: 'REMOVALIST' | 'SALON' = isRemovalist ? 'REMOVALIST' : 'SALON';
  const confirmationTemplate = t.CONFIRMATION_TEMPLATES[businessTemplate];

  // Build payment message using business-specific template
  const paymentMessage = isPaymentCompletion 
    ? `${confirmationTemplate.PAYMENT_THANKS}\n\n`
    : '';

  // Build main confirmation content using business-specific template
  let confirmationMessage = `${paymentMessage}${confirmationTemplate.TITLE.replace('{name}', customerName)}\n\n`;

  // Build job details section using new component system - use only validated addresses
  const addresses = {
    pickup: quote.pickUp || currentGoalData.finalServiceAddress,
    dropoff: quote.dropOff || currentGoalData.finalDropoffAddress,
    customer: quote.dropOff || currentGoalData.finalServiceAddress,
    business: business?.businessAddress
  };

  // Use businessTypeForComponents for buildJobDetails (expects 'removalist' | 'mobile' | 'non_mobile')
  confirmationMessage += MessageComponentBuilder.buildJobDetails(
    businessTypeForComponents,
    selectedServices,
    addresses,
    language
  );
  
  // Add cost breakdown using new component system
  confirmationMessage += generateCostBreakdown(
    selectedServices,
    quote.totalJobCostEstimation,
    quote.travelCostEstimate || 0,
    language
  );
  
  // Add date and time using new component system
  const formattedDate = bookingDateTime.toLocaleString(DateTime.DATE_FULL);
  const formattedTime = bookingDateTime.toLocaleString(DateTime.TIME_SIMPLE);
  const totalDuration = quote.totalJobDurationEstimation || 0;
  
  confirmationMessage += MessageComponentBuilder.buildDateTime(
    formattedDate,
    formattedTime,
    totalDuration,
    true, // Show completion time
    language
  );
  
  confirmationMessage += '\n';

  // Add payment details section using new component system
  if (paymentDetails.showPaymentDetails) {
    const deposit = paymentDetails.amountPaid > quote.totalJobCostEstimation ? {
      percentage: business?.getDepositManager().getConfiguration().percentage || 0,
      amount: paymentDetails.amountPaid - (business?.bookingFee || 0),
      type: business?.getDepositManager().getConfiguration().type || 'percentage'
    } : null;
    
    // Check if any service uses per-minute pricing
    const hasPerMinuteService = selectedServices.some((s: Service) => s.pricingType === 'per_minute');
    
    // For buildPaymentBreakdown (expects 'removalist' | 'salon')
    const businessTypeForPayment: 'removalist' | 'salon' = isRemovalist ? 'removalist' : 'salon';

    confirmationMessage += MessageComponentBuilder.buildPaymentBreakdown(
      quote.totalJobCostEstimation,
      deposit,
      business?.bookingFee || 0,
      preferredPaymentMethod,
      businessTypeForPayment,
      language,
      hasPerMinuteService,
      true // isConfirmation = true for booking confirmations
    );
    
    confirmationMessage += '\n';
  }

  // Add provider contact information
  if (providerContactInfo) {
    confirmationMessage += `${t.BOOKING_CONFIRMATION.CONTACT_INFO}\n   ${providerContactInfo}\n\n`;
  }

  // Add arrival instructions using business-specific template
  const hasMobileService = selectedServices.some((s: any) => s.mobile) || service.mobile;
  const arrivalInstructions = (hasMobileService || isRemovalist)
    ? confirmationTemplate.MOBILE_INSTRUCTIONS.replace('{name}', customerName)
    : (confirmationTemplate as any).SALON_INSTRUCTIONS?.replace('{name}', customerName) 
      || t.BOOKING_CONFIRMATION.SALON_INSTRUCTIONS.replace('{name}', customerName);
  
  confirmationMessage += `${confirmationTemplate.ARRIVAL_INSTRUCTIONS.replace('{name}', customerName)}\n   ${arrivalInstructions}\n\n`;

  // Add estimate notice for removalists
  if (isRemovalist && confirmationTemplate.ESTIMATE_NOTICE) {
    confirmationMessage += `${confirmationTemplate.ESTIMATE_NOTICE}\n\n`;
  }

  // Add booking ID and closing
  confirmationMessage += `${t.BOOKING_CONFIRMATION.BOOKING_ID} ${savedBooking.id}\n\n` +
    `${confirmationTemplate.LOOKING_FORWARD.replace('{name}', customerName)}`;
  
  // Replace any remaining placeholders
  return confirmationMessage.replace(/{name}/g, customerName);
};

// Sends comprehensive booking notifications to admin and super admin
const sendBookingNotifications = async (
  savedBooking: BookingData & { id: string },
  quote: any,
  service: any,
  currentGoalData: any,
  chatContext: any
): Promise<void> => {
  console.log('[CreateBooking] Sending booking notifications...');
  
  try {
    const customerName = currentGoalData.customerName || 'Customer';
    const customerPhone = chatContext.currentParticipant.customerWhatsappNumber || '';
    const selectedServices = currentGoalData.selectedServices || [currentGoalData.selectedService].filter(Boolean);
    const serviceDetails = currentGoalData.serviceDetails || [];
    
    // Get business info for payment calculations
    const business = await Business.getById(savedBooking.businessId);
    const businessBookingFee = business?.bookingFee || 0;
    
    // Calculate payment details for notification
    const paymentDetails = await calculatePaymentDetails(quote, false, quote.totalJobCostEstimation, businessBookingFee);
    
    const bookingDateTime = DateTime.fromISO(savedBooking.dateTime);
    
    // Calculate duration and estimated completion for removalist template
    const durationMinutes = quote.totalJobDurationEstimation || 0;
    const durationHours = Math.floor(durationMinutes / 60);
    const durationRemainder = durationMinutes % 60;
    const durationText = durationHours > 0 ? `${durationHours} hours${durationRemainder > 0 ? ` ${durationRemainder} minutes` : ''}` : `${durationMinutes} minutes`;
    
    const estimatedCompletionTime = durationMinutes > 0 
      ? bookingDateTime.plus({ minutes: durationMinutes }).toLocaleString(DateTime.TIME_SIMPLE)
      : null;
    
    const bookingDetails = {
      bookingId: savedBooking.id,
      customerName,
      customerPhone: formatPhoneForDisplay(customerPhone),
      customerWhatsapp: formatPhoneForDisplay(customerPhone),
      serviceName: service.name,
      servicesDisplay: formatServicesDisplay(selectedServices, serviceDetails, service),
      isMultiService: selectedServices.length > 1,
      formattedDate: bookingDateTime.toLocaleString(DateTime.DATE_FULL),
      formattedTime: bookingDateTime.toLocaleString(DateTime.TIME_SIMPLE),
      location: service.mobile ? quote.dropOff : quote.pickUp,
      // Removalist-specific fields
      pickupAddress: quote.pickUp,
      deliveryAddress: quote.dropOff,
      duration: durationMinutes > 0 ? durationText : null,
      estimatedCompletion: estimatedCompletionTime,
      // Service characteristics for template selection
      isMobile: service.mobile,
      pricingType: service.pricingType,
      // Cost details
      totalCost: quote.totalJobCostEstimation + businessBookingFee,
      serviceCost: quote.totalJobCostEstimation,
      travelCost: quote.travelCostEstimate || 0,
      bookingFee: businessBookingFee,
      amountPaid: paymentDetails.amountPaid,
      amountOwed: paymentDetails.amountOwed,
      balanceDue: paymentDetails.amountOwed,
      paymentMethod: 'cash'
    };
    
    const notificationService = new ScalableNotificationService();
    await notificationService.sendBookingNotification(savedBooking.businessId, bookingDetails);
    
    console.log('[CreateBooking] ✅ Booking notifications sent successfully');
  } catch (error) {
    console.error('[CreateBooking] Error sending booking notifications:', error);
    throw error;
  }
};

// Main handler for creating bookings from quotes
export const createBookingHandler: IndividualStepHandler = {
  // Accepts empty input (auto-advanced) or payment confirmation messages
  validateUserInput: async (userInput) => {
    if (!userInput || userInput === "" || userInput.startsWith('PAYMENT_COMPLETED_')) {
      return { isValidInput: true };
    }
    return { isValidInput: false, validationErrorMessage: '' };
  },
  
  // Creates booking from quote data and generates confirmation message
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[CreateBooking] Starting booking creation...');
    
    try {
      // Extract quote ID and determine if this is payment completion
      const { quoteId, isPaymentCompletion } = extractQuoteIdFromInput(validatedInput, currentGoalData);
      
      if (!quoteId) {
        console.error('[CreateBooking] No Quote ID found.');
        return {
          ...currentGoalData,
          bookingError: 'Missing quote information to create booking.'
        };
      }

      // Fetch and validate quote
      const quote = await Quote.getById(quoteId);
      if (!quote) {
        console.error(`[CreateBooking] Quote with ID ${quoteId} not found.`);
        return {
          ...currentGoalData,
          bookingError: `Booking data not found (quote ${quoteId}).`
        };
      }
      
      // Validate essential booking requirements
      const validation = validateBookingRequirements(quote);
      if (!validation.isValid) {
        return { ...currentGoalData, bookingError: validation.error };
      }

      // Get provider ID and timezone
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

      // Get provider timezone
      const calendarSettings = await CalendarSettings.getByUserAndBusiness(providerId, quote.businessId);
      const providerTimezone = calendarSettings?.settings?.timezone || 'UTC';

      // Create and validate booking datetime
      const dateTimeResult = await createBookingDateTime(currentGoalData, quote, providerTimezone);
      if (dateTimeResult.error) {
        return { ...currentGoalData, bookingError: dateTimeResult.error };
      }
      
      const bookingDateTime = dateTimeResult.dateTime!;

      // Create booking record
      const savedBooking = await createBookingRecord(quoteId, quote, providerId, bookingDateTime);
      
      // Send booking notifications (non-blocking)
      const serviceIds = quote.serviceIds;
      const serviceId = serviceIds?.[0];
      if (!serviceId) {
        console.error('[CreateBooking] Could not find service ID in quote data');
        return {
          ...currentGoalData,
          bookingError: 'Could not retrieve service details for confirmation.'
        };
      }
      
      const service = await Service.getById(serviceId);
      if (!service) {
        console.error(`[CreateBooking] Could not find service with ID ${serviceId}`);
        return {
          ...currentGoalData,
          bookingError: 'Could not retrieve service details for confirmation.'
        };
      }

      try {
        await sendBookingNotifications(savedBooking, quote, service, currentGoalData, chatContext);
      } catch (notificationError) {
        console.error('[CreateBooking] Failed to send booking notifications:', notificationError);
        // Don't fail booking creation if notifications fail
      }

      // Update quote status to accepted
      await updateQuoteStatus(quoteId, quote);

      // Get business info for payment calculations and confirmation
      const business = await Business.getById(quote.businessId);
      const businessBookingFee = business?.bookingFee || 0;

      // Calculate payment details for confirmation
      const paymentDetails = await calculatePaymentDetails(quote, isPaymentCompletion, quote.totalJobCostEstimation, businessBookingFee);
      
      // Generate confirmation message
      const confirmationMessage = await buildConfirmationMessage(
        savedBooking,
        quote,
        service,
        currentGoalData,
        chatContext,
        bookingDateTime,
        isPaymentCompletion,
        paymentDetails,
        business
      );
      
      console.log(`[CreateBooking] Generated confirmation for booking ${savedBooking.id}. Goal completed.`);
      
      return {
        ...currentGoalData,
        goalStatus: 'completed',
        persistedBooking: savedBooking,
        paymentCompleted: isPaymentCompletion,
        confirmationMessage,
        // Clear quote data to prevent future modifications
        persistedQuote: undefined,
        quoteId: undefined,
        bookingSummary: undefined,
        quoteEstimation: undefined
      };

    } catch (error) {
      console.error('[CreateBooking] Error during booking creation process:', error);
      await productionErrorTracker.logCriticalError('BOOKING_CREATION_FAILED', error instanceof Error ? error : new Error(String(error)), {
        userId: currentGoalData.userId,
        businessId: chatContext?.currentParticipant?.associatedBusinessId,
        chatSessionId: chatContext?.currentConversationSession?.id,
        additionalContext: {
          component: 'CreateBooking',
          operation: 'processAndExtractData',
          quoteId: currentGoalData.quoteId,
          customerName: currentGoalData.customerName,
          bookingDateTime: currentGoalData.bookingDateTime,
          hasQuote: !!currentGoalData.persistedQuote,
          isPaymentCompletion: validatedInput === 'payment_completed',
          serviceCount: currentGoalData.persistedQuote?.serviceIds?.length || 0
        }
      });
      const customerName = currentGoalData.customerName || '{name}';
      return {
        ...currentGoalData,
        bookingError: 'Failed to save booking. Please try again.',
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.BOOKING_PROBLEM', { name: customerName })
      };
    }
  }
};
