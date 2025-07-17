import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText } from './booking-utils';
import { Service } from '@/lib/database/models/service';
import { Business } from '@/lib/database/models/business';
import { Quote, type QuoteData } from '@/lib/database/models/quote';
import { computeQuoteEstimation, type QuoteEstimation } from '@/lib/general-helpers/quote-cost-calculator';
import { createLogger } from '@/lib/bot-engine/utils/logger';

const QuoteSummaryLogger = createLogger('QuoteSummary');

// =============================================================================
// CORE BUSINESS LOGIC - SEPARATED FOR CLARITY
// =============================================================================

class QuoteManager {
  static async shouldUpdateExistingQuote(currentGoalData: any): Promise<{ shouldUpdate: boolean; existingQuote?: any }> {
    // Simple check: Do we have a pending quote?
    const existingQuote = currentGoalData.persistedQuote;
    
    QuoteSummaryLogger.info('Checking for existing quote', {}, {
      hasExistingQuote: !!existingQuote,
      existingQuoteId: existingQuote?.id,
      existingQuoteStatus: existingQuote?.status
    });
    
    if (!existingQuote || existingQuote.status !== 'pending') {
      QuoteSummaryLogger.info('No valid existing quote found', {}, {
        reason: !existingQuote ? 'no_quote' : 'not_pending_status'
      });
      return { shouldUpdate: false };
    }

    // Compare services: current vs existing
    const currentServices = currentGoalData.selectedServices || 
                           (currentGoalData.selectedService ? [currentGoalData.selectedService] : []);
    const currentServiceIds = currentServices.map((s: any) => s.id).filter(Boolean).sort();
    const existingServiceIds = (existingQuote.serviceIds || []).sort();
    
    const servicesChanged = JSON.stringify(currentServiceIds) !== JSON.stringify(existingServiceIds);
    
    // Also check if time/date changed (should update quote for new times)
    const timeChanged = existingQuote.proposedDateTime && currentGoalData.selectedDate && currentGoalData.selectedTime &&
      (existingQuote.proposedDateTime !== `${currentGoalData.selectedDate}T${currentGoalData.selectedTime}:00`);
    
    const shouldUpdate = servicesChanged || timeChanged;
    
    QuoteSummaryLogger.info('Quote update check', {}, {
      existingQuoteId: existingQuote.id,
      currentServices: currentServiceIds,
      existingServices: existingServiceIds,
      servicesChanged,
      timeChanged,
      shouldUpdate
    });

    return { 
      shouldUpdate,
      existingQuote: shouldUpdate ? existingQuote : null
    };
  }

  static async updateQuote(quoteId: string, currentGoalData: any, businessId: string): Promise<any> {
    const services = currentGoalData.selectedServices || 
                    (currentGoalData.selectedService ? [currentGoalData.selectedService] : []);
    
    // Calculate new quote estimation
    const quoteEstimation = await QuoteCalculator.calculate(services, businessId, currentGoalData);
    
    // Create updated quote data
    const businessAddress = await BusinessHelper.getAddress(businessId);
    const updatedQuoteData = QuoteDataBuilder.build(services, quoteEstimation, currentGoalData, businessAddress, businessId);
    
    // Update in database
    const updatedQuote = await Quote.update(quoteId, updatedQuoteData, { useServiceRole: true });
    
    QuoteSummaryLogger.info('Quote updated successfully', {}, { 
      quoteId: updatedQuote.id,
      serviceCount: services.length
    });

    return updatedQuote;
  }

