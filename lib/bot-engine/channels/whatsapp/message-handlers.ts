import { type ConversationalParticipant, type ChatContext } from "@/lib/bot-engine/types";
import { type ParsedMessage, type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { 
    handleEscalationOrAdminCommand, 
    hasStickerContent,
} from "@/lib/bot-engine/escalation/handler";
import { handleAudioTranscription } from "@/lib/bot-engine/audio-transcription/audio-transcription-handler";
import { handleFaqOrChitchat } from "@/lib/bot-engine/steps/faq/faq-handler";
import { processIncomingMessage } from "@/lib/bot-engine/core/message-processor";
import { LanguageDetectionService } from "@/lib/bot-engine/services/language-service";
import { Notification } from '@/lib/database/models/notification';
import { UserContext } from "@/lib/database/models/user-context";
import { User } from '@/lib/database/models/user';
import { persistSessionState } from "@/lib/bot-engine/session/state-persister";
import { WhatsappSender } from "./whatsapp-message-sender";
import { START_BOOKING_PAYLOAD } from "@/lib/bot-engine/config/constants";

const LOG_PREFIX = "[Message Handlers]";

export interface MessageHandlerContext {
  parsedMessage: ParsedMessage;
  participant: ConversationalParticipant;
  chatContext: ChatContext;
  userContext: UserContext;
  historyForLLM: string;
  customerUser: User | null;
  sessionId: string;
}

export interface MessageHandlerResult {
  shouldContinue: boolean;
  response?: BotResponse;
  wasHandled: boolean;
  handlerType: string;
  message?: string;
}

/**
 * Handles escalation status checks and escalated conversations
 */
export class EscalationHandler {
  static async handle(context: MessageHandlerContext): Promise<MessageHandlerResult> {
    const { parsedMessage, sessionId, chatContext, userContext, historyForLLM } = context;
    
    // Check if bot is in escalation mode
    const escalationStatus = await Notification.getEscalationStatus(sessionId);
    if (escalationStatus) {
      console.log(`${LOG_PREFIX} Bot is in escalation mode for session ${sessionId}. Status: ${escalationStatus}`);

      if (escalationStatus === 'pending' || escalationStatus === 'attending') {
        const logMessage = escalationStatus === 'pending'
          ? `Escalation is pending for session ${sessionId}. Saving user message and silencing bot.`
          : `Staff is attending session ${sessionId}. Saving user message and silencing bot.`;
        
        console.log(`${LOG_PREFIX} ${logMessage}`);
        
        if (chatContext.currentConversationSession) {
          await persistSessionState(
            sessionId, 
            userContext, 
            chatContext.currentConversationSession, 
            undefined,
            parsedMessage.text || '', 
            '', // No bot response
            undefined, // fullHistory is optional and will be reconstructed from activeGoals
            parsedMessage
          );
        }

        return {
          shouldContinue: false,
          wasHandled: true,
          handlerType: `escalation_${escalationStatus}`,
          message: 'User message saved during escalation'
        };
      }
    }

    return {
      shouldContinue: true,
      wasHandled: false,
      handlerType: 'escalation_none'
    };
  }
}

/**
 * Handles language detection and updates
 */
export class LanguageHandler {
  static async handle(context: MessageHandlerContext): Promise<MessageHandlerResult> {
    const { parsedMessage, chatContext } = context;
    
    const languageResult = await LanguageDetectionService.detectAndUpdateLanguage(
      parsedMessage.text || '', 
      chatContext, 
      LOG_PREFIX
    );
    
    if (languageResult.wasChanged) {
      console.log(`${LOG_PREFIX} Language detection: ${languageResult.reason}`);
    }

    return {
      shouldContinue: true,
      wasHandled: false,
      handlerType: 'language_detection'
    };
  }
}

/**
 * Handles sticker messages (special case - save but don't respond)
 */
export class StickerHandler {
  static async handle(context: MessageHandlerContext): Promise<MessageHandlerResult> {
    const { parsedMessage, sessionId, userContext, chatContext, historyForLLM } = context;
    
    if (hasStickerContent(parsedMessage.text || '')) {
      console.log(`${LOG_PREFIX} Sticker detected: "${parsedMessage.text || ''}". Saving to history but not responding.`);
      
      if (chatContext.currentConversationSession) {
        await persistSessionState(
          sessionId, 
          userContext, 
          chatContext.currentConversationSession, 
          undefined,
          parsedMessage.text || '', 
          '',
          undefined, // fullHistory is optional and will be reconstructed from activeGoals
          parsedMessage
        );
      }

      return {
        shouldContinue: false,
        wasHandled: true,
        handlerType: 'sticker',
        message: 'Sticker received and saved to history'
      };
    }

    return {
      shouldContinue: true,
      wasHandled: false,
      handlerType: 'sticker_none'
    };
  }
}

/**
 * Handles escalation commands and admin commands
 */
export class EscalationCommandHandler {
  static async handle(context: MessageHandlerContext): Promise<MessageHandlerResult> {
    const { parsedMessage, participant, chatContext, userContext, historyForLLM, customerUser } = context;
    
    if (chatContext.currentConversationSession) {
      const escalationResult = await handleEscalationOrAdminCommand(
        parsedMessage.text || '',
        participant,
        chatContext,
        userContext,
        [], // Pass empty array since we don't have ChatMessage[] format here
        customerUser ? {
          firstName: customerUser.firstName || '',
          lastName: customerUser.lastName || '',
          id: customerUser.id
        } : undefined,
        parsedMessage.recipientId,
        parsedMessage.userName
      );

      if (escalationResult.isEscalated) {
        console.log(`${LOG_PREFIX} Message handled by escalation system. Reason: ${escalationResult.reason}`);
        
        if (escalationResult.response) {
          const sender = new WhatsappSender();
          await sender.sendMessage(parsedMessage.senderId, escalationResult.response, parsedMessage.recipientId);
          
          chatContext.currentConversationSession.sessionStatus = 'escalated';
          await persistSessionState(
            context.sessionId, 
            userContext, 
            chatContext.currentConversationSession, 
            undefined, 
            parsedMessage.text || '', 
            escalationResult.response,
            undefined, // fullHistory is optional and will be reconstructed from activeGoals
            parsedMessage
          );
        }

        return {
          shouldContinue: false,
          response: escalationResult.response,
          wasHandled: true,
          handlerType: 'escalation_command',
          message: 'Handled by escalation system'
        };
      }
    }

    return {
      shouldContinue: true,
      wasHandled: false,
      handlerType: 'escalation_command_none'
    };
  }
}

/**
 * Handles audio transcription
 */
export class AudioHandler {
  static async handle(context: MessageHandlerContext): Promise<MessageHandlerResult> {
    const { parsedMessage, chatContext, sessionId, userContext, historyForLLM } = context;
    
    const audioTranscriptionResult = await handleAudioTranscription(
      parsedMessage.text || '', 
      parsedMessage.attachments, 
      chatContext
    );
    
    if (audioTranscriptionResult.wasProcessed) {
      console.log(`${LOG_PREFIX} Audio transcription processed. Original: "${audioTranscriptionResult.originalMessage}" -> Transcribed: "${audioTranscriptionResult.transcribedMessage}"`);
      
      // If transcription failed, send error message
      if (audioTranscriptionResult.error) {
        console.log(`${LOG_PREFIX} Audio transcription failed, sending error message`);
        const sender = new WhatsappSender();
        await sender.sendMessage(parsedMessage.senderId, { text: audioTranscriptionResult.transcribedMessage }, parsedMessage.recipientId);
        
        if (chatContext.currentConversationSession) {
          await persistSessionState(
            sessionId, 
            userContext, 
            chatContext.currentConversationSession, 
            undefined,
            parsedMessage.text || '', 
            { text: audioTranscriptionResult.transcribedMessage },
            undefined, // fullHistory is optional and will be reconstructed from activeGoals
            parsedMessage
          );
        }
        
        return {
          shouldContinue: false,
          response: { text: audioTranscriptionResult.transcribedMessage },
          wasHandled: true,
          handlerType: 'audio_error',
          message: 'Audio transcription error sent'
        };
      }
      
      // Update message text with transcribed content
      parsedMessage.text = audioTranscriptionResult.transcribedMessage;
      console.log(`${LOG_PREFIX} Audio successfully transcribed, updated message for processing: "${parsedMessage.text}"`);
      
      return {
        shouldContinue: true,
        wasHandled: true,
        handlerType: 'audio_transcribed',
        message: 'Audio transcribed successfully'
      };
    }

    return {
      shouldContinue: true,
      wasHandled: false,
      handlerType: 'audio_none'
    };
  }
}

/**
 * Handles FAQ/Chitchat vs Booking Flow routing
 */
export class ConversationFlowHandler {
  static async handle(context: MessageHandlerContext): Promise<MessageHandlerResult> {
    const { parsedMessage, participant, chatContext, userContext, historyForLLM, sessionId } = context;
    
    const userCurrentGoal = chatContext.currentConversationSession?.activeGoals.find(g => g.goalStatus === 'inProgress');
    const messageContainsBookingPayload = (parsedMessage.text || '').toUpperCase().includes(START_BOOKING_PAYLOAD.toUpperCase());
    
    // Check if message contains a UUID (service selection, button clicks, etc.)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const messageContainsUUID = uuidRegex.test(parsedMessage.text || '');
    
    // Check if message contains booking-related payloads (confirmation, edit, payment, etc.)
    const bookingRelatedPayloads = [
      'confirm_quote', 'edit_quote', 'edit_service', 'edit_time', 
      'add_another_service', 'continue_with_services',
      'quick_booking', 'browse_available'
    ];
    const messageContainsBookingRelatedPayload = bookingRelatedPayloads.some(payload => 
      (parsedMessage.text || '').includes(payload)
    );
    
    // Check if message is payment completion
    const messageIsPaymentCompletion = (parsedMessage.text || '').startsWith('PAYMENT_COMPLETED_');
    
    const isBookingRelated = messageContainsBookingPayload || 
                           messageContainsUUID || 
                           messageContainsBookingRelatedPayload ||
                           messageIsPaymentCompletion ||
                           (userCurrentGoal && userCurrentGoal.goalType === 'serviceBooking');
    
    // DEBUG: Log goal state for debugging
    console.log(`${LOG_PREFIX} Goal state check - Message: "${parsedMessage.text?.substring(0, 50)}..." | HasBookingGoal: ${!!userCurrentGoal} | GoalType: ${userCurrentGoal?.goalType} | ContainsPayload: ${messageContainsBookingPayload} | ContainsUUID: ${messageContainsUUID} | ContainsBookingPayload: ${messageContainsBookingRelatedPayload} | IsPaymentCompletion: ${messageIsPaymentCompletion}`);
    
    let botResponse: BotResponse | null = null;
    
    if (isBookingRelated) {
      console.log(`${LOG_PREFIX} User is starting or continuing a booking flow. Routing to main engine.`);
      
      if (messageContainsBookingPayload && userCurrentGoal) {
        userCurrentGoal.goalStatus = 'completed';
      }

      // Create the existing context object to pass to processIncomingMessage
      const existingContext = {
        context: chatContext,
        sessionId: sessionId,
        userContext: userContext,
        historyForLLM: [], // Will be reconstructed internally
        customerUser: context.customerUser
      };

      botResponse = await processIncomingMessage(
        parsedMessage.text || '', 
        participant, 
        undefined, // Will use the history from the session context internally
        existingContext // Pass the existing context to prevent creating a new one
      );
      
    } else {
      console.log(`${LOG_PREFIX} No active booking goal. Routing to FAQ/Chitchat handler.`);
      const faqResponse = await handleFaqOrChitchat(chatContext, parsedMessage.text || '', []);
      botResponse = faqResponse;
      
      if (botResponse.text && chatContext.currentConversationSession) {
        console.log(`${LOG_PREFIX} FAQ persisting session state with undefined goal - THIS MIGHT OVERWRITE BOOKING GOALS`);
        await persistSessionState(
          sessionId, 
          userContext, 
          chatContext.currentConversationSession, 
          undefined,
          parsedMessage.text || '', 
          botResponse,
          undefined, // fullHistory is optional and will be reconstructed from activeGoals
          parsedMessage
        );
      }
    }

    return {
      shouldContinue: true,
      response: botResponse || undefined,
      wasHandled: true,
      handlerType: isBookingRelated ? 'booking_flow' : 'faq_chitchat'
    };
  }
}

/**
 * Main message processing pipeline
 */
export class MessageProcessor {
  static async processMessage(context: MessageHandlerContext): Promise<BotResponse | null> {
    const handlers = [
      EscalationHandler,
      LanguageHandler,
      StickerHandler,
      EscalationCommandHandler,
      AudioHandler,
      ConversationFlowHandler
    ];

    for (const handler of handlers) {
      const result = await handler.handle(context);
      
      if (!result.shouldContinue) {
        console.log(`${LOG_PREFIX} Processing stopped by ${result.handlerType}: ${result.message}`);
        return result.response || null;
      }
      
      if (result.wasHandled) {
        console.log(`${LOG_PREFIX} Message processed by ${result.handlerType}`);
        if (result.response) {
          return result.response;
        }
      }
    }

    return null;
  }
} 