import { WebhookAPIBody, Message } from "./whatsapp-message-logger"; // Ensure these are correctly exported
import { ParsedMessage } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";

/**
 * Represents a concise, parsed status update from a WhatsApp webhook.
 */
export interface ParsedStatusUpdate {
  type: 'status_update';
  messageId: string;
  status: string;
  timestamp: Date;
  recipientId: string;
  conversationId?: string;
}

/**
 * Defines handlers for different types of parsed WhatsApp payloads.
 * This allows the route handler to delegate logic cleanly.
 * @template T The return type of the handler functions.
 */
export interface WhatsappPayloadHandlers<T> {
  onMessage: (message: ParsedMessage) => Promise<T> | T;
  onStatusUpdate: (statusUpdate: ParsedStatusUpdate) => Promise<T> | T;
}

/**
 * Parses and processes a raw WhatsApp webhook payload, routing to the appropriate handler.
 * This is the primary entry point for handling incoming webhook data.
 * @template T The return type of the handler functions.
 * @param payload The raw WebhookAPIBody from WhatsApp.
 * @param handlers An object containing handler functions for messages and status updates.
 * @returns A promise that resolves with the return value of the executed handler, or null if not actionable.
 */
export async function processWhatsappPayload<T>(
  payload: WebhookAPIBody,
  handlers: WhatsappPayloadHandlers<T>
): Promise<T | null> {
  const parseResult = parseWhatsappMessage(payload);

  if (!parseResult) {
    return null; // Payload was not actionable.
  }

  // Handle Status Updates
  if ('type' in parseResult && parseResult.type === 'status_update') {
    return await handlers.onStatusUpdate(parseResult);
  }
  
  // Handle Incoming Messages
  return await handlers.onMessage(parseResult as ParsedMessage);
}

/**
 * (Internal) Parses an incoming WhatsApp webhook payload into a standardized format.
 * Called by `processWhatsappPayload`.
 * @param payload The raw WebhookAPIBody from WhatsApp.
 * @returns A ParsedMessage for user messages, a ParsedStatusUpdate for status changes, or null.
 */
export function parseWhatsappMessage(payload: WebhookAPIBody): ParsedMessage | ParsedStatusUpdate | null {
  if (payload.object !== "whatsapp_business_account") {
    return null;
  }

  const value = payload.entry?.[0]?.changes?.[0]?.value;
  if (!value || payload.entry?.[0]?.changes?.[0]?.field !== "messages") {
    return null;
  }

  const waStatus = value.statuses?.[0];
  if (waStatus) {
    return {
      type: 'status_update',
      messageId: waStatus.id,
      status: waStatus.status,
      timestamp: new Date(parseInt(waStatus.timestamp) * 1000),
      recipientId: waStatus.recipient_id,
      conversationId: waStatus.conversation?.id,
    };
  }

  const waMessage: Message | undefined = value.messages?.[0];
  if (waMessage) {
    if (!value.metadata || !waMessage.from) {
      console.warn("[WhatsappParser] Essential data missing for incoming message.");
      return null;
    }

    const baseParsedMessage: Omit<ParsedMessage, 'text' | 'attachments'> = {
      channelType: 'whatsapp',
      messageId: waMessage.id,
      senderId: waMessage.from,
      userName: value.contacts?.[0]?.profile?.name,
      recipientId: value.metadata.phone_number_id,
      timestamp: new Date(parseInt(waMessage.timestamp) * 1000),
      originalPayload: payload,
    };

    let textContent: string | undefined;
    const attachments: ParsedMessage['attachments'] = [];

    switch (waMessage.type) {
      case 'text':
        textContent = waMessage.text?.body;
        break;
      case 'button':
        // Button template clicks are received as text messages
        textContent = waMessage.text?.body;
        break;
      case 'interactive':
        const interactive = waMessage.interactive;
        if (interactive?.button_reply) {
          attachments.push({ type: 'interactive_reply', payload: interactive.button_reply });
          textContent = interactive.button_reply.title;
        } else if (interactive?.list_reply) {
          attachments.push({ type: 'interactive_reply', payload: interactive.list_reply });
          textContent = interactive.list_reply.title;
        } else if (interactive?.nfm_reply) {
          attachments.push({ type: 'interactive_reply', payload: interactive.nfm_reply });
          textContent = interactive.nfm_reply.body;
        }
        break;
      case 'image':
        attachments.push({ type: 'image', payload: waMessage.image });
        textContent = waMessage.image?.caption;
        break;
      case 'video':
        attachments.push({ type: 'video', payload: waMessage.video });
        textContent = waMessage.video?.caption;
        break;
      case 'document':
        attachments.push({ type: 'document', payload: waMessage.document });
        textContent = waMessage.document?.caption;
        break;
      case 'audio':
        attachments.push({ type: 'audio', payload: waMessage.audio });
        break;
      case 'sticker':
        attachments.push({ type: 'sticker', payload: waMessage.sticker });
        break;
      case 'location':
        attachments.push({ type: 'location', payload: waMessage.location });
        break;
      case 'contacts':
        attachments.push({ type: 'contact', payload: waMessage.contacts });
        break;
      default:
        attachments.push({ type: 'unsupported', payload: waMessage });
        break;
    }

    if (!textContent && (!attachments || attachments.length === 0)) {
      return null;
    }

    return {
      ...baseParsedMessage,
      text: textContent,
      attachments: attachments.length > 0 ? attachments : undefined,
    };
  }

  return null;
} 