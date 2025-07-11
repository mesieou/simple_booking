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
    
    return {
      notificationId: notification.id,
      sessionId: notification.chatSessionId,
      adminPhone: adminPhone,
      customerPhone: '', // We'll get this from session
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
    
    return {
      notificationId: notification.id,
      sessionId: sessionId,
      adminPhone: '', // We'll get this from notification data
      customerPhone: '', // We'll get this from session
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