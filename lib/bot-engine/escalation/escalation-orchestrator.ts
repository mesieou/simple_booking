import { BotResponse } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatContext, ConversationalParticipant } from '@/lib/bot-engine/types';
import { UserContext } from '@/lib/database/models/user-context';
import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';
import { Notification } from '@/lib/database/models/notification';
import { ChatMessage } from '@/lib/database/models/chat-session';
import { Business } from '@/lib/database/models/business';
import { User } from '@/lib/database/models/user';
import { getSiteUrl } from '@/lib/config/auth-config';
import { sendEscalationTemplateWithProxy } from '@/lib/bot-engine/escalation/proxy-escalation-handler';
import { BOOKING_TRANSLATIONS } from '@/lib/bot-engine/config/translations';
import { 
  detectEscalationTrigger, 
  hasMediaContent, 
  hasStickerContent
} from './escalation-detector';
import { 
  type EscalationTrigger,
  type EscalationResult
} from './types';
import { CustomerService } from './services/customer-service';
import { NotificationService } from './services/notification-service';

const LOG_PREFIX = '[EscalationOrchestrator]';

const i18n = {
    en: {
        notificationTitle: "🚨 *Human Assistance Required* 🚨",
        clientLabel: "Client:",
        assistRequestText: "To assist this client's request, go to",
        historyTitle: "*Recent conversation history:*",
        imageRedirectTitle: "📸 *Media Content Received* 📸",
    },
    es: {
        notificationTitle: "🚨 *Se Requiere Asistencia Humana* 🚨",
        clientLabel: "Cliente:",
        assistRequestText: "Para atender la solicitud de este cliente, dirigirse a",
        historyTitle: "*Historial de conversacion reciente:*",
        imageRedirectTitle: "📸 *Contenido Multimedia Recibido* 📸",
    }
};

// Escalation detection functions moved to escalation-detector.ts

/**
 * Main function for handling escalations.
 * Simplified to only handle user escalation triggers.
 * @returns An EscalationResult indicating if the user should be escalated.
 */
export async function handleEscalationOrAdminCommand(
  incomingUserMessage: string,
  participant: ConversationalParticipant,
  context: ChatContext,
  userContext: UserContext,
  history: ChatMessage[],
  customerUser?: { firstName: string; lastName: string; id: string },
  businessPhoneNumberId?: string,
  whatsappUserName?: string
): Promise<EscalationResult> {
  // Check if it's a user message that should trigger an escalation.
  const escalationResult = await checkForEscalationTrigger(
    incomingUserMessage,
    context,
    history,
    customerUser,
    businessPhoneNumberId,
    whatsappUserName
  );
  return escalationResult;
}

/**
 * Checks if the incoming message should trigger an escalation to a human agent using AI.
 * @returns An EscalationResult indicating if the user should be escalated.
 */
