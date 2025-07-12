import { getEnvironmentServiceRoleClient } from "@/lib/database/supabase/environment";
import { 
  type TemplateComponent,
  type TemplateMessage,
  getEscalationTemplateName
} from '@/lib/bot-engine/escalation/types';

const LOG_PREFIX = '[WhatsAppTemplateSender]';

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
    businessPhoneNumberId?: string,
    headerParameters: string[] = []
  ): Promise<string | null> {
    try {
      console.log(`${LOG_PREFIX} Sending template "${templateName}" to ${recipientId}`);
      console.log(`${LOG_PREFIX} Header parameters (${headerParameters.length}):`, headerParameters);
      console.log(`${LOG_PREFIX} Body parameters (${bodyParameters.length}):`, bodyParameters);
      
      // 🔧 FIX: Validate that all parameters are non-empty strings to prevent WhatsApp API errors
      const validatedHeaderParams = headerParameters.filter(param => param && param.trim().length > 0);
      const validatedBodyParams = bodyParameters.filter(param => param && param.trim().length > 0);
      
      if (validatedHeaderParams.length !== headerParameters.length) {
        console.warn(`${LOG_PREFIX} ⚠️ Removed ${headerParameters.length - validatedHeaderParams.length} empty header parameters`);
      }
      
      if (validatedBodyParams.length !== bodyParameters.length) {
        console.warn(`${LOG_PREFIX} ⚠️ Removed ${bodyParameters.length - validatedBodyParams.length} empty body parameters`);
      }
      
      const totalParams = validatedHeaderParams.length + validatedBodyParams.length;
      console.log(`${LOG_PREFIX} 🔍 Validated parameters - Header: ${validatedHeaderParams.length}, Body: ${validatedBodyParams.length}, Total: ${totalParams}`);
      
      const phoneNumberIdToUse = businessPhoneNumberId || this.phoneNumberId;
      
      const templateMessage: TemplateMessage = {
        name: templateName,
        language: {
          code: languageCode
        }
      };
      
      // Build components array
      const components: any[] = [];
      
      // Add header parameters if provided
      if (validatedHeaderParams.length > 0) {
        components.push({
          type: 'header',
          parameters: validatedHeaderParams.map(param => ({
            type: 'text',
            text: cleanForTemplateParameter(param)
          }))
        });
      }
      
      // Add body parameters if provided
      if (validatedBodyParams.length > 0) {
        components.push({
          type: 'body',
          parameters: validatedBodyParams.map(param => ({
            type: 'text',
            text: cleanForTemplateParameter(param)
          }))
        });
      }
      
      // Add components to template if any exist
      if (components.length > 0) {
        templateMessage.components = components;
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
        
        // 🔧 FIX: Provide more detailed error information for parameter mismatches
        const errorMessage = responseData.error?.message || 'Unknown error';
        if (errorMessage.includes('number of parameters') || errorMessage.includes('localizable_params')) {
          console.error(`${LOG_PREFIX} 🚨 Parameter count mismatch detected!`);
          console.error(`${LOG_PREFIX} Template: ${templateName}, Language: ${languageCode}`);
          console.error(`${LOG_PREFIX} Sent - Header: ${validatedHeaderParams.length}, Body: ${validatedBodyParams.length}, Total: ${totalParams}`);
          console.error(`${LOG_PREFIX} Header params:`, validatedHeaderParams);
          console.error(`${LOG_PREFIX} Body params:`, validatedBodyParams);
        }
        
        throw new Error(`Template API error: ${errorMessage}`);
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
   * @deprecated Use sendEscalationTemplate from proxy-template-service.ts instead
   */
  async sendEscalationTemplate(
    adminPhone: string,
    customerName: string,
    customerMessage: string,
    businessPhoneNumberId: string,
    language: string = 'en'
  ): Promise<string | null> {
    try {
      const languageCode = language === 'es' ? 'es' : 'en';
      const templateName = getEscalationTemplateName();
      
      // Truncate message to fit template constraints
      const truncatedMessage = customerMessage.length > 100 
        ? customerMessage.substring(0, 97) + '...'
        : customerMessage;
      
      console.warn(`${LOG_PREFIX} ⚠️ DEPRECATED: Using old sendEscalationTemplate method. Use proxy-template-service.ts instead.`);
      
      // New simplified template format:
      // Header: Customer {{1}} needs help!
      // Body: 👤{{1}} asked: {{2}}
      const headerParameters = [customerName]; // {{1}} in header
      const bodyParameters = [
        customerName,      // {{1}} in body - customer name (repeated from header)
        truncatedMessage   // {{2}} in body - triggering message
      ];
      
      console.log(`${LOG_PREFIX} Sending escalation template to ${adminPhone}`);
      console.log(`${LOG_PREFIX} Customer: ${customerName}, Message: "${truncatedMessage}"`);
      console.log(`${LOG_PREFIX} Using simplified template format (3 parameters total)`);
      
      return await this.sendTemplateMessage(
        adminPhone,
        templateName,
        languageCode,
        bodyParameters,
        businessPhoneNumberId,
        headerParameters
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
  businessPhoneNumberId?: string,
  headerParameters: string[] = []
): Promise<string | null> {
  const sender = new WhatsAppTemplateSender();
  return await sender.sendTemplateMessage(
    recipientId,
    templateName,
    languageCode,
    parameters,
    businessPhoneNumberId,
    headerParameters
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