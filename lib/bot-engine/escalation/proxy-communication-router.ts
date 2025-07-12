import { ParsedMessage, BotResponse } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';
import { Notification } from '@/lib/database/models/notification';
import { Business } from '@/lib/database/models/business';
import { ChatSession } from '@/lib/database/models/chat-session';
import { 
  isTakeoverCommand, 
  endProxySession, 
  getProxySessionByAdmin, 
  getProxySessionBySessionId, 
  logProxySessionActivity
} from './proxy-session-manager';
import { 
  type ProxySession,
  type ProxyMessageResult 
} from './types';

const LOG_PREFIX = '[ProxyMessageRouter]';

/**
 * Extracts button ID from parsed message (for button interactions)
 */
function extractButtonId(parsedMessage: ParsedMessage): string | undefined {
  try {
    // Check if message has button interaction data from WhatsApp
    // Button interactions come in the 'interactive' field of the webhook payload
    const originalPayload = (parsedMessage as any).originalPayload;
    
    if (originalPayload) {
      // Navigate through the webhook structure to find button reply
      const entry = originalPayload.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      
      // Check for interactive button reply
      if (message?.interactive?.type === 'button_reply') {
        return message.interactive.button_reply?.id;
      }
      
      // Check for list reply (if template uses list instead of buttons)
      if (message?.interactive?.type === 'list_reply') {
        return message.interactive.list_reply?.id;
      }
    }
    
    // Fallback: check if parsedMessage has button data directly
    if ((parsedMessage as any).interactive?.button_reply?.id) {
      return (parsedMessage as any).interactive.button_reply.id;
    }
    
    // Legacy fallback: check for button data in other formats
    if ((parsedMessage as any).buttonId) {
      return (parsedMessage as any).buttonId;
    }
    
    return undefined;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error extracting button ID:`, error);
    return undefined;
  }
}

/**
 * Gets session ID by customer phone number
 */
async function getSessionIdByCustomerPhone(customerPhone: string): Promise<string | null> {
  try {
    // Use existing method to get active session (proxy should only work with recent/active sessions)
    const session = await ChatSession.getActiveByChannelUserId('whatsapp', customerPhone, 24); // 24 hour timeout
    return session?.id || null;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting session by customer phone:`, error);
    return null;
  }
}

/**
 * Gets customer name from session
 */
async function getCustomerName(sessionId: string): Promise<string> {
  try {
    const session = await ChatSession.getById(sessionId);
    // Extract customer name from session data or use phone number
    return session?.channelUserId || 'Customer';
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting customer name:`, error);
    return 'Customer';
  }
}

/**
 * Main router for proxy messages - determines if message should be handled by proxy system
 */
export async function routeProxyMessage(
  parsedMessage: ParsedMessage,
  businessPhoneNumberId: string
): Promise<ProxyMessageResult> {
  console.log(`${LOG_PREFIX} Routing message from: ${parsedMessage.senderId}`);
  
  try {
    // Get business info to determine if sender is admin
    const business = await Business.findByPhoneNumberId(businessPhoneNumberId);
    if (!business) {
      console.log(`${LOG_PREFIX} No business found for phone number ID: ${businessPhoneNumberId}`);
      return { wasHandled: false, messageForwarded: false, proxyEnded: false };
    }
    
    const businessId = business.id;
    if (!businessId) {
      console.log(`${LOG_PREFIX} Business ID is missing for business: ${business.name}`);
      return { wasHandled: false, messageForwarded: false, proxyEnded: false };
    }
    
    // Use proper admin detection logic
    const isFromAdmin = await isUserAdminByPhone(parsedMessage.senderId, businessId);
    console.log(`${LOG_PREFIX} Message from admin: ${isFromAdmin} (sender: ${parsedMessage.senderId}, businessId: ${businessId})`);
    
    if (isFromAdmin) {
      console.log(`${LOG_PREFIX} 🎯 Admin message detected, checking for proxy session...`);
      return await handleAdminProxyMessage(parsedMessage, business, businessPhoneNumberId);
    } else {
      console.log(`${LOG_PREFIX} 👤 Customer message detected, checking for proxy session...`);
      return await handleCustomerProxyMessage(parsedMessage, businessPhoneNumberId);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} ❌ Error routing proxy message:`, errorMessage);
    
    return {
      wasHandled: false,
      messageForwarded: false,
      proxyEnded: false,
      error: errorMessage
    };
  }
}

