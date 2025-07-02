import { type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { IntelligentLLMService } from "@/lib/bot-engine/services/llm-service";
import { WhatsappSender } from "./whatsapp-message-sender";

const LOG_PREFIX = "[Response Processor]";

/**
 * Handles bot response translation
 */
export class ResponseTranslator {
  /**
   * Translates a bot response to the target language
   */
  static async translateBotResponse(response: BotResponse, targetLanguage: string): Promise<BotResponse> {
    const llmService = new IntelligentLLMService();
    const textsToTranslate: string[] = [];

    if (response.text) {
      textsToTranslate.push(response.text);
    }
    if (response.listActionText) {
      textsToTranslate.push(response.listActionText);
    }
    if (response.listSectionTitle) {
      textsToTranslate.push(response.listSectionTitle);
    }
    response.buttons?.forEach(btn => {
      if (btn.buttonText) {
        textsToTranslate.push(btn.buttonText);
      }
      if (btn.buttonDescription) {
        textsToTranslate.push(btn.buttonDescription);
      }
    });

    if (textsToTranslate.length === 0) {
      return response;
    }

    try {
      const translatedTexts = await llmService.translate(textsToTranslate, targetLanguage) as string[];
      
      const mutableTranslatedTexts = [...translatedTexts];

      let translatedText = response.text;
      if (response.text) {
        translatedText = mutableTranslatedTexts.shift() || response.text;
      }

      let translatedListActionText = response.listActionText;
      if (response.listActionText) {
        translatedListActionText = mutableTranslatedTexts.shift() || response.listActionText;
      }

      let translatedListSectionTitle = response.listSectionTitle;
      if (response.listSectionTitle) {
        translatedListSectionTitle = mutableTranslatedTexts.shift() || response.listSectionTitle;
      }

      const translatedButtons = response.buttons?.map(btn => {
        const newBtn = { ...btn };
        if (newBtn.buttonText) {
          newBtn.buttonText = mutableTranslatedTexts.shift() || newBtn.buttonText;
        }
        if (newBtn.buttonDescription) {
          newBtn.buttonDescription = mutableTranslatedTexts.shift() || newBtn.buttonDescription;
        }
        return newBtn;
      });

      return { 
        text: translatedText, 
        buttons: translatedButtons,
        listActionText: translatedListActionText,
        listSectionTitle: translatedListSectionTitle
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Error translating bot response:`, error);
      return response; // Return original on error
    }
  }
}

/**
 * Handles bot response sending via WhatsApp
 */
export class ResponseSender {
  /**
   * Sends a bot response via WhatsApp
   */
  static async sendResponse(
    botResponse: BotResponse,
    recipientId: string,
    senderId: string,
    businessPhoneNumberId?: string
  ): Promise<boolean> {
    if (!botResponse || !botResponse.text || !botResponse.text.trim()) {
      if (botResponse && !botResponse.text?.trim()) {
        console.log(`${LOG_PREFIX} Bot response is empty - not sending message to ${senderId}`);
      } else {
        console.log(`${LOG_PREFIX} No bot response to send for ${senderId}`);
      }
      return false;
    }

    try {
      if (!businessPhoneNumberId) {
        console.error(`${LOG_PREFIX} businessPhoneNumberId is required but not provided for ${senderId}`);
        return false;
      }

      console.log(`${LOG_PREFIX} Attempting to send reply to ${senderId}: "${botResponse.text}"`);
      const sender = new WhatsappSender();
      await sender.sendMessage(recipientId, botResponse, businessPhoneNumberId);
      console.log(`${LOG_PREFIX} Reply successfully sent via WhatsappSender to ${senderId}`);
      return true;
    } catch (sendError) {
      console.error(`${LOG_PREFIX} Error sending reply via WhatsappSender to ${senderId}:`, sendError);
      return false;
    }
  }
}

/**
 * Main response processing pipeline
 */
export class ResponseProcessor {
  /**
   * Processes and sends a bot response (translation + sending)
   */
  static async processAndSend(
    botResponse: BotResponse | null,
    recipientId: string,
    senderId: string,
    targetLanguage?: string,
    businessPhoneNumberId?: string
  ): Promise<boolean> {
    if (!botResponse) {
      console.log(`${LOG_PREFIX} No response to process for ${senderId}`);
      return false;
    }

    let processedResponse = botResponse;

    // Translate if target language is specified and different from default
    if (targetLanguage && targetLanguage !== 'en') {
      try {
        processedResponse = await ResponseTranslator.translateBotResponse(botResponse, targetLanguage);
        console.log(`${LOG_PREFIX} Response translated to ${targetLanguage}`);
      } catch (error) {
        console.error(`${LOG_PREFIX} Translation failed, using original response:`, error);
        processedResponse = botResponse;
      }
    }

    // Send the response
    return await ResponseSender.sendResponse(
      processedResponse,
      recipientId,
      senderId,
      businessPhoneNumberId
    );
  }
} 