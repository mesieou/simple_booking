import { BotResponse } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatContext, ConversationalParticipant } from '@/lib/bot-engine/types';
import { UserContext } from '@/lib/database/models/user-context';
import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';
import { Notification } from '@/lib/database/models/notification';
import { ChatMessage } from '@/lib/database/models/chat-session';
import { Business } from '@/lib/database/models/business';
import { User } from '@/lib/database/models/user';
import { analyzeSentiment } from '@/lib/shared/llm/functions/sentiment-analiser';
import { executeChatCompletion } from '@/lib/shared/llm/openai/openai-core';
import { getSiteUrl } from '@/lib/config/auth-config';

const LOG_PREFIX = '[EscalationHandler]';

const i18n = {
    en: {
        notificationTitle: "🚨 *Human Assistance Required* 🚨",
        clientLabel: "Client:",
        assistRequestText: "To assist this client's request, go to",
        historyTitle: "*Recent conversation history:*",
        userResponse: "Your request has been sent to our team. Someone will contact you shortly via WhatsApp.",
        frustrationDetected: "I apologize for any inconvenience. It seems you're having some difficulty with our automated system. A member of our staff will contact you shortly to assist you personally.",
        imageRedirectTitle: "📸 *Media Content Received* 📸",
        imageRedirectUserResponse: "I cannot process media files (images, videos, documents, audios) at the moment. I'm connecting you with a staff member who will review your content and assist you shortly. Please wait to be attended.",
    },
    es: {
        notificationTitle: "🚨 *Se Requiere Asistencia Humana* 🚨",
        clientLabel: "Cliente:",
        assistRequestText: "Para atender la solicitud de este cliente, dirigirse a",
        historyTitle: "*Historial de conversacion reciente:*",
        userResponse: "Tu solicitud ha sido enviada a nuestro equipo. Alguien se pondrá en contacto contigo en breve a través de WhatsApp.",
        frustrationDetected: "Disculpe las molestias. Parece que está teniendo algunas complicaciones con nuestro sistema automatizado. Pronto un miembro de nuestro personal se comunicará con usted para asistirle personalmente.",
        imageRedirectTitle: "📸 *Contenido Multimedia Recibido* 📸",
        imageRedirectUserResponse: "No puedo procesar archivos multimedia (imágenes, videos, documentos, audios) en este momento. Te estoy conectando con un miembro del personal que revisará tu contenido y te asistirá en breve. Por favor espera a ser atendido.",
    }
};

export interface EscalationResult {
  isEscalated: boolean;
  response?: BotResponse;
  reason?: string;
}

/**
 * Detects if a message contains media content that should trigger escalation
 * (excludes stickers and audios as they should not trigger escalation)
 */
function hasMediaContent(message: string): boolean {
  // Check if message contains media placeholders added by the parser
  // Stickers and audios are excluded as they should not trigger escalation
  // Audio messages are handled by the audio transcription module
  const mediaPlaceholders = ['[IMAGE]', '[VIDEO]', '[DOCUMENT]'];
  return mediaPlaceholders.some(placeholder => message.includes(placeholder));
}

/**
 * Detects if a message contains only a sticker
 */
export function hasStickerContent(message: string): boolean {
  return message.includes('[STICKER]');
}

/**
 * Uses AI to detect if a message is requesting human assistance
 */
async function detectHumanAssistanceRequest(message: string): Promise<boolean> {
  try {
    const prompt = `Analyze the following message and determine if the user is requesting to speak with a human agent, customer service representative, or any form of human assistance.

Return only "true" if the message is clearly requesting human assistance, or "false" if it's not.

Examples of human assistance requests:
- "I want to speak to a person"
- "Can I talk to someone?"
- "I need human help"
- "Connect me to an agent"
- "I want customer service"
- "Can you transfer me to a human?"
- "Quiero hablar con una persona"
- "Necesito ayuda humana"
- "¿Puedo hablar con alguien?"

Examples of NOT human assistance requests:
- "I need help with booking"
- "Can you help me?"
- "I have a question"
- "What services do you offer?"
- "How much does it cost?"

Message: "${message}"

Return only "true" or "false":`;

    const response = await executeChatCompletion([
      {
        role: "system" as const,
        content: "You are a precise intent detection system. Return only 'true' or 'false' based on whether the message is requesting human assistance."
      },
      {
        role: "user" as const,
        content: prompt
      }
    ], "gpt-4o", 0.1, 10);

    const result = response.choices[0]?.message?.content?.trim().toLowerCase();
    console.log(`${LOG_PREFIX} AI Human assistance detection result for "${message}": ${result}`);
    
    return result === 'true';
  } catch (error) {
    console.error(`${LOG_PREFIX} Error in AI human assistance detection:`, error);
    return false;
  }
}

/**
 * Analyzes recent message history for frustration patterns using sentiment analysis
 */
