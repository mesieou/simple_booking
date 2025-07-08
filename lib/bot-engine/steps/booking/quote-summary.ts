import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText } from './booking-utils';
import { Service } from '@/lib/database/models/service';
import { Business } from '@/lib/database/models/business';
import { Quote, type QuoteData } from '@/lib/database/models/quote';
import { computeQuoteEstimation, type QuoteEstimation } from '@/lib/general-helpers/quote-cost-calculator';
import { createLogger } from '@/lib/bot-engine/utils/logger';

const QuoteSummaryLogger = createLogger('QuoteSummary');

// Simple validation - check everything in one place
const validateBookingData = (currentGoalData: any, businessType: string, businessId: string, userId: string): boolean => {
  // Always need these basics
  const hasServices = (currentGoalData.selectedServices?.length > 0) || currentGoalData.selectedService;
  const hasDate = currentGoalData.selectedDate;
  const hasTime = currentGoalData.selectedTime;
  const hasBusinessId = businessId && businessId !== '';
  const hasUserId = userId && userId !== '';
  
  // Basic requirements for everyone
  if (!hasServices || !hasDate || !hasTime || !hasBusinessId || !hasUserId) {
    return false;
  }
  
  // Business-specific requirements
  if (businessType?.toLowerCase() === 'removalist') {
    // Removalists need pickup and dropoff addresses
    // Check for the actual field names set by address collection steps
    const hasPickUp = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress;
    const hasDropOff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress;
    return hasPickUp && hasDropOff;
  }
  
  if (businessType?.toLowerCase() === 'salon') {
    // Salons don't need any addresses - just the basics above
    return true;
  }
  
  // Default: assume it's like a removalist (safer)
  const hasPickUp = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress;
  const hasDropOff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress;
  return hasPickUp && hasDropOff;
};

// Check if input is a service ID (UUID format)
const isServiceId = (input: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
};

// Handle service selection change - restart booking with new service
const handleServiceChange = async (serviceId: string, currentGoalData: any, context: any) => {
  const availableServices = currentGoalData.availableServices;
  const { ServiceDataProcessor } = await import('./booking-utils');
  const selectedServiceData = ServiceDataProcessor.findServiceById(serviceId, availableServices);
  
  if (!selectedServiceData) {
    QuoteSummaryLogger.warn('Service not found', context, { serviceId });
    return {
      ...currentGoalData,
      confirmationMessage: 'Sorry, that service is not available. Please use the buttons below.'
    };
  }
  
  QuoteSummaryLogger.journey('Service changed - restarting booking', context, { 
    newServiceName: selectedServiceData.name 
  });
  
  return {
    availableServices,
    selectedService: ServiceDataProcessor.extractServiceDetails(selectedServiceData),
    // Clear booking data to restart process
    selectedDate: undefined,
    selectedTime: undefined,
    finalServiceAddress: undefined,
    serviceLocation: undefined,
    persistedQuote: undefined,
    quoteId: undefined,
    bookingSummary: undefined,
    restartBookingFlow: true,
    shouldAutoAdvance: true,
    confirmationMessage: `Great! Let's book a ${selectedServiceData.name} appointment.`
  };
};

