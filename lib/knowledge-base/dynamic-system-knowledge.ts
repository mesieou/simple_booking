/**
 * Dynamic System Knowledge Generator
 * 
 * This generates business-specific system knowledge based on the business's
 * actual configuration and settings. Unlike static "core" knowledge, this
 * adapts to how each business actually uses Skedy.
 */

import { BusinessCategoryType } from '../config/business-templates';

export interface BusinessConfiguration {
  // Business basics
  businessName: string;
  businessCategory: BusinessCategoryType;
  
  // Service configuration
  services: Array<{
    name: string;
    pricingType: 'fixed' | 'per_minute';
    fixedPrice?: number;
    baseCharge?: number;
    ratePerMinute?: number;
    mobile: boolean;
    durationEstimate: number;
  }>;
  
  // Provider configuration
  numberOfProviders: number;
  allowProviderSelection: boolean; // Most businesses: false
  
  // Payment configuration
  acceptsOnlinePayments: boolean;
  acceptsCash: boolean;
  requiresDeposit: boolean;
  depositPercentage: number;
  
  // Booking configuration
  allowsTextBooking: boolean; // Most businesses: true
  requiresButtonBooking: boolean; // Most businesses: false
  
  // Communication
  whatsappNumber: string;
  responseTimeHours: number;
  
  // Business policies
  operatingHours: string;
  cancellationPolicy: string;
  
  // Location
  businessAddress: string;
  serviceAreas: string[];
  
  // Features
  offersQuotes: boolean;
  offersInstantBooking: boolean;
  hasRealTimeAvailability: boolean;
}

export function generateBusinessSpecificSystemKnowledge(config: BusinessConfiguration): string {
  const { businessName } = config;
  
  let knowledge = `# How ${businessName} Works Through Skedy\n\n`;
  knowledge += `*This knowledge explains how the Skedy system works specifically for ${businessName}.*\n\n`;
  
  // Booking Process
  knowledge += generateBookingProcessKnowledge(config);
  
  // Quote System
  knowledge += generateQuoteSystemKnowledge(config);
  
  // Payment System
  knowledge += generatePaymentSystemKnowledge(config);
  
  // AI Assistant Capabilities
  knowledge += generateAICapabilitiesKnowledge(config);
  
  // Communication
  knowledge += generateCommunicationKnowledge(config);
  
  return knowledge;
}

function generateBookingProcessKnowledge(config: BusinessConfiguration): string {
  const { businessName, allowsTextBooking, requiresButtonBooking, numberOfProviders, allowProviderSelection } = config;
  
  let section = `## How to Book with ${businessName}\n\n`;
  
  if (allowsTextBooking && !requiresButtonBooking) {
    section += `**Q: Can I get quotes just by sending text messages?**\n`;
    section += `A: Yes! With ${businessName}, you can complete the entire booking process through WhatsApp messages. Here's how it works:\n\n`;
    section += `1. **Request a Quote**: Tell us what service you need\n`;
    section += `2. **Get Instant Quote**: Our AI calculates your price immediately\n`;
    section += `3. **Confirm Booking**: Reply "yes" or "book it" to confirm\n`;
    section += `4. **Provide Details**: Give us your contact info and preferred time\n`;
    section += `5. **Complete Payment**: Pay through our secure link (if required)\n`;
    section += `6. **Get Confirmation**: Receive booking confirmation and reminders\n\n`;
    section += `No buttons, no apps, no complicated forms - just natural conversation!\n\n`;
  } else if (requiresButtonBooking) {
    section += `**Q: Do I need to click a button to get quotes?**\n`;
    section += `A: Yes, ${businessName} uses our secure quote system. After getting your quote through chat, you'll need to click the 'Get a Quote' button to:\n`;
    section += `• Access real-time availability\n`;
    section += `• Complete secure payment processing\n`;
    section += `• Receive official booking confirmations\n\n`;
  }
  
  // Provider selection
  if (!allowProviderSelection || numberOfProviders === 1) {
    section += `**Q: Can I choose a specific service provider?**\n`;
    section += `A: ${businessName} automatically assigns the best available provider for your booking. `;
    if (numberOfProviders === 1) {
      section += `We have one highly skilled provider who handles all services.\n\n`;
    } else {
      section += `Our team of ${numberOfProviders} providers are all equally qualified, so you'll receive excellent service regardless of who is assigned.\n\n`;
    }
  } else {
    section += `**Q: Can I choose a specific service provider?**\n`;
    section += `A: Yes! ${businessName} allows you to select from our team of ${numberOfProviders} providers during the booking process. Each provider has their own schedule and you can choose based on availability and preference.\n\n`;
  }
  
  return section;
}

