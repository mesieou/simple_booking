import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';
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
 * Sends escalation template message with customer name and triggering message only
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
    const languageCode = language === 'es' ? 'es' : 'en';
    
    // Ensure all parameters have valid fallback values
    const safeCustomerName = customerName?.trim() || 'Customer';
    const safeLastMessage = lastCustomerMessage?.trim() || 'No message';
    
    console.log(`${LOG_PREFIX} Template parameters - Customer: "${safeCustomerName}", Message: "${safeLastMessage}"`);
    
    // Simple template structure:
    // Header: Customer {{1}} needs help!
    // Body: 👤{{1}} asked: {{2}}
    const headerParams = [
      cleanForTemplateParameter(safeCustomerName) // {{1}} in header
    ];
    
    const bodyParams = [
      cleanForTemplateParameter(safeCustomerName), // {{1}} in body - customer name
      cleanForTemplateParameter(safeLastMessage)   // {{2}} in body - triggering message
    ];
    
    console.log(`${LOG_PREFIX} Sending template with 3 parameters total (1 header + 2 body)`);
    console.log(`${LOG_PREFIX} Header: [${headerParams[0]}]`);
    console.log(`${LOG_PREFIX} Body: [${bodyParams[0]}, ${bodyParams[1]}]`);
    
    // Send the template
    const templateMessageId = await sender.sendTemplateMessage(
      businessPhoneNumber,
      getEscalationTemplateName(),
      languageCode,
      bodyParams,
      businessPhoneNumberId,
      headerParams
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