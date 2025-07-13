import { persistSessionState } from "@/lib/bot-engine/session/state-persister";
import { WhatsAppHandlerLogger } from "@/lib/bot-engine/utils/logger";
import { routeProxyMessage } from '@/lib/bot-engine/escalation/proxy-communication-router';
import type { MessageHandlerContext, MessageHandlerResult } from './message-handlers';

/**
 * Handles proxy escalation message routing
 */
export class ProxyMessageHandler {
  static async handle(context: MessageHandlerContext): Promise<MessageHandlerResult> {
    const { parsedMessage, sessionId, chatContext, userContext, participant } = context;
    
    // Try to route proxy messages first
    const proxyResult = await routeProxyMessage(
      parsedMessage, 
      parsedMessage.recipientId || ''
    );
    
    if (proxyResult.wasHandled) {
      WhatsAppHandlerLogger.journey('Message handled by proxy system', {
        sessionId,
        userId: participant.customerWhatsappNumber
      }, { 
        messageForwarded: proxyResult.messageForwarded,
        proxyEnded: proxyResult.proxyEnded,
        error: proxyResult.error
      });
      
      // If proxy ended, stop processing - admin already got confirmation
      if (proxyResult.proxyEnded) {
        WhatsAppHandlerLogger.flow('Proxy mode ended - stopping message processing', {
          sessionId,
          userId: participant.customerWhatsappNumber
        });
        
        return {
          shouldContinue: false,
          wasHandled: true,
          handlerType: 'proxy_ended',
          message: 'Proxy mode ended, admin already received confirmation'
        };
      }
      
      // If message was forwarded, stop processing
      if (proxyResult.messageForwarded) {
        // Save the user message if we have session context
        if (chatContext.currentConversationSession) {
          await persistSessionState(
            sessionId, 
            userContext, 
            chatContext.currentConversationSession, 
            undefined,
            parsedMessage.text || '', 
            '', // No bot response during proxy
            undefined,
            parsedMessage
          );
        }
        
        return {
          shouldContinue: false,
          wasHandled: true,
          handlerType: 'proxy_forwarded',
          message: 'Message forwarded to admin via proxy'
        };
      }
    }
    
    return {
      shouldContinue: true,
      wasHandled: false,
      handlerType: 'proxy_none'
    };
  }
} 