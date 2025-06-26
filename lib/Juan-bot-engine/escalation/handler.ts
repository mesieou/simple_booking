import { BotResponse } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatContext, ConversationalParticipant } from '@/lib/Juan-bot-engine/bot-manager';
import { UserContext } from '@/lib/database/models/user-context';
import { WhatsappSender } from '@/lib/conversation-engine/whatsapp/whatsapp-message-sender';
import { Notification } from '@/lib/database/models/notification';
import { ChatMessage } from '@/lib/database/models/chat-session';
import { Business } from '@/lib/database/models/business';
import { User } from '@/lib/database/models/user';

const LOG_PREFIX = '[EscalationHandler]';

const i18n = {
    en: {
        notificationTitle: "🚨 *Human Assistance Required* 🚨",
        clientLabel: "Client:",
        assistRequestText: "To assist this client's request, go to",
        historyTitle: "*Recent conversation history:*",
        userResponse: "Your request has been sent to our team. Someone will contact you shortly via WhatsApp."
    },
    es: {
        notificationTitle: "🚨 *Se Requiere Asistencia Humana* 🚨",
        clientLabel: "Cliente:",
        assistRequestText: "Para atender la solicitud de este cliente, dirigirse a",
        historyTitle: "*Historial de conversacion reciente:*",
        userResponse: "Tu solicitud ha sido enviada a nuestro equipo. Alguien se pondrá en contacto contigo en breve a través de WhatsApp."
    }
};

