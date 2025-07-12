import { WebhookAPIBody, Message } from "./whatsapp-message-logger"; // Ensure these are correctly exported
import { ParsedMessage } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { downloadAndStoreWhatsappMedia } from "../../utils/media-storage";

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
  const parseResult = await parseWhatsappMessage(payload);

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
export async function parseWhatsappMessage(payload: WebhookAPIBody): Promise<ParsedMessage | ParsedStatusUpdate | null> {
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

    const waMetadata = value.metadata;
    const contactProfile = value.contacts?.[0]?.profile;

    const baseParsedMessage = {
      channelType: 'whatsapp' as const,
      messageId: waMessage.id,
      senderId: waMessage.from,
      userName: contactProfile?.name,
      recipientId: waMetadata.phone_number_id,
      businessWhatsappNumber: waMetadata.display_phone_number, // Business WhatsApp number customers message TO
      customerWhatsappNumber: waMessage.from, // Customer's WhatsApp number who is messaging FROM
      timestamp: new Date(parseInt(waMessage.timestamp) * 1000),
      originalPayload: payload,
    };

    let textContent: string | undefined;
    const attachments: ParsedMessage['attachments'] = [];

    // We'll need these for media storage
    const businessId = extractBusinessIdFromPayload(payload);
    const sessionId = `temp_${waMessage.from}_${Date.now()}`; // Temporary session ID for storage

    switch (waMessage.type) {
      case 'text':
        textContent = waMessage.text?.body;
        console.log(`==============================================`);
        console.log("[WhatsappParser] Parsed text message:", textContent);
        break;
      case 'image':
        if (waMessage.image?.id) {
          // Download and store the image
          const storedImage = await downloadAndStoreWhatsappMedia(
            waMessage.image.id,
            'image',
            businessId,
            sessionId
          );
          
          if (storedImage) {
            attachments.push({ 
              type: 'image', 
              payload: { 
                ...waMessage.image, 
                storedUrl: storedImage.url,
                originalUrl: waMessage.image.id // Keep reference to original
              }, 
              caption: waMessage.image?.caption 
            });
          } else {
            // Fallback to placeholder if storage fails
            attachments.push({ type: 'image', payload: waMessage.image, caption: waMessage.image?.caption });
          }
        }
        textContent = waMessage.image?.caption; // Also treat caption as text if present
        console.log(`==============================================`);
        console.log("[WhatsappParser] Parsed image message. Caption:", textContent);
        break;
      case 'audio':
        if (waMessage.audio?.id) {
          const storedAudio = await downloadAndStoreWhatsappMedia(
            waMessage.audio.id,
            'audio',
            businessId,
            sessionId
          );
          
          if (storedAudio) {
            attachments.push({ 
              type: 'audio', 
              payload: { 
                ...waMessage.audio, 
                storedUrl: storedAudio.url 
              } 
            });
          } else {
            attachments.push({ type: 'audio', payload: waMessage.audio });
          }
        }
        console.log(`==============================================`);
        console.log("[WhatsappParser] Parsed audio message.");
        break;
      case 'video':
        if (waMessage.video?.id) {
          const storedVideo = await downloadAndStoreWhatsappMedia(
            waMessage.video.id,
            'video',
            businessId,
            sessionId
          );
          
          if (storedVideo) {
            attachments.push({ 
              type: 'video', 
              payload: { 
                ...waMessage.video, 
                storedUrl: storedVideo.url 
              }, 
              caption: waMessage.video?.caption 
            });
          } else {
            attachments.push({ type: 'video', payload: waMessage.video, caption: waMessage.video?.caption });
          }
        }
        textContent = waMessage.video?.caption;
        console.log(`==============================================`);
        console.log("[WhatsappParser] Parsed video message. Caption:", textContent);
        break;
      case 'document':
        if (waMessage.document?.id) {
          const storedDocument = await downloadAndStoreWhatsappMedia(
            waMessage.document.id,
            'document',
            businessId,
            sessionId
          );
          
          if (storedDocument) {
            attachments.push({ 
              type: 'document', 
              payload: { 
                ...waMessage.document, 
                storedUrl: storedDocument.url 
              }, 
              caption: waMessage.document?.caption 
            });
          } else {
            attachments.push({ type: 'document', payload: waMessage.document, caption: waMessage.document?.caption });
          }
        }
        textContent = waMessage.document?.caption;
        console.log(`==============================================`);
        console.log("[WhatsappParser] Parsed document message. Caption:", textContent);
        break;
      case 'sticker':
        if (waMessage.sticker?.id) {
          const storedSticker = await downloadAndStoreWhatsappMedia(
            waMessage.sticker.id,
            'sticker',
            businessId,
            sessionId
          );
          
          if (storedSticker) {
            attachments.push({ 
              type: 'sticker', 
              payload: { 
                ...waMessage.sticker, 
                storedUrl: storedSticker.url 
              } 
            });
          } else {
            attachments.push({ type: 'sticker', payload: waMessage.sticker });
          }
        }
        console.log(`==============================================`);
        console.log("[WhatsappParser] Parsed sticker message.");
        break;
      case 'location':
        attachments.push({ type: 'location', payload: waMessage.location });
        console.log(`==============================================`);
        console.log("[WhatsappParser] Parsed location message.");
        // Potentially construct a text representation from location if needed by core logic
        // textContent = `Location: ${waMessage.location?.latitude}, ${waMessage.location?.longitude}`;
        break;
      case 'contacts':
        attachments.push({ type: 'contact', payload: waMessage.contacts });
        console.log(`==============================================`);
        console.log("[WhatsappParser] Parsed contacts message.");
        break;
      case 'interactive':
        if (waMessage.interactive) {
          const interactiveType = waMessage.interactive.type;
          console.log(`==============================================`);
          console.log(`[WhatsappParser] Processing interactive type: ${interactiveType}`);
          
          // Handle button replies (≤3 options)
          if (interactiveType === 'button_reply' && waMessage.interactive.button_reply) {
            attachments.push({ type: 'interactive_reply', payload: waMessage.interactive.button_reply });
            textContent = waMessage.interactive.button_reply.id;
            console.log("[WhatsappParser] Parsed interactive button_reply. ID:", textContent, "Title:", waMessage.interactive.button_reply.title);
          }
          // Handle list replies (>3 options)  
          else if (interactiveType === 'list_reply' && waMessage.interactive.list_reply) {
            attachments.push({ type: 'interactive_reply', payload: waMessage.interactive.list_reply });
            textContent = waMessage.interactive.list_reply.id;
            console.log("[WhatsappParser] Parsed interactive list_reply. ID:", textContent, "Title:", waMessage.interactive.list_reply.title);
          }
          // Handle NFM (Native Flow Message) replies
          else if (interactiveType === 'nfm_reply' && waMessage.interactive.nfm_reply) {
            attachments.push({ type: 'interactive_reply', payload: waMessage.interactive.nfm_reply, caption: waMessage.interactive.nfm_reply.name });
            textContent = waMessage.interactive.nfm_reply.body;
            console.log("[WhatsappParser] Parsed interactive nfm_reply. Body:", textContent);
          }
          // Generic handler for any other interactive types
          else {
            // Try to find any interactive reply data
            const replyData = waMessage.interactive[`${interactiveType}`];
            if (replyData && typeof replyData === 'object') {
              attachments.push({ type: 'interactive_reply', payload: replyData });
              // Try to extract ID or value from common properties
              textContent = replyData.id || replyData.value || replyData.body || replyData.title;
              console.log(`[WhatsappParser] Parsed generic interactive ${interactiveType}. Extracted content:`, textContent);
            } else {
              console.warn("[WhatsappParser] Interactive message type received but couldn't extract data:", interactiveType);
              attachments.push({ type: 'interactive_reply', payload: waMessage.interactive });
            }
          }
        } else {
          console.warn("[WhatsappParser] Interactive message type received, but 'interactive' object is missing.");
        }
        break;
      case 'button': // This is for when a user clicks a button from a Buttons Message Template
          // Extract text from button payload, not from waMessage.text?.body
          textContent = waMessage.button?.text || waMessage.button?.payload;
          console.log("[WhatsappParser] Parsed button click message. Text:", textContent);
          
          // Add button data to attachments for reference
          if (waMessage.button) {
            attachments.push({ type: 'interactive_reply', payload: waMessage.button });
          }
          break;
      default:
        attachments.push({ type: 'unsupported', payload: waMessage });
        break;
    }

    if (!textContent && (!attachments || attachments.length === 0)) {
      return null;
    }

    // For media messages, always include placeholder regardless of caption
    // BUT exclude interactive_reply - those should be processed as pure text
    if (attachments && attachments.length > 0) {
      const mediaType = attachments[0].type;
      
      // Only add placeholder for actual media types, not interactive replies
      if (mediaType !== 'interactive_reply') {
        const placeholder = `[${mediaType.toUpperCase()}]`;
        
        if (textContent && textContent.trim()) {
          // Combine placeholder with caption for escalation detection
          textContent = `${placeholder} ${textContent}`;
          console.log(`[WhatsappParser] Media message with caption detected. Combined: ${textContent}`);
        } else {
          // Just placeholder if no caption
          textContent = placeholder;
          console.log(`[WhatsappParser] Media message without caption detected. Using placeholder: ${textContent}`);
        }
      }
    }

    return {
      ...baseParsedMessage,
      text: textContent,
      attachments: attachments.length > 0 ? attachments : undefined,
    };
  }

  return null;
}

/**
 * Helper function to extract business ID from WhatsApp payload
 * For now, we'll use a placeholder - this should be mapped to actual business logic
 */
function extractBusinessIdFromPayload(payload: WebhookAPIBody): string {
  // TODO: Map phone number ID to business ID using your business logic
  const phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  return `business_${phoneNumberId || 'unknown'}`;
} 