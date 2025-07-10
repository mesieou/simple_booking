import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from '../supabase/environment';
import { type Business } from './business';
import { type ChatSession } from './chat-session';

const NOTIFICATIONS_TABLE_NAME = 'notifications';

export type NotificationStatus = 'pending' | 'attending' | 'provided_help' | 'ignored' | 'wrong_activation';

// NEW: Delivery status tracking
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'retry_scheduled';

export interface NotificationData {
  id: string;
  createdAt: string;
  businessId: string;
  chatSessionId: string;
  message: string;
  status: NotificationStatus;
  // NEW: Delivery tracking fields
  deliveryStatus?: DeliveryStatus;
  deliveryAttempts?: number;
  lastDeliveryAttempt?: string;
  deliveryError?: string;
  targetPhoneNumber?: string;
  whatsappMessageId?: string;
}

export interface DashboardNotificationData {
  id: string;
  createdAt: string;
  businessId: string;
  chatSessionId: string;
  message: string;
  status: NotificationStatus;
  channelUserId: string;
  isRead: boolean;
  // NEW: Delivery info for dashboard
  deliveryStatus?: DeliveryStatus;
  deliveryError?: string;
  whatsappMessageId?: string;
}

export class Notification {
  id: string;
  createdAt: string;
  businessId: string;
  chatSessionId: string;
  message: string;
  status: NotificationStatus;
  // NEW: Delivery tracking properties
  deliveryStatus?: DeliveryStatus;
  deliveryAttempts?: number;
  lastDeliveryAttempt?: string;
  deliveryError?: string;
  targetPhoneNumber?: string;
  whatsappMessageId?: string;

  private static _tableName = NOTIFICATIONS_TABLE_NAME;

  constructor(data: NotificationData) {
    this.id = data.id;
    this.createdAt = data.createdAt;
    this.businessId = data.businessId;
    this.chatSessionId = data.chatSessionId;
    this.message = data.message;
    this.status = data.status;
    this.deliveryStatus = data.deliveryStatus;
    this.deliveryAttempts = data.deliveryAttempts;
    this.lastDeliveryAttempt = data.lastDeliveryAttempt;
    this.deliveryError = data.deliveryError;
    this.targetPhoneNumber = data.targetPhoneNumber;
    this.whatsappMessageId = data.whatsappMessageId;
  }

  static fromRow(row: any): Notification {
    return new Notification({
      id: row.id,
      createdAt: row.created_at,
      businessId: row.businessId,
      chatSessionId: row.chatSessionId,
      message: row.message,
      status: row.status,
      // NEW: Map delivery fields
      deliveryStatus: row.deliveryStatus,
      deliveryAttempts: row.deliveryAttempts,
      lastDeliveryAttempt: row.lastDeliveryAttempt,
      deliveryError: row.deliveryError,
      targetPhoneNumber: row.targetPhoneNumber,
      whatsappMessageId: row.whatsappMessageId,
    });
  }

  static async create(data: {
    businessId: string;
    chatSessionId: string;
    message: string;
    status: NotificationStatus;
  }): Promise<Notification> {
    const supabase = getEnvironmentServiceRoleClient();
    const { data: row, error } = await supabase
      .from(this._tableName)
      .insert({
        businessId: data.businessId,
        chatSessionId: data.chatSessionId,
        message: data.message,
        status: data.status,
      })
      .select()
      .single();

    if (error) {
      console.error(`[NotificationDB] Error creating notification:`, error);
      throw new Error('Failed to create notification.');
    }

    return this.fromRow(row);
  }
  
  static async getById(id: string): Promise<Notification | null> {
    const supabase = getEnvironmentServerClient();
    const { data, error } = await supabase
      .from(this._tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // PostgREST error for "Not a single row"
        return null;
      }
      console.error(`[NotificationDB] Error fetching notification by ID:`, error);
      throw error;
    }