/**
 * Helper function to determine if a user is an admin based on their phone number and role
 * @param phoneNumber - The phone number to check
 * @param businessId - The business ID to verify the user belongs to
 * @returns Promise<boolean> - true if user has admin/provider role for this business
 */
async function isUserAdminByPhone(phoneNumber: string, businessId: string): Promise<boolean> {
  try {
    const { getEnvironmentServiceRoleClient } = await import("@/lib/database/supabase/environment");
    const { PROVIDER_ROLES } = await import("@/lib/database/models/user");
    const supa = getEnvironmentServiceRoleClient();
    
    // Normalize the input phone number for comparison (remove + and non-digits)
    const normalizedInputPhone = phoneNumber.replace(/[^\d]/g, '');
    
    // Query users table directly by phoneNormalized or whatsAppNumberNormalized fields
    const { data: users, error } = await supa
      .from('users')
      .select('*')
      .eq('businessId', businessId)
      .in('role', PROVIDER_ROLES)
      .or(`phoneNormalized.eq.${normalizedInputPhone},whatsAppNumberNormalized.eq.${normalizedInputPhone}`);
    
    if (error) {
      console.error(`${LOG_PREFIX} Error querying users table:`, error);
      return false;
    }
    
    return users && users.length > 0;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error checking admin status for phone ${phoneNumber}:`, error);
    return false;
  }
}

/**
 * Handles messages from admin in proxy mode
 */
async function handleAdminProxyMessage(
  parsedMessage: ParsedMessage,
  business: Business,
  businessPhoneNumberId: string
): Promise<ProxyMessageResult> {
  console.log(`${LOG_PREFIX} Handling admin message: "${parsedMessage.text}"`);
  console.log(`${LOG_PREFIX} 🔍 Looking for proxy session for admin: ${business.phone}`);
  
  // Check for takeover command first (button or text)
  const buttonId = extractButtonId(parsedMessage);
  const adminPersonalPhone = parsedMessage.senderId;
  
  if (isTakeoverCommand(parsedMessage.text || '', buttonId)) {
    console.log(`${LOG_PREFIX} Takeover command detected (${buttonId ? 'button' : 'text'})`);
    
    // Find active proxy session for this admin using their personal phone
    const proxySession = await getProxySessionByAdmin(adminPersonalPhone);
    if (!proxySession) {
      console.log(`${LOG_PREFIX} No active proxy session found for admin personal phone: ${adminPersonalPhone}`);
      return {
        wasHandled: true,
        messageForwarded: false,
        proxyEnded: false,
        response: { text: "⚠️ No active proxy session found." }
      };
    }
    
    // End proxy mode - use the admin's personal phone
    await endProxySession(proxySession.notificationId, adminPersonalPhone, businessPhoneNumberId);
    
    logProxySessionActivity(proxySession.sessionId, 'ended', {
      direction: 'Admin→Customer',
      trigger: buttonId ? 'button' : 'text',
      message: buttonId || parsedMessage.text || ''
    });
    
    return {
      wasHandled: true,
      messageForwarded: false,
      proxyEnded: true,
      response: { text: "🔄 Proxy mode ended. Bot has resumed control." }
    };
  }
  
  // Forward message to customer - use admin's personal phone (sender), not business phone
  console.log(`${LOG_PREFIX} 🔍 Looking for active proxy session for admin personal phone: ${adminPersonalPhone}`);
  const proxySession = await getProxySessionByAdmin(adminPersonalPhone);
  if (!proxySession) {
    console.log(`${LOG_PREFIX} ❌ No active proxy session for admin personal phone: ${adminPersonalPhone}`);
    console.log(`${LOG_PREFIX} 💡 This might be because the admin's message created a new session instead of using the existing proxy session`);
    return { wasHandled: false, messageForwarded: false, proxyEnded: false };
  }
  
  console.log(`${LOG_PREFIX} ✅ Found active proxy session: ${proxySession.sessionId}`);
  console.log(`${LOG_PREFIX} 📞 Customer phone: ${proxySession.customerPhone}`);
  
  const forwarded = await forwardAdminMessageToCustomer(
    parsedMessage,
    proxySession,
    businessPhoneNumberId
  );
  
  logProxySessionActivity(proxySession.sessionId, 'message_forwarded', {
    direction: 'Admin→Customer',
    message: parsedMessage.text || '',
    forwarded
  });
  
  return {
    wasHandled: true,
    messageForwarded: forwarded,
    proxyEnded: false
    // No response - admin doesn't need confirmation when message is forwarded
  };
}

