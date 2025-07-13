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
    
    // Check if current message has image attachment
    let hasImage = false;
    let imageUrl: string | undefined;
    
    if (currentParsedMessage?.attachments && currentParsedMessage.attachments.length > 0) {
      // Find image attachment only
      const imageAttachment = currentParsedMessage.attachments.find(attachment => 
        attachment.type === 'image' &&
        (attachment.payload?.storedUrl || attachment.payload?.url)
      );
      
      if (imageAttachment) {
        imageUrl = imageAttachment.payload?.storedUrl || imageAttachment.payload?.url;
        hasImage = true;
        console.log(`${LOG_PREFIX} Found image in current message: ${imageUrl}`);
      }
    }
    
    // Determine template and parameters based on image presence
    let templateName: string;
    let headerParams: string[] = [];
    let headerMedia: { type: 'image'; url: string } | undefined;
    
    const bodyParams = [
      cleanForTemplateParameter(safeCustomerName), // {{1}} in body - customer name
      cleanForTemplateParameter(safeLastMessage)   // {{2}} in body - triggering message
    ];
    
    if (hasImage && imageUrl) {
      // Use escalation_with_image template with image header
      templateName = 'escalation_with_image';
      headerMedia = { type: 'image', url: imageUrl };
      console.log(`${LOG_PREFIX} Using escalation_with_image template with image header: ${imageUrl}`);
    } else {
      // Use regular escalation template with text header
      templateName = getEscalationTemplateName(); // 'escalation'
      headerParams = [cleanForTemplateParameter(safeCustomerName)]; // {{1}} in header
      console.log(`${LOG_PREFIX} Using escalation template with text header: ${safeCustomerName}`);
    }
    
    console.log(`${LOG_PREFIX} Template: ${templateName}`);
    console.log(`${LOG_PREFIX} Header: ${hasImage ? 'image' : `text [${headerParams[0]}]`}`);
    console.log(`${LOG_PREFIX} Body: [${bodyParams[0]}, ${bodyParams[1]}]`);
    
    // Send the template
    const templateMessageId = await sender.sendTemplateMessage(
      businessPhoneNumber,
      templateName,
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