export interface EscalationResult {
  isEscalated: boolean;
  response?: BotResponse;
  reason?: string;
}

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
 * Checks if the incoming message should trigger an escalation to a human agent.
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
  // --- Keyword/Regex Detection ---
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
    // Count how many aggression keywords are found in current message
    const currentMessageAggressionCount = aggressionKeywords.filter(keyword => lowerCaseMessage.includes(keyword)).length;
    console.log(`${LOG_PREFIX}  - Found ${currentMessageAggressionCount} aggression keywords in current message`);
    
    if (currentMessageAggressionCount > 0) {
      // Check recent message history for cumulative aggression
      const recentMessages = messageHistory.slice(-15); // Last 15 messages
      
      // Find the last staff message (indicates escalation was handled)
      let lastStaffMessageIndex = -1;
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        if (recentMessages[i].role === 'staff') {
          lastStaffMessageIndex = i;
          break;
        }
      }
      
      // Only count aggression from messages AFTER the last staff intervention
      const messagesToCheck = lastStaffMessageIndex >= 0 
        ? recentMessages.slice(lastStaffMessageIndex + 1) 
        : recentMessages;
      
      let totalAggressionCount = currentMessageAggressionCount;
      
      // Count aggression keywords in user messages (after last staff intervention)
      messagesToCheck.forEach(msg => {
        if (msg.role === 'user' && msg.content !== incomingUserMessage) { // Exclude current message to avoid double counting
          const msgLower = msg.content.toLowerCase();
          const msgAggressionCount = aggressionKeywords.filter(keyword => msgLower.includes(keyword)).length;
          totalAggressionCount += msgAggressionCount;
        }
      });
      
      if (lastStaffMessageIndex >= 0) {
        console.log(`${LOG_PREFIX}  - Last staff intervention found at message ${lastStaffMessageIndex}. Counting aggression only after that point.`);
      }
      console.log(`${LOG_PREFIX}  - Total aggression keywords since last intervention: ${totalAggressionCount}`);
      
      if (totalAggressionCount >= 3) {
        keywordReason = 'aggression';
        console.log(`${LOG_PREFIX}  - Escalating due to cumulative aggression keywords (${totalAggressionCount})`);
      }
    }
  }

  if (keywordReason) {
    console.log(`${LOG_PREFIX} Escalation triggered by keyword. Reason: ${keywordReason}`);
    console.log(`${LOG_PREFIX} Bot entering escalation mode for session ${currentContext.currentConversationSession?.id}.`);
    
    // Determine customer name: WhatsApp name → DB firstName+lastName → linked user → phone number
    let customerName = 'Unknown customer';
    if (whatsappUserName?.trim()) {
      customerName = whatsappUserName.trim();
      console.log(`${LOG_PREFIX} Using WhatsApp profile name: ${customerName}`);
    } else if (customerUser && customerUser.firstName && customerUser.lastName) {
      customerName = `${customerUser.firstName} ${customerUser.lastName}`;
      console.log(`${LOG_PREFIX} Using passed customerUser name: ${customerName}`);
    } else if (currentContext.currentConversationSession?.id) {
      // Try to fetch the actual ChatSession from DB to get the linked userId
      try {
        const { ChatSession } = await import('@/lib/database/models/chat-session');
        const chatSession = await ChatSession.getById(currentContext.currentConversationSession.id);
        
        if (chatSession && chatSession.userId) {
          const linkedUser = await User.getById(chatSession.userId);
          if (linkedUser && linkedUser.firstName && linkedUser.lastName) {
            customerName = `${linkedUser.firstName} ${linkedUser.lastName}`;
            console.log(`${LOG_PREFIX} Using linked user name from DB: ${customerName}`);
          } else if (currentContext.currentParticipant.customerWhatsappNumber) {
            customerName = currentContext.currentParticipant.customerWhatsappNumber;
            console.log(`${LOG_PREFIX} Using phone number fallback (linked user has no name): ${customerName}`);
          }
        } else if (currentContext.currentParticipant.customerWhatsappNumber) {
          customerName = currentContext.currentParticipant.customerWhatsappNumber;
          console.log(`${LOG_PREFIX} Using phone number fallback (no linked user in session): ${customerName}`);
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} Error fetching chat session or linked user:`, error);
        if (currentContext.currentParticipant.customerWhatsappNumber) {
          customerName = currentContext.currentParticipant.customerWhatsappNumber;
          console.log(`${LOG_PREFIX} Using phone number fallback (error fetching session): ${customerName}`);
        }
      }
    } else if (currentContext.currentParticipant.customerWhatsappNumber) {
      customerName = currentContext.currentParticipant.customerWhatsappNumber;
      console.log(`${LOG_PREFIX} Using phone number fallback (no linked user): ${customerName}`);
    }
    
    const language = currentContext.participantPreferences.language === 'es' ? 'es' : 'en';
    const t = i18n[language];
    
    try {
      const businessId = currentContext.currentParticipant.associatedBusinessId;
      if (!businessId) {
        throw new Error("Cannot escalate: No associated business ID in context.");
      }

      const business = await Business.getById(businessId);
      if (!business || !business.phone) {
        console.error(`${LOG_PREFIX} Escalation failed: Business ${businessId} not found or does not have a 'phone' number configured for notifications.`);
        // Fallback to the main business number if the dedicated phone is missing.
        const fallbackPhone = currentContext.currentParticipant.businessWhatsappNumber;
        if (!fallbackPhone) {
            console.error(`${LOG_PREFIX} Critical: No fallback phone number available either.`);
            return { isEscalated: false };
        }
        
        const chatSessionId = currentContext.currentConversationSession?.id;
        if (chatSessionId) {
          await sendEscalationNotification(fallbackPhone, customerName, messageHistory, language, fallbackPhone, chatSessionId, currentContext.currentParticipant.customerWhatsappNumber);
        }
        return { isEscalated: true, reason: keywordReason, response: { text: t.userResponse }};
      }
      
      const escalationPhoneNumber = business.phone;
      const chatSessionId = currentContext.currentConversationSession?.id;

      const finalBusinessPhoneNumberId = businessPhoneNumberId || currentContext.currentParticipant.businessWhatsappNumber;
      if (!finalBusinessPhoneNumberId) {
        console.error(`${LOG_PREFIX} Critical: Could not determine business phone number ID for sending notification.`);
        return { isEscalated: false };
      }
      
      let notification;
      if (currentContext.currentParticipant.associatedBusinessId && currentContext.currentConversationSession?.id) {
        notification = await Notification.create({
            businessId: currentContext.currentParticipant.associatedBusinessId,
            chatSessionId: currentContext.currentConversationSession.id,
            message: `Escalation triggered: ${keywordReason}`,
            status: 'pending'
        });
      }
      if (!notification) {
        throw new Error("Failed to create a notification record in the database.");
      }
      
      if (chatSessionId) {
        await sendEscalationNotification(escalationPhoneNumber, customerName, messageHistory, language, finalBusinessPhoneNumberId, chatSessionId, currentContext.currentParticipant.customerWhatsappNumber);
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

  return { isEscalated: false };
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
  customerPhoneNumber?: string
) {
  const lang = language === 'es' ? 'es' : 'en';
  const t = i18n[lang];
  const sender = new WhatsappSender();
  const dashboardLink = `https://skedy.io/protected?sessionId=${chatSessionId}`;

  // Prepare conversation history (last 10 messages)
  const lastNMessages = messageHistory.slice(-10);
  let historyText = '';
  if (lastNMessages.length > 0) {
    historyText = lastNMessages.map(msg => {
      const roleIcon = msg.role === 'user' ? '👤' : (msg.role === 'staff' ? '👨‍💼' : '🤖');
      return `${roleIcon}: ${msg.content}`;
    }).join('\n');
  }

  // Use customer phone number if available
  const displayPhoneNumber = customerPhoneNumber || 'Unknown';

  // Create the single message with the specified format
  const fullMessage = `${t.notificationTitle}

${t.clientLabel} ${customerName} (${displayPhoneNumber})

${t.assistRequestText} ${dashboardLink}.

${t.historyTitle}

${historyText}`;

  console.log(`${LOG_PREFIX} Sending escalation notification for session: ${chatSessionId}`);
  try {
    await sender.sendMessage(businessPhoneNumber, { text: fullMessage }, businessPhoneNumberId);
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to send escalation notification:`, error);
  }
} 