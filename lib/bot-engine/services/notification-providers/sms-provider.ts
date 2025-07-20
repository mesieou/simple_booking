import { BaseNotificationProvider, NotificationRecipient, NotificationContent, DeliveryResult } from './base-notification-provider';
import { NotificationType } from '@/lib/database/models/notification';

const LOG_PREFIX = '[SMSProvider]';

/**
 * SMS notification provider
 * No templates needed - simple text messages
 */
export class SMSProvider extends BaseNotificationProvider {
  readonly providerName = 'sms';
  readonly supportedChannels = ['sms'];

  canHandle(recipient: NotificationRecipient): boolean {
    return !!(recipient.phoneNumber && recipient.preferredChannel === 'sms');
  }

  async sendNotification(
    type: NotificationType,
    recipient: NotificationRecipient,
    content: NotificationContent,
    businessContext: {
      businessId: string;
      businessName?: string;
    }
  ): Promise<DeliveryResult> {
    console.log(`${LOG_PREFIX} Sending ${type} SMS to ${recipient.phoneNumber}`);

    try {
      // Format message for SMS (no templates needed!)
      const smsText = this.formatSMSMessage(content, recipient, businessContext);
      
      // Send via SMS service (Twilio, AWS SNS, etc.)
      const messageId = await this.sendSMS(recipient.phoneNumber, smsText);

      return {
        success: true,
        messageId,
        provider: this.providerName,
        method: 'text'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${LOG_PREFIX} Failed to send SMS:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        provider: this.providerName
      };
    }
  }

  private formatSMSMessage(
    content: NotificationContent,
    recipient: NotificationRecipient,
    businessContext: { businessName?: string }
  ): string {
    let message = `${content.title}\n\n${content.message}`;
    
    // Add business context for super admins
    if (recipient.isSuperAdmin && businessContext.businessName) {
      message = `[${businessContext.businessName}] ${message}`;
    }

    // Truncate for SMS limits (160 characters per segment)
    const maxLength = 1600; // ~10 SMS segments
    if (message.length > maxLength) {
      message = message.substring(0, maxLength - 3) + '...';
    }

    return message;
  }

  private async sendSMS(phoneNumber: string, message: string): Promise<string> {
    // Mock implementation - replace with actual SMS service
    console.log(`${LOG_PREFIX} Sending SMS to ${phoneNumber}: ${message.substring(0, 50)}...`);
    
    // Example with Twilio:
    // const client = twilio(accountSid, authToken);
    // const result = await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phoneNumber
    // });
    // return result.sid;
    
    return `sms_mock_${Date.now()}`;
  }

  getConfiguration(): Record<string, any> {
    return {
      providerName: this.providerName,
      templatesSupported: [], // No templates needed
      maxMessageLength: 1600,
      segmentLength: 160
    };
  }

  async healthCheck(): Promise<boolean> {
    // Check SMS service credentials
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  }
} 