// Calculate combined quote for multiple services
const calculateCombinedQuote = async (services: any[], businessId: string, currentGoalData: any, context: any): Promise<QuoteEstimation> => {
  let totalServiceCost = 0;
  let totalDuration = 0;
  let hasMobileService = false;
  
  // Sum up all service costs and durations
  for (const serviceData of services) {
    const service = new Service({
      id: serviceData.id,
      name: serviceData.name,
      durationEstimate: serviceData.durationEstimate,
      fixedPrice: serviceData.fixedPrice,
      pricingType: serviceData.pricingType,
      mobile: serviceData.mobile,
      ratePerMinute: serviceData.ratePerMinute,
      baseCharge: serviceData.baseCharge,
      businessId
    });

    const serviceQuote = computeQuoteEstimation(service, 0);
    totalServiceCost += serviceQuote.serviceCost;
    totalDuration += serviceData.durationEstimate || 0;
    
    if (serviceData.mobile) {
      hasMobileService = true;
    }
  }

  // Calculate travel cost once for mobile services
  let travelCost = 0;
  let travelTime = 0;
  
  if (hasMobileService) {
    const firstMobileService = services.find(s => s.mobile);
    if (firstMobileService) {
      // Get pickup and dropoff addresses
      const pickUp = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress;
      const dropOff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress;
      
      if (pickUp && dropOff && pickUp !== dropOff) {
        // Calculate real travel time using Google Maps API
        const { fetchDirectGoogleMapsDistance } = await import('@/lib/general-helpers/google-distance-calculator');
        const mapsData = await fetchDirectGoogleMapsDistance(pickUp, dropOff);
        
        if (mapsData.status !== 'OK' || !mapsData.rows?.[0]?.elements?.[0] || mapsData.rows[0].elements[0].status !== 'OK') {
          const errorMessage = mapsData.error_message || `Google Maps API returned status: ${mapsData.status}`;
          QuoteSummaryLogger.error('Google Maps API failed to calculate travel time', context, {
            mapsStatus: mapsData.status,
            errorMessage: mapsData.error_message,
            pickUp,
            dropOff
          });
          throw new Error(`Unable to calculate travel time between addresses: ${errorMessage}`);
        }
        
        const element = mapsData.rows[0].elements[0];
        travelTime = Math.ceil(element.duration.value / 60); // Convert seconds to minutes
        
        QuoteSummaryLogger.info(`Real travel time calculated: ${travelTime} minutes for ${pickUp} to ${dropOff}`, context);
      } else {
        QuoteSummaryLogger.info('Same pickup/dropoff or missing addresses, using minimal travel time', context);
        travelTime = 5; // Minimal travel time for same location
      }
      
      // Calculate travel cost with real travel time
      const tempService = new Service({
        id: firstMobileService.id,
        name: firstMobileService.name,
        durationEstimate: 0,
        fixedPrice: 0,
        pricingType: firstMobileService.pricingType,
        mobile: firstMobileService.mobile,
        ratePerMinute: firstMobileService.ratePerMinute,
        baseCharge: firstMobileService.baseCharge,
        businessId
      });
      const travelQuote = computeQuoteEstimation(tempService, travelTime);
      travelCost = travelQuote.travelCost;
      totalDuration += travelTime;
    }
  }

  return {
    serviceCost: totalServiceCost,
    travelCost,
    totalJobCost: totalServiceCost + travelCost,
    totalJobDuration: totalDuration,
    travelTime
  };
};

// Create quote data for database persistence
const createQuoteData = (
  services: any[], 
  quoteEstimation: QuoteEstimation, 
  currentGoalData: any, 
  businessAddress: string,
  businessId: string,
  userId: string
): QuoteData => {
  // Use pickup/dropoff from goalData if available, otherwise use business address as fallback
  // Check the actual field names set by address collection steps
  const pickUp = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress || businessAddress;
  const dropOff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress || businessAddress;
  
  return {
    userId,
    pickUp,
    dropOff,
    businessId,
    serviceIds: services.map(s => s.id),
    travelTimeEstimate: quoteEstimation.travelTime,
    totalJobDurationEstimation: quoteEstimation.totalJobDuration,
    travelCostEstimate: quoteEstimation.travelCost,
    totalJobCostEstimation: quoteEstimation.totalJobCost,
    status: 'pending'
  };
};

