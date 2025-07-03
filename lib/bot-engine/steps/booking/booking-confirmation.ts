import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText } from './booking-utils';

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

export const bookingConfirmationHandler: IndividualStepHandler = {
  defaultChatbotPrompt: 'Your booking is confirmed!',
  
  validateUserInput: async () => ({ isValidInput: true }),
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const bookingSummary = currentGoalData.bookingSummary;
    const selectedServices = currentGoalData.selectedServices || [];
    const serviceDetails = currentGoalData.serviceDetails || [];
    
    // Format services for confirmation
    const formatServicesForConfirmation = (services: any[], details: any[], singleService: string) => {
      if (!services || services.length <= 1) {
        return singleService || 'Service';
      }
      
      // Use serviceDetails if available, otherwise fallback to service names
      if (details && details.length > 0) {
        return details.map((detail, index) => 
          `${index + 1}. ${detail.name} - $${detail.cost.toFixed(2)}`
        ).join('\n   ');
      }
      
      return services.map((service, index) => 
        `${index + 1}. ${service?.name || 'Service'}`
      ).join('\n   ');
    };
    
    const isMultiService = selectedServices.length > 1;
    const servicesDisplay = formatServicesForConfirmation(selectedServices, serviceDetails, bookingSummary.service);
    
    // Get provider contact information and business payment preferences
    const businessId = chatContext.currentParticipant.associatedBusinessId;
    let providerContactInfo = '';
    let preferredPaymentMethod = '';
    let amountPaid = 0;
    let amountOwed = 0;
    let showPaymentDetails = false;
    
    if (businessId) {
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
        }
        
        // Get business payment preferences
        const { Business } = await import('@/lib/database/models/business');
        const business = await Business.getById(businessId);
        if (business) {
          preferredPaymentMethod = business.preferredPaymentMethod || '';
        }
      } catch (error) {
        console.warn('[BookingConfirmation] Could not fetch provider/business details');
      }
    }

    // Get payment details from booking summary
    const totalCost = parseFloat((bookingSummary.totalCost || '0').replace('$', ''));
    if (bookingSummary.requiresDeposit && bookingSummary.depositAmount) {
      showPaymentDetails = true;
      amountPaid = bookingSummary.totalPaymentAmount || (bookingSummary.depositAmount + 4);
      amountOwed = bookingSummary.remainingBalance || 0;
    }

    // Determine service type for arrival instructions
    const hasMobileService = selectedServices.some((s: any) => s.mobile) || bookingSummary.services?.some((s: any) => s.mobile);
    const arrivalInstructions = hasMobileService 
      ? getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.MOBILE_INSTRUCTIONS')
      : getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.SALON_INSTRUCTIONS');
    
    // Use new organized format similar to quote
    const serviceLabel = isMultiService 
      ? getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.SERVICES')
      : getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.SERVICE');
    
    const customerName = currentGoalData.customerName || '{name}';
    let confirmationMessage = `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.TITLE')}\n\n`;
    confirmationMessage += `${serviceLabel}\n   ${servicesDisplay}\n`;
    confirmationMessage += bookingSummary.travelCost && parseFloat(bookingSummary.travelCost.replace('$', '')) > 0 
      ? `🚗 ${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.TRAVEL_COST')} ${bookingSummary.travelCost}\n` 
      : '';
    confirmationMessage += `💰 ${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.TOTAL_COST')} ${bookingSummary.totalCost}\n\n`;
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.DATE')} ${bookingSummary.date}\n`;
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.TIME')} ${bookingSummary.time}\n`;
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.LOCATION')} ${bookingSummary.location}\n\n`;

    // Add payment details if applicable
    if (showPaymentDetails) {
      confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.PAYMENT_DETAILS')}\n` +
        `   ${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.AMOUNT_PAID')} $${amountPaid.toFixed(2)}\n` +
        (amountOwed > 0 ? `   ${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.AMOUNT_OWED')} $${amountOwed.toFixed(2)}\n` : '') +
        (amountOwed > 0 && preferredPaymentMethod ? `   ${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.PAYMENT_METHOD')} ${preferredPaymentMethod}\n` : '') +
        `\n`;
    }

    // Add provider contact information if available
    if (providerContactInfo) {
      confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.CONTACT_INFO')}\n   ${providerContactInfo}\n\n`;
    }

    // Add arrival instructions
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.ARRIVAL_INSTRUCTIONS')}\n   ${arrivalInstructions}\n\n`;

    // Add booking ID and closing
    confirmationMessage += `${getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.BOOKING_ID')} ${currentGoalData.bookingId}\n\n`;
    confirmationMessage += getLocalizedText(chatContext, 'BOOKING_CONFIRMATION.LOOKING_FORWARD');
    
    return {
      ...currentGoalData,
      confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.BOOKING_CONFIRMATION', { name: customerName })
    };
  }
};
