import { BotResponse, ParsedMessage } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatContext, ConversationalParticipant } from '@/lib/bot-engine/types';
import { UserContext } from '@/lib/database/models/user-context';
import { Notification } from '@/lib/database/models/notification';
import { ChatMessage } from '@/lib/database/models/chat-session';
import { Business } from '@/lib/database/models/business';
import { 
  createProxySession, 
  endProxySession, 
  isTakeoverCommand as sessionIsTakeoverCommand, 
  logProxySessionActivity
} from './proxy-session-manager';
import { 
  sendEscalationTemplate
} from './proxy-template-service';
import { 
  type ProxySessionData,
  type ProxyEscalationResult 
} from './types';
import { NotificationService } from './services/notification-service';

const LOG_PREFIX = '[ProxyEscalationHandler]';

/**
 * Sends escalation notification using template + starts proxy mode
 */
export async function sendEscalationTemplateWithProxy(
  businessPhoneNumber: string,
  customerName: string,
  lastCustomerMessage: string,
  businessPhoneNumberId: string,
  chatSessionId: string,
  notificationId: string,
  language: string = 'en',
  messageHistory?: ChatMessage[],
  currentParsedMessage?: ParsedMessage
): Promise<ProxyEscalationResult> {
  console.log(`${LOG_PREFIX} Starting proxy escalation for session: ${chatSessionId}`);
  console.log(`${LOG_PREFIX} Target admin: ${businessPhoneNumber}, Notification: ${notificationId}`);
  
  try {
    // Step 1: Send escalation template
    const templateMessageId = await sendEscalationTemplate(
      businessPhoneNumber,
      businessPhoneNumberId,
      customerName,
      lastCustomerMessage,
      chatSessionId,
      language,
      messageHistory,
      currentParsedMessage
    );
    
    if (!templateMessageId) {
      throw new Error('Template message failed - no message ID returned');
    }
    
    console.log(`${LOG_PREFIX} ✅ Escalation template sent successfully (ID: ${templateMessageId})`);
    
    // Step 2: Create proxy session
    const sessionData: ProxySessionData = {
      adminPhone: businessPhoneNumber,
      customerPhone: chatSessionId, // We'll store session ID here for now
      templateMessageId: templateMessageId,
      startedAt: new Date().toISOString()
    };
    
    await createProxySession(notificationId, sessionData);
    console.log(`${LOG_PREFIX} ✅ Proxy session created successfully`);
    
    // Log successful proxy session creation
    logProxySessionActivity(chatSessionId, 'created', {
      adminPhone: businessPhoneNumber,
      templateMessageId: templateMessageId
    });
    
    return {
      success: true,
      templateSent: true,
      proxyModeStarted: true,
      notificationId: notificationId
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} ❌ Proxy escalation failed:`, errorMessage);
    
    // Mark notification as failed but don't throw - escalation still created
    await NotificationService.markDeliveryFailure(
      notificationId, 
      error,
      businessPhoneNumber
    );
    
    // Log failed proxy session creation
    logProxySessionActivity(chatSessionId, 'validation_failed', {
      error: errorMessage,
      adminPhone: businessPhoneNumber
    });
    
    return {
      success: false,
      templateSent: false,
      proxyModeStarted: false,
      error: errorMessage
    };
  }
}

/**
 * Ends proxy mode and returns control to bot
 * @deprecated Use endProxySession from proxy-session-manager instead
 */
export async function endProxyMode(
  notificationId: string,
  adminPhone: string,
  businessPhoneNumberId: string
): Promise<void> {
  console.log(`${LOG_PREFIX} [DEPRECATED] Use endProxySession from proxy-session-manager instead`);
  return endProxySession(notificationId, adminPhone, businessPhoneNumberId);
}

/**
 * Checks if a message is a takeover command (text or button)
 * @deprecated Use isTakeoverCommand from proxy-session-manager instead
 */
export function isTakeoverCommand(message: string, buttonId?: string): boolean {
  console.log(`${LOG_PREFIX} [DEPRECATED] Use isTakeoverCommand from proxy-session-manager instead`);
  return sessionIsTakeoverCommand(message, buttonId);
}

/**
 * Logs proxy message for debugging and analytics
 * @deprecated Use logProxySessionActivity from proxy-session-manager instead
 */
export function logProxyMessage(
  sessionId: string,
  fromAdmin: boolean,
  originalMessage: string,
  forwarded: boolean,
  error?: string
): void {
  console.log(`${LOG_PREFIX} [DEPRECATED] Use logProxySessionActivity from proxy-session-manager instead`);
  
  const direction = fromAdmin ? 'Admin→Customer' : 'Customer→Admin';
  const activity = forwarded ? 'message_forwarded' : 'validation_failed';
  
  logProxySessionActivity(sessionId, activity, {
    direction,
    message: originalMessage.substring(0, 100),
    error
  });
} 