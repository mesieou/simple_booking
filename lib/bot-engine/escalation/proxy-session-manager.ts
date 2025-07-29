import { Notification } from '@/lib/database/models/notification';
import '@/lib/database/models/notification-proxy-extensions'; // Import to enable proxy methods
import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';
import { 
  type ProxySession,
  type ProxySessionData,
  type ProxySessionActivity,
  ESCALATION_CONSTANTS 
} from './types';
import { NotificationService } from './services/notification-service';

const LOG_PREFIX = '[ProxySessionManager]';

// Use shared proxy configuration
const PROXY_CONFIG = ESCALATION_CONSTANTS.PROXY_CONFIG;

/**
 * Creates a new proxy session by updating notification status
 */
export async function createProxySession(
  notificationId: string,
  sessionData: ProxySessionData
): Promise<void> {
  console.log(`${LOG_PREFIX} Creating proxy session for notification: ${notificationId}`);
  
  try {
    await Notification.updateStatusToProxyMode(notificationId, sessionData);
    console.log(`${LOG_PREFIX} ✅ Proxy session created successfully`);
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Failed to create proxy session:`, error);
    throw error;
  }
}

/**
 * Ends proxy mode and returns control to bot
 */
export async function endProxySession(
  notificationId: string,
  adminPhone: string,
  businessPhoneNumberId: string
): Promise<void> {
  console.log(`${LOG_PREFIX} Ending proxy session for notification: ${notificationId}`);
  
  try {
    // Update notification status to completed
    await NotificationService.resolveNotification(notificationId, 'provided_help');
    
    // Send confirmation to admin
    const sender = new WhatsappSender();
    await sender.sendMessage(
      adminPhone,
      { text: "🔄 Proxy mode ended. Bot has resumed control of the conversation." },
      businessPhoneNumberId
    );
    
    console.log(`${LOG_PREFIX} ✅ Proxy session ended successfully`);
    
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Error ending proxy session:`, error);
    throw error;
  }
}

/**
 * Checks if a message is a takeover command (text or button)
 */
export function isTakeoverCommand(message: string, buttonId?: string): boolean {
  // Check button press first
  if (buttonId && buttonId === PROXY_CONFIG.TAKEOVER_BUTTON_ID) {
    return true;
  }
  
  // Check text command as fallback
  if (message) {
    const trimmed = message.trim();
    return PROXY_CONFIG.TAKEOVER_KEYWORDS.some(keyword => 
      trimmed.toLowerCase() === keyword.toLowerCase()
    );
  }
  
  return false;
}

/**
 * Gets active proxy session by admin phone number
 */
export async function getProxySessionByAdmin(adminPhone: string): Promise<ProxySession | null> {
  try {
    const notification = await Notification.getActiveProxyByAdminPhone(adminPhone);
    if (!notification) return null;
    
    // Get customer phone from session data
    const customerPhone = notification.chatSessionId ? 
      await getCustomerPhoneFromSession(notification.chatSessionId) : 
      null;
    
    return {
      notificationId: notification.id,
      sessionId: notification.chatSessionId || '', // Handle null case
      adminPhone: adminPhone,
      customerPhone: customerPhone || '', // Now properly retrieved from session
      businessPhoneNumberId: '', // We'll get this from business
      isActive: true
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting proxy session by admin:`, error);
    return null;
  }
}

/**
 * Gets active proxy session by session ID
 */
export async function getProxySessionBySessionId(sessionId: string): Promise<ProxySession | null> {
  try {
    const notification = await Notification.getActiveProxyBySessionId(sessionId);
    if (!notification) return null;
    
    // Get customer phone from session data
    const customerPhone = await getCustomerPhoneFromSession(sessionId);
    
    // Get admin phone from notification data (assuming it's stored in proxyData)
    const adminPhone = await getAdminPhoneFromNotification(notification);
    
    return {
      notificationId: notification.id,
      sessionId: sessionId,
      adminPhone: adminPhone || '', // Now properly retrieved from notification
      customerPhone: customerPhone || '', // Now properly retrieved from session
      businessPhoneNumberId: '', // We'll get this from business
      isActive: true
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting proxy session by session:`, error);
    return null;
  }
}

/**
 * Validates if a proxy session is still active and within time limits
 */
export async function validateProxySession(session: ProxySession): Promise<boolean> {
  try {
    // Check if session is still active in database
    const notification = await Notification.getActiveProxyBySessionId(session.sessionId);
    if (!notification) {
      console.log(`${LOG_PREFIX} Proxy session ${session.sessionId} is no longer active`);
      return false;
    }
    
    // Check if session hasn't exceeded max duration
    if (session.startedAt) {
      const startTime = new Date(session.startedAt).getTime();
      const currentTime = new Date().getTime();
      const duration = currentTime - startTime;
      
      if (duration > PROXY_CONFIG.MAX_PROXY_DURATION) {
        console.log(`${LOG_PREFIX} Proxy session ${session.sessionId} exceeded max duration`);
        // Auto-end expired session
        await endProxySession(session.notificationId, session.adminPhone, session.businessPhoneNumberId);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error validating proxy session:`, error);
    return false;
  }
}

/**
 * Logs proxy session activity for debugging and analytics
 */
export function logProxySessionActivity(
  sessionId: string,
  activity: ProxySessionActivity,
  details?: any
): void {
  console.log(`${LOG_PREFIX} [${activity.toUpperCase()}] Session: ${sessionId}`);
  
  if (details) {
    console.log(`${LOG_PREFIX} Details:`, details);
  }
} 

/**
 * Helper function to get customer phone from session data
 */
async function getCustomerPhoneFromSession(sessionId: string): Promise<string | null> {
  try {
    const { ChatSession } = await import('@/lib/database/models/chat-session');
    const session = await ChatSession.getById(sessionId);
    
    if (!session) {
      console.warn(`${LOG_PREFIX} Session not found: ${sessionId}`);
      return null;
    }
    
    // The channelUserId should be the customer's phone number for WhatsApp
    return session.channelUserId || null;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting customer phone from session:`, error);
    return null;
  }
}

/**
 * Helper function to get admin phone from notification data
 * Gets the actual admin's personal phone, not the business phone
 */
async function getAdminPhoneFromNotification(notification: any): Promise<string | null> {
  try {
    // Try to get admin phone from proxy data first (if stored)
    if (notification.proxyData && notification.proxyData.adminPhone) {
      return notification.proxyData.adminPhone;
    }
    
    // Fallback: Find admin's personal phone for this business
    const { getEnvironmentServiceRoleClient } = await import("@/lib/database/supabase/environment");
    const { PROVIDER_ROLES } = await import("@/lib/database/models/user");
    const supa = getEnvironmentServiceRoleClient();
    
    const { data: users, error } = await supa
      .from('users')
      .select('phoneNormalized, whatsAppNumberNormalized, role')
      .eq('businessId', notification.businessId)
      .in('role', PROVIDER_ROLES)
      .not('phoneNormalized', 'is', null)
      .limit(1);
    
    if (error || !users || users.length === 0) {
      console.warn(`${LOG_PREFIX} Could not find admin for business: ${notification.businessId}`);
      
      // Final fallback: use business phone
      const { Business } = await import('@/lib/database/models/business');
      const business = await Business.getByIdWithServiceRole(notification.businessId);
      return business?.phone || null;
    }
    
    const admin = users[0];
    const phone = admin.phoneNormalized || admin.whatsAppNumberNormalized;
    return phone ? `+${phone}` : null;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting admin phone from notification:`, error);
    return null;
  }
} 