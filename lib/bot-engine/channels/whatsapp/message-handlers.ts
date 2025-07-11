import { type ConversationalParticipant, type ChatContext } from "@/lib/bot-engine/types";
import { type ParsedMessage, type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import {
    handleEscalationOrAdminCommand,
} from "@/lib/bot-engine/escalation/escalation-orchestrator";
import {
    hasStickerContent,
} from "@/lib/bot-engine/escalation/escalation-detector";
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
import { WhatsAppHandlerLogger } from "@/lib/bot-engine/utils/logger";
import { ProxyMessageHandler } from './proxy-message-interceptor';

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
      WhatsAppHandlerLogger.journey('Bot in escalation mode', {
        sessionId,
        userId: context.participant.customerWhatsappNumber
      }, { 
        escalationStatus,
        messagePreview: parsedMessage.text?.substring(0, 30) 
      });

      if (escalationStatus === 'pending' || escalationStatus === 'attending') {
        const logMessage = escalationStatus === 'pending'
          ? 'Escalation pending - saving message and silencing bot'
          : 'Staff attending - saving message and silencing bot';
        
        WhatsAppHandlerLogger.flow(logMessage, {
          sessionId,
          userId: context.participant.customerWhatsappNumber
        }, { escalationStatus });
        
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
      "[WhatsAppHandler]"
    );
    
    if (languageResult.wasChanged) {
      WhatsAppHandlerLogger.info('Language preference updated', {
        sessionId: context.sessionId,
        userId: context.participant.customerWhatsappNumber
      }, { 
        previousLanguage: languageResult.previousLanguage,
        newLanguage: languageResult.detectedLanguage,
        reason: languageResult.reason 
      });
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
      WhatsAppHandlerLogger.flow('Sticker message detected - saving without response', {
        sessionId,
        userId: context.participant.customerWhatsappNumber
      }, { stickerContent: parsedMessage.text });
      
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
      // Fetch actual chat history for escalation
      let chatHistory: any[] = [];
      try {
        const { ChatSession } = await import('@/lib/database/models/chat-session');
        const sessionData = await ChatSession.getById(chatContext.currentConversationSession.id);
        if (sessionData && sessionData.allMessages) {
          chatHistory = sessionData.allMessages;
          console.log(`[EscalationCommandHandler] Retrieved ${chatHistory.length} messages from chat history`);
        }
      } catch (error) {
        console.error('[EscalationCommandHandler] Error fetching chat history:', error);
      }
      
      const escalationResult = await handleEscalationOrAdminCommand(
        parsedMessage.text || '',
        participant,
        chatContext,
        userContext,
        chatHistory, // Pass actual chat history
        customerUser ? {
          firstName: customerUser.firstName || '',
          lastName: customerUser.lastName || '',
          id: customerUser.id
        } : undefined,
        parsedMessage.recipientId,
        parsedMessage.userName
      );

      if (escalationResult.isEscalated) {
        WhatsAppHandlerLogger.journey('Message escalated to human support', {
          sessionId: context.sessionId,
          userId: context.participant.customerWhatsappNumber
        }, { 
          escalationReason: escalationResult.reason,
          hasResponse: !!escalationResult.response
        });
        
        if (escalationResult.response) {
          // Update chat session status to escalated for tracking
          try {
            const { ChatSession } = await import('@/lib/database/models/chat-session');
            await ChatSession.updateStatus(context.sessionId, 'escalated');
            console.log(`[EscalationCommandHandler] Updated session ${context.sessionId} status to 'escalated'`);
          } catch (error) {
            console.error(`[EscalationCommandHandler] Failed to update session status:`, error);
          }
          
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
      WhatsAppHandlerLogger.info('Audio message processed', {
        sessionId,
        userId: context.participant.customerWhatsappNumber
      }, {
        originalLength: audioTranscriptionResult.originalMessage?.length || 0,
        transcribedLength: audioTranscriptionResult.transcribedMessage?.length || 0,
        hasError: !!audioTranscriptionResult.error
      });
      
      // If transcription failed, send error message
      if (audioTranscriptionResult.error) {
        WhatsAppHandlerLogger.warn('Audio transcription failed', {
          sessionId,
          userId: context.participant.customerWhatsappNumber
        }, { error: audioTranscriptionResult.error });
        
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
      
      WhatsAppHandlerLogger.flow('Audio transcribed successfully - continuing processing', {
        sessionId,
        userId: context.participant.customerWhatsappNumber
      }, { transcribedText: audioTranscriptionResult.transcribedMessage?.substring(0, 50) });
      
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
    
    // Log routing decision with detailed context
    WhatsAppHandlerLogger.flow('Message routing analysis completed', {
      sessionId,
      userId: context.participant.customerWhatsappNumber
    }, {
      messagePreview: parsedMessage.text?.substring(0, 50),
      hasBookingGoal: !!userCurrentGoal,
      goalType: userCurrentGoal?.goalType,
      isBookingRelated,
      routing: {
        containsPayload: messageContainsBookingPayload,
        containsUUID: messageContainsUUID,
        containsBookingPayload: messageContainsBookingRelatedPayload,
        isPaymentCompletion: messageIsPaymentCompletion
      }
    });
    
    let botResponse: BotResponse | null = null;
    
    if (isBookingRelated) {
      WhatsAppHandlerLogger.journey('Routing to booking flow', {
        sessionId,
        userId: context.participant.customerWhatsappNumber,
        goalType: userCurrentGoal?.goalType
      }, {
        routingReason: messageIsPaymentCompletion ? 'payment_completion' : 
                      messageContainsBookingPayload ? 'explicit_booking_start' :
                      userCurrentGoal ? 'existing_booking_goal' : 'booking_related_content'
      });
      
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
      WhatsAppHandlerLogger.journey('Routing to FAQ/Chitchat handler', {
        sessionId,
        userId: context.participant.customerWhatsappNumber
      }, {
        reason: 'no_booking_context',
        messagePreview: parsedMessage.text?.substring(0, 30)
      });
      
      const faqResponse = await handleFaqOrChitchat(chatContext, parsedMessage.text || '', []);
      botResponse = faqResponse;
      
      if (botResponse.text && chatContext.currentConversationSession) {
        WhatsAppHandlerLogger.debug('FAQ response persisting session state', { sessionId });
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
    WhatsAppHandlerLogger.journey('Message processing pipeline started', {
      sessionId: context.sessionId,
      userId: context.participant.customerWhatsappNumber
    }, {
      messageType: context.parsedMessage.attachments?.length ? 'media' : 'text',
      messagePreview: context.parsedMessage.text?.substring(0, 50),
      hasCustomerUser: !!context.customerUser
    });

    const handlers = [
      ProxyMessageHandler, // 🆕 Add proxy handler first
      EscalationHandler,
      LanguageHandler,
      StickerHandler,
      AudioHandler,
      EscalationCommandHandler,
      ConversationFlowHandler
    ];

    for (const handler of handlers) {
      const result = await handler.handle(context);
      
      if (!result.shouldContinue) {
        WhatsAppHandlerLogger.journey('Processing stopped by handler', {
          sessionId: context.sessionId,
          userId: context.participant.customerWhatsappNumber
        }, {
          handlerType: result.handlerType,
          reason: result.message,
          hasResponse: !!result.response
        });
        return result.response || null;
      }
      
      if (result.wasHandled) {
        WhatsAppHandlerLogger.debug('Message processed by handler', {
          sessionId: context.sessionId
        }, { handlerType: result.handlerType });
        
        if (result.response) {
          return result.response;
        }
      }
    }

    WhatsAppHandlerLogger.warn('No handler processed the message', {
      sessionId: context.sessionId,
      userId: context.participant.customerWhatsappNumber
    });

    return null;
  }
} 