// Format time display (24hr to 12hr format)
const formatTimeDisplay = (time24: string): string => {
  const [hour24, minute] = time24.split(':');
  const hour12 = parseInt(hour24) === 0 ? 12 : parseInt(hour24) > 12 ? parseInt(hour24) - 12 : parseInt(hour24);
  const ampm = parseInt(hour24) >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minute} ${ampm}`;
};

// Calculate estimated completion time
const calculateCompletionTime = (startTime: string, durationMinutes: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const startDate = new Date();
  startDate.setHours(hours, minutes, 0, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
};

// Create formatted summary message
const createSummaryMessage = (
  services: any[],
  quoteEstimation: QuoteEstimation,
  currentGoalData: any,
  translations: any,
  language: string,
  businessType: string
): string => {
  const customerName = currentGoalData.customerName || 'Customer';
  const selectedDate = currentGoalData.selectedDate;
  const selectedTime = currentGoalData.selectedTime;
  
  // Format date and time
  const dateObj = new Date(selectedDate);
  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = formatTimeDisplay(selectedTime);
  const estimatedEndTime = calculateCompletionTime(selectedTime, quoteEstimation.totalJobDuration);
  
  // Build summary message
  let message = `📋 ${customerName}, here's your Booking Quote Summary\n\n`;
  
  // Services section
  const serviceLabel = services.length > 1 ? '💼 Services:' : '💼 Service:';
  message += `${serviceLabel}\n`;
  
  if (services.length === 1) {
    const service = services[0];
    if (service.pricingType === 'per_minute') {
      message += `${service.name} - $${service.ratePerMinute.toFixed(2)} per minute\n`;
      message += `\nCosts:\n`;
      if (quoteEstimation.travelCost > 0) {
        message += `Travel Cost: ${quoteEstimation.travelTime} mins × $${service.ratePerMinute.toFixed(2)} = $${quoteEstimation.travelCost.toFixed(2)}\n`;
      }
      message += `Estimated Labour: ${service.durationEstimate} mins × $${service.ratePerMinute.toFixed(2)} = $${quoteEstimation.serviceCost.toFixed(2)}\n`;
      message += `💰 Total Estimated cost = $${quoteEstimation.totalJobCost.toFixed(2)}`;
    } else {
      message += `   ${service.name} - $${service.fixedPrice.toFixed(2)}`;
      if (quoteEstimation.travelCost > 0) {
        message += `\n🚗 Travel: ${quoteEstimation.travelTime} mins × $${service.ratePerMinute.toFixed(2)} = $${quoteEstimation.travelCost.toFixed(2)}`;
      }
      message += `\n💰 Total Cost: $${quoteEstimation.totalJobCost.toFixed(2)}`;
    }
  } else {
    services.forEach((service, index) => {
      const cost = service.pricingType === 'per_minute' 
        ? `$${service.ratePerMinute.toFixed(2)} per minute`
        : `$${service.fixedPrice.toFixed(2)}`;
      message += `   ${index + 1}. ${service.name} - ${cost}\n`;
    });
    if (quoteEstimation.travelCost > 0) {
      message += `🚗 Travel: ${quoteEstimation.travelTime} mins × $${services.find(s => s.mobile)?.ratePerMinute.toFixed(2)} = $${quoteEstimation.travelCost.toFixed(2)}\n`;
    }
    message += `💰 Total Cost: $${quoteEstimation.totalJobCost.toFixed(2)}`;
  }
  
  // Date and time details
  message += `\n\n📅 Date: ${formattedDate}\n`;
  message += `⏰ Time: ${formattedTime} (${quoteEstimation.totalJobDuration} minutes)\n`;
  message += `🏁 Estimated completion: ${estimatedEndTime}\n`;
  
  // Location details (only for removalists - mobile services)
  if (businessType?.toLowerCase() === 'removalist') {
    // Check the actual field names set by address collection steps
    const pickUp = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress;
    const dropOff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress;
    if (pickUp && dropOff && pickUp !== dropOff) {
      message += `📍 From: ${pickUp}\n`;
      message += `📍 To: ${dropOff}\n`;
    } else if (pickUp) {
      message += `📍 Location: ${pickUp}\n`;
    }
  }
  
  return message;
};