  static async createQuote(currentGoalData: any, businessId: string): Promise<any> {
    const services = currentGoalData.selectedServices || 
                    (currentGoalData.selectedService ? [currentGoalData.selectedService] : []);
    
    const quoteEstimation = await QuoteCalculator.calculate(services, businessId, currentGoalData);
    const businessAddress = await BusinessHelper.getAddress(businessId);
    const quoteData = QuoteDataBuilder.build(services, quoteEstimation, currentGoalData, businessAddress, businessId);
    
    const hasMobileService = services.some((s: any) => s.mobile);
    const quote = new Quote(quoteData, hasMobileService);
    const savedQuote = await quote.add({ useServiceRole: true });
    
    QuoteSummaryLogger.info('Quote created successfully', {}, { 
      quoteId: savedQuote.id,
      serviceCount: services.length
    });

    return savedQuote;
  }
}

class QuoteCalculator {
  static async calculate(services: any[], businessId: string, currentGoalData: any): Promise<QuoteEstimation> {
    let totalServiceCost = 0;
    let totalDuration = 0;
    let hasMobileService = false;
    
    // Calculate service costs
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

    // Calculate travel cost for mobile services
    let travelCost = 0;
    let travelTime = 0;
    
    if (hasMobileService) {
      const travelResult = await this.calculateTravelCost(services, currentGoalData);
      travelCost = travelResult.cost;
      travelTime = travelResult.time;
      totalDuration += travelTime;
    }

    return {
      serviceCost: totalServiceCost,
      travelCost,
      totalJobCost: totalServiceCost + travelCost,
      totalJobDuration: totalDuration,
      travelTime
    };
  }

