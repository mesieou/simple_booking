import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';
import { ChatMessage } from '@/lib/database/models/chat-session';
import { ParsedMessage } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { 
  getEscalationTemplateName
} from './types';

const LOG_PREFIX = '[ProxyTemplateService]';

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
 * Sends escalation template message with customer name, triggering message, and optional media
 */
export async function sendEscalationTemplate(
  businessPhoneNumber: string,
  businessPhoneNumberId: string,
  customerName: string,
  lastCustomerMessage: string,
  chatSessionId: string,
  language: string = 'en',
  messageHistory?: ChatMessage[],
  currentParsedMessage?: ParsedMessage
): Promise<string | null> {
  console.log(`${LOG_PREFIX} Sending escalation template for session: ${chatSessionId}`);
  
  const sender = new WhatsappSender();
  
  try {
    const languageCode = language === 'es' ? 'es' : 'en';
    
    // Ensure all parameters have valid fallback values
    const safeCustomerName = customerName?.trim() || 'Customer';
    const safeLastMessage = lastCustomerMessage?.trim() || 'No message';
    
    console.log(`${LOG_PREFIX} Template parameters - Customer: "${safeCustomerName}", Message: "${safeLastMessage}"`);
    
    // Extract media from current message that triggered escalation
    let headerMedia: { type: 'image' | 'video' | 'document'; url: string; filename?: string } | undefined;
    
    if (currentParsedMessage?.attachments && currentParsedMessage.attachments.length > 0) {
      // Find the first suitable media attachment (image, video, document)
      const mediaAttachment = currentParsedMessage.attachments.find(attachment => 
        (attachment.type === 'image' || attachment.type === 'video' || attachment.type === 'document') &&
        attachment.payload?.storedUrl || attachment.payload?.url
      );
      
      if (mediaAttachment) {
        const url = mediaAttachment.payload?.storedUrl || mediaAttachment.payload?.url;
        if (url) {
          headerMedia = {
            type: mediaAttachment.type as 'image' | 'video' | 'document',
            url: url,
            filename: mediaAttachment.payload?.originalFilename
          };
          console.log(`${LOG_PREFIX} Including ${mediaAttachment.type} media from current message: ${url}`);
        }
      }
    }
    
    // Template structure:
    // Header: Customer {{1}} needs help! + optional media {{2}}
    // Body: 👤{{1}} asked: {{2}}
    const headerParams = [
      cleanForTemplateParameter(safeCustomerName) // {{1}} in header
    ];
    
    const bodyParams = [
      cleanForTemplateParameter(safeCustomerName), // {{1}} in body - customer name
      cleanForTemplateParameter(safeLastMessage)   // {{2}} in body - triggering message
    ];
    
    const parameterCount = headerParams.length + bodyParams.length + (headerMedia ? 1 : 0);
    console.log(`${LOG_PREFIX} Sending template with ${parameterCount} parameters total (${headerParams.length} header text + ${headerMedia ? '1 header media + ' : ''}${bodyParams.length} body)`);
    console.log(`${LOG_PREFIX} Header: [${headerParams[0]}]${headerMedia ? ` + ${headerMedia.type} media` : ''}`);
    console.log(`${LOG_PREFIX} Body: [${bodyParams[0]}, ${bodyParams[1]}]`);
    
    // Send the template
    const templateMessageId = await sender.sendTemplateMessage(
      businessPhoneNumber,
      getEscalationTemplateName(),
      languageCode,
      bodyParams,
      businessPhoneNumberId,
      headerParams,
      headerMedia
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
 * DEPRECATED: Sends media attachments as follow-up messages after the escalation template
 * Now media is sent directly in the template header for better UX
 */
/*
export async function sendMediaAttachments(
  businessPhoneNumber: string,
  businessPhoneNumberId: string,
  customerName: string,
  messageHistory: ChatMessage[],
  chatSessionId: string,
  language: string = 'en'
): Promise<string[]> {
  // This function is deprecated - media is now sent directly in template header
  console.log(`${LOG_PREFIX} ⚠️ sendMediaAttachments is deprecated - media now sent in template header`);
  return [];
}
*/ 