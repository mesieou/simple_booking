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

/**
 * Sends escalation template message with conversation context
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
    const compactHistory = formatConversationHistoryForTemplate(conversationHistory, customerName, language, TEMPLATE_CONFIG.MAX_HISTORY_LENGTH);
    
    // Send comprehensive escalation template (header + body + button)
    const languageCode = language === 'es' ? 'es' : 'en'; // Changed from 'en_US' to 'en'
    
    // Template structure (based on actual template):
    // Header: Customer {{1}} needs help!
    // Body: Customer {{1}} needs help! \n📝 Recent Chat: {{2}} \n💬 Current Message: "{{3}}"
    const headerParams = [customerName]; // {{1}} for header
    const bodyParams = [
      customerName, // {{1}} for body - customer name (reused)
      compactHistory, // {{2}} for body - conversation history  
      lastCustomerMessage.substring(0, TEMPLATE_CONFIG.MAX_CURRENT_MESSAGE_LENGTH) // {{3}} for body - current message
    ];
    
    console.log(`${LOG_PREFIX} Sending template with params:`, {
      customerName,
      historyLength: compactHistory.length,
      currentMessage: bodyParams[2]
    });
    
    const templateMessageId = await sender.sendTemplateMessage(
      businessPhoneNumber,
      getEscalationTemplateName(),
      languageCode,
      bodyParams, // body parameters
      businessPhoneNumberId,
      headerParams // header parameters
    );
    
    if (!templateMessageId) {
      throw new Error('Template message failed - no message ID returned');
    }
    
    console.log(`${LOG_PREFIX} ✅ Template sent successfully (ID: ${templateMessageId})`);
    return templateMessageId;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Failed to send escalation template:`, error);
    throw error;
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
    
    // Extract text content from message
    let messageText = '';
    if (typeof msg.content === 'string') {
      messageText = msg.content;
    } else if (msg.content && typeof msg.content === 'object') {
      messageText = (msg.content as any).text || '[Non-text message]';
    } else {
      messageText = '[Empty message]';
    }
    
    // Add media indicator if message has attachments
    const hasMedia = msg.attachments && msg.attachments.length > 0;
    const mediaIndicator = hasMedia ? ' 📎' : '';
    
    // Compact format: "Sender: 'message' (timestamp)" with media indicator
    const maxMsgLength = hasMedia ? 75 : 80; // Leave space for media indicator
    const truncatedText = messageText.length > maxMsgLength 
      ? messageText.substring(0, maxMsgLength - 3) + '...'
      : messageText;
    
    const line = `${sender}: "${truncatedText}"${mediaIndicator} (${timestamp})\n`;
    
    // Check if adding this line would exceed max length
    if (currentLength + line.length > maxLength) {
      break;
    }
    
    historyText = line + historyText; // Prepend to show chronological order
    currentLength += line.length;
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