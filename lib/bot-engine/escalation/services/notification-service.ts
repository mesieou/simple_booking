import { Notification } from '@/lib/database/models/notification';
import { Business } from '@/lib/database/models/business';
import { EscalationError, EscalationErrorCode } from '../types';

const LOG_PREFIX = '[NotificationService]';

export class NotificationService {
  /**
   * Creates an escalation notification with comprehensive error handling
   */
  static async createEscalationNotification(data: {
    businessId: string;
    chatSessionId: string;
    escalationReason: string;
    message?: string;
  }): Promise<Notification> {
    const { businessId, chatSessionId, escalationReason, message } = data;
    
    try {
      const notification = await Notification.create({
        businessId,
        chatSessionId,
        message: message || `Escalation triggered: ${escalationReason}`,
        status: 'pending'
      });
      
      if (!notification) {
        throw new EscalationError(
          'Failed to create notification record',
          EscalationErrorCode.DATABASE_OPERATION_FAILED,
          { businessId, chatSessionId, escalationReason }
        );
      }
      
      console.log(`${LOG_PREFIX} ✅ Escalation notification created: ${notification.id}`);
      return notification;
      
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Failed to create escalation notification:`, error);
      
      if (error instanceof EscalationError) {
        throw error;
      }
      
      throw new EscalationError(
        'Database operation failed during notification creation',
        EscalationErrorCode.DATABASE_OPERATION_FAILED,
        { 
          businessId, 
          chatSessionId, 
          escalationReason,
          originalError: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  }
  
  /**
   * Gets business information with error handling
   */
  static async getBusinessWithValidation(businessId: string): Promise<Business> {
    try {
      const business = await Business.getByIdWithServiceRole(businessId);
      
      if (!business) {
        throw new EscalationError(
          `Business not found: ${businessId}`,
          EscalationErrorCode.BUSINESS_NOT_FOUND,
          { businessId }
        );
      }
      
      return business;
      
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Failed to get business:`, error);
      
      if (error instanceof EscalationError) {
        throw error;
      }
      
      throw new EscalationError(
        'Failed to fetch business information',
        EscalationErrorCode.DATABASE_OPERATION_FAILED,
        { businessId, originalError: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
  
  /**
   * Validates business has required phone number for escalation
   */
  static validateBusinessForEscalation(business: Business): void {
    if (!business.phone) {
      throw new EscalationError(
        `Business ${business.id} does not have a phone number configured for escalation notifications`,
        EscalationErrorCode.INVALID_PHONE_NUMBER,
        { businessId: business.id, businessName: business.name }
      );
    }
  }
  
  /**
   * Marks notification delivery as successful
   */
  static async markDeliverySuccess(
    notificationId: string,
    whatsappMessageId: string,
    method: 'template' | 'regular' = 'template'
  ): Promise<void> {
    try {
      await Notification.markDeliverySuccessWithMessageId(
        notificationId,
        whatsappMessageId,
        method === 'regular' ? 'fallback_regular_message' : undefined
      );
      
      console.log(`${LOG_PREFIX} ✅ Notification delivery marked as successful: ${notificationId}`);
      
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Failed to mark delivery success:`, error);
      
      throw new EscalationError(
        'Failed to update notification delivery status',
        EscalationErrorCode.DATABASE_OPERATION_FAILED,
        { 
          notificationId, 
          whatsappMessageId, 
          method,
          originalError: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  }
  
  /**
   * Marks notification delivery as failed
   */
  static async markDeliveryFailure(
    notificationId: string,
    error: unknown,
    targetPhone?: string
  ): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await Notification.markDeliveryFailure(
        notificationId,
        errorMessage,
        targetPhone
      );
      
      console.log(`${LOG_PREFIX} ⚠️ Notification delivery marked as failed: ${notificationId}`);
      
    } catch (dbError) {
      console.error(`${LOG_PREFIX} ❌ Failed to mark delivery failure:`, dbError);
      
      // Don't throw here - we don't want to mask the original error
      // The original error should be handled by the caller
    }
  }
  
  /**
   * Resolves notification with proper status
   */
  static async resolveNotification(
    notificationId: string,
    status: 'provided_help' | 'ignored' | 'wrong_activation'
  ): Promise<void> {
    try {
      const resolvedNotification = await Notification.resolve(notificationId, status);
      
      if (!resolvedNotification) {
        throw new EscalationError(
          `Failed to resolve notification: ${notificationId}`,
          EscalationErrorCode.DATABASE_OPERATION_FAILED,
          { notificationId, status }
        );
      }
      
      console.log(`${LOG_PREFIX} ✅ Notification resolved: ${notificationId} (${status})`);
      
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Failed to resolve notification:`, error);
      
      if (error instanceof EscalationError) {
        throw error;
      }
      
      throw new EscalationError(
        'Failed to resolve notification',
        EscalationErrorCode.DATABASE_OPERATION_FAILED,
        { 
          notificationId, 
          status,
          originalError: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  }
} 