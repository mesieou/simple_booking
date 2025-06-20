import { BotResponse } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatContext, ConversationalParticipant } from '@/lib/conversation-engine/juan-bot-engine-v2/bot-manager';
import { UserContext } from '@/lib/database/models/user-context';
import { WhatsappSender } from '@/lib/conversation-engine/whatsapp/whatsapp-message-sender';
import { Notification } from '@/lib/database/models/notification';

const LOG_PREFIX = '[EscalationHandler]';

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
  incomingUserMessage: string,
  participant: ConversationalParticipant,
  context: ChatContext,
  userContext: UserContext,
  customerUser?: { firstName: string; lastName: string; id: string }
): Promise<EscalationResult | AdminCommandResult> {
  // First, check if it's an admin command.
  const adminResult = await resolveEscalation(incomingUserMessage);
  if (adminResult.isHandled) {
    return adminResult;
  }

  // If not, check if it's a user message that should trigger an escalation.
  const escalationResult = await checkForEscalationTrigger(
    incomingUserMessage,
    context,
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
  customerUser?: { firstName: string; lastName: string; id: string }
): Promise<EscalationResult> {
  // --- Layer 1: Immediate Keyword/Regex Detection ---
  const lowerCaseMessage = incomingUserMessage.toLowerCase();
  const humanRequestKeywords = ['human', 'agent', 'person', 'talk to someone', 'speak to a person'];
  const aggressionKeywords = ['stupid', 'useless', 'idiot', 'fuck', 'shit', 'crap', 'terrible'];
  let keywordReason: 'human_request' | 'aggression' | undefined;
  let summary: string = '';

  console.log(`${LOG_PREFIX} Checking for escalation keywords in: "${lowerCaseMessage}"`);

  const hasHumanRequest = humanRequestKeywords.some(keyword => {
    const included = lowerCaseMessage.includes(keyword);
    console.log(`${LOG_PREFIX}  - Checking for keyword '${keyword}': ${included}`);
    return included;
  });

  if (hasHumanRequest) {
    keywordReason = 'human_request';
    summary = `User explicitly asked to speak to a human.`;
  } else {
    const hasAggression = aggressionKeywords.some(keyword => lowerCaseMessage.includes(keyword));
    if (hasAggression) {
      keywordReason = 'aggression';
      summary = `User is expressing aggression or frustration with the bot.`;
    }
  }

  if (keywordReason) {
    console.log(`${LOG_PREFIX} Escalation triggered by keyword. Reason: ${keywordReason}`);
    const businessPhoneNumber = '+61450549485'; // Hardcoded as per original file
    const customerName = customerUser ? `${customerUser.firstName} ${customerUser.lastName}` : 'A customer';
    const customerPhone = currentContext.currentParticipant.customerWhatsappNumber;
    const customerPhoneUrl = customerPhone ? `https://wa.me/${customerPhone.replace('+', '')}` : 'Not available';
    
    try {
      let notification;
      if (currentContext.currentParticipant.associatedBusinessId && currentContext.currentConversationSession?.id) {
        notification = await Notification.create({
            businessId: currentContext.currentParticipant.associatedBusinessId,
            chatSessionId: currentContext.currentConversationSession.id,
            message: summary,
            status: 'pending'
        });
      }
      if (!notification) {
        throw new Error("Failed to create a notification record in the database.");
      }
      const messageHistory = currentContext.currentConversationSession?.activeGoals[0]?.messageHistory || [];
      await sendEscalationNotifications(businessPhoneNumber, customerName, customerPhoneUrl, summary, messageHistory, notification.id);
      
      return {
        isEscalated: true,
        reason: keywordReason,
        response: { text: "Your request has been sent to our team. Someone will contact you shortly via WhatsApp." },
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to process keyword-based escalation due to an internal error:`, error);
      // Fall through to LLM check as a backup, but log the failure.
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
  messageHistory: Array<{ speakerRole: 'user' | 'chatbot'; content: string; messageTimestamp: Date; }>,
  notificationId: string
) {
  const sender = new WhatsappSender();

  // 1. Send conversation history
  const lastNMessages = messageHistory.slice(-5);
  if (lastNMessages.length > 0) {
    const historyText = "*Recent Conversation History:*\n" + lastNMessages.map(msg => 
      `${msg.speakerRole === 'user' ? '👤' : '🤖'}: ${msg.content}`
    ).join('\n');
    
    try {
      await sender.sendMessage(businessPhoneNumber, { text: historyText });
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to send message history notification:`, error);
    }
  }

  // 2. Send the main summary notification with buttons
  const summaryText = `🚨 *Human Assistance Required* 🚨\n\n*Customer:* ${customerName}\n*Contact:* ${customerPhoneUrl}\n\n*Summary:* ${summary}`;
  
  const adminButtons = [
    { buttonText: 'Provided Help', buttonValue: `resolve_provided_help_${notificationId}` },
    { buttonText: 'Ignore', buttonValue: `resolve_ignored_${notificationId}` },
    { buttonText: 'Wrong Activation', buttonValue: `resolve_wrong_activation_${notificationId}` },
  ];

  console.log(`${LOG_PREFIX} Sending admin notification for notificationId: ${notificationId}`);
  await sender.sendMessage(businessPhoneNumber, { 
    text: summaryText, 
    buttons: adminButtons 
  });
} 