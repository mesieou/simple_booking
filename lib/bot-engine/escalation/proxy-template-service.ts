import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';
import { ChatMessage, ChatSession } from '@/lib/database/models/chat-session';
import { 
  type EscalationTemplateParams,
  type MediaAttachmentInfo,
  ESCALATION_CONSTANTS,
  getEscalationTemplateName
} from './types';

const LOG_PREFIX = '[ProxyTemplateService]';

// Use shared template configuration
const TEMPLATE_CONFIG = ESCALATION_CONSTANTS.TEMPLATE_CONFIG;
const TEMPLATE_LIMITS = ESCALATION_CONSTANTS.TEMPLATE_PARAMETER_LIMITS;

/**
 * Cleans text for WhatsApp template parameters by removing/replacing forbidden characters
 * WhatsApp doesn't allow: newlines, tabs, or more than 4 consecutive spaces
 */
function cleanForTemplateParameter(text: string): string {
  return text
    // Remove all newlines and replace with space
    .replace(/\n/g, ' ')
    // Remove all tabs and replace with space
    .replace(/\t/g, ' ')
    // Replace multiple consecutive spaces (4+) with 3 spaces
    .replace(/\s{4,}/g, '   ')
    // Clean up any double spaces that might have been created
    .replace(/\s{2}/g, ' ')
    // Trim whitespace from start and end
    .trim();
}

/**
 * Truncates text to fit WhatsApp template parameter limits
 */
function truncateForTemplate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Checks if template parameters exceed WhatsApp limits
 */
function checkParameterLimits(headerParams: string[], bodyParams: string[]): {
  isWithinLimits: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check header parameters
  headerParams.forEach((param, index) => {
    if (param.length > TEMPLATE_LIMITS.HEADER_MAX_LENGTH) {
      issues.push(`Header param ${index + 1} too long: ${param.length}/${TEMPLATE_LIMITS.HEADER_MAX_LENGTH} chars`);
    }
  });
  
  // Check body parameters  
  bodyParams.forEach((param, index) => {
    if (param.length > TEMPLATE_LIMITS.BODY_MAX_LENGTH) {
      issues.push(`Body param ${index + 1} too long: ${param.length}/${TEMPLATE_LIMITS.BODY_MAX_LENGTH} chars`);
    }
  });
  
  return {
    isWithinLimits: issues.length === 0,
    issues
  };
}

/**
 * Sends escalation template message with conversation context and smart fallback
 */
