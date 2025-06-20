import { createClient } from '../supabase/server';
import { type Business } from './business';
import { type ChatSession } from './chat-session';

const NOTIFICATIONS_TABLE_NAME = 'notifications';

export type NotificationStatus = 'pending' | 'provided_help' | 'ignored' | 'wrong_activation';

export interface NotificationData {
  id: string;
  createdAt: string;
  businessId: string;
  chatSessionId: string;
  message: string;
  status: NotificationStatus;
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
} 