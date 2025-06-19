import { createClient } from "../supabase/server";
import { handleModelError } from '@/lib/general-helpers/error';

export interface NotificationData {
  id?: string;
  businessId: string;
  chatSessionId: string;
  message: string;
  status: 'unread' | 'read';
  createdAt?: string;
}

export class Notification {
  
  static async create(input: Omit<NotificationData, 'id' | 'createdAt' | 'status'> & { status?: 'unread' | 'read' }): Promise<NotificationData> {
    const supa = await createClient();
    
    const notificationData = {
      ...input,
      status: input.status || 'unread',
      createdAt: new Date().toISOString()
    };

    const { data, error } = await supa
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();
      
    if (error) {
      handleModelError('Failed to create notification', error);
    }
    
    return data;
  }
} 