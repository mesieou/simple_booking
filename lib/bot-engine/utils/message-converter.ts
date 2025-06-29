import { ParsedMessage } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatMessage } from '@/lib/database/models/chat-session';

/**
 * Separator used between ID and friendly text in interactive messages
 */
const MESSAGE_SEPARATOR = '|';

/**
 * Extracts the technical ID from a formatted message for bot logic processing
 * Handles format: "ID|title" -> "ID"
 * If no separator found, returns the original message
 */
export function extractIdForBotLogic(message: string): string {
  if (!message || !message.includes(MESSAGE_SEPARATOR)) {
    return message;
  }
  
  const [id] = message.split(MESSAGE_SEPARATOR, 1);
  console.log(`[MessageConverter] Extracted ID for bot logic: "${message}" -> "${id}"`);
  return id;
}

/**
 * Extracts the friendly text from a formatted message for display purposes
 * Handles format: "ID|title" -> "title"
 * If no separator found, returns the original message
 */
export function extractFriendlyTextForDisplay(message: string): string {
  if (!message || !message.includes(MESSAGE_SEPARATOR)) {
    // Return original message for legacy messages or non-interactive text
    return message;
  }
  
  const parts = message.split(MESSAGE_SEPARATOR);
  if (parts.length < 2) {
    return message;
  }
  
  // Join everything after the first separator and trim any extra spaces
  const friendlyText = parts.slice(1).join(MESSAGE_SEPARATOR).trim();
  console.log(`[MessageConverter] Extracted friendly text: "${message}" -> "${friendlyText}"`);
  return friendlyText;
}

/**
 * Checks if a message uses the formatted "ID|title" structure
 */
export function isFormattedInteractiveMessage(message: string): boolean {
  return message && message.includes(MESSAGE_SEPARATOR);
}

/**
 * Converts a ParsedMessage to ChatMessage format for database storage
 * No special processing needed since parser now handles the formatting
 */
export function convertParsedMessageToChatMessage(
  parsedMessage: ParsedMessage,
  role: 'user' | 'bot' | 'staff' = 'user'
): ChatMessage {
  const chatMessage: ChatMessage = {
    role,
    content: parsedMessage.text || '',
    timestamp: parsedMessage.timestamp.toISOString()
  };

  // Convert attachments if they exist
  if (parsedMessage.attachments && parsedMessage.attachments.length > 0) {
    chatMessage.attachments = parsedMessage.attachments
      .filter(attachment => ['image', 'video', 'document', 'audio', 'sticker'].includes(attachment.type))
      .map(attachment => ({
        type: attachment.type as 'image' | 'video' | 'document' | 'audio' | 'sticker',
        url: attachment.payload?.storedUrl || attachment.payload?.id || '',
        caption: attachment.caption,
        originalFilename: attachment.payload?.originalFilename,
        mimeType: attachment.payload?.mimeType,
        size: attachment.payload?.size
      }))
      .filter(attachment => attachment.url); // Only include attachments with valid URLs
  }

  return chatMessage;
}

/** 
 * Extracts media URLs from attachments for display purposes
 */
export function extractMediaUrls(message: ChatMessage): Array<{
  type: string;
  url: string;
  caption?: string;
}> {
  if (!message.attachments) return [];
  
  return message.attachments.map(attachment => ({
    type: attachment.type,
    url: attachment.url,
    caption: attachment.caption
  }));
}

/**
 * Processes chat messages for display in admin dashboard
 * Converts technical IDs to friendly text while preserving all other content
 */
export function processMessageForDisplay(message: ChatMessage): ChatMessage {
  return {
    ...message,
    content: extractFriendlyTextForDisplay(message.content)
  };
}

/**
 * Processes multiple chat messages for display
 */
export function processMessagesForDisplay(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(processMessageForDisplay);
} 