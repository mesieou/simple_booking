import { BotResponse, IMessageSender } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { getWhatsappHeaders } from "./whatsapp-headers";

// Configuration constants - easily customizable without touching core logic
const WHATSAPP_CONFIG = {
  API_VERSION: process.env.WHATSAPP_API_VERSION || "v23.0",
  PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  ACCESS_TOKEN: process.env.WHATSAPP_PERMANENT_TOKEN, // Use permanent token for API calls
  
  // WhatsApp API limits
  LIMITS: {
    MAX_BUTTONS: 3,
    MAX_LIST_ITEMS: 10,
    BUTTON_TITLE_MAX_LENGTH: 20,
    LIST_TITLE_MAX_LENGTH: 24,
    LIST_DESCRIPTION_MAX_LENGTH: 72,
    MESSAGE_BODY_MAX_LENGTH: 1024
  }
} as const;

// Type definitions for WhatsApp message payloads
interface WhatsappTextPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: { body: string };
}

interface WhatsappButtonPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "interactive";
  interactive: {
    type: "button";
    body: { text: string };
    action: {
      buttons: Array<{
        type: "reply";
        reply: { id: string; title: string };
      }>;
    };
  };
}

interface WhatsappListPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "interactive";
  interactive: {
    type: "list";
    body: { text: string };
    action: {
      button: string;
      sections: Array<{
        title?: string;
        rows: Array<{
          id: string;
          title: string;
          description?: string;
        }>;
      }>;
    };
  };
}

type WhatsappPayload = WhatsappTextPayload | WhatsappButtonPayload | WhatsappListPayload;

export class WhatsappSender implements IMessageSender {
  
  // AHORA ACEPTA EL ID DEL NÚMERO DE TELÉFONO
  private getApiUrl(businessPhoneNumberId: string): string {
    if (!businessPhoneNumberId) {
      throw new Error("businessPhoneNumberId parameter is required");
    }
    return `https://graph.facebook.com/${WHATSAPP_CONFIG.API_VERSION}/${businessPhoneNumberId}/messages`;
  }

  // Se mantiene igual, pero ahora valida el token permanente
  private validateConfiguration(): void {
    if (!WHATSAPP_CONFIG.ACCESS_TOKEN) {
      throw new Error("WHATSAPP_PERMANENT_TOKEN environment variable is required");
    }
    // Ya no necesitamos validar PHONE_NUMBER_ID aquí
  }

  // Determines the optimal message type based on button count
  private getMessageType(buttonCount: number): 'text' | 'buttons' | 'list' {
    if (buttonCount === 0) return 'text';
    if (buttonCount <= WHATSAPP_CONFIG.LIMITS.MAX_BUTTONS) return 'buttons';
    return 'list';
  }

  // Creates a simple text message payload
  private createTextPayload(recipientId: string, text: string): WhatsappTextPayload {
    const validatedText = this.validateMessageText(text);
    return {
      messaging_product: "whatsapp",
      to: recipientId,
      type: "text",
      text: { body: validatedText }
    };
  }

