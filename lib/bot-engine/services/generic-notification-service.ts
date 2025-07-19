import { Notification, NotificationType } from '@/lib/database/models/notification';
import { Business } from '@/lib/database/models/business';
import { User } from '@/lib/database/models/user';
import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';

const LOG_PREFIX = '[GenericNotificationService]';

export interface NotificationRecipient {
  userId: string;
  phoneNumber: string;
  name: string;
  role: string;
  isBusinessAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface NotificationContent {
  title: string;
  message: string;
  details?: Record<string, any>;
}

export interface SendNotificationParams {
  type: NotificationType;
  businessId: string;
  chatSessionId?: string; // Optional for non-chat notifications like bookings
  content: NotificationContent;
  recipients?: NotificationRecipient[]; // Optional - will auto-find if not provided
}

export class GenericNotificationService {
  
  /**
   * Main method to send notifications of any type
   */
  static async sendNotification(params: SendNotificationParams): Promise<void> {
    const { type, businessId, chatSessionId, content, recipients } = params;
    
    console.log(`${LOG_PREFIX} Sending ${type} notification for business: ${businessId}`);
    
    try {
      // Find recipients if not provided
      const targetRecipients = recipients || await this.findNotificationRecipients(businessId, type);
      
      if (targetRecipients.length === 0) {
        console.warn(`${LOG_PREFIX} No recipients found for ${type} notification`);
        return;
      }
      
      // Send to each recipient
      for (const recipient of targetRecipients) {
        await this.sendToRecipient(type, businessId, chatSessionId, content, recipient);
      }
      
      console.log(`${LOG_PREFIX} ✅ ${type} notification sent to ${targetRecipients.length} recipients`);
      
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Failed to send ${type} notification:`, error);
      throw error;
    }
  }
  
  /**
   * Finds appropriate recipients for notifications
   */
  static async findNotificationRecipients(businessId: string, type?: NotificationType): Promise<NotificationRecipient[]> {
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
      
      console.log(`${LOG_PREFIX} Found ${recipients.length} notification recipients (${businessAdmins.length} business admins, ${superAdmins.length} super admins)`);
      return recipients;
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Error finding notification recipients:`, error);
      return [];
    }
  }
  
