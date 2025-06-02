import { BotResponse, IMessageSender } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";

// It's crucial to manage these securely, typically via environment variables.
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v22.0"; // Or your specific version
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID; // Your WhatsApp Business Phone Number ID
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN; // Your WhatsApp Business Access Token

interface WhatsappTextPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: {
    preview_url?: boolean;
    body: string;
  };
}

// TODO: Define interfaces for other WhatsApp message types (image, template, interactive) as needed.

export class WhatsappSender implements IMessageSender {
  private constructApiUrl(): string | null {
    if (!PHONE_NUMBER_ID) {
      console.error("[WhatsappSender] Error: WHATSAPP_PHONE_NUMBER_ID environment variable is not set.");
      return null;
    }
    return `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  }

  /**
   * Sends a message response via the WhatsApp Cloud API.
   * Currently supports text messages only.
   * @param recipientId The WhatsApp ID of the user to send the message to (e.g., their phone number).
   * @param response The standardized BotResponse object containing the message to send.
   */
  async sendMessage(recipientId: string, response: BotResponse): Promise<void> {
    const apiUrl = this.constructApiUrl();
    if (!apiUrl) {
      // Error already logged by constructApiUrl
      return Promise.reject("WhatsApp sender not properly configured (PHONE_NUMBER_ID missing).");
    }

    if (!WHATSAPP_VERIFY_TOKEN) {
      console.error("[WhatsappSender] Error: WHATSAPP_VERIFY_TOKEN environment variable is not set.");
      return Promise.reject("WhatsApp sender not properly configured (ACCESS_TOKEN missing).");
    }

    if (!response.text) {
      console.warn("[WhatsappSender] No text found in BotResponse. Skipping sending message to:", recipientId);
      return Promise.resolve(); // Or reject, depending on desired behavior for empty messages
    }

    const payload: WhatsappTextPayload = {
      messaging_product: "whatsapp",
      to: recipientId,
      type: "text",
      text: {
        body: response.text,
      },
    };

    console.log(`[WhatsappSender] Attempting to send to ${recipientId}: "${response.text}"`);
    // console.log("[WhatsappSender] Payload:", JSON.stringify(payload, null, 2)); // For debugging

    try {
      const apiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_VERIFY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (apiResponse.ok) {
        const responseData = await apiResponse.json();
        console.log("[WhatsappSender] Message sent successfully to", recipientId, "Response Data:", responseData);
      } else {
        const errorData = await apiResponse.text(); // Use .text() for non-JSON error bodies too
        console.error(
          `[WhatsappSender] Error sending message to ${recipientId}. Status: ${apiResponse.status} ${apiResponse.statusText}. Body:`, 
          errorData
        );
        // Depending on the error, you might want to throw or handle it more specifically
        throw new Error(`WhatsApp API error: ${apiResponse.status} - ${errorData}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during fetch";
      console.error("[WhatsappSender] Failed to send WhatsApp message to", recipientId, ":", errorMessage);
      // Rethrow or handle as appropriate for your application's error handling strategy
      throw error;
    }
  }
}