  // Creates an interactive button message payload
  private createButtonPayload(recipientId: string, text: string, buttons: BotResponse['buttons']): WhatsappButtonPayload {
    const limitedButtons = buttons!.slice(0, WHATSAPP_CONFIG.LIMITS.MAX_BUTTONS);
    const validatedText = this.validateMessageText(text);
    
    return {
      messaging_product: "whatsapp",
      to: recipientId,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: validatedText },
        action: {
          buttons: limitedButtons.map((btn) => ({
            type: "reply",
            reply: {
              id: btn.buttonValue,
              title: this.truncateText(btn.buttonText, WHATSAPP_CONFIG.LIMITS.BUTTON_TITLE_MAX_LENGTH)
            }
          }))
        }
      }
    };
  }

  // Creates an interactive list message payload
  private createListPayload(recipientId: string, text: string, response: BotResponse): WhatsappListPayload {
    const limitedButtons = response.buttons!.slice(0, WHATSAPP_CONFIG.LIMITS.MAX_LIST_ITEMS);
    const validatedText = this.validateMessageText(text);
    console.log('[WhatsappSender] Creating list with buttons:', limitedButtons.map(b => ({ text: b.buttonText, desc: b.buttonDescription })));
    
    return {
      messaging_product: "whatsapp",
      to: recipientId,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: validatedText },
        action: {
          button: response.listActionText || "Select Option",
          sections: [{
            title: this.truncateText(response.listSectionTitle || "Available Options", WHATSAPP_CONFIG.LIMITS.LIST_TITLE_MAX_LENGTH),
            rows: limitedButtons.map((btn) => this.createListRow(btn))
          }]
        }
      }
    };
  }

  // Creates a list row with optimized title and description
  private createListRow(button: NonNullable<BotResponse['buttons']>[0]) {
    console.log('[WhatsappSender] Creating list row for button:', { text: button.buttonText, desc: button.buttonDescription });
    
    const title = button.buttonText;
    const description = button.buttonDescription || '';
    
    const row = {
      id: button.buttonValue,
      title: this.truncateText(title, WHATSAPP_CONFIG.LIMITS.LIST_TITLE_MAX_LENGTH),
      description: this.truncateText(description, WHATSAPP_CONFIG.LIMITS.LIST_DESCRIPTION_MAX_LENGTH)
    };
    
    console.log('[WhatsappSender] Created row:', row);
    return row;
  }

  // Validates and fixes message text to meet WhatsApp requirements
  private validateMessageText(text: string): string {
    if (!text || typeof text !== 'string') {
      console.warn('[WhatsappSender] Invalid message text detected, using fallback');
      return 'Message content unavailable';
    }

    // Trim whitespace
    const trimmedText = text.trim();
    
    // Check for empty message
    if (trimmedText.length === 0) {
      console.warn('[WhatsappSender] Empty message text detected, using fallback');
      return 'Message content unavailable';
    }

    // Check for length limit
    if (trimmedText.length > WHATSAPP_CONFIG.LIMITS.MESSAGE_BODY_MAX_LENGTH) {
      console.warn(`[WhatsappSender] Message too long (${trimmedText.length} chars), truncating to ${WHATSAPP_CONFIG.LIMITS.MESSAGE_BODY_MAX_LENGTH}`);
      return trimmedText.substring(0, WHATSAPP_CONFIG.LIMITS.MESSAGE_BODY_MAX_LENGTH - 3) + '...';
    }

    return trimmedText;
  }

  // Truncates text to specified length if needed
  private truncateText(text: string, maxLength: number): string {
    // Specific truncation rules for known long service names
    if (text.toLowerCase() === "manicura con uñas postizas") {
        return "Manic. Unas postizas";
    }
    
    return text.length > maxLength ? text.substring(0, maxLength) : text;
  }

  // Creates the appropriate payload based on response content
  private createPayload(recipientId: string, response: BotResponse): WhatsappPayload {
    const buttonCount = response.buttons?.length || 0;
    const messageType = this.getMessageType(buttonCount);
    
    switch (messageType) {
      case 'text':
        return this.createTextPayload(recipientId, response.text!);
      case 'buttons':
        return this.createButtonPayload(recipientId, response.text!, response.buttons);
      case 'list':
        return this.createListPayload(recipientId, response.text!, response);
    }
  }

  // Logs the outgoing message for debugging and monitoring
  private logOutgoingMessage(recipientId: string, messageType: string, itemCount?: number): void {
    const countInfo = itemCount ? ` with ${itemCount} ${messageType === 'buttons' ? 'buttons' : 'options'}` : '';
    console.log(`[WhatsappSender] Sending ${messageType} message${countInfo} to ${recipientId}`);
  }

  // Sends HTTP request to WhatsApp API
  // AHORA NECESITA EL ID DEL NÚMERO DE TELÉFONO
  private async sendToWhatsappApi(payload: WhatsappPayload, businessPhoneNumberId: string): Promise<string | null> {
    const apiUrl = this.getApiUrl(businessPhoneNumberId); // Se lo pasamos
    const headers = getWhatsappHeaders();
    const body = JSON.stringify(payload);

    console.log(`[WhatsappSender] Sending payload to ${apiUrl}:`, body);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorData}`);
    }

    const responseData = await response.json();
    console.log("[WhatsappSender] Message sent successfully. Response:", responseData);
    
    // Extract and return the WhatsApp message ID
    const messageId = responseData.messages?.[0]?.id;
    if (messageId) {
      console.log(`[WhatsappSender] WhatsApp message ID: ${messageId}`);
      return messageId;
    }
    
    return null;
  }

  // Main method: AHORA ACEPTA EL ID DEL NÚMERO DE TELÉFONO DEL NEGOCIO
  async sendMessage(recipientId: string, response: BotResponse, businessPhoneNumberId: string): Promise<string | null> {
    try {
      // Validate prerequisites
      this.validateConfiguration();
      
      if (!response.text) {
        console.warn("[WhatsappSender] No text found in response. Skipping message to:", recipientId);
        return null;
      }

      // Log message length for debugging
      const textLength = response.text.length;
      if (textLength > 800) {
        console.warn(`[WhatsappSender] Long message detected (${textLength} chars) for ${recipientId}. Content preview: "${response.text.substring(0, 100)}..."`);
      }

      // Create and send payload
      const payload = this.createPayload(recipientId, response);
      const messageType = this.getMessageType(response.buttons?.length || 0);
      
      this.logOutgoingMessage(recipientId, messageType, response.buttons?.length);
      // LE PASAMOS EL ID DEL NÚMERO DE TELÉFONO A LA FUNCIÓN DE ENVÍO Y RETORNAMOS EL MESSAGE ID
      const whatsappMessageId = await this.sendToWhatsappApi(payload, businessPhoneNumberId);
      
      return whatsappMessageId;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`[WhatsappSender] Failed to send message to ${recipientId}:`, errorMessage);
      throw error;
    }
  }
}