function generateQuoteSystemKnowledge(config: BusinessConfiguration): string {
  const { businessName, services, offersQuotes } = config;
  
  let section = `## How ${businessName} Pricing Works\n\n`;
  
  if (!offersQuotes) {
    section += `**Q: How does pricing work?**\n`;
    section += `A: ${businessName} has fixed pricing for all services. You'll know the exact cost upfront with no surprises. See our price list for current rates.\n\n`;
    return section;
  }
  
  section += `**Q: How are quotes calculated for ${businessName}?**\n`;
  section += `A: Our intelligent quoting system calculates prices based on several factors:\n\n`;
  
  // Analyze service pricing types
  const hasFixedPricing = services.some(s => s.pricingType === 'fixed');
  const hasPerMinutePricing = services.some(s => s.pricingType === 'per_minute');
  const hasMobileServices = services.some(s => s.mobile);
  const hasBaseCharges = services.some(s => s.baseCharge && s.baseCharge > 0);
  
  if (hasFixedPricing) {
    section += `**Fixed Price Services**:\n`;
    const fixedServices = services.filter(s => s.pricingType === 'fixed');
    fixedServices.forEach(service => {
      section += `• ${service.name}: $${service.fixedPrice} (set price)\n`;
    });
    section += `\n`;
  }
  
  if (hasPerMinutePricing) {
    section += `**Time-Based Services**:\n`;
    const perMinuteServices = services.filter(s => s.pricingType === 'per_minute');
    perMinuteServices.forEach(service => {
      section += `• ${service.name}: $${service.ratePerMinute}/minute`;
      if (service.baseCharge) {
        section += ` (minimum charge: $${service.baseCharge})`;
      }
      section += `\n`;
    });
    section += `\n`;
  }
  
  if (hasMobileServices) {
    section += `**Mobile Services Include**:\n`;
    section += `• Service time at your location\n`;
    section += `• Travel time to reach you\n`;
    section += `• All travel costs included in the quote\n\n`;
  }
  
  if (hasBaseCharges) {
    section += `**Minimum Charges**: Some services have minimum charges to ensure fair pricing for both short and long jobs.\n\n`;
  }
  
  section += `**Quote Accuracy**: Our quotes are based on the information you provide. The more details you give us about your requirements, the more accurate your quote will be.\n\n`;
  
  section += `**Q: Are quotes binding or can prices change?**\n`;
  section += `A: Here's how ${businessName} handles quote changes:\n\n`;
  section += `• **If your requirements don't change**: Your original quote remains exactly the same\n`;
  section += `• **If you need to modify your request**: We'll create a fresh quote reflecting the new requirements\n`;
  section += `• **No surprise charges**: We never change prices without creating a new quote and getting your approval\n`;
  section += `• **Transparent process**: Any changes are discussed and agreed upon before work begins\n\n`;
  
  return section;
}

function generatePaymentSystemKnowledge(config: BusinessConfiguration): string {
  const { businessName, acceptsOnlinePayments, acceptsCash, requiresDeposit, depositPercentage } = config;
  
  let section = `## Payment Options with ${businessName}\n\n`;
  
  section += `**Q: How do deposits and payments work?**\n`;
  section += `A: ${businessName}'s payment system is designed to be simple and secure:\n\n`;
  
  if (requiresDeposit) {
    section += `**Deposit Required**:\n`;
    section += `• ${depositPercentage}% deposit required to secure your booking\n`;
    section += `• Remaining balance paid after service completion\n`;
    section += `• Deposits are processed when you confirm your booking\n\n`;
  } else {
    section += `**No Deposit Required**:\n`;
    section += `• Full payment after service completion\n`;
    section += `• No upfront costs to secure your booking\n\n`;
  }
  
  section += `**Payment Methods Accepted**:\n`;
  if (acceptsOnlinePayments) {
    section += `• **Online Payments**: Secure credit/debit card processing\n`;
    section += `• **Payment Links**: Sent via WhatsApp for easy payment\n`;
  }
  if (acceptsCash) {
    section += `• **Cash**: Accepted on completion of service\n`;
  }
  section += `\n`;
  
  section += `**Payment Security**: All online payments use bank-level encryption and security. Your payment information is never stored.\n\n`;
  
  return section;
}

