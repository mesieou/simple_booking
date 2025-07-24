/**
 * Chat-related types that can be safely used in client components
 */

export interface BotResponseMessage {
  text?: string;
  buttons?: Array<{ 
    buttonText: string;
    buttonValue: string;
    buttonDescription?: string;
  }>;
  listActionText?: string;
  listSectionTitle?: string;
}

export type ChatMessage = {
  id: string;
  role: 'user' | 'bot' | 'staff';
  senderRole: 'customer' | 'bot' | 'staff';
  content: string | BotResponseMessage;
  timestamp?: string;
  createdAt: string;
  displayType?: 'text' | 'interactive';
  attachments?: Array<{
    type: 'image' | 'video' | 'document' | 'audio' | 'sticker';
    url: string;
    caption?: string;
    originalFilename?: string;
    mimeType?: string;
    size?: number;
  }>;
};

export interface Conversation {
  channelUserId: string;
  updatedAt: string;
  hasEscalation: boolean;
  escalationStatus: string | null;
  sessionId: string;
  businessId?: string; // Optional for superadmin
  businessName?: string; // Optional for superadmin
} 