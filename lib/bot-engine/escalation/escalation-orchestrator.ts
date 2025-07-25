import { BotResponse, ParsedMessage } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
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
import { productionErrorTracker } from "@/lib/general-helpers/error-handling/production-error-tracker";
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

/**
 * Helper function to find admin's personal phone number for a business
 * @param businessId - The business ID to find admin for
 * @returns Promise<string | null> - The admin's personal phone with + prefix, or null if not found
 */
async function getAdminPersonalPhoneForBusiness(businessId: string): Promise<string | null> {
  try {
    const { getEnvironmentServiceRoleClient } = await import("@/lib/database/supabase/environment");
    const { PROVIDER_ROLES } = await import("@/lib/database/models/user");
    const supa = getEnvironmentServiceRoleClient();
    
    // Find admin/provider users for this business
    const { data: users, error } = await supa
      .from('users')
      .select('phoneNormalized, whatsAppNumberNormalized, role, firstName, lastName')
      .eq('businessId', businessId)
      .in('role', PROVIDER_ROLES)
      .not('phoneNormalized', 'is', null)
      .limit(1);
    
    if (error) {
      console.error(`${LOG_PREFIX} Error finding admin for business ${businessId}:`, error);
      return null;
    }
    
    if (!users || users.length === 0) {
      console.log(`${LOG_PREFIX} No admin users found for business ${businessId}`);
      return null;
    }
    
    const admin = users[0];
    console.log(`${LOG_PREFIX} Found admin: ${admin.firstName} ${admin.lastName} (${admin.role})`);
    
    // Return phone with + prefix (prefer phoneNormalized, fallback to whatsAppNumberNormalized)
    const phone = admin.phoneNormalized || admin.whatsAppNumberNormalized;
    return phone ? `+${phone}` : null;
  } catch (error) {
    console.error(`${LOG_PREFIX} Exception finding admin for business ${businessId}:`, error);
    return null;
  }
}

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
  whatsappUserName?: string,
  currentParsedMessage?: ParsedMessage
): Promise<EscalationResult> {
  // Check if it's a user message that should trigger an escalation.
  const escalationResult = await checkForEscalationTrigger(
    incomingUserMessage,
    context,
    history,
    customerUser,
    businessPhoneNumberId,
    whatsappUserName,
    currentParsedMessage
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
  whatsappUserName?: string,
  currentParsedMessage?: ParsedMessage
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
    
    const language = 'en'; // Always use English templates since only English templates exist
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
        await productionErrorTracker.logCriticalError('ESCALATION_NO_SESSION_ID', 'No chat session ID available for escalation', {
          businessId: currentContext.currentParticipant.associatedBusinessId,
          additionalContext: {
            component: 'EscalationOrchestrator',
            operation: 'checkForEscalationTrigger',
            escalationReason: escalationTrigger.reason,
            conversationContext: currentContext.currentConversationSession
          }
        });
        return { isEscalated: false };
      }

      const finalBusinessPhoneNumberId = businessPhoneNumberId || currentContext.currentParticipant.businessWhatsappNumber;
      if (!finalBusinessPhoneNumberId) {
        console.error(`${LOG_PREFIX} Critical: Could not determine business phone number ID for sending notification.`);
        await productionErrorTracker.logCriticalError('ESCALATION_NO_PHONE_ID', 'Could not determine business phone number ID for sending notification', {
          businessId: currentContext.currentParticipant.associatedBusinessId,
          chatSessionId: chatSessionId,
          additionalContext: {
            component: 'EscalationOrchestrator',
            operation: 'checkForEscalationTrigger',
            businessPhoneNumberIdProvided: !!businessPhoneNumberId,
            currentParticipantPhoneNumber: currentContext.currentParticipant?.businessWhatsappNumber
          }
        });
        return { isEscalated: false };
      }
      
      // Find the admin's personal phone number for this business
      const adminPersonalPhone = await getAdminPersonalPhoneForBusiness(businessId);
      if (!adminPersonalPhone) {
        console.warn(`${LOG_PREFIX} Warning: Could not find admin personal phone for business ${businessId}, using business phone as fallback`);
      }
      
      // Use admin personal phone if found, otherwise fallback to business phone
      const targetAdminPhone = adminPersonalPhone || business.phone;
      console.log(`${LOG_PREFIX} Targeting admin phone: ${targetAdminPhone} (personal: ${!!adminPersonalPhone})`);
      
      const notification = await NotificationService.createEscalationNotification({
        businessId,
        chatSessionId,
        escalationReason,
        message: `Escalation triggered: ${escalationReason}`
      });
    
      // Send notification with delivery tracking - use admin's personal phone
      await sendEscalationNotificationWithTracking(
        notification.id,
        targetAdminPhone, 
        customerName, 
        messageHistory, 
        language, 
        finalBusinessPhoneNumberId, 
        chatSessionId, 
        currentContext.currentParticipant.customerWhatsappNumber, 
        escalationReason,
        incomingUserMessage, // Pass the current message that triggered the escalation
        currentParsedMessage // Pass the current ParsedMessage for media extraction
      );
      return {
        isEscalated: true,
        reason: escalationReason,
        response: { text: escalationMessage || BOOKING_TRANSLATIONS[language].ESCALATION.USER_RESPONSE },
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to process AI-powered escalation due to an internal error:`, error);
      await productionErrorTracker.logCriticalError('ESCALATION_PROCESSING_FAILED', error instanceof Error ? error : new Error(String(error)), {
        businessId: currentContext.currentParticipant.associatedBusinessId,
        chatSessionId: currentContext.currentConversationSession?.id,
        additionalContext: {
          component: 'EscalationOrchestrator',
          operation: 'checkForEscalationTrigger',
          escalationReason: escalationTrigger.reason,
          customerPhoneNumber: currentContext.currentParticipant?.customerWhatsappNumber,
          businessPhoneNumberId: businessPhoneNumberId
        }
      });
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
  escalationReason?: string,
  currentUserMessage?: string, // Add parameter for the current message that triggered escalation
  currentParsedMessage?: ParsedMessage // Add parameter for the current ParsedMessage
) {
  console.log(`${LOG_PREFIX} Sending escalation notification for session: ${chatSessionId}`);
  console.log(`${LOG_PREFIX} Target phone: ${businessPhoneNumber}, Notification ID: ${notificationId}`);
  
  // Use the current message that triggered the escalation, or fallback to history
  const lastCustomerMessage: string = currentUserMessage && currentUserMessage.trim() 
    ? currentUserMessage.trim()
    : messageHistory.length > 0 
      ? (typeof messageHistory[messageHistory.length - 1].content === 'string' 
         ? messageHistory[messageHistory.length - 1].content as string
         : '[Complex message]')
      : 'No message available';
  
  console.log(`${LOG_PREFIX} Using message for template: "${lastCustomerMessage}" (source: ${currentUserMessage ? 'current' : 'history'})`);
  
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
      language,
      messageHistory,
      currentParsedMessage
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
  const lang = 'en'; // Always use English for consistency
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