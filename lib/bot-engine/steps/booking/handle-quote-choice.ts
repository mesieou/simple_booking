import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars } from './booking-utils';
import { StripePaymentService } from '@/lib/payments/stripe-utils';
import { Business } from '@/lib/database/models/business';

// Step: Handle user's choice from quote summary
// Job: Process confirmation (trigger payment) or show edit options
export const handleQuoteChoiceHandler: IndividualStepHandler = {
  // Conditionally auto-advance: only when quote is confirmed, not when showing edit options
  
  // Accept confirmation, edit choice, or payment completion
  validateUserInput: async (userInput) => {
    console.log('[HandleQuoteChoice] Validating input:', userInput);
    if (userInput === 'confirm_quote' || userInput === 'edit_quote') {
      return { isValidInput: true };
    }
    
    // Handle edit sub-choices (service, time, pickup address, dropoff address)
    if (userInput === 'edit_service' || userInput === 'edit_time' || userInput === 'edit_pickup_address' || userInput === 'edit_dropoff_address') {
      return { isValidInput: true };
    }
    
    // Handle payment completion messages
    if (userInput && userInput.startsWith('PAYMENT_COMPLETED_')) {
      console.log('[HandleQuoteChoice] Payment completion message detected - accepting for processing');
      return { isValidInput: true };
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: 'Please select one of the available options.'
    };
  },
  
  // Process user choice and set flags for subsequent steps
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    console.log('[HandleQuoteChoice] Processing input:', validatedInput);
    
    if (validatedInput === 'confirm_quote') {
      // Clear any previous payment errors when retrying
      const isRetry = currentGoalData.paymentError;
      if (isRetry) {
        console.log('[HandleQuoteChoice] Clearing previous payment error for retry');
      }
      
      const requiresDeposit = currentGoalData.requiresDeposit || currentGoalData.bookingSummary?.requiresDeposit;
      
      if (requiresDeposit) {
        console.log('[HandleQuoteChoice] Quote confirmed - creating payment link for deposit');
        
        try {
          const quoteId = currentGoalData.quoteId || currentGoalData.persistedQuote?.id;
          if (!quoteId) {
            console.error('[HandleQuoteChoice] No quote ID found for payment');
            const { getUserLanguage } = await import('./booking-utils');
            const errorMessage = getUserLanguage(chatContext) === 'es'
              ? 'Lo siento, hubo un problema procesando tu reserva. Por favor intenta de nuevo.'
              : 'Sorry, there was an issue processing your booking. Please try again.';
            return {
              ...currentGoalData,
              paymentError: true,
              confirmationMessage: errorMessage
            };
          }

          // Get payment details
          const depositAmount = currentGoalData.depositAmount || currentGoalData.bookingSummary?.depositAmount;
          const totalChargeAmount = currentGoalData.totalPaymentAmount || currentGoalData.bookingSummary?.totalPaymentAmount;

          if (!depositAmount || !totalChargeAmount) {
            console.error('[HandleQuoteChoice] No deposit amount found');
            const { getUserLanguage } = await import('./booking-utils');
            const errorMessage = getUserLanguage(chatContext) === 'es'
              ? 'Lo siento, hubo un problema calculando el monto del pago. Por favor intenta de nuevo.'
              : 'Sorry, there was an issue calculating payment amount. Please try again.';
            return {
              ...currentGoalData,
              paymentError: true,
              confirmationMessage: errorMessage
            };
          }

          // Create payment link
          console.log(`[HandleQuoteChoice] Creating payment link for quote ${quoteId}`);
          const paymentResult = await StripePaymentService.createPaymentLinkForQuote(quoteId);
          
          if (!paymentResult.success) {
            console.error('[HandleQuoteChoice] Failed to create payment link:', paymentResult.error);
            return {
              ...currentGoalData,
              paymentError: true,
              confirmationMessage: 'Sorry, there was an issue setting up payment. Please contact us directly to complete your booking.'
            };
          }

          console.log('[HandleQuoteChoice] Payment link created successfully');
          
          // Get business info for personalization
          const businessId = chatContext.currentParticipant.associatedBusinessId;
          let businessName = 'the business';
          if (businessId) {
            try {
              const business = await Business.getById(businessId);
              businessName = business.name;
            } catch (error) {
              console.warn('[HandleQuoteChoice] Could not fetch business name');
            }
          }

          const { getUserLanguage } = await import('./booking-utils');
          const language = getUserLanguage(chatContext);
          
          // Get balance breakdown from Quote model or goal data
          const serviceTotal = currentGoalData.selectedService?.fixedPrice || 0;
          const remainingBalance = currentGoalData.remainingBalance || currentGoalData.bookingSummary?.remainingBalance || (serviceTotal - depositAmount);
          
          // Get business info for payment method and type
          let preferredPaymentMethod = language === 'es' ? 'efectivo o tarjeta' : 'cash or card';
          let businessType = 'unknown';
          
          if (businessId) {
            try {
              const business = await Business.getById(businessId);
              if (business.preferredPaymentMethod) {
                preferredPaymentMethod = business.preferredPaymentMethod;
              }
              businessType = business.businessCategory || 'unknown';
            } catch (error) {
              console.warn('[HandleQuoteChoice] Could not fetch business payment method');
            }
          }
          
          const customerName = currentGoalData.customerName || '{name}';
          
          // Use "Estimate Remaining Balance" for removalists
          const isRemovalist = businessType?.toLowerCase() === 'removalist';
          const remainingBalanceLabel = language === 'es' 
            ? (isRemovalist ? 'Balance restante estimado' : 'Balance restante')
            : (isRemovalist ? 'Estimate Remaining Balance' : 'Remaining balance');
          
          const paymentMessage = language === 'es' 
            ? `💳 *¡Listo para Reservar!*\n\n` +
              `Para asegurar tu cita, por favor completa el pago del depósito de reserva:\n\n` +
              `💰 *Desglose del Pago:*\n` +
              `   • Servicio total: $${serviceTotal.toFixed(2)}\n` +
              `   • Depósito (ahora): $${depositAmount.toFixed(2)}\n` +
              `   • Tarifa de reserva: $4.00\n` +
              `   • *Total a pagar ahora: $${totalChargeAmount.toFixed(2)}*\n\n` +
              `📍 *${remainingBalanceLabel}: $${remainingBalance.toFixed(2)}*\n` +
              `   💳 A pagar en la cita (${preferredPaymentMethod})\n\n` +
              `🔗 *Enlace de Pago:*\n${paymentResult.paymentLink}\n\n` +
              `¡Después del pago, serás redirigido de vuelta a WhatsApp y tu reserva será confirmada automáticamente!\n\n` +
              `✅ Pago seguro y protegido por Stripe\n` +
              `🔒 Tu pago va directamente a ${businessName}`
            : `💳 *Ready to Book!*\n\n` +
              `To secure your appointment, please complete your booking deposit payment:\n\n` +
              `💰 *Payment Breakdown:*\n` +
              `   • Service total: $${serviceTotal.toFixed(2)}\n` +
              `   • Deposit (now): $${depositAmount.toFixed(2)}\n` +
              `   • Booking fee: $4.00\n` +
              `   • *Total to pay now: $${totalChargeAmount.toFixed(2)}*\n\n` +
              `📍 *${remainingBalanceLabel}: $${remainingBalance.toFixed(2)}*\n` +
              `   💳 Pay at appointment (${preferredPaymentMethod})\n\n` +
              `🔗 *Payment Link:*\n${paymentResult.paymentLink}\n\n` +
              `After payment, you'll be redirected back to WhatsApp and your booking will be confirmed automatically!\n\n` +
              `✅ Safe & secure payment powered by Stripe\n` +
              `🔒 Your payment goes directly to ${businessName}`;

          return {
            ...currentGoalData,
            paymentLinkGenerated: true,
            paymentLink: paymentResult.paymentLink,
            paymentError: false, // Clear any previous payment errors
            shouldAutoAdvance: false, // Don't auto-advance, wait for payment
            confirmationMessage: paymentMessage
          };

        } catch (error) {
          console.error('[HandleQuoteChoice] Error creating payment link:', error);
          return {
            ...currentGoalData,
            paymentError: true,
            confirmationMessage: 'Sorry, there was an issue setting up payment. Please contact us directly to complete your booking.'
          };
        }
      } else {
        // No deposit required - proceed directly to booking creation
        console.log('[HandleQuoteChoice] Quote confirmed - no deposit required, proceeding to booking creation');
        return {
          ...currentGoalData,
          quoteConfirmedFromSummary: true,
          shouldAutoAdvance: true, // Auto-advance to createBooking step
          confirmationMessage: 'Perfect! Your quote is confirmed. Creating your booking...'
        };
      }
    }
    
    if (validatedInput === 'edit_quote') {
      console.log('[HandleQuoteChoice] Edit requested - showing edit options');
      return {
        ...currentGoalData,
        showEditOptions: true,
        shouldAutoAdvance: false, // Don't auto-advance, stay to show edit options
        confirmationMessage: 'What would you like to change?'
      };
    }
    
    // Handle specific edit choices
    if (validatedInput === 'edit_service') {
      console.log('[HandleQuoteChoice] Service edit requested - navigating back to selectService');
      return {
        ...currentGoalData,
        navigateBackTo: 'selectService',
        shouldAutoAdvance: true, // Auto-advance to navigate back
        confirmationMessage: 'Let\'s choose a different service...'
      };
    }
    
    if (validatedInput === 'edit_time') {
      console.log('[HandleQuoteChoice] Time edit requested - navigating back to showAvailableTimes');
      return {
        ...currentGoalData,
        navigateBackTo: 'showAvailableTimes',
        shouldAutoAdvance: true, // Auto-advance to navigate back
        confirmationMessage: 'Let\'s pick a different time...'
      };
    }
    
    if (validatedInput === 'edit_pickup_address') {
      console.log('[HandleQuoteChoice] Pickup address edit requested - navigating back to askPickupAddress');
      return {
        ...currentGoalData,
        navigateBackTo: 'askPickupAddress',
        shouldAutoAdvance: true, // Auto-advance to navigate back
        confirmationMessage: 'Let\'s update your pickup address...'
      };
    }

    if (validatedInput === 'edit_dropoff_address') {
      console.log('[HandleQuoteChoice] Dropoff address edit requested - navigating back to askDropoffAddress');
      return {
        ...currentGoalData,
        navigateBackTo: 'askDropoffAddress',
        shouldAutoAdvance: true, // Auto-advance to navigate back
        confirmationMessage: 'Let\'s update your dropoff address...'
      };
    }
    
    // Handle payment completion
    if (validatedInput && validatedInput.startsWith('PAYMENT_COMPLETED_')) {
      console.log('[HandleQuoteChoice] Payment completion detected - advancing to booking creation');
      const quoteId = validatedInput.replace('PAYMENT_COMPLETED_', '');
      console.log(`[HandleQuoteChoice] Payment completed for quote: ${quoteId}`);
      
      return {
        ...currentGoalData,
        paymentCompleted: true,
        paymentLinkGenerated: false, // Clear payment link state
        shouldAutoAdvance: true, // Auto-advance to createBooking step
        confirmationMessage: 'Payment received! Creating your booking...'
      };
    }
    
    console.log('[HandleQuoteChoice] Unexpected input, returning current data');
    return currentGoalData;
  },
  
  // Show edit options if user chose to edit, or no buttons if payment link was generated
  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.paymentError) {
      return [
        { buttonText: getLocalizedText(chatContext, 'BUTTONS.TRY_AGAIN'), buttonValue: 'confirm_quote' },
        { buttonText: getLocalizedText(chatContext, 'BUTTONS.EDIT'), buttonValue: 'edit_quote' }
      ];
    }

    if (currentGoalData.paymentLinkGenerated) {
      // No buttons needed - user should click the payment link
      return [];
    }

    if (currentGoalData.showEditOptions) {
      // Check if any selected services are mobile to determine if address editing is relevant
      const selectedServices = currentGoalData.selectedServices || 
                              (currentGoalData.selectedService ? [currentGoalData.selectedService] : []);
      const hasMobileServices = selectedServices.some((service: any) => service?.mobile);
      
      const buttons = [
        { buttonText: getLocalizedText(chatContext, 'BUTTONS.CHANGE_SERVICE'), buttonValue: 'edit_service' },
        { buttonText: getLocalizedText(chatContext, 'BUTTONS.CHANGE_TIME'), buttonValue: 'edit_time' }
      ];
      
      // Only add address buttons for mobile services (pickup and dropoff separately)
      if (hasMobileServices) {
        buttons.push({ buttonText: getLocalizedText(chatContext, 'BUTTONS.CHANGE_PICKUP'), buttonValue: 'edit_pickup_address' });
        buttons.push({ buttonText: getLocalizedText(chatContext, 'BUTTONS.CHANGE_DROPOFF'), buttonValue: 'edit_dropoff_address' });
      }
      
      return buttons;
    }
    
    // No buttons if quote confirmed or navigating back
    return [];
  }
};