async function checkForEscalationTrigger(
  incomingUserMessage: string,
  currentContext: ChatContext,
  messageHistory: ChatMessage[],
  customerUser?: { firstName: string; lastName: string; id: string },
  businessPhoneNumberId?: string,
  whatsappUserName?: string
): Promise<EscalationResult> {
  console.log(`${LOG_PREFIX} Starting escalation analysis for: "${incomingUserMessage}"`);

  // Use the new escalation detector
  const escalationTrigger = await detectEscalationTrigger(
    incomingUserMessage,
    currentContext,
    messageHistory
  );

  if (!escalationTrigger.shouldEscalate) {
    return { isEscalated: false };
  }

  // Get the escalation reason and custom message
  const escalationReason = escalationTrigger.reason;
  const escalationMessage = escalationTrigger.customMessage;

  if (escalationReason) {
    console.log(`${LOG_PREFIX} Escalation triggered. Reason: ${escalationReason}`);
    console.log(`${LOG_PREFIX} Bot entering escalation mode for session ${currentContext.currentConversationSession?.id}.`);
    
    // Resolve customer name using the unified service
    const customerName = await CustomerService.resolveCustomerName({
      whatsappName: whatsappUserName,
      customerUser: customerUser,
      sessionId: currentContext.currentConversationSession?.id,
      phoneNumber: currentContext.currentParticipant.customerWhatsappNumber
    });
    
    const language = currentContext.participantPreferences.language === 'es' ? 'es' : 'en';
    const t = i18n[language];
    
    try {
      const businessId = currentContext.currentParticipant.associatedBusinessId;
      if (!businessId) {
        throw new Error("Cannot escalate: No associated business ID in context.");
      }

      const business = await NotificationService.getBusinessWithValidation(businessId);
      NotificationService.validateBusinessForEscalation(business);
      
      const chatSessionId = currentContext.currentConversationSession?.id;
      if (!chatSessionId) {
        console.error(`${LOG_PREFIX} Critical: No chat session ID available for escalation.`);
        return { isEscalated: false };
      }

      const finalBusinessPhoneNumberId = businessPhoneNumberId || currentContext.currentParticipant.businessWhatsappNumber;
      if (!finalBusinessPhoneNumberId) {
        console.error(`${LOG_PREFIX} Critical: Could not determine business phone number ID for sending notification.`);
        return { isEscalated: false };
      }
      
      const notification = await NotificationService.createEscalationNotification({
        businessId,
        chatSessionId,
        escalationReason,
        message: `Escalation triggered: ${escalationReason}`
      });
    
      // Send notification with delivery tracking
      await sendEscalationNotificationWithTracking(
        notification.id,
        business.phone, 
        customerName, 
        messageHistory, 
        language, 
        finalBusinessPhoneNumberId, 
        chatSessionId, 
        currentContext.currentParticipant.customerWhatsappNumber, 
        escalationReason
      );
      return {
        isEscalated: true,
        reason: escalationReason,
        response: { text: escalationMessage || BOOKING_TRANSLATIONS[language].ESCALATION.USER_RESPONSE },
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to process AI-powered escalation due to an internal error:`, error);
      return { isEscalated: false };
    }
  }

  return { isEscalated: false };
}

/**
 * Sends escalation notification with delivery tracking - now with proxy escalation support
 */
async function sendEscalationNotificationWithTracking(
  notificationId: string,
  businessPhoneNumber: string,
  customerName: string,
  messageHistory: ChatMessage[],
  language: string,
  businessPhoneNumberId: string,
  chatSessionId: string,
  customerPhoneNumber?: string,
  escalationReason?: string
) {
  console.log(`${LOG_PREFIX} Sending escalation notification for session: ${chatSessionId}`);
  console.log(`${LOG_PREFIX} Target phone: ${businessPhoneNumber}, Notification ID: ${notificationId}`);
  
  // Get the last customer message for proxy escalation
  const lastCustomerMessage: string = messageHistory.length > 0 
    ? (typeof messageHistory[messageHistory.length - 1].content === 'string' 
       ? messageHistory[messageHistory.length - 1].content as string
       : '[Complex message]')
    : 'No message available';
  
  try {
    // 🆕 PRIMARY: Try proxy escalation first (template-based)
    console.log(`${LOG_PREFIX} 🚀 Attempting proxy escalation with template...`);
    const proxyResult = await sendEscalationTemplateWithProxy(
      businessPhoneNumber,
      customerName,
      lastCustomerMessage,
      businessPhoneNumberId,
      chatSessionId,
      notificationId,
      language
    );
    
    if (proxyResult.success && proxyResult.templateSent) {
      console.log(`${LOG_PREFIX} ✅ Proxy escalation successful! Template sent and proxy mode started.`);
      
      // Update notification with proxy success
      await NotificationService.markDeliverySuccess(
        notificationId, 
        proxyResult.notificationId || 'proxy-template-sent',
        'template'
      );
      
      return; // Success - proxy escalation complete
    }
    
    // 🔄 FALLBACK: If proxy fails, try regular escalation
    console.log(`${LOG_PREFIX} ⚠️ Proxy escalation failed, falling back to regular message...`);
    console.log(`${LOG_PREFIX} Proxy failure reason: ${proxyResult.error}`);
    
    // Send regular escalation notification as fallback
    const whatsappMessageId = await sendEscalationNotification(
      businessPhoneNumber,
      customerName,
      messageHistory,
      language,
      businessPhoneNumberId,
      chatSessionId,
      customerPhoneNumber,
      escalationReason
    );
    
    // Mark delivery as successful with fallback method
    await NotificationService.markDeliverySuccess(
      notificationId, 
      whatsappMessageId || 'unknown',
      'regular'
    );
    
    console.log(`${LOG_PREFIX} ✅ Fallback escalation notification sent (Message ID: ${whatsappMessageId || 'unknown'})`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} ❌ Both proxy and regular escalation failed for ${businessPhoneNumber}:`, errorMessage);
    
    // Mark delivery as failed with retry scheduling
    await NotificationService.markDeliveryFailure(notificationId, error, businessPhoneNumber);
    
    // Don't throw the error - we've tracked it in the database
    console.log(`${LOG_PREFIX} Escalation notification failure tracked in database for retry`);
  }
}

/**
 * Sends a single escalation notification to the business with the specified format.
 */
async function sendEscalationNotification(
  businessPhoneNumber: string,
  customerName: string,
  messageHistory: ChatMessage[],
  language: string,
  businessPhoneNumberId: string,
  chatSessionId: string,
  customerPhoneNumber?: string,
  escalationReason?: string
): Promise<string | null> {
  const lang = language === 'es' ? 'es' : 'en';
  const t = i18n[lang];
  const sender = new WhatsappSender();
  const dashboardLink = `${getSiteUrl()}/protected?sessionId=${chatSessionId}`;

  // Use different title for media redirections
  const notificationTitle = escalationReason === 'media_redirect' ? t.imageRedirectTitle : t.notificationTitle;

  // Prepare conversation history (last 10 messages)
  const lastNMessages = messageHistory.slice(-10);
  let historyText = '';
  if (lastNMessages.length > 0) {
    historyText = lastNMessages.map(msg => {
      const roleIcon = msg.role === 'user' ? '👤' : (msg.role === 'staff' ? '👨‍💼' : '🤖');
      
      // Handle different content types (string vs BotResponse object)
      let content = '';
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (msg.content && typeof msg.content === 'object') {
        // Extract text from BotResponse object
        content = (msg.content as any).text || '[Complex message]';
      } else {
        content = '[Unknown content]';
      }
      
      return `${roleIcon}: ${content}`;
    }).join('\n');
  }

  // Use customer phone number if available
  const displayPhoneNumber = customerPhoneNumber || 'Unknown';

  // Create message with prominent URL formatting
  const fullMessage = `${notificationTitle}

${t.clientLabel} ${customerName} (${displayPhoneNumber})

🔗 *${t.assistRequestText}:*
${dashboardLink}

${t.historyTitle}

${historyText}`;

  console.log(`${LOG_PREFIX} Sending escalation notification for session: ${chatSessionId}`);
  try {
    const whatsappMessageId = await sender.sendMessage(businessPhoneNumber, { text: fullMessage }, businessPhoneNumberId);
    console.log(`${LOG_PREFIX} Escalation notification sent successfully (WhatsApp ID: ${whatsappMessageId || 'unknown'})`);
    return whatsappMessageId;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to send escalation notification:`, error);
    throw error;
  }
} 