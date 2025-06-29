import { ParsedMessage } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatMessage } from '@/lib/database/models/chat-session';

/**
 * Converts a ParsedMessage with attachments to ChatMessage format for database storage
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