/**
 * Handles messages from customer in proxy mode
 */
async function handleCustomerProxyMessage(
  parsedMessage: ParsedMessage,
  businessPhoneNumberId: string
): Promise<ProxyMessageResult> {
  console.log(`${LOG_PREFIX} Checking for customer proxy session: ${parsedMessage.senderId}`);
  
  // Get session ID from customer phone
  const sessionId = await getSessionIdByCustomerPhone(parsedMessage.senderId);
  if (!sessionId) {
    console.log(`${LOG_PREFIX} ❌ No session found for customer: ${parsedMessage.senderId}`);
    return { wasHandled: false, messageForwarded: false, proxyEnded: false };
  }
  
  console.log(`${LOG_PREFIX} 📋 Found session ID: ${sessionId} for customer: ${parsedMessage.senderId}`);
  
  // Check if session is in proxy mode
  const proxySession = await getProxySessionBySessionId(sessionId);
  if (!proxySession) {
    console.log(`${LOG_PREFIX} ❌ No active proxy session for session: ${sessionId}`);
    return { wasHandled: false, messageForwarded: false, proxyEnded: false };
  }
  
  console.log(`${LOG_PREFIX} ✅ Found active proxy session, forwarding to admin: ${proxySession.adminPhone}`);
  
  // Forward message to admin
  const forwarded = await forwardCustomerMessageToAdmin(
    parsedMessage,
    proxySession,
    businessPhoneNumberId
  );
  
  logProxySessionActivity(proxySession.sessionId, 'message_forwarded', {
    direction: 'Customer→Admin',
    message: parsedMessage.text || '',
    forwarded
  });
  
  return {
    wasHandled: true,
    messageForwarded: forwarded,
    proxyEnded: false
    // No response - customer message is silenced while forwarded to admin
  };
}

/**
 * Forwards admin message to customer
 */
async function forwardAdminMessageToCustomer(
  parsedMessage: ParsedMessage,
  proxySession: ProxySession,
  businessPhoneNumberId: string
): Promise<boolean> {
  try {
    if (!parsedMessage.text?.trim()) {
      console.log(`${LOG_PREFIX} Empty admin message, not forwarding`);
      return false;
    }
    
    const sender = new WhatsappSender();
    const messageId = await sender.sendMessage(
      proxySession.customerPhone,
      { text: parsedMessage.text },
      businessPhoneNumberId
    );
    
    console.log(`${LOG_PREFIX} ✅ Admin message forwarded to customer (ID: ${messageId})`);
    return !!messageId;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Failed to forward admin message:`, error);
    return false;
  }
}

/**
 * Forwards customer message to admin
 */
async function forwardCustomerMessageToAdmin(
  parsedMessage: ParsedMessage,
  proxySession: ProxySession,
  businessPhoneNumberId: string
): Promise<boolean> {
  try {
    if (!parsedMessage.text?.trim()) {
      console.log(`${LOG_PREFIX} Empty customer message, not forwarding`);
      return false;
    }
    
    // Format message with customer context and emoticon
    const customerName = await getCustomerName(proxySession.sessionId);
    const forwardedMessage = `👤 ${customerName} said: "${parsedMessage.text}"`;
    
    const sender = new WhatsappSender();
    const messageId = await sender.sendMessage(
      proxySession.adminPhone,
      { text: forwardedMessage },
      businessPhoneNumberId
    );
    
    console.log(`${LOG_PREFIX} ✅ Customer message forwarded to admin (ID: ${messageId})`);
    return !!messageId;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Failed to forward customer message:`, error);
    return false;
  }
} 