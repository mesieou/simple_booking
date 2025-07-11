import { getEnvironmentServiceRoleClient } from "@/lib/database/supabase/environment";
import { 
  type TemplateComponent,
  type TemplateMessage,
  getEscalationTemplateName
} from '@/lib/bot-engine/escalation/types';

const LOG_PREFIX = '[WhatsAppTemplateSender]';

export class WhatsAppTemplateSender {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0';
    
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WhatsApp configuration missing: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
    }
  }

  /**
   * Sends a WhatsApp template message
   */
  async sendTemplateMessage(
    recipientId: string,
    templateName: string,
    languageCode: string,
    bodyParameters: string[] = [],
    businessPhoneNumberId?: string
  ): Promise<string | null> {
    try {
      console.log(`${LOG_PREFIX} Sending template "${templateName}" to ${recipientId}`);
      console.log(`${LOG_PREFIX} Parameters:`, bodyParameters);
      
      const phoneNumberIdToUse = businessPhoneNumberId || this.phoneNumberId;
      
      const templateMessage: TemplateMessage = {
        name: templateName,
        language: {
          code: languageCode
        }
      };
      
      // Add body parameters if provided
      if (bodyParameters.length > 0) {
        templateMessage.components = [
          {
            type: 'body',
            parameters: bodyParameters.map(param => ({
              type: 'text',
              text: param
            }))
          }
        ];
      }
      
      const payload = {
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'template',
        template: templateMessage
      };
      
      console.log(`${LOG_PREFIX} Template payload:`, JSON.stringify(payload, null, 2));
      
      const apiUrl = `https://graph.facebook.com/${this.apiVersion}/${phoneNumberIdToUse}/messages`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error(`${LOG_PREFIX} Template API error:`, responseData);
        throw new Error(`Template API error: ${responseData.error?.message || 'Unknown error'}`);
      }
      
      const messageId = responseData.messages?.[0]?.id;
      if (!messageId) {
        console.error(`${LOG_PREFIX} No message ID in response:`, responseData);
        throw new Error('No message ID returned from WhatsApp API');
      }
      
      console.log(`${LOG_PREFIX} ✅ Template sent successfully (ID: ${messageId})`);
      return messageId;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${LOG_PREFIX} ❌ Template send failed:`, errorMessage);
      throw error;
    }
  }
  
  /**
   * Sends escalation notification template with customer details
   */
  async sendEscalationTemplate(
    adminPhone: string,
    customerName: string,
    customerMessage: string,
    businessPhoneNumberId: string,
    language: string = 'en'
  ): Promise<string | null> {
    try {
      const languageCode = language === 'es' ? 'es' : 'en'; // Changed from 'en_US' to 'en'
      const templateName = getEscalationTemplateName();
      
      // Truncate message to fit template constraints
      const truncatedMessage = customerMessage.length > 100 
        ? customerMessage.substring(0, 97) + '...'
        : customerMessage;
      
      const parameters = [
        customerName,
        truncatedMessage
      ];
      
      console.log(`${LOG_PREFIX} Sending escalation template to ${adminPhone}`);
      console.log(`${LOG_PREFIX} Customer: ${customerName}, Message: "${truncatedMessage}"`);
      
      return await this.sendTemplateMessage(
        adminPhone,
        templateName,
        languageCode,
        parameters,
        businessPhoneNumberId
      );
      
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Escalation template failed:`, error);
      throw error;
    }
  }
  
  /**
   * Validates template configuration
   */
  async validateTemplateExists(templateName: string): Promise<boolean> {
    try {
      // Note: This would require additional API calls to check template status
      // For now, we'll assume template exists if no error is thrown during send
      console.log(`${LOG_PREFIX} Validating template: ${templateName}`);
      return true;
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Template validation failed:`, error);
      return false;
    }
  }
  
  /**
   * Gets template information (for debugging)
   */
  async getTemplateInfo(templateName: string): Promise<any> {
    try {
      // This would require WhatsApp Business Management API access
      // For now, return basic info
      return {
        name: templateName,
        status: 'unknown',
        category: 'UTILITY',
        language: 'en' // Changed from 'en_US' to 'en' for consistency
      };
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to get template info:`, error);
      return null;
    }
  }
}

// Convenience function for quick template sending
export async function sendWhatsAppTemplate(
  recipientId: string,
  templateName: string,
  languageCode: string,
  parameters: string[] = [],
  businessPhoneNumberId?: string
): Promise<string | null> {
  const sender = new WhatsAppTemplateSender();
  return await sender.sendTemplateMessage(
    recipientId,
    templateName,
    languageCode,
    parameters,
    businessPhoneNumberId
  );
}

// Convenience function for escalation templates
export async function sendEscalationTemplate(
  adminPhone: string,
  customerName: string,
  customerMessage: string,
  businessPhoneNumberId: string,
  language: string = 'en'
): Promise<string | null> {
  const sender = new WhatsAppTemplateSender();
  return await sender.sendEscalationTemplate(
    adminPhone,
    customerName,
    customerMessage,
    businessPhoneNumberId,
    language
  );
}

// Export is already handled by the class declaration above 