  private static async calculateTravelCost(services: any[], currentGoalData: any): Promise<{ cost: number; time: number }> {
    const firstMobileService = services.find(s => s.mobile);
    if (!firstMobileService) return { cost: 0, time: 0 };

    const pickUp = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress;
    const dropOff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress;
    
    if (!pickUp || !dropOff || pickUp === dropOff) {
      return { cost: 0, time: 5 }; // Minimal time for same location
    }

    try {
      const { fetchDirectGoogleMapsDistance } = await import('@/lib/general-helpers/google-distance-calculator');
      const mapsData = await fetchDirectGoogleMapsDistance(pickUp, dropOff);
      
      if (mapsData.status !== 'OK' || !mapsData.rows?.[0]?.elements?.[0] || mapsData.rows[0].elements[0].status !== 'OK') {
        throw new Error(`Google Maps API error: ${mapsData.status}`);
      }
      
      const travelTime = Math.ceil(mapsData.rows[0].elements[0].duration.value / 60);
      
      const tempService = new Service({
        id: firstMobileService.id,
        name: firstMobileService.name,
        durationEstimate: 0,
        fixedPrice: 0,
        pricingType: firstMobileService.pricingType,
        mobile: firstMobileService.mobile,
        ratePerMinute: firstMobileService.ratePerMinute,
        baseCharge: firstMobileService.baseCharge,
        businessId: firstMobileService.businessId
      });
      
      const travelQuote = computeQuoteEstimation(tempService, travelTime);
      return { cost: travelQuote.travelCost, time: travelTime };
      
    } catch (error) {
      QuoteSummaryLogger.error('Travel calculation failed', {}, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}

class QuoteDataBuilder {
  static build(services: any[], quoteEstimation: QuoteEstimation, currentGoalData: any, businessAddress: string, businessId: string): QuoteData {
    const pickUp = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress || businessAddress;
    const dropOff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress || businessAddress;
    
    return {
      userId: currentGoalData.userId,
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
  }
}

class BusinessHelper {
  static async getInfo(businessId: string): Promise<{ type: string; paymentMethod?: string; address: string }> {
    try {
      const business = await Business.getById(businessId);
      return {
        type: business.businessCategory || 'unknown',
        paymentMethod: business.preferredPaymentMethod,
        address: business.businessAddress || business.name || 'Business Location'
      };
    } catch (error) {
      QuoteSummaryLogger.warn('Could not fetch business info', {}, { error: error instanceof Error ? error.message : String(error) });
      return { type: 'unknown', address: 'Business Location' };
    }
  }

  static async getAddress(businessId: string): Promise<string> {
    const info = await this.getInfo(businessId);
    return info.address;
  }
}

class PaymentCalculator {
  static async getDetails(quoteId: string): Promise<{ depositAmount?: number; remainingBalance?: number; requiresDeposit: boolean }> {
    try {
      const quote = await Quote.getById(quoteId);
      const paymentDetails = await quote.calculatePaymentDetails();
      
      return {
        depositAmount: paymentDetails.depositAmount,
        remainingBalance: paymentDetails.remainingBalance,
        requiresDeposit: (paymentDetails.depositAmount ?? 0) > 0
      };
    } catch (error) {
      QuoteSummaryLogger.warn('Could not calculate payment details', {}, { error: error instanceof Error ? error.message : String(error) });
      return { requiresDeposit: false };
    }
  }
}

class MessageGenerator {
  static async generate(services: any[], quoteEstimation: QuoteEstimation, quote: any, currentGoalData: any, chatContext: any): Promise<string> {
    const { getUserLanguage, BOOKING_TRANSLATIONS } = await import('./booking-utils');
    const language = getUserLanguage(chatContext);
    const translations = BOOKING_TRANSLATIONS[language] || BOOKING_TRANSLATIONS['en'];
    
    const businessInfo = await BusinessHelper.getInfo(chatContext.currentParticipant?.associatedBusinessId);
    const paymentDetails = await PaymentCalculator.getDetails(quote.id);
    
    // Generate base message
    let message = this.createBaseMessage(services, quoteEstimation, currentGoalData, businessInfo.type);
    
    // Add payment details
    message = this.addPaymentDetails(message, paymentDetails, language, businessInfo.type, businessInfo.paymentMethod);
    
    // Add quote ID and prompt
    message += `\n📄 Quote ID: ${quote.id}\n\n`;
    
    if (paymentDetails.requiresDeposit && paymentDetails.depositAmount) {
      const readyPrompt = language === 'es' ? '🔒 ¿Listo para asegurar tu reserva?' : '🔒 Ready to secure your booking?';
      message += readyPrompt;
    } else {
      message += `✅ Would you like to confirm this quote?`;
    }
    
    return message;
  }

  private static createBaseMessage(services: any[], quoteEstimation: QuoteEstimation, currentGoalData: any, businessType: string): string {
    const customerName = currentGoalData.customerName || 'Customer';
    const selectedDate = currentGoalData.selectedDate;
    const selectedTime = currentGoalData.selectedTime;
    
    // Format date and time
    const dateObj = new Date(selectedDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    const formattedTime = this.formatTime(selectedTime);
    const estimatedEndTime = this.calculateEndTime(selectedTime, quoteEstimation.totalJobDuration);
    
    let message = `📋 ${customerName}, here's your Booking Quote Summary\n\n`;
    
    // Services section
    if (services.length === 1) {
      const service = services[0];
      message += `💼 Service:\n   ${service.name} - $${service.fixedPrice.toFixed(2)}`;
      if (quoteEstimation.travelCost > 0) {
        message += `\n🚗 Travel: $${quoteEstimation.travelCost.toFixed(2)}`;
      }
      message += `\n💰 Total Cost: $${quoteEstimation.totalJobCost.toFixed(2)}`;
    } else {
      message += `💼 Services:\n`;
      services.forEach((service, index) => {
        message += `   ${index + 1}. ${service.name} - $${service.fixedPrice.toFixed(2)}\n`;
      });
      if (quoteEstimation.travelCost > 0) {
        message += `🚗 Travel: $${quoteEstimation.travelCost.toFixed(2)}\n`;
      }
      message += `💰 Total Cost: $${quoteEstimation.totalJobCost.toFixed(2)}`;
    }
    
    // Date and time
    message += `\n\n📅 Date: ${formattedDate}\n`;
    message += `⏰ Time: ${formattedTime} (${quoteEstimation.totalJobDuration} minutes)\n`;
    message += `🏁 Estimated completion: ${estimatedEndTime}`;
    
    return message;
  }

  private static addPaymentDetails(message: string, paymentDetails: any, language: string, businessType: string, preferredPaymentMethod?: string): string {
    if (!paymentDetails.requiresDeposit || !paymentDetails.depositAmount || paymentDetails.depositAmount <= 0) {
      return message;
    }
    
    const bookingFee = 4;
    const totalPayNow = paymentDetails.depositAmount + bookingFee;
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
    message += `   • ${labels.deposit}: $${paymentDetails.depositAmount.toFixed(2)}\n`;
    message += `   • ${labels.bookingFee}: $${bookingFee.toFixed(2)}\n`;
    message += `   • ${labels.payNow}: $${totalPayNow.toFixed(2)}\n`;
    
    if (paymentDetails.remainingBalance !== undefined && paymentDetails.remainingBalance >= 0) {
      const paymentMethodDisplay = preferredPaymentMethod || (language === 'es' ? 'efectivo/tarjeta' : 'cash/card');
      message += `   • ${labels.balanceDue}: $${paymentDetails.remainingBalance.toFixed(2)} (${paymentMethodDisplay})`;
    }
    
    return message;
  }

  private static formatTime(time24: string): string {
    const [hour24, minute] = time24.split(':');
    const hour12 = parseInt(hour24) === 0 ? 12 : parseInt(hour24) > 12 ? parseInt(hour24) - 12 : parseInt(hour24);
    const ampm = parseInt(hour24) >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minute} ${ampm}`;
  }

  private static calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
  }
}

class BookingSummaryBuilder {
  static build(services: any[], quoteEstimation: QuoteEstimation, paymentDetails: any): any {
    return {
      serviceCost: quoteEstimation.serviceCost,
      travelCost: quoteEstimation.travelCost,
      totalCost: quoteEstimation.totalJobCost,
      duration: quoteEstimation.totalJobDuration,
      travelTime: quoteEstimation.travelTime,
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
  }
}

// =============================================================================
// MAIN HANDLER - NOW CLEAN AND SIMPLE
// =============================================================================

export const quoteSummaryHandler: IndividualStepHandler = {
  validateUserInput: async (userInput, currentGoalData) => {
    // Accept empty input for first display
    if (!userInput || userInput === "") {
      return { isValidInput: true };
    }
    
    // Reject button clicks to pass to next step
    if (userInput === 'confirm_quote' || userInput === 'edit_quote') {
      return { isValidInput: false, validationErrorMessage: '' };
    }
    
    // Accept service ID selections (for service changes)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userInput)) {
      return { isValidInput: true };
    }
    
    return { 
      isValidInput: false,
      validationErrorMessage: 'Please use the buttons below to confirm or edit your quote.' 
    };
  },

  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const businessId = chatContext.currentParticipant?.associatedBusinessId;
    const userId = currentGoalData.userId;
    
    QuoteSummaryLogger.flow('Quote summary processing started', {}, { 
      hasExistingQuote: !!currentGoalData.persistedQuote,
      serviceCount: (currentGoalData.selectedServices || []).length 
    });

    // Handle service changes (restart flow)
    if (validatedInput && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validatedInput)) {
      return {
        ...currentGoalData,
        persistedQuote: undefined,
        quoteId: undefined,
        bookingSummary: undefined,
        restartBookingFlow: true,
        shouldAutoAdvance: true,
        confirmationMessage: 'Let\'s update your service selection...'
      };
    }

    // Return existing data if not empty input
    if (validatedInput !== "") {
      return currentGoalData;
    }

    try {
      // 1. Check if we should update existing quote or create new one
      const { shouldUpdate, existingQuote } = await QuoteManager.shouldUpdateExistingQuote(currentGoalData);
      
      let quote;
      let quoteEstimation;
      
      QuoteSummaryLogger.info('Quote processing decision', {}, {
        shouldUpdate,
        hasExistingQuote: !!existingQuote,
        hasPersistentQuote: !!currentGoalData.persistedQuote,
        action: shouldUpdate && existingQuote ? 'update' : currentGoalData.persistedQuote ? 'reuse' : 'create'
      });
      
      if (shouldUpdate && existingQuote) {
        // Update existing quote
        if (!businessId) {
          QuoteSummaryLogger.error('Cannot update quote: businessId is undefined', {}, { quoteId: existingQuote.id });
          throw new Error('Business ID is required to update quote');
        }
        
        QuoteSummaryLogger.info('Updating existing quote', {}, { quoteId: existingQuote.id });
        quote = await QuoteManager.updateQuote(existingQuote.id, currentGoalData, businessId);
        quoteEstimation = await QuoteCalculator.calculate(
          currentGoalData.selectedServices || [currentGoalData.selectedService], 
          businessId, 
          currentGoalData
        );
      } else if (currentGoalData.persistedQuote) {
        // Use existing quote (no changes)
        if (!businessId) {
          QuoteSummaryLogger.error('Cannot calculate quote: businessId is undefined', {}, { quoteId: currentGoalData.persistedQuote.id });
          throw new Error('Business ID is required to calculate quote');
        }
        
        QuoteSummaryLogger.info('Reusing existing quote', {}, { quoteId: currentGoalData.persistedQuote.id });
        quote = currentGoalData.persistedQuote;
        quoteEstimation = await QuoteCalculator.calculate(
          currentGoalData.selectedServices || [currentGoalData.selectedService], 
          businessId, 
          currentGoalData
        );
      } else {
        // Create new quote
        if (!businessId) {
          QuoteSummaryLogger.error('Cannot create quote: businessId is undefined', {}, { reason: 'no_existing_quote' });
          throw new Error('Business ID is required to create quote');
        }
        
        QuoteSummaryLogger.info('Creating new quote', {}, { reason: 'no_existing_quote' });
        quote = await QuoteManager.createQuote(currentGoalData, businessId);
        quoteEstimation = await QuoteCalculator.calculate(
          currentGoalData.selectedServices || [currentGoalData.selectedService], 
          businessId, 
          currentGoalData
        );
      }

      // 2. Get payment details
      const paymentDetails = await PaymentCalculator.getDetails(quote.id);

      // 3. Generate message
      const services = currentGoalData.selectedServices || [currentGoalData.selectedService];
      const confirmationMessage = await MessageGenerator.generate(services, quoteEstimation, quote, currentGoalData, chatContext);

      // 4. Build booking summary
      const bookingSummary = BookingSummaryBuilder.build(services, quoteEstimation, paymentDetails);

      QuoteSummaryLogger.info('Quote summary completed successfully', {}, { 
        quoteId: quote.id,
        totalCost: quoteEstimation.totalJobCost,
        requiresDeposit: paymentDetails.requiresDeposit
      });

      return {
        ...currentGoalData,
        persistedQuote: quote,
        quoteId: quote.id,
        quoteEstimation,
        bookingSummary,
        ...paymentDetails,
        shouldAutoAdvance: false,
        confirmationMessage
      };

    } catch (error) {
      QuoteSummaryLogger.error('Quote processing failed', {}, { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        ...currentGoalData,
        summaryError: 'Failed to generate quote. Please try again.',
        confirmationMessage: 'Sorry, there was an issue generating your quote. Please try again.'
      };
    }
  },

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
        const payDepositText = language === 'es' ? `💳 $${paymentAmount}` : `💳 Pay $${paymentAmount}`;
        
        return [
          { buttonText: payDepositText, buttonValue: 'confirm_quote' },
          { buttonText: getLocalizedText(chatContext, 'BUTTONS.EDIT'), buttonValue: 'edit_quote' }
        ];
      }
    }
    
    return [
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.CONFIRM'), buttonValue: 'confirm_quote' },
      { buttonText: getLocalizedText(chatContext, 'BUTTONS.EDIT'), buttonValue: 'edit_quote' }
    ];
  }
};
