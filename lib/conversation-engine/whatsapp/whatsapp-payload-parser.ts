import { WebhookAPIBody, Message } from "./whatsapp-message-logger"; // Ensure these are correctly exported
import { ParsedMessage } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";

/**
 * Parses an incoming WhatsApp webhook payload and transforms it into a standardized ParsedMessage format.
 * 
 * @param payload The raw WebhookAPIBody from WhatsApp.
 * @returns A ParsedMessage object if a valid user message is found, otherwise null.
 */
export function parseWhatsappMessage(payload: WebhookAPIBody): ParsedMessage | null {
  console.log("[WhatsappParser] Received payload for parsing:", JSON.stringify(payload, null, 2)); // Log raw payload

  if (payload.object !== "whatsapp_business_account") {
    console.warn("[WhatsappParser] Received non-WhatsApp payload object:", payload.object);
    return null;
  }

  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  if (!value || !change || change.field !== "messages") {
    console.warn("[WhatsappParser] Payload value missing or not a message field. Value:", JSON.stringify(value, null, 2), "Change field:", change?.field);
    return null;
  }

  const waMessage: Message | undefined = value.messages?.[0];
  const contactProfile = value.contacts?.[0]?.profile;
  const waMetadata = value.metadata;

  if (!waMessage || !waMetadata || !waMessage.from) {
    console.warn("[WhatsappParser] Essential message data missing. Message:", JSON.stringify(waMessage, null, 2), "Metadata:", JSON.stringify(waMetadata, null, 2), "From:", waMessage?.from);
    return null;
  }

  console.log(`[WhatsappParser] Processing message type: ${waMessage.type} from ${waMessage.from}`);

  const baseParsedMessage: Omit<ParsedMessage, 'text' | 'attachments'> = {
    channelType: 'whatsapp',
    messageId: waMessage.id,
    senderId: waMessage.from,
    userName: contactProfile?.name,
    recipientId: waMetadata.phone_number_id,
    businessWhatsappNumber: waMetadata.display_phone_number, // Business WhatsApp number customers message TO
    timestamp: new Date(parseInt(waMessage.timestamp) * 1000),
    originalPayload: payload,
  };

  let textContent: string | undefined = undefined;
  let attachments: ParsedMessage['attachments'] = undefined;

  switch (waMessage.type) {
    case 'text':
      textContent = waMessage.text?.body;
      console.log("[WhatsappParser] Parsed text message:", textContent);
      break;
    case 'image':
      attachments = [{ type: 'image', payload: waMessage.image, caption: waMessage.image?.caption }];
      textContent = waMessage.image?.caption; // Also treat caption as text if present
      console.log("[WhatsappParser] Parsed image message. Caption:", textContent);
      break;
    case 'audio':
      attachments = [{ type: 'audio', payload: waMessage.audio }];
      console.log("[WhatsappParser] Parsed audio message.");
      break;
    case 'video':
      attachments = [{ type: 'video', payload: waMessage.video, caption: waMessage.video?.caption }];
      textContent = waMessage.video?.caption;
      console.log("[WhatsappParser] Parsed video message. Caption:", textContent);
      break;
    case 'document':
      attachments = [{ type: 'document', payload: waMessage.document, caption: waMessage.document?.caption }];
      textContent = waMessage.document?.caption;
      console.log("[WhatsappParser] Parsed document message. Caption:", textContent);
      break;
    case 'sticker':
      attachments = [{ type: 'sticker', payload: waMessage.sticker }];
      console.log("[WhatsappParser] Parsed sticker message.");
      break;
    case 'location':
      attachments = [{ type: 'location', payload: waMessage.location }];
      console.log("[WhatsappParser] Parsed location message.");
      // Potentially construct a text representation from location if needed by core logic
      // textContent = `Location: ${waMessage.location?.latitude}, ${waMessage.location?.longitude}`;
      break;
    case 'contacts':
      attachments = [{ type: 'contact', payload: waMessage.contacts }];
      console.log("[WhatsappParser] Parsed contacts message.");
      break;
    case 'interactive':
      if (waMessage.interactive) {
        const interactiveType = waMessage.interactive.type;
        console.log(`[WhatsappParser] Processing interactive type: ${interactiveType}`);
        
        // Handle button replies (≤3 options)
        if (interactiveType === 'button_reply' && waMessage.interactive.button_reply) {
          attachments = [{ type: 'interactive_reply', payload: waMessage.interactive.button_reply }];
          textContent = waMessage.interactive.button_reply.id;
          console.log("[WhatsappParser] Parsed interactive button_reply. ID:", textContent, "Title:", waMessage.interactive.button_reply.title);
        }
        // Handle list replies (>3 options)  
        else if (interactiveType === 'list_reply' && waMessage.interactive.list_reply) {
          attachments = [{ type: 'interactive_reply', payload: waMessage.interactive.list_reply }];
          textContent = waMessage.interactive.list_reply.id;
          console.log("[WhatsappParser] Parsed interactive list_reply. ID:", textContent, "Title:", waMessage.interactive.list_reply.title);
        }
        // Handle NFM (Native Flow Message) replies
        else if (interactiveType === 'nfm_reply' && waMessage.interactive.nfm_reply) {
          attachments = [{ type: 'interactive_reply', payload: waMessage.interactive.nfm_reply, caption: waMessage.interactive.nfm_reply.name }];
          textContent = waMessage.interactive.nfm_reply.body;
          console.log("[WhatsappParser] Parsed interactive nfm_reply. Body:", textContent);
        }
        // Generic handler for any other interactive types
        else {
          // Try to find any interactive reply data
          const replyData = waMessage.interactive[`${interactiveType}`];
          if (replyData && typeof replyData === 'object') {
            attachments = [{ type: 'interactive_reply', payload: replyData }];
            // Try to extract ID or value from common properties
            textContent = replyData.id || replyData.value || replyData.body || replyData.title;
            console.log(`[WhatsappParser] Parsed generic interactive ${interactiveType}. Extracted content:`, textContent);
          } else {
            console.warn("[WhatsappParser] Interactive message type received but couldn't extract data:", interactiveType);
            attachments = [{ type: 'interactive_reply', payload: waMessage.interactive }];
          }
        }
      } else {
        console.warn("[WhatsappParser] Interactive message type received, but 'interactive' object is missing.");
      }
      break;
    case 'button': // This is for when a user clicks a button from a Buttons Message Template
        textContent = waMessage.text?.body; // The button click often sends back the button's text as a message
        console.log("[WhatsappParser] Parsed button click message. Text:", textContent);
        // Or, if there's specific button payload: attachments = [{ type: 'button_reply', payload: waMessage.button }] 
        break;
    default:
      console.log(`[WhatsappParser] Received unhandled message type: ${waMessage.type} from ${waMessage.from}.`);
      attachments = [{ type: 'unsupported', payload: waMessage }];
      break;
  }

  if (!textContent && !attachments) {
    // If after processing, there's no text and no recognized attachments, probably not a user message to act on.
    // This can happen for 'system' messages or other types not explicitly handled above.
    console.log(`[WhatsappParser] Message type ${waMessage.type} resulted in no actionable content. Returning null.`);
    return null;
  }

  const parsedMessageResult: ParsedMessage = {
    ...baseParsedMessage,
    text: textContent,
    ...(attachments && { attachments }), // Add attachments array only if it has items
  };

  console.log("[WhatsappParser] Successfully parsed message. Result:", JSON.stringify(parsedMessageResult, null, 2));
  return parsedMessageResult;
} 