function generateAICapabilitiesKnowledge(config: BusinessConfiguration): string {
  const { businessName, allowsTextBooking, offersQuotes, offersInstantBooking } = config;
  
  let section = `## What ${businessName}'s AI Assistant Can Do\n\n`;
  
  section += `**Q: What is the AI assistant and what can it do?**\n`;
  section += `A: Our AI assistant is your personal booking helper for ${businessName}, available 24/7 through WhatsApp. Here's what it can do:\n\n`;
  
  section += `**Complete Service Capabilities**:\n`;
  if (offersQuotes) {
    section += `• **Provide Instant Quotes**: Calculate pricing based on your specific needs\n`;
  }
  if (allowsTextBooking) {
    section += `• **Complete Full Bookings**: Handle the entire booking process via messages\n`;
    section += `• **Process Payments**: Send secure payment links and confirm payments\n`;
  }
  section += `• **Answer Questions**: Provide detailed information about services and policies\n`;
  section += `• **Check Availability**: Let you know when ${businessName} can serve you\n`;
  section += `• **Send Confirmations**: Provide booking confirmations and reminders\n`;
  section += `• **Handle Changes**: Assist with rescheduling and modifications\n\n`;
  
  section += `**What Makes It Smart**:\n`;
  section += `• **Understands Context**: Remembers your conversation and preferences\n`;
  section += `• **Natural Conversation**: Talk to it like you would a human assistant\n`;
  section += `• **Always Learning**: Gets better at understanding your needs\n`;
  section += `• **Instant Responses**: Available 24/7 with immediate replies\n\n`;
  
  if (allowsTextBooking) {
    section += `**Complete Booking Process**: Unlike many booking systems, our AI can handle everything from initial inquiry to final confirmation - no forms, buttons, or apps required!\n\n`;
  }
  
  return section;
}

function generateCommunicationKnowledge(config: BusinessConfiguration): string {
  const { businessName, whatsappNumber, responseTimeHours, operatingHours } = config;
  
  let section = `## Communicating with ${businessName}\n\n`;
  
  section += `**Q: How do I contact ${businessName}?**\n`;
  section += `A: The easiest way to reach us is through WhatsApp:\n\n`;
  section += `• **WhatsApp**: ${whatsappNumber}\n`;
  section += `• **Phone**: Same number for voice calls\n`;
  section += `• **AI Assistant**: Available 24/7 for instant responses\n`;
  section += `• **Human Staff**: Available during business hours (${operatingHours})\n\n`;
  
  section += `**Q: How quickly will I get a response?**\n`;
  section += `A: Response times with ${businessName}:\n\n`;
  section += `• **AI Assistant**: Instant responses 24/7\n`;
  section += `• **Complex Questions**: Human staff responds within ${responseTimeHours} hours during business hours\n`;
  section += `• **Urgent Matters**: Call directly for immediate assistance\n`;
  section += `• **Booking Confirmations**: Sent immediately upon completion\n\n`;
  
  return section;
}

// Export helper function to generate from business form data
export function generateSystemKnowledgeFromBusinessForm(businessFormData: any): string {
  const config: BusinessConfiguration = {
    businessName: businessFormData.businessName || 'This Business',
    businessCategory: businessFormData.businessCategory || 'removalist',
    
    services: businessFormData.services || [],
    
    numberOfProviders: businessFormData.numberOfProviders || 1,
    allowProviderSelection: false, // Most Skedy businesses don't allow this
    
    acceptsOnlinePayments: businessFormData.setupPayments || true,
    acceptsCash: true, // Most businesses accept cash
    requiresDeposit: businessFormData.depositPercentage > 0,
    depositPercentage: businessFormData.depositPercentage || 0,
    
    allowsTextBooking: true, // This is the main Skedy feature
    requiresButtonBooking: false, // Most don't require buttons
    
    whatsappNumber: businessFormData.whatsappNumber || businessFormData.phone || '[Phone Number]',
    responseTimeHours: 2, // Standard Skedy response time
    
    operatingHours: 'Standard business hours', // Would come from calendar settings
    cancellationPolicy: '24 hours notice for full refund', // Default
    
    businessAddress: businessFormData.businessAddress || '[Business Address]',
    serviceAreas: ['Local area'], // Would be configured separately
    
    offersQuotes: true, // Main Skedy feature
    offersInstantBooking: true, // Main Skedy feature
    hasRealTimeAvailability: true // Main Skedy feature
  };
  
  return generateBusinessSpecificSystemKnowledge(config);
} 