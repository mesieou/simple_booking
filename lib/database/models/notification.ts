import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from '../supabase/environment';
import { type Business } from './business';
import { type ChatSession } from './chat-session';

const NOTIFICATIONS_TABLE_NAME = 'notifications';

export type NotificationStatus = 'pending' | 'attending' | 'provided_help' | 'ignored' | 'wrong_activation';

export interface NotificationData {
  id: string;
  createdAt: string;
  businessId: string;
  chatSessionId: string;
  message: string;
  status: NotificationStatus;
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
}

export class Notification {
  id: string;
  createdAt: string;
  businessId: string;
  chatSessionId: string;
  message: string;
  status: NotificationStatus;

  private static _tableName = NOTIFICATIONS_TABLE_NAME;

  constructor(data: NotificationData) {
    this.id = data.id;
    this.createdAt = data.createdAt;
    this.businessId = data.businessId;
    this.chatSessionId = data.chatSessionId;
    this.message = data.message;
    this.status = data.status;
  }

  static fromRow(row: any): Notification {
    return new Notification({
      id: row.id,
      createdAt: row.created_at,
      businessId: row.businessId,
      chatSessionId: row.chatSessionId,
      message: row.message,
      status: row.status,
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
} 