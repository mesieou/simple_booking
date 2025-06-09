import { BotResponse, IMessageSender } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";

// Configuration constants - easily customizable without touching core logic
const WHATSAPP_CONFIG = {
  API_VERSION: process.env.WHATSAPP_API_VERSION || "v22.0",
  PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  ACCESS_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
  
  // WhatsApp API limits
  LIMITS: {
    MAX_BUTTONS: 3,
    MAX_LIST_ITEMS: 10,
    BUTTON_TITLE_MAX_LENGTH: 20,
    LIST_TITLE_MAX_LENGTH: 24,
    LIST_DESCRIPTION_MAX_LENGTH: 72
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
  
  // Constructs the WhatsApp API endpoint URL
  private getApiUrl(): string {
    if (!WHATSAPP_CONFIG.PHONE_NUMBER_ID) {
      throw new Error("WHATSAPP_PHONE_NUMBER_ID environment variable is required");
    }
    return `https://graph.facebook.com/${WHATSAPP_CONFIG.API_VERSION}/${WHATSAPP_CONFIG.PHONE_NUMBER_ID}/messages`;
  }

  // Validates required environment variables are present
  private validateConfiguration(): void {
    if (!WHATSAPP_CONFIG.ACCESS_TOKEN) {
      throw new Error("WHATSAPP_VERIFY_TOKEN environment variable is required");
    }
  }

  // Determines the optimal message type based on button count
  private getMessageType(buttonCount: number): 'text' | 'buttons' | 'list' {
    if (buttonCount === 0) return 'text';
    if (buttonCount <= WHATSAPP_CONFIG.LIMITS.MAX_BUTTONS) return 'buttons';
    return 'list';
  }

  // Creates a simple text message payload
  private createTextPayload(recipientId: string, text: string): WhatsappTextPayload {
    return {
      messaging_product: "whatsapp",
      to: recipientId,
      type: "text",
      text: { body: text }
    };
  }

  // Creates an interactive button message payload
  private createButtonPayload(recipientId: string, text: string, buttons: BotResponse['buttons']): WhatsappButtonPayload {
    const limitedButtons = buttons!.slice(0, WHATSAPP_CONFIG.LIMITS.MAX_BUTTONS);
    
    return {
      messaging_product: "whatsapp",
      to: recipientId,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text },
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
  private createListPayload(recipientId: string, text: string, buttons: BotResponse['buttons']): WhatsappListPayload {
    const limitedButtons = buttons!.slice(0, WHATSAPP_CONFIG.LIMITS.MAX_LIST_ITEMS);
    
    return {
      messaging_product: "whatsapp",
      to: recipientId,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text },
        action: {
          button: "Select Option",
          sections: [{
            title: "Available Options",
            rows: limitedButtons.map((btn) => this.createListRow(btn))
          }]
        }
      }
    };
  }

  // Creates a list row with optimized title and description
  private createListRow(button: NonNullable<BotResponse['buttons']>[0]) {
    const parts = button.buttonText.split(' - ');
    const serviceName = parts[0];
    const priceAndDuration = parts.slice(1).join(' - ');
    
    return {
      id: button.buttonValue,
      title: this.truncateText(serviceName, WHATSAPP_CONFIG.LIMITS.LIST_TITLE_MAX_LENGTH),
      description: priceAndDuration || `Select ${serviceName}`
    };
  }

  // Truncates text to specified length if needed
  private truncateText(text: string, maxLength: number): string {
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
        return this.createListPayload(recipientId, response.text!, response.buttons);
    }
  }

  // Logs the outgoing message for debugging and monitoring
  private logOutgoingMessage(recipientId: string, messageType: string, itemCount?: number): void {
    const countInfo = itemCount ? ` with ${itemCount} ${messageType === 'buttons' ? 'buttons' : 'options'}` : '';
    console.log(`[WhatsappSender] Sending ${messageType} message${countInfo} to ${recipientId}`);
  }

  // Sends HTTP request to WhatsApp API
  private async sendToWhatsappApi(payload: WhatsappPayload): Promise<void> {
    const response = await fetch(this.getApiUrl(), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_CONFIG.ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorData}`);
    }

    const responseData = await response.json();
    console.log("[WhatsappSender] Message sent successfully. Response:", responseData);
  }

  // Main method: sends message response via WhatsApp Cloud API
  async sendMessage(recipientId: string, response: BotResponse): Promise<void> {
    try {
      // Validate prerequisites
      this.validateConfiguration();
      
      if (!response.text) {
        console.warn("[WhatsappSender] No text found in response. Skipping message to:", recipientId);
        return;
      }

      // Create and send payload
      const payload = this.createPayload(recipientId, response);
      const messageType = this.getMessageType(response.buttons?.length || 0);
      
      this.logOutgoingMessage(recipientId, messageType, response.buttons?.length);
      await this.sendToWhatsappApi(payload);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`[WhatsappSender] Failed to send message to ${recipientId}:`, errorMessage);
      throw error;
    }
  }
}