// Add payment details to summary message
const addPaymentDetails = (
  message: string,
  requiresDeposit: boolean,
  depositAmount: number | undefined,
  remainingBalance: number | undefined,
  language: string,
  businessType: string
): string => {
  if (!requiresDeposit || !depositAmount || depositAmount <= 0) {
    return message;
  }
  
  const bookingFee = 4;
  const totalPayNow = depositAmount + bookingFee;
  
  // Use "Estimate Remaining Balance" for removalists, "Balance Due" for others
  const isRemovalist = businessType?.toLowerCase() === 'removalist';
  
  const labels = language === 'es' ? {
    paymentDetails: 'Detalles de Pago',
    deposit: 'Depósito',
    bookingFee: 'Tarifa de Reserva',
    payNow: 'Pagar Ahora',
    balanceDue: isRemovalist ? 'Saldo Restante Estimado' : 'Saldo Pendiente'
  } : {
    paymentDetails: 'Payment Details',
    deposit: 'Deposit',
    bookingFee: 'Booking Fee',
    payNow: 'Pay Now',
    balanceDue: isRemovalist ? 'Estimate Remaining Balance' : 'Balance Due'
  };
  
  message += `\n💳 *${labels.paymentDetails}:*\n`;
  message += `   • ${labels.deposit}: $${depositAmount.toFixed(2)}\n`;
  message += `   • ${labels.bookingFee}: $${bookingFee.toFixed(2)}\n`;
  message += `   • ${labels.payNow}: $${totalPayNow.toFixed(2)}\n`;
  
  if (remainingBalance !== undefined && remainingBalance >= 0) {
    message += `   • ${labels.balanceDue}: $${remainingBalance.toFixed(2)} (cash/card)\n`;
  }
  
  return message;
};