export async function sendEscalationTemplate(
  businessPhoneNumber: string,
  businessPhoneNumberId: string,
  customerName: string,
  lastCustomerMessage: string,
  chatSessionId: string,
  language: string = 'en'
): Promise<string | null> {
  console.log(`${LOG_PREFIX} Sending escalation template for session: ${chatSessionId}`);
  
  const sender = new WhatsappSender();
  
  try {
    // Get conversation history for template
    const conversationHistory = await getConversationHistory(chatSessionId, TEMPLATE_CONFIG.MAX_MESSAGES_IN_HISTORY);
    const fullHistory = formatConversationHistoryForTemplate(conversationHistory, customerName, language, TEMPLATE_CONFIG.MAX_HISTORY_LENGTH);
    
    const languageCode = language === 'es' ? 'es' : 'en';
    
    // 🔧 FIX: Ensure all parameters have valid fallback values to prevent parameter count mismatch
    const safeCustomerName = customerName?.trim() || 'Customer';
    const safeLastMessage = lastCustomerMessage?.trim() || 'No message';
    const safeHistory = fullHistory?.trim() || 'No conversation history';
    
    console.log(`${LOG_PREFIX} Template parameters - Customer: "${safeCustomerName}", Message: "${safeLastMessage.substring(0, 50)}...", History length: ${safeHistory.length}`);
    
    // Prepare original parameters (cleaned but not truncated)
    const originalHeaderParams = [
      cleanForTemplateParameter(safeCustomerName)
    ];
    // 🔧 FIX: WhatsApp template expects 3 body parameters: customer name, conversation history, current message
    const originalBodyParams = [
      cleanForTemplateParameter(safeCustomerName), // {{1}} - customer name (repeated from header)
      cleanForTemplateParameter(safeHistory),      // {{2}} - conversation history  
      cleanForTemplateParameter(safeLastMessage.substring(0, TEMPLATE_CONFIG.MAX_CURRENT_MESSAGE_LENGTH)) // {{3}} - current message
    ];
    
    // 🔧 FIX: Validate that all parameters are non-empty to ensure correct parameter count
    if (!originalHeaderParams[0]) {
      originalHeaderParams[0] = 'Customer';
      console.warn(`${LOG_PREFIX} ⚠️ Empty header parameter detected, using fallback: "Customer"`);
    }
    
    if (!originalBodyParams[0]) {
      originalBodyParams[0] = 'Customer';
      console.warn(`${LOG_PREFIX} ⚠️ Empty customer name parameter detected, using fallback`);
    }
    
    if (!originalBodyParams[1]) {
      originalBodyParams[1] = 'No conversation history available';
      console.warn(`${LOG_PREFIX} ⚠️ Empty history parameter detected, using fallback`);
    }
    
    if (!originalBodyParams[2]) {
      originalBodyParams[2] = 'No current message available';
      console.warn(`${LOG_PREFIX} ⚠️ Empty message parameter detected, using fallback`);
    }
    
    // Check if parameters exceed WhatsApp template limits
    const limitCheck = checkParameterLimits(originalHeaderParams, originalBodyParams);
    
    let templateParams = {
      header: originalHeaderParams,
      body: originalBodyParams
    };
    
    let needsFollowUp = false;
    
    if (!limitCheck.isWithinLimits) {
      console.log(`${LOG_PREFIX} ⚠️ Template parameters exceed limits:`, limitCheck.issues);
      needsFollowUp = true;
      
      // Create truncated versions for template
      templateParams = {
        header: [
          truncateForTemplate(originalHeaderParams[0], TEMPLATE_LIMITS.HEADER_MAX_LENGTH)
        ],
        body: [
          truncateForTemplate(originalBodyParams[0], TEMPLATE_LIMITS.HEADER_MAX_LENGTH), // Customer name (same limit as header)
          truncateForTemplate(originalBodyParams[1], TEMPLATE_LIMITS.SAFE_HISTORY_LENGTH), // Use conservative limit for history
          truncateForTemplate(originalBodyParams[2], TEMPLATE_LIMITS.SAFE_MESSAGE_LENGTH)  // Use conservative limit for message
        ]
      };
      
      console.log(`${LOG_PREFIX} 📏 Using truncated parameters for template, will send full details in follow-up`);
    }
    
    // 🔧 FIX: Final validation to ensure we always send exactly 4 parameters (1 header + 3 body)
    const totalParamCount = templateParams.header.length + templateParams.body.length;
    console.log(`${LOG_PREFIX} 🔍 Template parameter validation - Header: ${templateParams.header.length}, Body: ${templateParams.body.length}, Total: ${totalParamCount}`);
    
    if (totalParamCount !== 4) {
      console.error(`${LOG_PREFIX} ❌ Parameter count mismatch! Expected 4, got ${totalParamCount}`);
      console.error(`${LOG_PREFIX} Header params:`, templateParams.header);
      console.error(`${LOG_PREFIX} Body params:`, templateParams.body);
      throw new Error(`Template parameter count mismatch: expected 4, got ${totalParamCount}`);
    }
    
    console.log(`${LOG_PREFIX} Sending template with params:`, {
      customerName: templateParams.header[0],
      customerNameBody: templateParams.body[0],
      historyLength: templateParams.body[1].length,
      currentMessage: templateParams.body[2],
      willSendFollowUp: needsFollowUp
    });
    
    // Send the template with (possibly truncated) parameters
    const templateMessageId = await sender.sendTemplateMessage(
      businessPhoneNumber,
      getEscalationTemplateName(),
      languageCode,
      templateParams.body,
      businessPhoneNumberId,
      templateParams.header
    );
    
    if (!templateMessageId) {
      throw new Error('Template message failed - no message ID returned');
    }
    
    console.log(`${LOG_PREFIX} ✅ Template sent successfully (ID: ${templateMessageId})`);
    
    // Send follow-up message with full conversation history if needed
    if (needsFollowUp) {
      await sendFullConversationHistoryFollowUp(
        businessPhoneNumber,
        businessPhoneNumberId,
        safeCustomerName,
        safeHistory,
        safeLastMessage,
        language,
        sender
      );
    }
    
    return templateMessageId;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Failed to send escalation template:`, error);
    throw error;
  }
}

/**
 * Sends follow-up message with full conversation history when template was truncated
 */
async function sendFullConversationHistoryFollowUp(
  businessPhoneNumber: string,
  businessPhoneNumberId: string,
  customerName: string,
  fullHistory: string,
  lastCustomerMessage: string,
  language: string,
  sender: WhatsappSender
): Promise<void> {
  try {
    const lang = language === 'es' ? 'es' : 'en';
    
    const translations = {
      es: {
        followUpTitle: '📋 *Historial Completo de Conversación*',
        customerName: 'Cliente',
        currentMessage: 'Mensaje Actual',
        fullHistory: 'Historial Completo'
      },
      en: {
        followUpTitle: '📋 *Complete Conversation History*',
        customerName: 'Customer',
        currentMessage: 'Current Message',
        fullHistory: 'Full History'
      }
    };
    
    const t = translations[lang];
    
    // Create comprehensive follow-up message
    const followUpMessage = `${t.followUpTitle}

${t.customerName}: ${customerName}

${t.currentMessage}: "${lastCustomerMessage}"

${t.fullHistory}:
${fullHistory}`;
    
    console.log(`${LOG_PREFIX} 📤 Sending follow-up with full conversation history (${followUpMessage.length} chars)`);
    
    // Send as regular message
    await sender.sendMessage(
      businessPhoneNumber,
      { text: followUpMessage },
      businessPhoneNumberId
    );
    
    console.log(`${LOG_PREFIX} ✅ Follow-up message sent with complete conversation history`);
    
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Failed to send follow-up message:`, error);
    // Don't throw error - template was already sent successfully
  }
}

