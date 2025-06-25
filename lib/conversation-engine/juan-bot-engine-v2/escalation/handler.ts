import { BotResponse } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatContext, ConversationalParticipant } from '@/lib/Juan-bot-engine/bot-manager';
import { UserContext } from '@/lib/database/models/user-context';
import { WhatsappSender } from '@/lib/conversation-engine/whatsapp/whatsapp-message-sender';
import { Notification } from '@/lib/database/models/notification';
import { ChatMessage } from '@/lib/database/models/chat-session';
import { User } from '@/lib/database/models/user';

const LOG_PREFIX = '[EscalationHandler]';
const ADMIN_ESCALATION_NUMBER = '+61450549485'; // Easy-to-modify admin phone number

const i18n = {
    en: {
        historyTitle: "*Recent Conversation History:*\n",
        notificationTitle: "🚨 *Human Assistance Required* 🚨",
        customerLabel: "Customer",
        contactLabel: "Contact",
        summaryLabel: "Summary",
        btnProvidedHelp: "Provided Help",
        btnIgnore: "Ignore",
        btnWrongActivation: "Wrong Activation",
        summaryHumanRequest: "User explicitly asked to speak to a human.",
        summaryAggression: "User is expressing aggression or frustration with the bot.",
        userResponse: "Your request has been sent to our team. Someone will contact you shortly via WhatsApp.",
        dashboardLinkText: "Open Chat in Dashboard"
    },
    es: {
        historyTitle: "*Historial de Conversación Reciente:*\n",
        notificationTitle: "🚨 *Se Requiere Asistencia Humana* 🚨",
        customerLabel: "Cliente",
        contactLabel: "Contacto",
        summaryLabel: "Resumen",
        btnProvidedHelp: "Ayuda Brindada",
        btnIgnore: "Ignorar",
        btnWrongActivation: "Activación Errónea",
        summaryHumanRequest: "El usuario pidió explícitamente hablar con un humano.",
        summaryAggression: "El usuario está expresando agresión o frustración con el bot.",
        userResponse: "Tu solicitud ha sido enviada a nuestro equipo. Alguien se pondrá en contacto contigo en breve a través de WhatsApp.",
        dashboardLinkText: "Abrir Chat en el Dashboard"
    }
};

export interface EscalationResult {
  isEscalated: boolean;
  response?: BotResponse;
  reason?: string;
}

export interface AdminCommandResult {
  isHandled: boolean;
  response?: BotResponse;
}

/**
 * Main orchestration function for handling potential escalations or admin commands.
 * This should be called by the webhook before the main message processor.
 * @returns A result object indicating if the message was handled as an escalation/admin command.
 */
export async function handleEscalationOrAdminCommand(
  messageText: string,
  participant: ConversationalParticipant,
  chatContext: ChatContext,
  userContext: UserContext,
  historyForLLM: ChatMessage[],
  customerUser: User | null,
  businessPhoneNumberId: string
): Promise<EscalationResult | AdminCommandResult> {
  // First, check if it's an admin command.
  const adminResult = await resolveEscalation(messageText);
  if (adminResult.isHandled) {
    return adminResult;
  }

  // If not, check if it's a user message that should trigger an escalation.
  const escalationResult = await checkForEscalationTrigger(
    messageText,
    chatContext,
    historyForLLM,
    businessPhoneNumberId,
    customerUser
  );
  return escalationResult;
}

/**
 * Handles a command sent by an admin to resolve a notification.
 * @returns An AdminCommandResult indicating if the message was handled.
 */
