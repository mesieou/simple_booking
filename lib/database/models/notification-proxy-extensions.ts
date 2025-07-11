import { getEnvironmentServiceRoleClient } from "@/lib/database/supabase/environment";
import { Notification, NotificationData } from './notification';
import { 
  type ProxyNotificationStatus,
  type ProxySessionData 
} from '@/lib/bot-engine/escalation/types';

const LOG_PREFIX = '[NotificationProxyExtensions]';

/**
 * Extensions to the Notification model for proxy escalation functionality
 */
class NotificationProxyExtensions {
  
  /**
   * Updates notification status to proxy mode with session data
   */
  static async updateStatusToProxyMode(
    notificationId: string,
    proxyData: ProxySessionData
  ): Promise<void> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      const updateData = {
        status: 'proxy_mode' as ProxyNotificationStatus,
        deliveryStatus: 'sent',
        whatsappMessageId: proxyData.templateMessageId,
        lastDeliveryAttempt: new Date().toISOString(),
        // Store proxy session data in the JSONB column
        proxySessionData: proxyData
      };
      
      const { error } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('id', notificationId);

      if (error) {
        console.error(`${LOG_PREFIX} Error updating notification to proxy mode:`, error);
        throw error;
      }

      console.log(`${LOG_PREFIX} ✅ Notification ${notificationId} updated to proxy mode`);
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Exception updating notification to proxy mode:`, error);
      throw error;
    }
  }
  
  /**
   * Gets active proxy session by admin phone number
   */
  static async getActiveProxyByAdminPhone(adminPhone: string): Promise<NotificationData | null> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('status', 'proxy_mode')
        .eq('targetPhoneNumber', adminPhone)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`${LOG_PREFIX} Error getting proxy session by admin phone:`, error);
        return null;
      }

      if (data) {
        console.log(`${LOG_PREFIX} Found active proxy session for admin: ${adminPhone}`);
      }

      return data;
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Exception getting proxy session by admin phone:`, error);
      return null;
    }
  }
  
  /**
   * Gets active proxy session by session ID
   */
  static async getActiveProxyBySessionId(sessionId: string): Promise<NotificationData | null> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('status', 'proxy_mode')
        .eq('chatSessionId', sessionId)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`${LOG_PREFIX} Error getting proxy session by session ID:`, error);
        return null;
      }

      if (data) {
        console.log(`${LOG_PREFIX} Found active proxy session for session: ${sessionId}`);
      }

      return data;
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Exception getting proxy session by session ID:`, error);
      return null;
    }
  }
  
  /**
   * Checks if a session is currently in proxy mode
   */
  static async isSessionInProxyMode(sessionId: string): Promise<boolean> {
    try {
      const proxySession = await this.getActiveProxyBySessionId(sessionId);
      return !!proxySession;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error checking proxy mode status:`, error);
      return false;
    }
  }
  
  /**
   * Gets all active proxy sessions (for monitoring/debugging)
   */
  static async getAllActiveProxySessions(): Promise<NotificationData[]> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('status', 'proxy_mode')
        .order('createdAt', { ascending: false });

      if (error) {
        console.error(`${LOG_PREFIX} Error getting all active proxy sessions:`, error);
        return [];
      }

      console.log(`${LOG_PREFIX} Found ${data?.length || 0} active proxy sessions`);
      return data || [];
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Exception getting all active proxy sessions:`, error);
      return [];
    }
  }
  
  /**
   * Ends proxy mode and updates notification status
   */
  static async endProxyMode(notificationId: string): Promise<void> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      // Get current proxy session data
      const { data: currentData } = await supabase
        .from('notifications')
        .select('proxySessionData')
        .eq('id', notificationId)
        .single();
      
      let updatedProxyData = currentData?.proxySessionData || {};
      if (typeof updatedProxyData === 'object') {
        updatedProxyData.endedAt = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('notifications')
        .update({
          status: 'provided_help',
          proxySessionData: updatedProxyData
        })
        .eq('id', notificationId);

      if (error) {
        console.error(`${LOG_PREFIX} Error ending proxy mode:`, error);
        throw error;
      }

      console.log(`${LOG_PREFIX} ✅ Proxy mode ended for notification: ${notificationId}`);
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Exception ending proxy mode:`, error);
      throw error;
    }
  }
  
  /**
   * Gets proxy session statistics for monitoring
   */
  static async getProxySessionStats(): Promise<{
    activeCount: number;
    totalToday: number;
    averageDuration: number | null;
  }> {
    try {
      const supabase = getEnvironmentServiceRoleClient();
      
      // Get active count
      const { data: activeData, error: activeError } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('status', 'proxy_mode');
      
      if (activeError) {
        throw activeError;
      }
      
      // Get today's proxy sessions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: todayData, error: todayError } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('status', 'proxy_mode')
        .gte('createdAt', today.toISOString());
      
      if (todayError) {
        throw todayError;
      }
      
      return {
        activeCount: activeData?.length || 0,
        totalToday: todayData?.length || 0,
        averageDuration: null // We can calculate this later with more complex query
      };
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Error getting proxy session stats:`, error);
      return {
        activeCount: 0,
        totalToday: 0,
        averageDuration: null
      };
    }
  }
}

// Extend the main Notification class with proxy methods
declare module './notification' {
  namespace Notification {
    function updateStatusToProxyMode(notificationId: string, proxyData: ProxySessionData): Promise<void>;
    function getActiveProxyByAdminPhone(adminPhone: string): Promise<NotificationData | null>;
    function getActiveProxyBySessionId(sessionId: string): Promise<NotificationData | null>;
    function isSessionInProxyMode(sessionId: string): Promise<boolean>;
  }
}

// Monkey patch the Notification class to add proxy methods
Object.assign(Notification, {
  updateStatusToProxyMode: NotificationProxyExtensions.updateStatusToProxyMode,
  getActiveProxyByAdminPhone: NotificationProxyExtensions.getActiveProxyByAdminPhone,
  getActiveProxyBySessionId: NotificationProxyExtensions.getActiveProxyBySessionId,
  isSessionInProxyMode: NotificationProxyExtensions.isSessionInProxyMode,
});

// Export the class for external use
export { NotificationProxyExtensions }; 