async function analyzeFrustrationPattern(
  currentMessage: string,
  messageHistory: ChatMessage[],
  currentContext: ChatContext
): Promise<{ shouldEscalate: boolean; consecutiveFrustratedMessages: number }> {
  try {
    // Analyze sentiment of current message
    const currentSentiment = await analyzeSentiment(currentMessage);
    
    if (!currentSentiment) {
      console.log(`${LOG_PREFIX} Could not analyze sentiment for current message`);
      return { shouldEscalate: false, consecutiveFrustratedMessages: 0 };
    }

    console.log(`${LOG_PREFIX} Current message sentiment:`, currentSentiment);

    // Find the last staff message to reset frustration tracking
    const recentMessages = messageHistory.slice(-15);
    let lastStaffMessageIndex = -1;
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      if (recentMessages[i].role === 'staff') {
        lastStaffMessageIndex = i;
        break;
      }
    }

    // Get messages to analyze (after last staff intervention)
    const messagesToAnalyze = lastStaffMessageIndex >= 0 
      ? recentMessages.slice(lastStaffMessageIndex + 1)
      : recentMessages.slice(-10); // Last 10 messages if no staff intervention

    // Count consecutive frustrated messages (including current one if frustrated)
    let consecutiveFrustratedCount = 0;
    
    // Check if current message is frustrated
    if (currentSentiment.category === 'frustrated') {
      consecutiveFrustratedCount = 1;
      
      // Check previous messages (in reverse order) for consecutive frustration
      for (let i = messagesToAnalyze.length - 1; i >= 0; i--) {
        const msg = messagesToAnalyze[i];
        
        // Only analyze user messages that are strings
        if (msg.role === 'user' && typeof msg.content === 'string' && msg.content !== currentMessage) {
          const msgSentiment = await analyzeSentiment(msg.content);
          if (msgSentiment && msgSentiment.category === 'frustrated') {
            consecutiveFrustratedCount++;
          } else {
            break; // Stop counting if we find a non-frustrated message
          }
        }
      }
    }

    console.log(`${LOG_PREFIX} Consecutive frustrated messages: ${consecutiveFrustratedCount}`);

    // Escalate if 3 or more consecutive frustrated messages
    const shouldEscalate = consecutiveFrustratedCount >= 3;

    return { shouldEscalate, consecutiveFrustratedMessages: consecutiveFrustratedCount };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error analyzing frustration pattern:`, error);
    return { shouldEscalate: false, consecutiveFrustratedMessages: 0 };
  }
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
  let escalationReason: 'human_request' | 'frustration' | 'media_redirect' | undefined;
  let escalationMessage: string | undefined;

  console.log(`${LOG_PREFIX} Starting AI-powered escalation analysis for: "${incomingUserMessage}"`);

  // 1. Check for media content first (highest priority)
  const hasMedia = hasMediaContent(incomingUserMessage);
  
  if (hasMedia) {
    escalationReason = 'media_redirect';
    console.log(`${LOG_PREFIX} Media content detected in message: "${incomingUserMessage}"`);
    
    // Set custom message for media redirection
    const language = currentContext.participantPreferences.language === 'es' ? 'es' : 'en';
    escalationMessage = i18n[language].imageRedirectUserResponse;
  } else {
    // 2. Check for explicit human assistance requests using AI
    const isHumanRequest = await detectHumanAssistanceRequest(incomingUserMessage);
    
    if (isHumanRequest) {
      escalationReason = 'human_request';
      console.log(`${LOG_PREFIX} AI detected explicit human assistance request`);
    } else {
      // 3. Check for frustration patterns using sentiment analysis
      const frustrationAnalysis = await analyzeFrustrationPattern(
        incomingUserMessage,
        messageHistory,
        currentContext
      );

      if (frustrationAnalysis.shouldEscalate) {
        escalationReason = 'frustration';
        console.log(`${LOG_PREFIX} Frustration pattern detected: ${frustrationAnalysis.consecutiveFrustratedMessages} consecutive frustrated messages`);
        
        // Set custom message for frustration-based escalation
        const language = currentContext.participantPreferences.language === 'es' ? 'es' : 'en';
        escalationMessage = i18n[language].frustrationDetected;
      }
    }
  }

  if (escalationReason) {
    console.log(`${LOG_PREFIX} Escalation triggered. Reason: ${escalationReason}`);
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
          // For fallback scenario, we don't have a notification ID, so send directly
          await sendEscalationNotification(fallbackPhone, customerName, messageHistory, language, fallbackPhone, chatSessionId, currentContext.currentParticipant.customerWhatsappNumber, escalationReason);
        }
        return { 
          isEscalated: true, 
          reason: escalationReason, 
          response: { text: escalationMessage || t.userResponse }
        };
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
            message: `Escalation triggered: ${escalationReason}`,
            status: 'pending'
        });
      }
      if (!notification) {
        throw new Error("Failed to create a notification record in the database.");
      }
      
      if (chatSessionId) {
        // Send notification with delivery tracking
        await sendEscalationNotificationWithTracking(
          notification.id,
          escalationPhoneNumber, 
          customerName, 
          messageHistory, 
          language, 
          finalBusinessPhoneNumberId, 
          chatSessionId, 
          currentContext.currentParticipant.customerWhatsappNumber, 
          escalationReason
        );
      }
      
      return {
        isEscalated: true,
        reason: escalationReason,
        response: { text: escalationMessage || t.userResponse },
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to process AI-powered escalation due to an internal error:`, error);
      return { isEscalated: false };
    }
  }

  return { isEscalated: false };
}

/**
 * Sends escalation notification with delivery tracking
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
  
  try {
    // Send the notification and capture WhatsApp message ID
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
    
    // Mark delivery as successful and store WhatsApp message ID
    await Notification.markDeliverySuccessWithMessageId(notificationId, whatsappMessageId);
    console.log(`${LOG_PREFIX} ✅ Escalation notification sent to WhatsApp API for ${businessPhoneNumber} (Message ID: ${whatsappMessageId || 'unknown'})`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} ❌ Failed to send escalation notification to ${businessPhoneNumber}:`, errorMessage);
    
    // Mark delivery as failed with retry scheduling
    await Notification.markDeliveryFailure(notificationId, errorMessage, businessPhoneNumber);
    
    // Don't throw the error - we've tracked it in the database
    // The escalation is created even if delivery fails
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