import { BaseNotificationProvider, NotificationRecipient, NotificationContent, DeliveryResult } from './base-notification-provider';
import { NotificationType } from '@/lib/database/models/notification';
import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';

const LOG_PREFIX = '[WhatsAppProvider]';

/**
 * WhatsApp-specific notification provider
 * Handles templates internally - other providers don't need to know about them
 */
export class WhatsAppProvider extends BaseNotificationProvider {
  readonly providerName = 'whatsapp';
  readonly supportedChannels = ['whatsapp'];

  private templateConfig = new Map<NotificationType, {
    templateName: string;
    requiresTemplate: boolean;
    headerParams: (data: any) => string[];
    bodyParams: (data: any) => string[];
  }>([
    ['booking', {
      templateName: 'booking_confirmation',
      requiresTemplate: true,
      headerParams: (data) => [this.cleanParam(data.customerName || 'Customer')], // {{1}} Customer name in header
      bodyParams: (data) => [
        this.cleanParam(data.customerName || 'Customer'), // {{1}} Customer name (reused in body)
        this.cleanParam(data.serviceName || 'Service'), // {{2}} Service name
        this.cleanParam(data.pickupAddress || 'N/A'), // {{3}} Pickup address
        this.cleanParam(data.deliveryAddress || 'N/A'), // {{4}} Delivery address
        this.cleanParam(data.serviceCost?.toString() || (data.totalCost - (data.travelCost || 0) - (data.bookingFee || 4)).toString()), // {{5}} Work/Service cost
        this.cleanParam(data.travelCost?.toString() || '0'), // {{6}} Travel cost
        this.cleanParam(data.totalCost?.toString() || '0'), // {{7}} Total cost (first time)
        this.cleanParam(data.formattedDate || 'Unknown date'), // {{8}} Date
        this.cleanParam(data.formattedTime || 'Unknown time'), // {{9}} Time
        this.cleanParam(data.estimatedCompletion || 'N/A'), // {{10}} Estimated completion
        this.cleanParam(data.totalCost?.toString() || '0'), // {{11}} Total cost (AGAIN in payment breakdown)
        this.cleanParam(data.bookingFee?.toString() || '4'), // {{12}} Booking fee
        this.cleanParam(data.amountPaid?.toString() || '0'), // {{13}} Total paid
        this.cleanParam(data.balanceDue?.toString() || '0'), // {{14}} Remaining balance
        this.cleanParam(data.customerWhatsapp || data.customerPhone || 'Unknown') // {{15}} Customer WhatsApp
      ]
    }],
    ['system', {
      templateName: 'negative_feedback_alert',
      requiresTemplate: true,
      headerParams: () => [], // No header parameters
      bodyParams: (data) => [
        this.cleanParam(data.customerPhone || data.customerPhoneNumber || 'Unknown'), // {{1}} Customer phone
        this.cleanParam(data.sessionId || 'Unknown'), // {{2}} Session ID
        this.cleanParam(data.businessId || 'Unknown'), // {{3}} Business ID
        this.cleanParam(data.botMessage || data.messageContent || 'No message'), // {{4}} Bot message
        this.cleanParam(data.feedbackText || 'No feedback'), // {{5}} Admin feedback
        this.cleanParam(data.timestamp || new Date().toLocaleString()) // {{6}} Timestamp
      ]
    }],
    ['escalation', {
      templateName: 'escalation',
      requiresTemplate: true,
      headerParams: (data) => [this.cleanParam(data.customerName || 'Customer')],
      bodyParams: (data) => [
        this.cleanParam(data.customerName || 'Customer'),
        this.cleanParam(data.lastMessage || 'No message')
      ]
    }]
  ]);

  canHandle(recipient: NotificationRecipient): boolean {
    // Must have a phone number and either prefer WhatsApp or have no preference
    return !!(
      recipient.phoneNumber && 
      recipient.phoneNumber.length > 5 && // Basic phone validation
      (
        recipient.preferredChannel === 'whatsapp' || 
        !recipient.preferredChannel // Default to WhatsApp if no preference
      )
    );
  }