    return data ? this.fromRow(data) : null;
  }

  static async resolve(
    notificationId: string,
    newStatus: 'provided_help' | 'ignored' | 'wrong_activation'
  ): Promise<Notification | null> {
    const notification = await this.getById(notificationId);
    if (!notification) {
      console.error(`[NotificationDB] Cannot resolve: Notification not found with ID ${notificationId}`);
      return null;
    }

    // 1. Update the notification status
    const supabase = getEnvironmentServerClient();
    const { data: updatedRow, error: updateError } = await supabase
      .from(this._tableName)
      .update({ status: newStatus })
      .eq('id', notificationId)
      .select()
      .single();
      
    if (updateError) {
      console.error(`[NotificationDB] Error updating notification status:`, updateError);
      throw updateError;
    }

    // 2. Unlock the associated chat session
    try {
      const { ChatSession } = await import('./chat-session');
      await ChatSession.updateStatus(notification.chatSessionId, 'completed');
      console.log(`[NotificationDB] Unlocked chat session ${notification.chatSessionId} by setting status to 'completed'.`);
    } catch (sessionError) {
      console.error(`[NotificationDB] Failed to unlock chat session ${notification.chatSessionId}:`, sessionError);
      // Decide if we should roll back the notification status change or just log the error
      // For now, we'll log it and proceed.
    }

    return this.fromRow(updatedRow);
  }

  /**
   * Checks if there is at least one pending escalation for a given chat session.
   * This is used to determine if the bot should be blocked from responding.
   * @param chatSessionId The ID of the chat session to check
   * @returns Promise<boolean> - true if there's a pending escalation, false otherwise
   */
  static async hasPendingEscalation(chatSessionId: string): Promise<boolean> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      const { data, error } = await supabase
        .from(this._tableName)
        .select('id')
        .eq('chatSessionId', chatSessionId)
        .in('status', ['pending', 'attending']) // Bot should be blocked for both states
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`[NotificationDB] Error checking for pending escalation:`, error);
        // In case of error, we'll assume no pending escalation to avoid blocking the bot unnecessarily
        return false;
      }

      // If data exists, there's at least one pending or attending escalation
      return !!data;
    } catch (error) {
      console.error(`[NotificationDB] Exception checking for pending escalation:`, error);
      // In case of exception, we'll assume no pending escalation to avoid blocking the bot unnecessarily
      return false;
    }
  }

  /**
   * Gets the specific escalation status for a given chat session.
   * This allows for different bot behaviors based on the escalation state.
   * @param chatSessionId The ID of the chat session to check
   * @returns Promise<NotificationStatus | null> - the status if escalation exists, null otherwise
   */
  static async getEscalationStatus(chatSessionId: string): Promise<NotificationStatus | null> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      const { data, error } = await supabase
        .from(this._tableName)
        .select('status')
        .eq('chatSessionId', chatSessionId)
        .in('status', ['pending', 'attending']) // Only active escalations
        .order('createdAt', { ascending: false }) // Get the most recent
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`[NotificationDB] Error checking escalation status:`, error);
        return null;
      }

      return data?.status || null;
    } catch (error) {
      console.error(`[NotificationDB] Exception checking escalation status:`, error);
      return null;
    }
  }

  /**
   * Gets all notifications for a business with read status for dashboard display
   * @param businessId The business ID to get notifications for
   * @param userId The current user ID to check read status
   * @returns Promise<DashboardNotificationData[]>
   */
  static async getDashboardNotifications(businessId: string, userId: string): Promise<DashboardNotificationData[]> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      // Get notifications with session info and read status
      const { data, error } = await supabase
        .from(this._tableName)
        .select(`
          id,
          createdAt,
          businessId,
          chatSessionId,
          message,
          status,
          chatSessions!inner(channelUserId),
          notification_reads(id)
        `)
        .eq('businessId', businessId)
        .eq('notification_reads.userId', userId)
        .order('createdAt', { ascending: false });

      if (error) {
        console.error(`[NotificationDB] Error fetching dashboard notifications:`, error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        createdAt: row.createdAt,
        businessId: row.businessId,
        chatSessionId: row.chatSessionId,
        message: row.message,
        status: row.status,
        channelUserId: (row.chatSessions as any).channelUserId,
        isRead: !!(row.notification_reads as any[])?.length,
      }));
    } catch (error) {
      console.error(`[NotificationDB] Exception fetching dashboard notifications:`, error);
      return [];
    }
  }

  /**
   * Marks a notification as read for a specific user
   * @param notificationId The notification ID to mark as read
   * @param userId The user ID who read the notification
   */
  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      // Insert or ignore if already exists
      const { error } = await supabase
        .from('notification_reads')
        .upsert(
          { notificationId, userId },
          { onConflict: 'notificationId,userId' }
        );

      if (error) {
        console.error(`[NotificationDB] Error marking notification as read:`, error);
        throw new Error('Failed to mark notification as read');
      }
    } catch (error) {
      console.error(`[NotificationDB] Exception marking notification as read:`, error);
      throw error;
    }
  }

  /**
   * Simplified version for dashboard that gets notifications with session data
   * without requiring a separate table join (fallback approach)
   */
  static async getDashboardNotificationsSimple(businessId: string): Promise<Array<{
    id: string;
    createdAt: string;
    message: string;
    status: NotificationStatus;
    chatSessionId: string;
    channelUserId: string;
  }>> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      // Get all notifications for the business
      const { data: notifications, error: notificationsError } = await supabase
        .from(this._tableName)
        .select('*')
        .eq('businessId', businessId)
        .order('createdAt', { ascending: false });

      if (notificationsError) {
        console.error(`[NotificationDB] Error fetching notifications:`, notificationsError);
        return [];
      }

      if (!notifications?.length) {
        return [];
      }

      // Get session data for all notifications
      const sessionIds = notifications.map(n => n.chatSessionId);
      const { data: sessions, error: sessionsError } = await supabase
        .from('chatSessions')
        .select('id, channelUserId')
        .in('id', sessionIds);

      if (sessionsError) {
        console.error(`[NotificationDB] Error fetching sessions:`, sessionsError);
        return [];
      }

      // Map session data to notifications
      const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
      
      return notifications
        .map(notification => {
          const session = sessionMap.get(notification.chatSessionId);
          if (!session) return null;
          
          return {
            id: notification.id,
            createdAt: notification.createdAt,
            message: notification.message,
            status: notification.status,
            chatSessionId: notification.chatSessionId,
            channelUserId: session.channelUserId,
          };
        })
        .filter(Boolean) as Array<{
          id: string;
          createdAt: string;
          message: string;
          status: NotificationStatus;
          chatSessionId: string;
          channelUserId: string;
        }>;
    } catch (error) {
      console.error(`[NotificationDB] Exception fetching simple dashboard notifications:`, error);
      return [];
    }
  }

  /**
   * Gets the count of escalations for a specific phone number
   * @param phoneNumber The WhatsApp phone number to count escalations for
   * @returns Promise<number> - count of escalations for this phone number
   */
  static async getEscalationCountByPhoneNumber(phoneNumber: string): Promise<number> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      // First get chat sessions for this phone number
      const { data: sessions, error: sessionError } = await supabase
        .from('chatSessions')
        .select('id')
        .eq('channelUserId', phoneNumber);

      if (sessionError || !sessions?.length) {
        console.error(`[NotificationDB] Error fetching sessions for phone number:`, sessionError);
        return 0;
      }

      const sessionIds = sessions.map(s => s.id);

      // Count notifications for these sessions
      const { count, error } = await supabase
        .from(this._tableName)
        .select('id', { count: 'exact' })
        .in('chatSessionId', sessionIds);

      if (error) {
        console.error(`[NotificationDB] Error counting escalations for phone number:`, error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error(`[NotificationDB] Exception counting escalations:`, error);
      return 0;
    }
  }

  /**
   * Gets the last escalation for a specific phone number
   * @param phoneNumber The WhatsApp phone number to get last escalation for
   * @returns Promise<Notification | null> - the most recent escalation or null
   */
  static async getLastEscalationByPhoneNumber(phoneNumber: string): Promise<Notification | null> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      // First get chat sessions for this phone number
      const { data: sessions, error: sessionError } = await supabase
        .from('chatSessions')
        .select('id')
        .eq('channelUserId', phoneNumber);

      if (sessionError || !sessions?.length) {
        console.error(`[NotificationDB] Error fetching sessions for phone number:`, sessionError);
        return null;
      }

      const sessionIds = sessions.map(s => s.id);

      // Get the most recent notification for any of these sessions
      const { data, error } = await supabase
        .from(this._tableName)
        .select('*')
        .in('chatSessionId', sessionIds)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`[NotificationDB] Error fetching last escalation:`, error);
        return null;
      }

      return data ? this.fromRow(data) : null;
    } catch (error) {
      console.error(`[NotificationDB] Exception fetching last escalation:`, error);
      return null;
    }
  }

  /**
   * Gets notifications from all businesses for superadmin
   * @returns Promise<Array> - notifications from all businesses
   */
  static async getAllBusinessesNotifications(): Promise<Array<{
    id: string;
    createdAt: string;
    message: string;
    status: NotificationStatus;
    chatSessionId: string;
    channelUserId: string;
  }>> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      // Get all notifications from all businesses
      const { data: notifications, error: notificationsError } = await supabase
        .from(this._tableName)
        .select('*')
        .order('createdAt', { ascending: false });

      if (notificationsError) {
        console.error(`[NotificationDB] Error fetching all notifications:`, notificationsError);
        return [];
      }

      if (!notifications?.length) {
        return [];
      }

      // Get session data for all notifications
      const sessionIds = notifications.map(n => n.chatSessionId);
      const { data: sessions, error: sessionsError } = await supabase
        .from('chatSessions')
        .select('id, channelUserId')
        .in('id', sessionIds);

      if (sessionsError) {
        console.error(`[NotificationDB] Error fetching sessions:`, sessionsError);
        return [];
      }

      // Map session data to notifications
      const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
      
      return notifications
        .map(notification => {
          const session = sessionMap.get(notification.chatSessionId);
          if (!session) return null;
          
          return {
            id: notification.id,
            createdAt: notification.createdAt,
            message: notification.message,
            status: notification.status,
            chatSessionId: notification.chatSessionId,
            channelUserId: session.channelUserId,
          };
        })
        .filter(Boolean) as Array<{
          id: string;
          createdAt: string;
          message: string;
          status: NotificationStatus;
          chatSessionId: string;
          channelUserId: string;
        }>;
    } catch (error) {
      console.error(`[NotificationDB] Exception fetching all business notifications:`, error);
      return [];
    }
  }

  // NEW: Track delivery success
  static async markDeliverySuccess(notificationId: string): Promise<void> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      const { error } = await supabase
        .from(this._tableName)
        .update({
          deliveryStatus: 'sent', // Changed from 'sent' to be more accurate - this is just API acceptance
          lastDeliveryAttempt: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) {
        console.error(`[NotificationDB] Error marking delivery success:`, error);
        throw error;
      }

      console.log(`[NotificationDB] Marked notification ${notificationId} as sent to WhatsApp API`);
    } catch (error) {
      console.error(`[NotificationDB] Exception marking delivery success:`, error);
      throw error;
    }
  }

  // NEW: Track delivery success with WhatsApp message ID
  static async markDeliverySuccessWithMessageId(notificationId: string, whatsappMessageId: string | null): Promise<void> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      const updateData: any = {
        deliveryStatus: 'sent',
        lastDeliveryAttempt: new Date().toISOString(),
      };
      
      if (whatsappMessageId) {
        updateData.whatsappMessageId = whatsappMessageId;
      }
      
      const { error } = await supabase
        .from(this._tableName)
        .update(updateData)
        .eq('id', notificationId);

      if (error) {
        console.error(`[NotificationDB] Error marking delivery success with message ID:`, error);
        throw error;
      }

      console.log(`[NotificationDB] Marked notification ${notificationId} as sent to WhatsApp API (Message ID: ${whatsappMessageId || 'none'})`);
    } catch (error) {
      console.error(`[NotificationDB] Exception marking delivery success:`, error);
      throw error;
    }
  }

  // NEW: Update delivery status by WhatsApp message ID
  static async updateDeliveryStatusByMessageId(
    whatsappMessageId: string, 
    status: 'sent' | 'delivered' | 'read' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      const updateData: any = {
        deliveryStatus: status,
        lastDeliveryAttempt: new Date().toISOString(),
      };
      
      if (errorMessage) {
        updateData.deliveryError = errorMessage;
      }
      
      // Try to find by exact WhatsApp message ID match first
      const { data: updated, error } = await supabase
        .from(this._tableName)
        .update(updateData)
        .eq('whatsappMessageId', whatsappMessageId)
        .select('id, targetPhoneNumber');

      if (error) {
        console.error(`[NotificationDB] Error updating delivery status by message ID:`, error);
        throw error;
      }

      if (updated && updated.length > 0) {
        console.log(`[NotificationDB] Updated notification ${updated[0].id} status to: ${status} (Message ID: ${whatsappMessageId})`);
      } else {
        // Fallback: try to match by recent timestamp and sent status for backward compatibility
        console.log(`[NotificationDB] No exact match for message ID ${whatsappMessageId}, trying fallback matching...`);
        
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        const { data: fallbackUpdated, error: fallbackError } = await supabase
          .from(this._tableName)
          .update(updateData)
          .gte('createdAt', oneHourAgo) // Only recent notifications
          .eq('deliveryStatus', 'sent') // Only notifications that were previously sent
          .is('whatsappMessageId', null) // Only notifications without stored message ID
          .select('id, targetPhoneNumber')
          .limit(1);

        if (fallbackError) {
          console.error(`[NotificationDB] Error in fallback update:`, fallbackError);
        } else if (fallbackUpdated && fallbackUpdated.length > 0) {
          console.log(`[NotificationDB] Fallback updated notification ${fallbackUpdated[0].id} status to: ${status}`);
        } else {
          console.log(`[NotificationDB] No matching notification found for WhatsApp message: ${whatsappMessageId}`);
        }
      }
    } catch (error) {
      console.error(`[NotificationDB] Exception updating delivery status:`, error);
      throw error;
    }
  }

  // NEW: Track delivery failure
  static async markDeliveryFailure(
    notificationId: string, 
    errorMessage: string,
    targetPhone?: string
  ): Promise<void> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      // Get current attempt count
      const { data: current } = await supabase
        .from(this._tableName)
        .select('deliveryAttempts')
        .eq('id', notificationId)
        .single();

      const attemptCount = (current?.deliveryAttempts || 0) + 1;
      const maxAttempts = 3;
      const deliveryStatus: DeliveryStatus = attemptCount >= maxAttempts ? 'failed' : 'retry_scheduled';

      const { error } = await supabase
        .from(this._tableName)
        .update({
          deliveryStatus,
          deliveryAttempts: attemptCount,
          lastDeliveryAttempt: new Date().toISOString(),
          deliveryError: errorMessage,
          targetPhoneNumber: targetPhone,
        })
        .eq('id', notificationId);

      if (error) {
        console.error(`[NotificationDB] Error marking delivery failure:`, error);
        throw error;
      }

      console.log(`[NotificationDB] Marked notification ${notificationId} delivery failure (attempt ${attemptCount}/${maxAttempts}): ${errorMessage}`);
      
      // Alert if max attempts reached
      if (attemptCount >= maxAttempts) {
        console.error(`[NotificationDB] 🚨 CRITICAL: Escalation notification ${notificationId} failed all delivery attempts to ${targetPhone}`);
        // TODO: Send alert to system administrators
      }
    } catch (error) {
      console.error(`[NotificationDB] Exception marking delivery failure:`, error);
      throw error;
    }
  }

  // NEW: Get failed delivery notifications for retry
  static async getFailedDeliveries(): Promise<Notification[]> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      const { data, error } = await supabase
        .from(this._tableName)
        .select('*')
        .eq('deliveryStatus', 'retry_scheduled')
        .lt('deliveryAttempts', 3)
        .order('lastDeliveryAttempt', { ascending: true });

      if (error) {
        console.error(`[NotificationDB] Error fetching failed deliveries:`, error);
        return [];
      }

      return (data || []).map(row => this.fromRow(row));
    } catch (error) {
      console.error(`[NotificationDB] Exception fetching failed deliveries:`, error);
      return [];
    }
  }
} 