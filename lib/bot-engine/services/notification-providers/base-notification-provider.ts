import { NotificationType } from '@/lib/database/models/notification';

export interface NotificationRecipient {
  userId: string;
  phoneNumber: string;
  email?: string;
  name: string;
  role: string;
  isBusinessAdmin: boolean;
  isSuperAdmin: boolean;
  preferredChannel?: 'whatsapp' | 'sms' | 'email' | 'push';
}

export interface NotificationContent {
  title: string;
  message: string;
  details?: Record<string, any>;
  // Provider-agnostic data - each provider extracts what it needs
  data?: Record<string, any>;
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  method?: string; // 'template', 'regular', 'html', etc.
}

/**
 * Base interface for all notification providers
 * Each provider handles its own requirements (templates, formatting, etc.)
 */
export abstract class BaseNotificationProvider {
  abstract readonly providerName: string;
  abstract readonly supportedChannels: string[];

  /**
   * Send notification using provider-specific logic
   * Each provider decides how to handle templates, formatting, etc.
   */
  abstract sendNotification(
    type: NotificationType,
    recipient: NotificationRecipient,
    content: NotificationContent,
    businessContext: {
      businessId: string;
      businessPhoneNumberId?: string;
      businessName?: string;
      businessEmail?: string;
    }
  ): Promise<DeliveryResult>;

  /**
   * Validate if provider can handle this recipient
   */
  abstract canHandle(recipient: NotificationRecipient): boolean;

  /**
   * Get provider-specific configuration
   */
  abstract getConfiguration(): Record<string, any>;

  /**
   * Provider-specific health check
   */
  async healthCheck(): Promise<boolean> {
    return true; // Override in specific providers
  }
} 