  async sendNotification(
    type: NotificationType,
    recipient: NotificationRecipient,
    content: NotificationContent,
    businessContext: {
      businessId: string;
      businessPhoneNumberId?: string;
      businessName?: string;
    }
  ): Promise<DeliveryResult> {
    console.log(`${LOG_PREFIX} Sending ${type} notification to ${recipient.phoneNumber}`);

    try {
      const businessPhoneNumberId = businessContext.businessPhoneNumberId || 
                                   process.env.WHATSAPP_PHONE_NUMBER_ID as string;

      // Try template-based sending if template exists
      const templateConfig = this.templateConfig.get(type);
      if (templateConfig && content.data) {
        try {
          // Use dynamic template name if provided in data, otherwise fallback to config
          const dynamicTemplateName = content.data.templateName || templateConfig.templateName;
          
          const messageId = await this.sendTemplate(
            recipient,
            { ...templateConfig, templateName: dynamicTemplateName },
            content.data,
            businessPhoneNumberId
          );
          
          return {
            success: true,
            messageId: messageId || undefined,
            provider: this.providerName,
            method: 'template'
          };
        } catch (templateError) {
          console.warn(`${LOG_PREFIX} Template failed, falling back to regular message:`, templateError);
          
          // If template is required, fail
          if (templateConfig.requiresTemplate) {
            const errorMessage = templateError instanceof Error ? templateError.message : String(templateError);
            return {
              success: false,
              error: `Template required but failed: ${errorMessage}`,
              provider: this.providerName
            };
          }
        }
      }

      // Fallback to regular message
      const messageId = await this.sendRegularMessage(
        recipient,
        content,
        businessContext,
        businessPhoneNumberId
      );

      return {
        success: true,
        messageId: messageId || undefined,
        provider: this.providerName,
        method: 'regular'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${LOG_PREFIX} Failed to send notification:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        provider: this.providerName
      };
    }
  }

  private async sendTemplate(
    recipient: NotificationRecipient,
    templateConfig: any,
    data: Record<string, any>,
    businessPhoneNumberId: string
  ): Promise<string | null> {
    const sender = new WhatsappSender();
    
    const headerParams = templateConfig.headerParams(data);
    const bodyParams = templateConfig.bodyParams(data);
    
    console.log(`${LOG_PREFIX} Sending template ${templateConfig.templateName}`);
    console.log(`${LOG_PREFIX} Header params:`, headerParams);
    console.log(`${LOG_PREFIX} Body params:`, bodyParams);

    return await sender.sendTemplateMessage(
      recipient.phoneNumber,
      templateConfig.templateName,
      'en', // Language code
      bodyParams,
      businessPhoneNumberId,
      headerParams
    );
  }

  private async sendRegularMessage(
    recipient: NotificationRecipient,
    content: NotificationContent,
    businessContext: { businessName?: string },
    businessPhoneNumberId: string
  ): Promise<string | null> {
    const sender = new WhatsappSender();
    
    let message = content.message; // Use the detailed message from the content
    
    // Add business context for super admins
    if (recipient.isSuperAdmin && businessContext.businessName) {
      message = `🏢 Business: ${businessContext.businessName}\n\n${message}`;
    }

    return await sender.sendMessage(
      recipient.phoneNumber,
      { text: message },
      businessPhoneNumberId
    );
  }

  private cleanParam(text: string): string {
    return text
      .replace(/\n/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s{4,}/g, '   ')
      .replace(/\s{2}/g, ' ')
      .trim()
      .substring(0, 1024);
  }

  getConfiguration(): Record<string, any> {
    return {
      providerName: this.providerName,
      templatesSupported: Array.from(this.templateConfig.keys()),
      requiresBusinessPhoneId: true,
      maxMessageLength: 4096
    };
  }

  async healthCheck(): Promise<boolean> {
    return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  }
} 