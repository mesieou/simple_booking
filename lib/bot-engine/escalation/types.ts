import { BotResponse } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatContext, ConversationalParticipant } from '@/lib/bot-engine/types';
import { UserContext } from '@/lib/database/models/user-context';
import { ChatMessage } from '@/lib/database/models/chat-session';

/**
 * Gets the appropriate template name based on environment
 */
export function getEscalationTemplateName(): string {
  // Always use the new template name
  return 'escalation';
}

// Core escalation types
export interface EscalationTrigger {
  shouldEscalate: boolean;
  reason?: 'human_request' | 'frustration' | 'media_redirect';
  customMessage?: string;
}

export interface EscalationResult {
  isEscalated: boolean;
  response?: BotResponse;
  reason?: string;
}

// Proxy session types
export interface ProxySession {
  notificationId: string;
  sessionId: string;
  adminPhone: string;
  customerPhone: string;
  businessPhoneNumberId: string;
  isActive: boolean;
  startedAt?: string;
  templateMessageId?: string;
}

export interface ProxySessionData {
  adminPhone: string;
  customerPhone: string;
  templateMessageId: string;
  startedAt: string;
  endedAt?: string;
}

// Proxy message routing types
export interface ProxyMessageResult {
  wasHandled: boolean;
  messageForwarded: boolean;
  proxyEnded: boolean;
  error?: string;
  response?: BotResponse;
}

// Template service types
export interface EscalationTemplateParams {
  customerName: string;
  conversationHistory: string;
  currentMessage: string;
}

export interface MediaAttachmentInfo {
  type: string;
  url: string;
  caption?: string;
  originalFilename?: string;
}

// Template configuration
export interface TemplateConfig {
  TEMPLATE_NAME: string;
  MAX_HISTORY_LENGTH: number;
  MAX_CURRENT_MESSAGE_LENGTH: number;
  MAX_MESSAGES_IN_HISTORY: number;
}

// Proxy escalation result types
export interface ProxyEscalationResult {
  success: boolean;
  templateSent: boolean;
  proxyModeStarted: boolean;
  error?: string;
  notificationId?: string;
}

// Customer context types
export interface CustomerContext {
  id?: string;
  firstName?: string;
  lastName?: string;
  whatsappName?: string;
  phoneNumber?: string;
}

// Error types for escalation system
export class EscalationError extends Error {
  constructor(
    message: string,
    public code: EscalationErrorCode,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'EscalationError';
  }
}

export enum EscalationErrorCode {
  TEMPLATE_SEND_FAILED = 'TEMPLATE_SEND_FAILED',
  PROXY_SESSION_CREATION_FAILED = 'PROXY_SESSION_CREATION_FAILED',
  CUSTOMER_NAME_RESOLUTION_FAILED = 'CUSTOMER_NAME_RESOLUTION_FAILED',
  DATABASE_OPERATION_FAILED = 'DATABASE_OPERATION_FAILED',
  MEDIA_ATTACHMENT_FAILED = 'MEDIA_ATTACHMENT_FAILED',
  MESSAGE_ROUTING_FAILED = 'MESSAGE_ROUTING_FAILED',
  BUSINESS_NOT_FOUND = 'BUSINESS_NOT_FOUND',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_PHONE_NUMBER = 'INVALID_PHONE_NUMBER',
  WHATSAPP_API_ERROR = 'WHATSAPP_API_ERROR'
}

// Escalation detection types
export interface FrustrationAnalysis {
  shouldEscalate: boolean;
  consecutiveFrustratedMessages: number;
}

// Notification status types (extending base notification types)
export type ProxyNotificationStatus = 'pending' | 'attending' | 'proxy_mode' | 'provided_help' | 'ignored' | 'wrong_activation';

// Constants
export const ESCALATION_CONSTANTS = {
  PROXY_CONFIG: {
    TAKEOVER_KEYWORDS: ['skedy-continue', 'SKEDY-CONTINUE'],
    TAKEOVER_BUTTON_ID: 'return_control_to_bot',
    MAX_PROXY_DURATION: 24 * 60 * 60 * 1000 // 24 hours
  },
  TEMPLATE_CONFIG: {
    TEMPLATE_NAME: 'customer_needs_help', // This will be overridden by getEscalationTemplateName()
    MAX_HISTORY_LENGTH: 600,
    MAX_CURRENT_MESSAGE_LENGTH: 150,
    MAX_MESSAGES_IN_HISTORY: 4
  },
  // WhatsApp template parameter limits to prevent API errors
  TEMPLATE_PARAMETER_LIMITS: {
    HEADER_MAX_LENGTH: 60,    // WhatsApp header parameter limit
    BODY_MAX_LENGTH: 1024,    // WhatsApp body parameter limit
    SAFE_HISTORY_LENGTH: 300, // Conservative limit for history in templates
    SAFE_MESSAGE_LENGTH: 100  // Conservative limit for current message in templates
  },
  FRUSTRATION_THRESHOLDS: {
    CONSECUTIVE_FRUSTRATED_MESSAGES: 3,
    SENTIMENT_ANALYSIS_HISTORY_LIMIT: 15
  }
} as const;

// Utility types for better type safety
export type EscalationReason = EscalationTrigger['reason'];
export type ProxySessionActivity = 'created' | 'ended' | 'message_forwarded' | 'validation_failed';

// Template component types for WhatsApp
export interface TemplateComponent {
  type: 'header' | 'body' | 'footer';
  parameters: Array<{
    type: 'text' | 'image' | 'document' | 'video';
    text?: string;
    image?: { link: string };
    document?: { link: string; filename: string };
    video?: { link: string };
  }>;
}

export interface TemplateMessage {
  name: string;
  language: {
    code: string;
  };
  components?: TemplateComponent[];
} 