async function resolveEscalation(incomingUserMessage: string): Promise<AdminCommandResult> {
  if (!incomingUserMessage.startsWith('resolve_')) {
    return { isHandled: false };
  }

  console.log(`${LOG_PREFIX} Detected admin action: ${incomingUserMessage}`);

  const parts = incomingUserMessage.split('_');
  if (parts.length < 3) {
    console.error(`${LOG_PREFIX} Invalid command format: not enough parts.`);
    return {
      isHandled: true,
      response: { text: "Invalid command format. Expected: resolve_<status>_<notificationId>" },
    };
  }

  const notificationId = parts[parts.length - 1];
  const status = parts.slice(1, -1).join('_');
  const validStatuses = ['provided_help', 'ignored', 'wrong_activation'];

  if (!validStatuses.includes(status)) {
    console.error(`${LOG_PREFIX} Invalid status: ${status}`);
    return {
      isHandled: true,
      response: { text: `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}` },
    };
  }

  try {
    const resolved = await Notification.resolve(notificationId, status as any);

    if (resolved) {
      console.log(`${LOG_PREFIX} Successfully resolved notification ${notificationId} with status ${status}`);
      return { isHandled: true, response: { text: `✅ Notification resolved.` } };
    } else {
      console.error(`${LOG_PREFIX} Failed to resolve notification ${notificationId}`);
      return {
        isHandled: true,
        response: { text: `❌ Failed to resolve. It may have been resolved already.` },
      };
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error resolving notification:`, error);
    return {
      isHandled: true,
      response: { text: "An internal error occurred while resolving the notification." },
    };
  }
}

/**
 * Checks if the incoming message should trigger an escalation to a human agent.
 * @returns An EscalationResult indicating if the user should be escalated.
 */
async function checkForEscalationTrigger(
  incomingUserMessage: string,
  currentContext: ChatContext,
  messageHistory: ChatMessage[],
  businessPhoneNumberId: string,
  customerUser?: { firstName: string; lastName: string; id: string } | null
): Promise<EscalationResult> {
  // --- Layer 1: Immediate Keyword/Regex Detection ---
  const lowerCaseMessage = incomingUserMessage.toLowerCase();
  const humanRequestKeywords = ['human', 'agent', 'person', 'talk to someone', 'speak to a person', 'humano', 'agente', 'persona', 'hablar con alguien'];
  const aggressionKeywords = ['stupid', 'useless', 'idiot', 'fuck', 'shit', 'crap', 'terrible', 'estúpido', 'inútil', 'idiota', 'mierda', 'pésimo', 'terrible'];
  let keywordReason: 'human_request' | 'aggression' | undefined;

  console.log(`${LOG_PREFIX} Checking for escalation keywords in: "${lowerCaseMessage}"`);

  const hasHumanRequest = humanRequestKeywords.some(keyword => {
    const included = lowerCaseMessage.includes(keyword);
    console.log(`${LOG_PREFIX}  - Checking for keyword '${keyword}': ${included}`);
    return included;
  });

  if (hasHumanRequest) {
    keywordReason = 'human_request';
  } else {
    const hasAggression = aggressionKeywords.some(keyword => lowerCaseMessage.includes(keyword));
    if (hasAggression) {
      keywordReason = 'aggression';
    }
  }

  if (keywordReason) {
    console.log(`${LOG_PREFIX} Escalation triggered by keyword. Reason: ${keywordReason}`);
    console.log(`${LOG_PREFIX} Bot entering escalation mode for session ${currentContext.currentConversationSession?.id}.`);
    const customerName = customerUser ? `${customerUser.firstName} ${customerUser.lastName}` : 'A customer';
    const customerPhone = currentContext.currentParticipant.customerWhatsappNumber;
    const customerPhoneUrl = customerPhone ? `https://wa.me/${customerPhone.replace('+', '')}` : 'Not available';
    
    const language = currentContext.participantPreferences.language === 'es' ? 'es' : 'en';
    const t = i18n[language];

    const summaryForAdmin = keywordReason === 'human_request' ? t.summaryHumanRequest : t.summaryAggression;
    
    try {
      if (currentContext.currentParticipant.associatedBusinessId && currentContext.currentConversationSession?.id) {
        const chatSessionId = currentContext.currentConversationSession.id;
        
        const notification = await Notification.create({
            businessId: currentContext.currentParticipant.associatedBusinessId,
            chatSessionId: chatSessionId,
            message: summaryForAdmin,
            status: 'pending'
        });
      
        if (!notification) {
          throw new Error("Failed to create a notification record in the database.");
        }
      
        await sendEscalationNotifications(
            ADMIN_ESCALATION_NUMBER, 
            customerName, 
            customerPhoneUrl, 
            summaryForAdmin, 
            messageHistory, 
            notification.id, 
            language, 
            businessPhoneNumberId,
            chatSessionId
        );
      } else {
        console.error(`${LOG_PREFIX} Cannot escalate: missing businessId or chatSessionId in context.`);
        throw new Error("Cannot process escalation due to missing context.");
      }
      
      return {
        isEscalated: true,
        reason: keywordReason,
        response: { text: t.userResponse },
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to process keyword-based escalation due to an internal error:`, error);
    }
  }
  
  // --- Layer 2: LLM-based analysis (as a fallback) ---
  // This part is removed as per the decision to simplify and rely on keywords first.
  // If keyword check fails due to an error, we don't escalate automatically.

  return { isEscalated: false };
}

/**
 * Sends the two-part escalation notification to the business.
 */
async function sendEscalationNotifications(
  businessPhoneNumber: string,
  customerName: string,
  customerPhoneUrl: string,
  summary: string,
  messageHistory: ChatMessage[],
  notificationId: string,
  language: string,
  businessPhoneNumberId: string,
  chatSessionId: string
) {
  const lang = language === 'es' ? 'es' : 'en';
  const t = i18n[lang];
  const sender = new WhatsappSender();
  const dashboardLink = `https://skedy.io/protected?sessionId=${chatSessionId}`;

  // 1. Send conversation history
  const lastNMessages = messageHistory.slice(-5);
  if (lastNMessages.length > 0) {
    const historyText = t.historyTitle + lastNMessages.map(msg => 
      `${msg.role === 'user' ? '👤' : '🤖'}: ${msg.content}`
    ).join('\n');
    
    try {
      await sender.sendMessage(businessPhoneNumber, { text: historyText }, businessPhoneNumberId);
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to send message history notification:`, error);
    }
  }

  // 2. Send the main summary notification with buttons
  const summaryText = `${t.notificationTitle}\n\n*${t.customerLabel}:* ${customerName}\n*${t.contactLabel}:* ${customerPhoneUrl}\n\n*${t.summaryLabel}:* ${summary}\n\n*${t.dashboardLinkText}:* ${dashboardLink}`;
  
  const adminButtons = [
    { buttonText: t.btnProvidedHelp, buttonValue: `resolve_provided_help_${notificationId}` },
    { buttonText: t.btnIgnore, buttonValue: `resolve_ignored_${notificationId}` },
    { buttonText: t.btnWrongActivation, buttonValue: `resolve_wrong_activation_${notificationId}` },
  ];

  console.log(`${LOG_PREFIX} Sending admin notification for notificationId: ${notificationId}`);
  await sender.sendMessage(businessPhoneNumber, { 
    text: summaryText, 
    buttons: adminButtons 
  }, businessPhoneNumberId);
} 