  /**
   * Finds admin/provider users for a specific business
   */
  static async findBusinessAdmins(businessId: string): Promise<NotificationRecipient[]> {
    try {
      const { getEnvironmentServiceRoleClient } = await import("@/lib/database/supabase/environment");
      const { PROVIDER_ROLES } = await import("@/lib/database/models/user");
      const supa = getEnvironmentServiceRoleClient();
      
      const { data: users, error } = await supa
        .from('users')
        .select('id, firstName, lastName, phoneNormalized, whatsAppNumberNormalized, role, email')
        .eq('businessId', businessId)
        .in('role', PROVIDER_ROLES)
        .not('phoneNormalized', 'is', null);
      
      if (error) {
        console.error(`${LOG_PREFIX} Error finding business admins:`, error);
        return [];
      }
      
      return (users || []).map(user => ({
        userId: user.id,
        phoneNumber: `+${user.phoneNormalized || user.whatsAppNumberNormalized}`,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        isBusinessAdmin: true,
        isSuperAdmin: false
      }));
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Exception finding business admins:`, error);
      return [];
    }
  }
  
  /**
   * Finds super admin users (not tied to any specific business)
   */
  static async findSuperAdmins(): Promise<NotificationRecipient[]> {
    try {
      const { getEnvironmentServiceRoleClient } = await import("@/lib/database/supabase/environment");
      const supa = getEnvironmentServiceRoleClient();
      
      const { data: users, error } = await supa
        .from('users')
        .select('id, firstName, lastName, phoneNormalized, whatsAppNumberNormalized, role, email')
        .eq('role', 'super_admin')
        .not('phoneNormalized', 'is', null);
      
      if (error) {
        console.error(`${LOG_PREFIX} Error finding super admins:`, error);
        return [];
      }
      
      return (users || []).map(user => ({
        userId: user.id,
        phoneNumber: `+${user.phoneNormalized || user.whatsAppNumberNormalized}`,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        isBusinessAdmin: false,
        isSuperAdmin: true
      }));
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Exception finding super admins:`, error);
      return [];
    }
  }
  
  /**
   * Sends notification to a specific recipient
   */
  static async sendToRecipient(
    type: NotificationType,
    businessId: string,
    chatSessionId: string | undefined,
    content: NotificationContent,
    recipient: NotificationRecipient
  ): Promise<void> {
    try {
      // Create notification record in database
      const notification = await Notification.create({
        businessId,
        chatSessionId: chatSessionId || 'system-generated', // Use system-generated for non-chat notifications
        message: content.message,
        status: 'pending',
        notificationType: type
      });
      
      // Send via WhatsApp
      await this.sendWhatsAppNotification(notification.id, recipient, content, businessId);
      
      console.log(`${LOG_PREFIX} ✅ Sent ${type} notification to ${recipient.name} (${recipient.phoneNumber})`);
      
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Failed to send to ${recipient.name}:`, error);
      // Continue with other recipients even if one fails
    }
  }
  
  /**
   * Sends notification via WhatsApp
   */
  static async sendWhatsAppNotification(
    notificationId: string,
    recipient: NotificationRecipient,
    content: NotificationContent,
    businessId: string
  ): Promise<void> {
    try {
      const sender = new WhatsappSender();
      
      // Format message for WhatsApp
      const whatsappMessage = await this.formatMessageForWhatsApp(content, recipient, businessId);
      
      // Send the message
      const messageId: string | null = await sender.sendMessage(
        recipient.phoneNumber,
        { text: whatsappMessage },
        process.env.WHATSAPP_PHONE_NUMBER_ID as string
      );
      
      if (messageId) {
        // Mark notification as successfully sent
        await Notification.markDeliverySuccessWithMessageId(notificationId, messageId);
        console.log(`${LOG_PREFIX} WhatsApp message sent: ${messageId}`);
      } else {
        await Notification.markDeliveryFailure(notificationId, 'No message ID returned', recipient.phoneNumber);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Notification.markDeliveryFailure(notificationId, errorMessage, recipient.phoneNumber);
      throw error;
    }
  }
  
  /**
   * Formats notification content for WhatsApp
   */
  static async formatMessageForWhatsApp(
    content: NotificationContent,
    recipient: NotificationRecipient,
    businessId: string
  ): Promise<string> {
    let message = `${content.title}\n\n${content.message}`;
    
    // Add business context for super admins
    if (recipient.isSuperAdmin) {
      try {
        const business = await Business.getById(businessId);
        if (business) {
          message = `🏢 Business: ${business.name}\n\n${message}`;
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} Could not fetch business name for context`);
      }
    }
    
    return message;
  }
  
  /**
   * Convenience method for booking notifications specifically
   */
  static async sendBookingNotification(
    businessId: string,
    bookingDetails: any
  ): Promise<void> {
    const content = this.formatBookingNotificationContent(bookingDetails);
    
    await this.sendNotification({
      type: 'booking',
      businessId,
      chatSessionId: undefined, // Bookings don't have chat sessions
      content
    });
  }
  
  /**
   * Formats booking details into notification content
   */
  static formatBookingNotificationContent(bookingDetails: any): NotificationContent {
    const {
      bookingId,
      customerName,
      customerPhone,
      serviceName,
      servicesDisplay,
      isMultiService,
      formattedDate,
      formattedTime,
      location,
      totalCost,
      amountPaid,
      amountOwed
    } = bookingDetails;
    
    const title = "🎉 New Booking Confirmed!";
    
    let message = `📋 **Booking Details**\n`;
    message += `• ID: ${bookingId}\n`;
    message += `• Customer: ${customerName}\n`;
    if (customerPhone) {
      message += `• Phone: ${customerPhone}\n`;
    }
    message += `\n`;
    
    message += `🛍️ **Service${isMultiService ? 's' : ''}**\n`;
    message += `${servicesDisplay}\n\n`;
    
    message += `📅 **Schedule**\n`;
    message += `• Date: ${formattedDate}\n`;
    message += `• Time: ${formattedTime}\n`;
    message += `• Location: ${location}\n\n`;
    
    message += `💰 **Payment**\n`;
    message += `• Total: $${totalCost}\n`;
    if (amountPaid > 0) {
      message += `• Paid: $${amountPaid}\n`;
    }
    if (amountOwed > 0) {
      message += `• Remaining: $${amountOwed}\n`;
    }
    
    return {
      title,
      message,
      details: bookingDetails
    };
  }
} 