// Get payment details from quote
const getPaymentDetails = async (quoteId: string, context: any): Promise<{
  depositAmount: number | undefined;
  remainingBalance: number | undefined;
  requiresDeposit: boolean;
}> => {
  try {
    const quote = await Quote.getById(quoteId);
    const paymentDetails = await quote.calculatePaymentDetails();
    
    return {
      depositAmount: paymentDetails.depositAmount,
      remainingBalance: paymentDetails.remainingBalance,
      requiresDeposit: (paymentDetails.depositAmount ?? 0) > 0
    };
  } catch (error) {
    QuoteSummaryLogger.warn('Could not calculate payment details', context, { 
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      depositAmount: undefined,
      remainingBalance: undefined,
      requiresDeposit: false
    };
  }
};

// Get business address for quote persistence
const getBusinessAddress = async (businessId: string, context: any): Promise<string> => {
  try {
    const business = await Business.getById(businessId);
    return business.businessAddress || business.name || 'Business Location';
  } catch (error) {
    QuoteSummaryLogger.warn('Could not fetch business address', context, { 
      error: error instanceof Error ? error.message : String(error)
    });
    return 'Business Location';
  }
};

// Main step handler for quote summary
export const quoteSummaryHandler: IndividualStepHandler = {
  
  // Validate user input - accept empty input, button clicks, or service IDs
  validateUserInput: async (userInput, currentGoalData) => {
    const context = { userId: currentGoalData.userId };
    
    QuoteSummaryLogger.debug('Validating user input', context, { userInput });
    
    // Accept empty input for first display
    if (!userInput || userInput === "") {
      return { isValidInput: true };
    }
    
    // Reject button clicks to pass to next step
    if (userInput === 'confirm_quote' || userInput === 'edit_quote') {
      return { isValidInput: false, validationErrorMessage: '' };
    }
    
    // Accept service ID selections
    if (isServiceId(userInput)) {
      return { isValidInput: true };
    }
    
    // Reject other input types
    return { 
      isValidInput: false,
      validationErrorMessage: 'Please use the buttons below to confirm or edit your quote.' 
    };
  },
  
  // Process validated input - create quote and generate summary
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const context = {
      userId: currentGoalData.userId,
      businessId: chatContext.currentParticipant?.associatedBusinessId
    };
    
    QuoteSummaryLogger.flow('Processing validated input', context, { validatedInput });
    
    // Handle service selection change
    if (isServiceId(validatedInput)) {
      return await handleServiceChange(validatedInput, currentGoalData, context);
    }
    
    // Return existing data if not empty input
    if (validatedInput !== "") {
      return currentGoalData;
    }
    
    // Return existing quote if already processed
    if (currentGoalData.persistedQuote && currentGoalData.bookingSummary) {
      QuoteSummaryLogger.info('Quote already processed', context);
      return { ...currentGoalData, shouldAutoAdvance: false };
    }
    
         // Get business info for validation
     const businessId = chatContext.currentParticipant?.associatedBusinessId;
     let businessType = 'unknown';
     try {
       if (businessId) {
         const business = await Business.getById(businessId);
         businessType = business.businessCategory || 'unknown';
         QuoteSummaryLogger.info(`Business type detection: ID=${businessId}, Type=${businessType}, BusinessName=${business.name}`, context);
       } else {
         QuoteSummaryLogger.warn('No businessId provided for business type detection', context);
       }
     } catch (error) {
       QuoteSummaryLogger.warn('Could not fetch business type', context, { 
         error: error instanceof Error ? error.message : String(error)
       });
     }
    
         // Validate required booking data
     const userId = currentGoalData.userId;
     
     if (!businessId) {
       QuoteSummaryLogger.error('No businessId available for validation', context);
       return {
         ...currentGoalData,
         summaryError: 'Business information is missing. Please try again.',
         confirmationMessage: 'Business information is missing. Please try again.'
       };
     }
     
     if (!validateBookingData(currentGoalData, businessType, businessId, userId)) {
       // Check the actual field names for better error reporting
       const pickUp = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress;
       const dropOff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress;
       
       QuoteSummaryLogger.warn(`Missing required booking data for ${businessType} - Services: ${currentGoalData.selectedServices?.map((s: any) => s.name) || currentGoalData.selectedService?.name || 'none'}, Date: ${currentGoalData.selectedDate || 'none'}, Time: ${currentGoalData.selectedTime || 'none'}, PickUp: ${pickUp || 'none'}, DropOff: ${dropOff || 'none'}`, context, { 
         businessType,
         hasSelectedServices: !!currentGoalData.selectedServices?.length,
         hasSelectedService: !!currentGoalData.selectedService,
         hasSelectedDate: !!currentGoalData.selectedDate,
         hasSelectedTime: !!currentGoalData.selectedTime,
         hasPickUp: !!pickUp,
         hasDropOff: !!dropOff,
         hasUserId: !!currentGoalData.userId,
         businessId: businessId || 'missing',
         userId: userId || 'missing',
         goalDataKeys: Object.keys(currentGoalData),
         // Debug: show all address-related fields
         finalServiceAddress: currentGoalData.finalServiceAddress || 'missing',
         finalDropoffAddress: currentGoalData.finalDropoffAddress || 'missing',
         pickupAddress: currentGoalData.pickupAddress || 'missing',
         dropoffAddress: currentGoalData.dropoffAddress || 'missing',
         customerAddress: currentGoalData.customerAddress || 'missing'
       });
       // Provide specific error message based on what's missing
       let errorMessage = 'Missing booking information';
       
       if (businessType?.toLowerCase() === 'removalist') {
         if (!pickUp || !dropOff) {
           errorMessage = 'We need your pickup and dropoff addresses to generate a quote. Please provide your moving details.';
         }
       }
       
       return {
         ...currentGoalData,
         summaryError: errorMessage,
         confirmationMessage: errorMessage
       };
     }

    try {
      // Get services to process
      const services = currentGoalData.selectedServices || 
                      (currentGoalData.selectedService ? [currentGoalData.selectedService] : []);
      
      QuoteSummaryLogger.journey('Starting quote calculation', context, { 
        serviceCount: services.length 
      });
      
      // Calculate combined quote with real travel time
      const quoteEstimation = await calculateCombinedQuote(services, businessId, currentGoalData, context);
      
      // Get business address
      const businessAddress = await getBusinessAddress(businessId, context);
      
             // Create and persist quote
       const quoteData = createQuoteData(services, quoteEstimation, currentGoalData, businessAddress, businessId, userId);
       const hasMobileService = services.some((s: any) => s.mobile);
       const quote = new Quote(quoteData, hasMobileService);
       const savedQuote = await quote.add({ useServiceRole: true });
      
      QuoteSummaryLogger.journey('Quote created successfully', context, { 
        quoteId: savedQuote.id 
      });
      
      // Get payment details
      let paymentDetails;
      if (savedQuote.id) {
        paymentDetails = await getPaymentDetails(savedQuote.id, context);
      } else {
        QuoteSummaryLogger.warn('No quote ID available for payment details', context);
        paymentDetails = {
          depositAmount: undefined,
          remainingBalance: undefined,
          requiresDeposit: false
        };
      }
      
      // Create summary message
      const { getUserLanguage, BOOKING_TRANSLATIONS } = await import('./booking-utils');
      const language = getUserLanguage(chatContext);
      const translations = BOOKING_TRANSLATIONS[language] || BOOKING_TRANSLATIONS['en'];
      
             let summaryMessage = createSummaryMessage(
         services,
         quoteEstimation,
         currentGoalData,
         translations,
         language,
         businessType
       );
      
      // Add payment details if required
      summaryMessage = addPaymentDetails(
        summaryMessage,
        paymentDetails.requiresDeposit,
        paymentDetails.depositAmount,
        paymentDetails.remainingBalance,
        language,
        businessType
      );
      
      // Add quote ID and confirmation prompt
      summaryMessage += `\n📄 Quote ID: ${savedQuote.id}\n\n`;
      
      if (paymentDetails.requiresDeposit && paymentDetails.depositAmount) {
        const readyPrompt = language === 'es' 
          ? '🔒 ¿Listo para asegurar tu reserva?' 
          : '🔒 Ready to secure your booking?';
        summaryMessage += readyPrompt;
      } else {
        summaryMessage += `✅ Would you like to confirm this quote?`;
      }
      
      // Prepare booking summary data
      const bookingSummary = {
        serviceCost: quoteEstimation.serviceCost,
        travelCost: quoteEstimation.travelCost,
        totalCost: quoteEstimation.totalJobCost,
        duration: quoteEstimation.totalJobDuration,
        ...paymentDetails,
        totalPaymentAmount: paymentDetails.requiresDeposit && paymentDetails.depositAmount ? paymentDetails.depositAmount + 4 : undefined,
        serviceCount: services.length,
        services: services.map((s: any) => ({
          id: s.id,
          name: s.name,
          duration: s.durationEstimate,
          cost: s.fixedPrice || (s.ratePerMinute * s.durationEstimate),
          pricingType: s.pricingType
        }))
      };
      
      QuoteSummaryLogger.journey('Quote processing completed', context, { 
        quoteId: savedQuote.id,
        requiresDeposit: paymentDetails.requiresDeposit
      });
      
      return {
        ...currentGoalData,
        persistedQuote: savedQuote,
        quoteId: savedQuote.id,
        quoteEstimation,
        ...paymentDetails,
        selectedServices: services,
        bookingSummary,
        shouldAutoAdvance: false,
        confirmationMessage: summaryMessage
      };

    } catch (error) {
      QuoteSummaryLogger.error('Error creating quote', context, { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        ...currentGoalData,
        summaryError: 'Failed to create quote and summary. Please try again.',
        confirmationMessage: getLocalizedText(chatContext, 'MESSAGES.ISSUE_PREPARING_QUOTE')
      };
    }
  },
  
  // Generate appropriate UI buttons based on deposit requirements
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.summaryError) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.TRY_AGAIN'), buttonValue: 'restart_booking' }];
    }
    
    const requiresDeposit = currentGoalData.requiresDeposit || currentGoalData.bookingSummary?.requiresDeposit;
    
    if (requiresDeposit) {
      const totalPaymentAmount = currentGoalData.totalPaymentAmount || currentGoalData.bookingSummary?.totalPaymentAmount;
      
      if (totalPaymentAmount && totalPaymentAmount > 0) {
        const { getUserLanguage } = await import('./booking-utils');
        const language = getUserLanguage(chatContext);
        const paymentAmount = totalPaymentAmount.toFixed(2);
        const payDepositText = language === 'es' 
          ? `💳 $${paymentAmount}` 
          : `💳 Pay $${paymentAmount}`;
        
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
