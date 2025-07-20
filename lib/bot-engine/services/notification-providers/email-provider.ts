import { BaseNotificationProvider, NotificationRecipient, NotificationContent, DeliveryResult } from './base-notification-provider';
import { NotificationType } from '@/lib/database/models/notification';

const LOG_PREFIX = '[EmailProvider]';

/**
 * Email notification provider
 * Uses HTML templates but different from WhatsApp templates
 */
export class EmailProvider extends BaseNotificationProvider {
  readonly providerName = 'email';
  readonly supportedChannels = ['email'];

  private emailTemplates = new Map<NotificationType, {
    subject: (data: any) => string;
    htmlTemplate: (data: any, content: NotificationContent) => string;
  }>([
    ['booking', {
      subject: (data) => `🎉 Booking Confirmation - ${data.bookingId || 'New Booking'}`,
      htmlTemplate: (data, content) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2e7d32;">🎉 Booking Confirmed!</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
            <h3>Booking Details</h3>
            <p><strong>ID:</strong> ${data.bookingId}</p>
            <p><strong>Service:</strong> ${data.serviceName}</p>
            <p><strong>Date:</strong> ${data.formattedDate}</p>
            <p><strong>Time:</strong> ${data.formattedTime}</p>
            <p><strong>Total:</strong> $${data.totalCost}</p>
          </div>
          <p>Thank you for choosing our services!</p>
        </div>
      `
    }],
    ['system', {
      subject: () => '⚠️ System Alert - Negative Feedback',
      htmlTemplate: (data, content) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">⚠️ Negative Feedback Alert</h2>
          <div style="background: #ffebee; padding: 20px; border-radius: 8px; border-left: 4px solid #d32f2f;">
            <p><strong>Customer:</strong> ${data.customerName}</p>
            <p><strong>Business:</strong> ${data.businessName}</p>
            <p><strong>Date:</strong> ${data.timestamp}</p>
            <div style="background: white; padding: 15px; border-radius: 4px; margin-top: 10px;">
              <p><strong>Feedback:</strong></p>
              <p style="font-style: italic;">"${data.feedbackText}"</p>
            </div>
          </div>
          <p style="color: #666;">Please review and take appropriate action.</p>
        </div>
      `
    }]
  ]);

  canHandle(recipient: NotificationRecipient): boolean {
    return !!(recipient.email && (
      recipient.preferredChannel === 'email' ||
      recipient.isSuperAdmin // Super admins get email by default
    ));
  }

  async sendNotification(
    type: NotificationType,
    recipient: NotificationRecipient,
    content: NotificationContent,
    businessContext: {
      businessId: string;
      businessName?: string;
      businessEmail?: string;
    }
  ): Promise<DeliveryResult> {
    console.log(`${LOG_PREFIX} Sending ${type} email to ${recipient.email}`);

    try {
      const emailTemplate = this.emailTemplates.get(type);
      
      let subject: string;
      let htmlBody: string;
      
      if (emailTemplate && content.data) {
        // Use specific email template
        subject = emailTemplate.subject(content.data);
        htmlBody = emailTemplate.htmlTemplate(content.data, content);
      } else {
        // Fallback to generic email
        subject = content.title;
        htmlBody = this.formatGenericEmail(content, recipient, businessContext);
      }

      const messageId = await this.sendEmail(
        recipient.email!,
        subject,
        htmlBody,
        businessContext.businessEmail
      );

      return {
        success: true,
        messageId,
        provider: this.providerName,
        method: emailTemplate ? 'html_template' : 'generic_html'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${LOG_PREFIX} Failed to send email:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        provider: this.providerName
      };
    }
  }

  private formatGenericEmail(
    content: NotificationContent,
    recipient: NotificationRecipient,
    businessContext: { businessName?: string }
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${content.title}</h2>
        ${businessContext.businessName && recipient.isSuperAdmin ? 
          `<p style="background: #e3f2fd; padding: 10px; border-radius: 4px;">
            <strong>Business:</strong> ${businessContext.businessName}
          </p>` : ''
        }
        <div style="line-height: 1.6;">
          ${content.message.replace(/\n/g, '<br>')}
        </div>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    `;
  }

  private async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    fromEmail?: string
  ): Promise<string> {
    // Mock implementation - replace with actual email service
    console.log(`${LOG_PREFIX} Sending email to ${to}`);
    console.log(`${LOG_PREFIX} Subject: ${subject}`);
    
    // Example with SendGrid, AWS SES, or similar:
    // const msg = {
    //   to,
    //   from: fromEmail || process.env.DEFAULT_FROM_EMAIL,
    //   subject,
    //   html: htmlBody
    // };
    // const result = await sgMail.send(msg);
    // return result[0].headers['x-message-id'];
    
    return `email_mock_${Date.now()}`;
  }

  getConfiguration(): Record<string, any> {
    return {
      providerName: this.providerName,
      templatesSupported: Array.from(this.emailTemplates.keys()),
      supportsHtml: true,
      supportsAttachments: true
    };
  }

  async healthCheck(): Promise<boolean> {
    // Check email service credentials
    return !!(process.env.SENDGRID_API_KEY || process.env.AWS_SES_REGION);
  }
} 