/**
 * Gets conversation history for escalation context
 */
export async function getConversationHistory(chatSessionId: string, messageLimit: number = 4): Promise<ChatMessage[]> {
  try {
    console.log(`${LOG_PREFIX} Fetching conversation history for session: ${chatSessionId}`);
    
    // Get session and extract recent messages from existing allMessages
    const session = await ChatSession.getById(chatSessionId);
    if (!session) {
      console.warn(`${LOG_PREFIX} Session not found: ${chatSessionId}`);
      return [];
    }
    
    // Get the most recent messages from allMessages array
    const messages = session.allMessages || [];
    const recentMessages = messages
      .filter(msg => msg.timestamp) // Ensure timestamp exists
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
      .slice(0, messageLimit);
    
    console.log(`${LOG_PREFIX} Found ${recentMessages.length} messages in history`);
    return recentMessages;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching conversation history:`, error);
    return [];
  }
}

/**
 * Formats conversation history for template (compact format)
 */
export function formatConversationHistoryForTemplate(
  messages: ChatMessage[], 
  customerName: string, 
  language: string,
  maxLength: number = 600
): string {
  const lang = language === 'es' ? 'es' : 'en';
  
  const translations = {
    es: {
      customer: '👤 Cliente',
      bot: '🤖 Bot',
      noHistory: '📝 Sin historial previo.',
    },
    en: {
      customer: '👤 Customer',
      bot: '🤖 Bot',
      noHistory: '📝 No previous conversation.',
    }
  };
  
  const t = translations[lang];
  
  if (!messages || messages.length === 0) {
    return t.noHistory;
  }
  
  // Sort messages by timestamp (most recent first for template)
  const sortedMessages = messages
    .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
    .slice(0, 4); // Limit to last 4 messages to fit in template
  
  let historyText = '';
  let currentLength = 0;
  
  for (const msg of sortedMessages) {
    const isCustomer = msg.role === 'user';
    const sender = isCustomer ? t.customer : t.bot;
    const timestamp = formatRelativeTime(msg.timestamp!, lang);
    
    // Extract text content from message and clean it for template compatibility
    let messageText = '';
    if (typeof msg.content === 'string') {
      messageText = cleanForTemplateParameter(msg.content);
    } else if (msg.content && typeof msg.content === 'object') {
      messageText = cleanForTemplateParameter((msg.content as any).text || '[Non-text message]');
    } else {
      messageText = '[Empty message]';
    }
    
    // Add media indicator if message has attachments
    const hasMedia = msg.attachments && msg.attachments.length > 0;
    const mediaIndicator = hasMedia ? ' 📎' : '';
    
    // Compact format: "Sender: 'message' (timestamp)" with media indicator
    // Use " • " as separator instead of newlines for WhatsApp template compatibility
    const maxMsgLength = hasMedia ? 70 : 75; // Leave space for media indicator and separator
    const truncatedText = messageText.length > maxMsgLength 
      ? messageText.substring(0, maxMsgLength - 3) + '...'
      : messageText;
    
    const line = `${sender}: "${truncatedText}"${mediaIndicator} (${timestamp})`;
    const separator = historyText ? ' • ' : ''; // Add bullet separator between messages
    
    // Check if adding this line would exceed max length
    if (currentLength + line.length + separator.length > maxLength) {
      break;
    }
    
    historyText = line + separator + historyText; // Prepend to show chronological order
    currentLength += line.length + separator.length;
  }
  
  return historyText.trim();
}

/**
 * Formats relative time for message timestamps
 */
export function formatRelativeTime(timestamp: string, language: string): string {
  try {
    const messageTime = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));
    
    if (language === 'es') {
      if (diffInMinutes < 1) return 'ahora';
      if (diffInMinutes < 60) return `${diffInMinutes}m`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
      return `${Math.floor(diffInMinutes / 1440)}d`;
    } else {
      if (diffInMinutes < 1) return 'now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  } catch (error) {
    return language === 'es' ? 'reciente' : 'recent';
  }
}

/**
 * Sends media attachments from recent conversation to admin
 */
export async function sendMediaAttachments(
  messages: ChatMessage[],
  adminPhone: string,
  businessPhoneNumberId: string,
  customerName: string,
  language: string
): Promise<void> {
  const sender = new WhatsappSender();
  const lang = language === 'es' ? 'es' : 'en';
  
  const translations = {
    es: {
      mediaHeader: '📎 ARCHIVOS ADJUNTOS RECIENTES:',
      customerSent: 'envió',
      noMedia: 'Sin archivos multimedia en conversación reciente.'
    },
    en: {
      mediaHeader: '📎 RECENT ATTACHMENTS:',
      customerSent: 'sent',
      noMedia: 'No media in recent conversation.'
    }
  };
  
  const t = translations[lang];
  let mediaCount = 0;
  let mediaHeaderSent = false;
  
  // Sort messages chronologically (oldest first for context)
  const sortedMessages = messages
    .filter(msg => msg.attachments && msg.attachments.length > 0)
    .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());
  
  if (sortedMessages.length === 0) {
    console.log(`${LOG_PREFIX} No media attachments found in recent conversation`);
    return;
  }
  
  console.log(`${LOG_PREFIX} Found ${sortedMessages.length} messages with media attachments`);
  
  for (const message of sortedMessages) {
    if (!message.attachments || message.attachments.length === 0) continue;
    
    const isCustomer = message.role === 'user';
    const timestamp = formatRelativeTime(message.timestamp!, language);
    
    // Send header message once
    if (!mediaHeaderSent) {
      await sender.sendMessage(
        adminPhone,
        { text: t.mediaHeader },
        businessPhoneNumberId
      );
      mediaHeaderSent = true;
    }
    
    // Send each attachment with context
    for (const attachment of message.attachments) {
      try {
        const contextMessage = isCustomer 
          ? `👤 ${customerName} ${t.customerSent} (${timestamp}):`
          : `🤖 Bot ${t.customerSent} (${timestamp}):`;
        
        // Send context message first
        await sender.sendMessage(
          adminPhone,
          { text: contextMessage },
          businessPhoneNumberId
        );
        
        // Send the actual media
        await sendSingleMediaAttachment(
          adminPhone,
          attachment,
          businessPhoneNumberId
        );
        
        mediaCount++;
        
        // Small delay between attachments
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (attachmentError) {
        console.error(`${LOG_PREFIX} Failed to send attachment:`, attachmentError);
        // Continue with other attachments
      }
    }
  }
  
  console.log(`${LOG_PREFIX} ✅ Sent ${mediaCount} media attachments to admin`);
}

/**
 * Sends individual media attachment to admin
 */
async function sendSingleMediaAttachment(
  adminPhone: string,
  attachment: NonNullable<ChatMessage['attachments']>[0],
  businessPhoneNumberId: string
): Promise<void> {
  const sender = new WhatsappSender();
  
  try {
    // For now, send media URL as text message
    // TODO: Implement actual media sending when WhatsappSender supports it
    const mediaInfo = `📎 ${attachment.type.toUpperCase()}: ${attachment.url}`;
    const caption = attachment.caption ? `\n💬 "${attachment.caption}"` : '';
    const filename = attachment.originalFilename ? `\n📄 ${attachment.originalFilename}` : '';
    
    const mediaMessage = `${mediaInfo}${caption}${filename}`;
    
    await sender.sendMessage(
      adminPhone,
      { text: mediaMessage },
      businessPhoneNumberId
    );
    
    console.log(`${LOG_PREFIX} ✅ Sent ${attachment.type} attachment to admin`);
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to send media attachment:`, error);
    throw error;
  }
}

/**
 * Extracts media attachments from conversation history
 */
export function extractMediaAttachments(messages: ChatMessage[]): MediaAttachmentInfo[] {
  const attachments: MediaAttachmentInfo[] = [];
  
  for (const message of messages) {
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        attachments.push({
          type: attachment.type,
          url: attachment.url,
          caption: attachment.caption,
          originalFilename: attachment.originalFilename
        });
      }
    }
  }
  
  return attachments;
}

/**
 * Checks if conversation history has media attachments
 */
export function hasMediaAttachments(messages: ChatMessage[]): boolean {
  return messages.some(msg => msg.attachments && msg.attachments.length > 0);
} 