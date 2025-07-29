import { Notification, NotificationType } from '@/lib/database/models/notification';
import { Business } from '@/lib/database/models/business';
import { BaseNotificationProvider, NotificationRecipient, NotificationContent, DeliveryResult } from './notification-providers/base-notification-provider';
import { WhatsAppProvider } from './notification-providers/whatsapp-provider';
import { SMSProvider } from './notification-providers/sms-provider';
import { EmailProvider } from './notification-providers/email-provider';

const LOG_PREFIX = '[ScalableNotificationService]';

/**
 * Provider-agnostic notification service
 * Each provider handles its own requirements (templates, formatting, etc.)
 * Easy to add new providers without affecting existing ones
 */
export class ScalableNotificationService {
  private providers: Map<string, BaseNotificationProvider> = new Map();

  constructor() {
    // Register available providers
    this.registerProvider(new WhatsAppProvider());
    this.registerProvider(new SMSProvider());
    this.registerProvider(new EmailProvider());
  }

  /**
   * Register a new notification provider
   */
  registerProvider(provider: BaseNotificationProvider): void {
    this.providers.set(provider.providerName, provider);
    console.log(`${LOG_PREFIX} Registered provider: ${provider.providerName}`);
  }

  /**
   * Main method to send notifications
   * Routes to appropriate providers based on recipient preferences
   */
  async sendNotification(params: {
    type: NotificationType;
    businessId: string;
    chatSessionId?: string;
    content: NotificationContent;
    recipients?: NotificationRecipient[];
    preferredProviders?: string[]; // Optional: force specific providers
  }): Promise<void> {
    const { type, businessId, chatSessionId, content, recipients, preferredProviders } = params;
    
    console.log(`${LOG_PREFIX} Sending ${type} notification for business: ${businessId}`);
    
    try {
      // Find recipients if not provided
      const targetRecipients = recipients || await this.findNotificationRecipients(businessId, type);
      
      if (targetRecipients.length === 0) {
        console.warn(`${LOG_PREFIX} No recipients found for ${type} notification`);
        return;
      }

      // Get business context
      const businessContext = await this.getBusinessContext(businessId);
      
      // Send to each recipient using their preferred provider(s)
      for (const recipient of targetRecipients) {
        await this.sendToRecipient(
          type,
          recipient,
          content,
          businessContext,
          chatSessionId,
          preferredProviders
        );
      }
      
      console.log(`${LOG_PREFIX} ✅ ${type} notification sent to ${targetRecipients.length} recipients`);
      
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Failed to send ${type} notification:`, error);
      throw error;
    }
  }

  /**
   * Send notification to a specific recipient using the best provider
   */
  private async sendToRecipient(
    type: NotificationType,
    recipient: NotificationRecipient,
    content: NotificationContent,
    businessContext: any,
    chatSessionId?: string,
    preferredProviders?: string[]
  ): Promise<void> {
    
    // Create notification record in database with enhanced error context
    let notification: Notification;
    try {
      notification = await Notification.create({
        businessId: businessContext.businessId,
        chatSessionId: chatSessionId || null,
        message: content.message,
        status: 'pending',
        notificationType: type
      });
    } catch (error) {
      // Add additional context for scalable notification service errors
      const { productionErrorTracker } = await import('@/lib/general-helpers/error-handling/production-error-tracker');
      const errorCategory = type === 'system' ? 'SYSTEM_NOTIFICATION_FAILED' : 
                          type === 'escalation' ? 'ESCALATION_NOTIFICATION_FAILED' : 
                          'BOOKING_NOTIFICATION_FAILED';
      await productionErrorTracker.logCriticalError(errorCategory, error instanceof Error ? error : new Error(String(error)), {
        businessId: businessContext.businessId,
        chatSessionId,
        additionalContext: {
          component: 'ScalableNotificationService',
          operation: 'sendToRecipient',
          notificationType: type,
          recipientName: recipient.name,
          recipientPhone: recipient.phoneNumber,
          contentTitle: content.title,
          businessContext: businessContext,
          contentData: content.data,
          stackTrace: new Error().stack
        }
      }).catch(trackingError => {
        console.error('[ScalableNotificationService] Failed to log detailed error:', trackingError);
      });
      
      throw error; // Re-throw the original error
    }

    // Find suitable providers for this recipient
    const availableProviders = this.findProvidersForRecipient(recipient, preferredProviders);
    
    if (availableProviders.length === 0) {
      console.warn(`${LOG_PREFIX} No suitable providers found for ${recipient.name}`);
      await Notification.markDeliveryFailure(notification.id, 'No suitable providers found', recipient.phoneNumber);
      return;
    }

    // Try providers in order of preference
    let lastError: string = '';
    for (const provider of availableProviders) {
      try {
        console.log(`${LOG_PREFIX} Attempting ${provider.providerName} for ${recipient.name}`);
        
        const result = await provider.sendNotification(
          type,
          recipient,
          content,
          businessContext
        );

        if (result.success) {
          // Mark as successful
          await Notification.markDeliverySuccessWithMessageId(
            notification.id,
            result.messageId || 'unknown',
            `${result.provider}:${result.method}`
          );
          
          console.log(`${LOG_PREFIX} ✅ Sent via ${result.provider} (${result.method}) to ${recipient.name}`);
          return; // Success - stop trying other providers
        } else {
          lastError = result.error || 'Unknown provider error';
          console.warn(`${LOG_PREFIX} Provider ${provider.providerName} failed: ${lastError}`);
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`${LOG_PREFIX} Provider ${provider.providerName} threw error: ${lastError}`);
      }
    }

    // All providers failed
    await Notification.markDeliveryFailure(notification.id, `All providers failed. Last error: ${lastError}`, recipient.phoneNumber);
    throw new Error(`Failed to send notification to ${recipient.name}: ${lastError}`);
  }

  /**
   * Find providers that can handle this recipient
   */
  private findProvidersForRecipient(
    recipient: NotificationRecipient,
    preferredProviders?: string[]
  ): BaseNotificationProvider[] {
    const suitable: BaseNotificationProvider[] = [];
    
    // If specific providers requested, try those first
    if (preferredProviders) {
      for (const providerName of preferredProviders) {
        const provider = this.providers.get(providerName);
        if (provider && provider.canHandle(recipient)) {
          suitable.push(provider);
        }
      }
      if (suitable.length > 0) return suitable;
    }

    // Default provider selection based on recipient preferences
    for (const provider of this.providers.values()) {
      if (provider.canHandle(recipient)) {
        suitable.push(provider);
      }
    }

    // Sort by preference (WhatsApp first, then SMS, then Email)
    const providerPriority = ['whatsapp', 'sms', 'email'];
    suitable.sort((a, b) => {
      const aPriority = providerPriority.indexOf(a.providerName);
      const bPriority = providerPriority.indexOf(b.providerName);
      return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
    });

    return suitable;
  }

  /**
   * Get business context for providers
   */
  private async getBusinessContext(businessId: string) {
    const business = await Business.getByIdWithServiceRole(businessId);
    
    return {
      businessId,
      businessName: business?.name,
      businessPhoneNumberId: business?.whatsappPhoneNumberId,
      businessEmail: business?.email
    };
  }

  /**
   * Find notification recipients (same logic as before)
   */
  async findNotificationRecipients(businessId: string, type?: NotificationType): Promise<NotificationRecipient[]> {
    const recipients: NotificationRecipient[] = [];
    
    try {
      // For system notifications (like negative feedback), only send to super admins
      if (type === 'system') {
        const superAdmins = await this.findSuperAdmins();
        recipients.push(...superAdmins);
        console.log(`${LOG_PREFIX} System notification: Found ${recipients.length} super admin recipients`);
        return recipients;
      }
      
      // For other notifications (booking, escalation), send to both business admins and super admins
      const businessAdmins = await this.findBusinessAdmins(businessId);
      recipients.push(...businessAdmins);
      
      const superAdmins = await this.findSuperAdmins();
      recipients.push(...superAdmins);
      
      console.log(`${LOG_PREFIX} Found ${recipients.length} notification recipients`);
      return recipients;
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Error finding notification recipients:`, error);
      return [];
    }
  }

  /**
   * Find business admins
   */
  private async findBusinessAdmins(businessId: string): Promise<NotificationRecipient[]> {
    try {
      const { getEnvironmentServiceRoleClient } = await import("@/lib/database/supabase/environment");
      const { PROVIDER_ROLES } = await import("@/lib/database/models/user");
      const supa = getEnvironmentServiceRoleClient();
      
      // Find business admins with either phoneNormalized OR whatsAppNumberNormalized
      const { data: users, error } = await supa
        .from('users')
        .select('id, firstName, lastName, phoneNormalized, whatsAppNumberNormalized, email, role')
        .eq('businessId', businessId)
        .in('role', PROVIDER_ROLES)
        .or('phoneNormalized.not.is.null,whatsAppNumberNormalized.not.is.null');
      
      if (error) {
        console.error(`${LOG_PREFIX} Error finding business admins:`, error);
        return [];
      }
      
      const recipients = (users || [])
        .filter(user => user.phoneNormalized || user.whatsAppNumberNormalized) // Must have phone for WhatsApp
        .map(user => {
          const phoneNumber = user.phoneNormalized || user.whatsAppNumberNormalized;
          return {
            userId: user.id,
            phoneNumber: `+${phoneNumber}`,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`.trim(),
            role: user.role,
            isBusinessAdmin: true,
            isSuperAdmin: false,
            preferredChannel: 'whatsapp' as const // Default for business admins
          };
        });
      
      console.log(`${LOG_PREFIX} Found ${recipients.length} business admin recipients for business ${businessId}:`, 
        recipients.map(r => `${r.name} (${r.phoneNumber || r.email})`));
      
      return recipients;
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Exception finding business admins:`, error);
      return [];
    }
  }

  /**
   * Find super admins
   */
  private async findSuperAdmins(): Promise<NotificationRecipient[]> {
    try {
      const { getEnvironmentServiceRoleClient } = await import("@/lib/database/supabase/environment");
      const supa = getEnvironmentServiceRoleClient();
      
      // Find super admins with either phoneNormalized OR whatsAppNumberNormalized
      const { data: users, error } = await supa
        .from('users')
        .select('id, firstName, lastName, phoneNormalized, whatsAppNumberNormalized, email, role')
        .eq('role', 'super_admin')
        .or('phoneNormalized.not.is.null,whatsAppNumberNormalized.not.is.null');
      
      if (error) {
        console.error(`${LOG_PREFIX} Error finding super admins:`, error);
        return [];
      }
      
      const recipients = (users || [])
        .filter(user => user.phoneNormalized || user.whatsAppNumberNormalized) // Must have phone for WhatsApp
        .map(user => {
          const phoneNumber = user.phoneNormalized || user.whatsAppNumberNormalized;
          return {
            userId: user.id,
            phoneNumber: `+${phoneNumber}`,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`.trim(),
            role: user.role,
            isBusinessAdmin: false,
            isSuperAdmin: true,
            preferredChannel: 'whatsapp' as const // Prefer WhatsApp if phone available
          };
        });
      
      console.log(`${LOG_PREFIX} Found ${recipients.length} super admin recipients:`, 
        recipients.map(r => `${r.name} (${r.phoneNumber || r.email})`));
      
      return recipients;
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Exception finding super admins:`, error);
      return [];
    }
  }

  /**
   * Convenience methods for specific notification types
   */
  async sendBookingNotification(businessId: string, bookingDetails: any): Promise<void> {
    // Get business info to determine which template to use
    const { Business } = await import('@/lib/database/models/business');
    let businessCategory = 'default';
    try {
      const business = await Business.getByIdWithServiceRole(businessId);
      businessCategory = business?.businessCategory || 'default';
    } catch (error) {
      console.warn('[ScalableNotificationService] Could not fetch business category, using default template');
    }

    // Choose the appropriate booking confirmation template
    let customerMessage: string;
    let templateName: string;
    
    if (businessCategory === 'removalist') {
      customerMessage = this.formatRemovalistBookingConfirmation(bookingDetails);
      templateName = 'removalist_booking_confirmation';
    } else if (!bookingDetails.isMobile && bookingDetails.pricingType === 'fixed_price') {
      customerMessage = this.formatFixedPriceNonMobileBookingConfirmation(bookingDetails);
      templateName = 'fixed_price_non_mobile_booking_confirmation';
    } else {
      // Fallback to fixed price non-mobile template for now
      customerMessage = this.formatFixedPriceNonMobileBookingConfirmation(bookingDetails);
      templateName = 'fixed_price_non_mobile_booking_confirmation';
    }
    
    const content: NotificationContent = {
      title: "🎉 New Booking Confirmed!",
      message: customerMessage,
      data: {
        ...bookingDetails,
        templateName // Pass the specific template name to the provider
      }
    };

    // Determine the notification type based on template
    const notificationType = templateName === 'fixed_price_non_mobile_booking_confirmation' 
      ? 'booking_fixed_price_non_mobile' 
      : templateName === 'removalist_booking_confirmation'
      ? 'booking_removalist'
      : 'booking_fixed_price_non_mobile'; // fallback

    await this.sendNotification({
      type: notificationType as any,
      businessId,
      content
    });
  }

  /**
   * Format booking confirmation for removalist services
   * Uses existing MessageComponentBuilder for consistent formatting
   */
  private formatRemovalistBookingConfirmation(details: any): string {
    const {
      bookingId,
      customerName,
      customerPhone,
      serviceName,
      pickupAddress,
      deliveryAddress,
      formattedDate,
      formattedTime,
      duration,
      estimatedCompletion,
      totalCost,
      serviceCost,
      travelCost = 0,
      bookingFee = 4.00,
      amountPaid = 0,
      balanceDue = 0,
      providerContactInfo,
      isPaymentCompletion = false
    } = details;

    let message = '';
    
    // Payment thank you if this was a payment completion
    if (isPaymentCompletion) {
      message += `💳 Thank you for your payment!\n\n`;
    }

    // Header: New booking for {customerName}!
    message += `New booking for ${customerName}!\n\n`;

    // Body matching Meta template format exactly
    message += `🏠 Service: ${serviceName}\n\n`;
    
    message += `📦 Pickup: ${pickupAddress || 'N/A'}\n`;
    message += `🏁 Delivery: ${deliveryAddress || 'N/A'}\n\n`;
    
    message += `💪 Estimated Work Cost: $${(serviceCost || (totalCost - travelCost - bookingFee)).toFixed(2)}\n`;
    message += `🚛 Estimated Travel Cost: $${travelCost.toFixed(2)}\n`;
    message += `💰 Estimated Total Cost: $${totalCost.toFixed(2)}\n\n`;
    
    message += `📅 Date: ${formattedDate}\n`;
    message += `⏰ Time: ${formattedTime}\n`;
    if (estimatedCompletion) {
      message += `🏁 Estimated completion: ${estimatedCompletion}\n`;
    }
    message += `\n`;
    
    message += `💳 Payment Breakdown\n`;
    message += `• Estimated Total Cost: $${totalCost.toFixed(2)}\n`;
    message += `• Booking Fee: $${bookingFee.toFixed(2)}\n`;
    message += `• Total Paid: $${amountPaid.toFixed(2)}\n`;
    message += `• Estimated Remaining Balance: $${balanceDue.toFixed(2)} (cash after job completion)\n\n`;

    // Customer contact details (admin specific) - reusing {{1}} for customer name
    message += `👤 Customer Details:\n`;
    message += `• Name: ${customerName}\n`;
    if (customerPhone) {
      message += `• WhatsApp: ${customerPhone}\n`;
    }
    message += `\n`;

    // Provider contact info (if available)
    if (providerContactInfo) {
      message += `📞 Contact Information:\n${providerContactInfo}\n\n`;
    }

    // Booking ID
    message += `📄 Booking ID: ${bookingId}\n\n`;

    // Admin closing
    message += `New booking confirmed! 🎉`;

    return message;
  }

  /**
   * Format booking confirmation for fixed price non-mobile services
   * Uses existing MessageComponentBuilder for consistent formatting
   */
  private formatFixedPriceNonMobileBookingConfirmation(details: any): string {
    const {
      bookingId,
      customerName,
      customerPhone,
      serviceName,
      servicesDisplay,
      formattedDate,
      formattedTime,
      location,
      totalCost,
      serviceCost,
      travelCost = 0,
      amountPaid = 0,
      amountOwed = 0,
      paymentMethod = 'cash',
      providerContactInfo,
      bookingFee = 4.00,
      isPaymentCompletion = false
    } = details;

    // Start with payment thank you if this was a payment completion
    let message = '';
    if (isPaymentCompletion) {
      message += `💳 Thank you for your payment!\n\n`;
    }

    // Main confirmation line (exactly like customer format)
    message += `🎉 ${customerName}, booking confirmed!\n\n`;

    // Service section (exactly like customer format)
    message += `💼 Service:\n${servicesDisplay || serviceName}\n`;

    // Pricing section (exactly like customer format) 
    message += `💰💰 Pricing:\n`;
    if (serviceCost) {
      message += `• Service: $${serviceCost.toFixed(2)}\n`;
    } else {
      message += `• Service: $${(totalCost - bookingFee).toFixed(2)}\n`;
    }
    
    if (travelCost && travelCost > 0) {
      message += `• Travel: $${travelCost.toFixed(2)}\n`;
    }
    
    if (bookingFee > 0) {
      message += `• Booking Fee: $${bookingFee.toFixed(2)}\n`;
    }
    
    message += `• *Total Cost: $${totalCost.toFixed(2)}*\n\n`;

    // Schedule section (exactly like customer format)
    message += `📅 Date: ${formattedDate}\n`;
    message += `⏰ Time: ${formattedTime}\n`;
    message += `📍 Location: ${location}\n\n`;

    // Payment Summary section (exactly like customer format)
    if (amountPaid > 0 || amountOwed > 0) {
      message += `💳 Payment Summary:\n`;
      if (amountPaid > 0) {
        message += `• Paid: $${amountPaid.toFixed(2)}\n`;
      }
      if (amountOwed > 0) {
        message += `• Balance Due: $${amountOwed.toFixed(2)}\n`;
      }
      if (paymentMethod) {
        message += `• Payment Method: ${paymentMethod}\n`;
      }
      message += `\n`;
    }

    // **ADMIN-SPECIFIC ADDITION: Customer Contact Details**
    message += `👤 Customer Details:\n`;
    message += `• Name: ${customerName}\n`;
    if (customerPhone) {
      message += `• WhatsApp: ${customerPhone}\n`;
    }
    message += `\n`;

    // Provider contact info (if available)
    if (providerContactInfo) {
      message += `📞 Provider Contact:\n   ${providerContactInfo}\n\n`;
    }

    // Booking ID (exactly like customer format)
    message += `📄 Booking ID: ${bookingId}\n\n`;

    // Professional admin closing
    message += `New booking confirmed and ready to serve! 🎉`;

    return message;
  }

  async sendFeedbackNotification(businessId: string, feedbackDetails: any): Promise<void> {
    const content: NotificationContent = {
      title: "⚠️ Negative Feedback Alert",
      message: this.formatFeedbackMessage(feedbackDetails),
      data: feedbackDetails // Provider-agnostic data
    };

    await this.sendNotification({
      type: 'system',
      businessId,
      chatSessionId: feedbackDetails.sessionId, // Pass the session ID from feedback details
      content
    });
  }

  /**
   * Format feedback message (for SMS/Email fallback)
   */
  private formatFeedbackMessage(details: any): string {
    return `Customer ${details.customerName} from ${details.businessName} left negative feedback:\n\n` +
           `"${details.feedbackText}"\n\n` +
           `Received: ${details.timestamp || new Date().toLocaleDateString()}`;
  }

  /**
   * Get provider information for debugging
   */
  getProviderInfo(): Record<string, any> {
    const info: Record<string, any> = {};
    
    for (const [name, provider] of this.providers) {
      info[name] = provider.getConfiguration();
    }
    
    return info;
  }

  /**
   * Health check all providers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        health[name] = await provider.healthCheck();
      } catch (error) {
        health[name] = false;
      }
    }
    
    return health;
  }
} 