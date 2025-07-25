import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, MessageComponentBuilder } from './booking-utils';
import { Service } from '@/lib/database/models/service';
import { Business } from '@/lib/database/models/business';
import { Quote, type QuoteData } from '@/lib/database/models/quote';
import { computeQuoteEstimation, type QuoteEstimation } from '@/lib/general-helpers/quote-cost-calculator';
import { createLogger } from '@/lib/bot-engine/utils/logger';

const QuoteSummaryLogger = createLogger('QuoteSummary');

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface QuoteTemplateData {
  customerName: string;
  services: any[];
  quoteEstimation: any;
  currentGoalData: any;
  paymentDetails: any;
  businessInfo: any;
  language: string;
  quoteId: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MINIMAL_TRAVEL_TIME = 5; // minutes for same location

// =============================================================================
// CORE BUSINESS LOGIC
// =============================================================================

class QuoteProcessor {
  static async processQuote(currentGoalData: any, businessId: string, chatContext: any): Promise<any> {
    const { shouldUpdate, existingQuote } = await this.shouldUpdateExistingQuote(currentGoalData);
    const services = this.getServicesFromGoalData(currentGoalData);
    
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
      QuoteSummaryLogger.info('Updating existing quote', {}, { quoteId: existingQuote.id });
      quote = await this.updateQuote(existingQuote.id, currentGoalData, businessId);
    } else if (currentGoalData.persistedQuote) {
      // Use existing quote (no changes)
      QuoteSummaryLogger.info('Reusing existing quote', {}, { quoteId: currentGoalData.persistedQuote.id });
      quote = currentGoalData.persistedQuote;
    } else {
      // Create new quote
      QuoteSummaryLogger.info('Creating new quote', {}, { reason: 'no_existing_quote' });
      quote = await this.createQuote(currentGoalData, businessId);
    }
    
    // Calculate quote estimation for any scenario
    quoteEstimation = await QuoteCalculator.calculate(services, businessId, currentGoalData);
    
    return { quote, quoteEstimation, services };
  }

  private static getServicesFromGoalData(currentGoalData: any): any[] {
    return currentGoalData.selectedServices || 
           (currentGoalData.selectedService ? [currentGoalData.selectedService] : []);
  }

  private static async shouldUpdateExistingQuote(currentGoalData: any): Promise<{ shouldUpdate: boolean; existingQuote?: any }> {
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

    // Compare services and addresses
    const currentServices = this.getServicesFromGoalData(currentGoalData);
    const currentServiceIds = currentServices.map((s: any) => s.id).filter(Boolean).sort();
    const existingServiceIds = (existingQuote.serviceIds || []).sort();
    
    const servicesChanged = JSON.stringify(currentServiceIds) !== JSON.stringify(existingServiceIds);
    
    const currentPickup = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress;
    const currentDropoff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress;
    const addressChanged = existingQuote.pickUp !== currentPickup || existingQuote.dropOff !== currentDropoff;
    
    const shouldUpdate = servicesChanged || addressChanged;
    
    QuoteSummaryLogger.info('Quote update decision', {}, {
      servicesChanged,
      addressChanged,
      shouldUpdate,
      currentServiceIds,
      existingServiceIds
    });
    
    return { shouldUpdate, existingQuote };
  }

  private static async updateQuote(quoteId: string, currentGoalData: any, businessId: string): Promise<any> {
    const services = this.getServicesFromGoalData(currentGoalData);
    const quoteEstimation = await QuoteCalculator.calculate(services, businessId, currentGoalData);
    const businessAddress = await BusinessHelper.getAddress(businessId);
    const updatedQuoteData = QuoteDataBuilder.build(services, quoteEstimation, currentGoalData, businessAddress, businessId);
    
    const updatedQuote = await Quote.update(quoteId, updatedQuoteData, { useServiceRole: true });
    
    QuoteSummaryLogger.info('Quote updated successfully', {}, { 
      quoteId: updatedQuote.id,
      serviceCount: services.length
    });

    return updatedQuote;
  }

  private static async createQuote(currentGoalData: any, businessId: string): Promise<any> {
    const services = this.getServicesFromGoalData(currentGoalData);
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
      const service = this.createServiceInstance(serviceData, businessId);
      const serviceQuote = computeQuoteEstimation(service, 0);
      
      totalServiceCost += serviceQuote.serviceCost;
      totalDuration += serviceData.durationEstimate || 0;
      
      if (serviceData.mobile) {
        hasMobileService = true;
      }
    }

    // Calculate travel cost for mobile services
    const { travelCost, travelTime } = hasMobileService 
      ? await this.calculateTravelCost(services, currentGoalData, businessId)
      : { travelCost: 0, travelTime: 0 };
    
    totalDuration += travelTime;

    return {
      serviceCost: totalServiceCost,
      travelCost,
      totalJobCost: totalServiceCost + travelCost,
      totalJobDuration: totalDuration,
      travelTime
    };
  }

  private static createServiceInstance(serviceData: any, businessId: string): Service {
    return new Service({
      id: serviceData.id,
      name: serviceData.name,
      durationEstimate: serviceData.durationEstimate,
      fixedPrice: serviceData.fixedPrice,
      pricingType: serviceData.pricingType,
      mobile: serviceData.mobile,
      ratePerMinute: serviceData.ratePerMinute,
      baseCharge: serviceData.baseCharge,
      businessId: serviceData.businessId || businessId
    });
  }

  private static async calculateTravelCost(services: any[], currentGoalData: any, businessId: string): Promise<{ travelCost: number; travelTime: number }> {
    const firstMobileService = services.find(s => s.mobile);
    if (!firstMobileService) return { travelCost: 0, travelTime: 0 };

    const pickUp = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress;
    const dropOff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress;
    
    // Also check raw input addresses before Google formatting
    const rawPickup = currentGoalData.pickupAddress;
    const rawDropoff = currentGoalData.dropoffAddress;
    
    console.log('[QuoteCalculator] Travel cost calculation:', {
      pickUp,
      dropOff,
      rawPickup,
      rawDropoff,
      sameFormatted: pickUp === dropOff,
      sameRawInput: rawPickup === rawDropoff
    });
    
    // Check if addresses are missing or the same (either formatted or raw input)
    if (!pickUp || !dropOff || pickUp === dropOff || rawPickup === rawDropoff) {
      console.log('[QuoteCalculator] Same address detected - no travel cost');
      return { travelCost: 0, travelTime: MINIMAL_TRAVEL_TIME };
    }

    try {
      const { fetchDirectGoogleMapsDistance } = await import('@/lib/general-helpers/google-distance-calculator');
      const mapsData = await fetchDirectGoogleMapsDistance(pickUp, dropOff);
      
      if (mapsData.status !== 'OK' || !mapsData.rows?.[0]?.elements?.[0] || mapsData.rows[0].elements[0].status !== 'OK') {
        throw new Error(`Google Maps API error: ${mapsData.status}`);
      }
      
      const travelTime = Math.ceil(mapsData.rows[0].elements[0].duration.value / 60);
      const tempService = this.createServiceInstance(firstMobileService, businessId);
      const travelQuote = computeQuoteEstimation(tempService, travelTime);
      
      console.log('[QuoteCalculator] Travel cost calculated:', {
        travelTime,
        travelCost: travelQuote.travelCost
      });
      
      return { travelCost: travelQuote.travelCost, travelTime };
      
    } catch (error) {
      QuoteSummaryLogger.error('Travel calculation failed', {}, { 
        error: error instanceof Error ? error.message : String(error)
      });
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
  static async getInfo(businessId: string): Promise<{ type: string; businessCategory: string; paymentMethod?: string; address: string; depositPercentage?: number; bookingFee?: number; businessAddress?: string; preferredPaymentMethod?: string }> {
    try {
      const business = await Business.getById(businessId);
      return {
        type: business.businessCategory || 'unknown',
        businessCategory: business.businessCategory || 'unknown',
        paymentMethod: business.preferredPaymentMethod,
        address: business.businessAddress || business.name || 'Business Location',
        depositPercentage: business.depositPercentage,
        bookingFee: business.bookingFee,
        businessAddress: business.businessAddress,
        preferredPaymentMethod: business.preferredPaymentMethod
      };
    } catch (error) {
      QuoteSummaryLogger.warn('Could not fetch business info', {}, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { type: 'unknown', businessCategory: 'unknown', address: 'Business Location' };
    }
  }

  static async getAddress(businessId: string): Promise<string> {
    const info = await this.getInfo(businessId);
    return info.address;
  }
}

class QuoteTemplateRenderer {
  static generateQuoteMessage(data: QuoteTemplateData): string {
    const { businessInfo, language } = data;
    const { BOOKING_TRANSLATIONS } = require('./booking-utils');
    const t = BOOKING_TRANSLATIONS[language];
    
    // Determine business type and service configuration
    const businessType = this.getBusinessType(businessInfo, data.services);
    const hasMobileService = data.services.some(s => s.mobile);
    const hasPerMinuteService = data.services.some(s => s.pricingType === 'per_minute');
    
    let message = `${t.QUOTE_TEMPLATES.TITLE}\n\n`;
    
    // Build job details section
    message += this.buildJobDetailsSection(businessType, data, language);
    message += '\n';
    
    // Build breakdown durations (only for per-minute services)
    if (hasPerMinuteService) {
      message += this.buildBreakdownDurationsSection(data, language);
      message += '\n';
    }
    
    // Build breakdown costs
    message += this.buildBreakdownCostsSection(data, language);
    // Note: buildBreakdownCosts already ends with \n\n, no need to add more
    
    // Build date/time section
    message += this.buildDateTimeSection(data, language);
    message += '\n';
    
    // Build payment breakdown (if deposit required)
    if (data.paymentDetails.requiresDeposit && data.paymentDetails.depositAmount) {
      message += this.buildPaymentBreakdownSection(data, businessType, language);
      message += '\n';
    }
    
    // Add quote ID and confirmation prompt
    message += `${t.QUOTE_TEMPLATES.QUOTE_ID.replace('{id}', data.quoteId)}\n\n`;
    message += data.paymentDetails.requiresDeposit && data.paymentDetails.depositAmount
      ? t.QUOTE_TEMPLATES.CONFIRM_WITH_DEPOSIT
      : t.QUOTE_TEMPLATES.CONFIRM_NO_DEPOSIT;
    
    return message;
  }
  
  private static getBusinessType(businessInfo: any, services: any[]): 'removalist' | 'mobile' | 'non_mobile' {
    if (businessInfo.type === 'removalist' || businessInfo.businessCategory === 'removalist') {
      return 'removalist';
    }
    
    const hasMobileService = services.some(s => s.mobile);
    return hasMobileService ? 'mobile' : 'non_mobile';
  }
  
  private static buildJobDetailsSection(businessType: 'removalist' | 'mobile' | 'non_mobile', data: QuoteTemplateData, language: string): string {
    const addresses = {
      pickup: data.currentGoalData.finalServiceAddress || data.currentGoalData.pickupAddress,
      dropoff: data.currentGoalData.finalDropoffAddress || data.currentGoalData.dropoffAddress,
      customer: data.currentGoalData.finalServiceAddress || data.currentGoalData.customerAddress,
      business: data.businessInfo.businessAddress
    };
    
    return MessageComponentBuilder.buildJobDetails(businessType, data.services, addresses, language);
  }
  
  private static buildBreakdownDurationsSection(data: QuoteTemplateData, language: string): string {
    const { quoteEstimation } = data;
    const labourTime = quoteEstimation.totalJobDuration - (quoteEstimation.travelTime || 0);
    
    return MessageComponentBuilder.buildBreakdownDurations(
      quoteEstimation.travelTime || 0,
      labourTime,
      quoteEstimation.totalJobDuration,
      language
    );
  }
  
  private static buildBreakdownCostsSection(data: QuoteTemplateData, language: string): string {
    const { services, quoteEstimation } = data;
    
    // Determine if any service uses per-minute pricing
    const hasPerMinuteService = services.some(s => s.pricingType === 'per_minute');
    const pricingType = hasPerMinuteService ? 'per_minute' : 'fixed_price';
    
    const costs = {
      labour: quoteEstimation.serviceCost,
      travel: quoteEstimation.travelCost || 0,
      total: quoteEstimation.totalJobCost
    };
    
    return MessageComponentBuilder.buildBreakdownCosts(pricingType, costs, language);
  }
  
  private static buildDateTimeSection(data: QuoteTemplateData, language: string): string {
    const { currentGoalData, quoteEstimation } = data;
    
    if (!currentGoalData.selectedDate || !currentGoalData.selectedTime) {
      return ''; // Skip if date/time not set yet
    }
    
    // Format the date properly
    const selectedDate = new Date(currentGoalData.selectedDate);
    const formattedDate = selectedDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    return MessageComponentBuilder.buildDateTime(
      formattedDate,
      currentGoalData.selectedTime,
      quoteEstimation.totalJobDuration,
      true, // Show completion time
      language
    );
  }
  
  private static buildPaymentBreakdownSection(data: QuoteTemplateData, businessType: string, language: string): string {
    const { paymentDetails, quoteEstimation, businessInfo, services } = data;
    
    // Get the correct deposit percentage from business info
    const depositPercentage = businessInfo.depositPercentage || 0;
    
    const deposit = paymentDetails.depositAmount > 0 ? {
      percentage: depositPercentage,
      amount: paymentDetails.depositAmount
    } : null;
    
    const businessTypeForPayment = businessType === 'removalist' ? 'removalist' : 'salon';
    
    // Check if any service uses per-minute pricing
    const hasPerMinuteService = services.some(s => s.pricingType === 'per_minute');
    
    return MessageComponentBuilder.buildPaymentBreakdown(
      quoteEstimation.totalJobCost,
      deposit,
      businessInfo.bookingFee || 0,
      businessInfo.preferredPaymentMethod || 'cash',
      businessTypeForPayment,
      language,
      hasPerMinuteService
    );
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
      QuoteSummaryLogger.warn('Could not calculate payment details', {}, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { requiresDeposit: false };
    }
  }
}

class MessageGenerator {
  static async generate(services: any[], quoteEstimation: QuoteEstimation, quote: any, currentGoalData: any, chatContext: any): Promise<string> {
    const { getUserLanguage } = await import('./booking-utils');
    const language = getUserLanguage(chatContext);
    const businessInfo = await BusinessHelper.getInfo(chatContext.currentParticipant?.associatedBusinessId);
    const paymentDetails = await PaymentCalculator.getDetails(quote.id);
    
    // Prepare data for template renderer
    const templateData: QuoteTemplateData = {
      customerName: currentGoalData.customerName || 'Customer',
      services,
      quoteEstimation,
      currentGoalData,
      paymentDetails,
      businessInfo,
      language,
      quoteId: quote.id
    };
    
    // Generate message using appropriate template
    return QuoteTemplateRenderer.generateQuoteMessage(templateData);
  }
}

class BookingSummaryBuilder {
  static build(services: any[], quoteEstimation: QuoteEstimation, paymentDetails: any, businessBookingFee: number = 0): any {
    return {
      serviceCost: quoteEstimation.serviceCost,
      travelCost: quoteEstimation.travelCost,
      totalCost: quoteEstimation.totalJobCost,
      duration: quoteEstimation.totalJobDuration,
      travelTime: quoteEstimation.travelTime,
      ...paymentDetails,
      totalPaymentAmount: paymentDetails.requiresDeposit && paymentDetails.depositAmount 
        ? paymentDetails.depositAmount + businessBookingFee 
        : undefined,
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
// MAIN HANDLER
// =============================================================================

export const quoteSummaryHandler: IndividualStepHandler = {
  validateUserInput: async (userInput, currentGoalData) => {
    // Accept empty input for first display
    if (!userInput || userInput === "") {
      return { isValidInput: true };
    }
    
    // Accept edit_quote button clicks to handle internally
    if (userInput === 'edit_quote') {
      return { isValidInput: true };
    }
    
    // Accept edit option selections
    if (userInput === 'edit_service' || userInput === 'edit_time' || userInput === 'edit_pickup_address' || userInput === 'edit_dropoff_address') {
      return { isValidInput: true };
    }
    
    // Reject confirm_quote button clicks to pass to next step
    if (userInput === 'confirm_quote') {
      return { isValidInput: false, validationErrorMessage: '' };
    }
    
    // Accept service ID selections (for service changes)
    if (UUID_REGEX.test(userInput)) {
      return { isValidInput: true };
    }
    
    return { 
      isValidInput: false,
      validationErrorMessage: 'Please use the buttons below to confirm or edit your quote.' 
    };
  },

  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    const businessId = chatContext.currentParticipant?.associatedBusinessId;
    
    QuoteSummaryLogger.flow('Quote summary processing started', {}, { 
      hasExistingQuote: !!currentGoalData.persistedQuote,
      serviceCount: (currentGoalData.selectedServices || []).length,
      businessIdFound: !!businessId
    });

    // Handle service changes (restart flow)
    if (validatedInput && UUID_REGEX.test(validatedInput)) {
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

    // Handle edit_quote button - show edit options without advancing steps
    if (validatedInput === 'edit_quote') {
      return {
        ...currentGoalData,
        showEditOptions: true,
        shouldAutoAdvance: false,
        confirmationMessage: 'What would you like to change?'
      };
    }

    // Handle specific edit choices - navigate back to appropriate steps
    if (validatedInput === 'edit_service') {
      return {
        ...currentGoalData,
        navigateBackTo: 'selectService',
        showEditOptions: false,
        shouldAutoAdvance: true,
        confirmationMessage: 'Let\'s choose a different service...'
      };
    }
    
    if (validatedInput === 'edit_time') {
      return {
        ...currentGoalData,
        navigateBackTo: 'showAvailableTimes',
        showEditOptions: false,
        // Clear timing data to force re-selection
        selectedDate: undefined,
        selectedTime: undefined,
        availableSlots: undefined,
        shouldAutoAdvance: true,
        confirmationMessage: 'Let\'s choose a different time...'
      };
    }
    
    if (validatedInput === 'edit_pickup_address') {
      return {
        ...currentGoalData,
        navigateBackTo: 'askPickupAddress',
        showEditOptions: false,
        // Clear pickup-related data
        pickupAddress: undefined,
        finalServiceAddress: undefined,
        pickupAddressValidated: false,
        shouldAutoAdvance: true,
        confirmationMessage: 'Let\'s update your pickup address...'
      };
    }
    
    if (validatedInput === 'edit_dropoff_address') {
      return {
        ...currentGoalData,
        navigateBackTo: 'askDropoffAddress', 
        showEditOptions: false,
        // Clear dropoff-related data
        dropoffAddress: undefined,
        finalDropoffAddress: undefined,
        dropoffAddressValidated: false,
        shouldAutoAdvance: true,
        confirmationMessage: 'Let\'s update your dropoff address...'
      };
    }

    // Return existing data if not empty input
    if (validatedInput !== "") {
      return currentGoalData;
    }

    try {
      // Check business ID and use proper translation for error
      if (!businessId) {
        QuoteSummaryLogger.error('Business ID missing from context', {}, {
          hasCurrentParticipant: !!chatContext.currentParticipant,
          associatedBusinessId: chatContext.currentParticipant?.associatedBusinessId
        });
        
        const customerName = currentGoalData.customerName || '{name}';
        const errorMessage = getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.SYSTEM_ERROR_ADDRESS_VALIDATION', { name: customerName });
        
        return {
          ...currentGoalData,
          summaryError: 'technical_issue',
          confirmationMessage: errorMessage
        };
      }

      // Process the quote (create, update, or reuse)
      const { quote, quoteEstimation, services } = await QuoteProcessor.processQuote(currentGoalData, businessId, chatContext);

      // Get business info for booking fee
      const business = await Business.getById(businessId);
      const businessBookingFee = business?.bookingFee || 0;

      // Get payment details
      const paymentDetails = await PaymentCalculator.getDetails(quote.id);

      // Generate confirmation message
      const confirmationMessage = await MessageGenerator.generate(services, quoteEstimation, quote, currentGoalData, chatContext);

      // Build booking summary
      const bookingSummary = BookingSummaryBuilder.build(services, quoteEstimation, paymentDetails, businessBookingFee);

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
      
      const customerName = currentGoalData.customerName || '{name}';
      const errorMessage = getLocalizedTextWithVars(chatContext, 'ERROR_MESSAGES.SYSTEM_ERROR_ADDRESS_VALIDATION', { name: customerName });
      
      return {
        ...currentGoalData,
        summaryError: 'technical_issue',
        confirmationMessage: errorMessage
      };
    }
  },

  fixedUiButtons: async (currentGoalData, chatContext) => {
    if (currentGoalData.summaryError) {
      return [{ buttonText: getLocalizedText(chatContext, 'BUTTONS.TRY_AGAIN'), buttonValue: 'restart_booking' }];
    }
    
    // Show edit options if user clicked edit
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
