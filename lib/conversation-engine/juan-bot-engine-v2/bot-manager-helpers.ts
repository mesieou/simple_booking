import { ConversationalParticipant, ChatContext, UserGoal, ChatConversationSession, BOT_CONFIG } from '@/lib/Juan-bot-engine/bot-manager';
import { extractSessionHistoryAndContext } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/extract-history-and-context.ts";
import { persistSessionState as persistState } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/save-history-and-context";
import { UserContext } from '@/lib/database/models/user-context';
import { ChatMessage } from '@/lib/database/models/chat-session';
import { User } from '@/lib/database/models/user';

export const START_BOOKING_PAYLOAD = 'start_booking_flow';


// Converts database models to internal session format
function convertToInternalSession(historyAndContext: any, participant: ConversationalParticipant): ChatConversationSession {
    const activeGoals: UserGoal[] = [];
    
    if (historyAndContext.userContext.currentGoal && historyAndContext.userContext.currentGoal.goalStatus === 'inProgress') {
      const currentGoal = historyAndContext.userContext.currentGoal;
      
      const messageHistory = historyAndContext.historyForLLM.map((msg: ChatMessage) => ({
        speakerRole: msg.role === 'user' ? 'user' as const : 'chatbot' as const,
        content: msg.content,
        messageTimestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
      }));

      const userGoal: UserGoal = {
        goalType: currentGoal.goalType || 'serviceBooking',
        goalAction: currentGoal.goalAction,
        goalStatus: currentGoal.goalStatus,
        currentStepIndex: currentGoal.currentStepIndex || 0,
        collectedData: currentGoal.collectedData || {},
        messageHistory: messageHistory,
        flowKey: currentGoal.flowKey || 'bookingCreatingForMobileService'
      };
      
      activeGoals.push(userGoal);
    }

    return {
      id: historyAndContext.currentSessionId,
      participantId: participant.id,
      participantType: participant.type,
      activeGoals: activeGoals,
      sessionStartTimestamp: new Date(),
      lastMessageTimestamp: new Date(),
      sessionStatus: 'active' as const,
      communicationChannel: 'whatsapp' as const,
      sessionMetadata: {
        languagePreference: historyAndContext.userContext.participantPreferences?.language || BOT_CONFIG.DEFAULT_LANGUAGE
      }
    };
}

// Gets or creates chat context for a participant using database persistence
export async function getOrCreateChatContext(participant: ConversationalParticipant): Promise<{context: ChatContext, sessionId: string, userContext: UserContext, historyForLLM: ChatMessage[], customerUser?: any}> {
    const associatedBusinessId = '228c7e8e-ec15-4eeb-a766-d1ebee07104f';
    let customerUser: any = undefined;

    if (participant.customerWhatsappNumber && participant.type === 'customer') {
        try {
            customerUser = await User.findUserByCustomerWhatsappNumber(participant.customerWhatsappNumber);
        } catch (error) {
            console.error(`[MessageProcessor] Error looking up customer user:`, error);
        }
    }

    const participantWithBusinessId: ConversationalParticipant = {
      ...participant,
      associatedBusinessId: associatedBusinessId,
    };

    let historyAndContext = await extractSessionHistoryAndContext(
        'whatsapp',
        participant.customerWhatsappNumber || participant.id,
        associatedBusinessId,
        BOT_CONFIG.SESSION_TIMEOUT_HOURS,
        {}
    );

    if (!historyAndContext) {
      historyAndContext = {
        currentSessionId: `mock-session-${Date.now()}`,
        historyForLLM: [],
        isNewSession: true,
        userContext: {
          id: `mock-context-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          channelUserId: participant.customerWhatsappNumber || participant.id,
          businessId: null,
          currentGoal: null,
          previousGoal: null,
          participantPreferences: null,
          frequentlyDiscussedTopics: null
        }
      };
    }

    const currentSession = convertToInternalSession(historyAndContext, participantWithBusinessId);
    
    const frequentlyDiscussedTopics = historyAndContext.userContext.frequentlyDiscussedTopics
      ? historyAndContext.userContext.frequentlyDiscussedTopics.split(', ').filter((topic:string) => topic.trim() !== '')
      : ['general queries', 'booking help'];
    
    const context: ChatContext = {
      currentParticipant: participantWithBusinessId,
      currentConversationSession: currentSession,
      previousConversationSession: undefined,
      frequentlyDiscussedTopics: frequentlyDiscussedTopics,
      participantPreferences: historyAndContext.userContext.participantPreferences || { 
        language: BOT_CONFIG.DEFAULT_LANGUAGE, 
        timezone: BOT_CONFIG.DEFAULT_TIMEZONE, 
        notificationSettings: { email: true } 
      }
    };

    return {
      context,
      sessionId: historyAndContext.currentSessionId,
      userContext: historyAndContext.userContext,
      historyForLLM: historyAndContext.historyForLLM,
      customerUser
    };
}

// Persists the updated conversation state to the database
export async function persistSessionState(
    sessionId: string,
    userContext: UserContext,
    activeSession: ChatConversationSession,
    currentGoal: UserGoal | undefined,
    userMessage: string,
    botResponse: string,
    fullHistory: ChatMessage[]
  ): Promise<void> {
    try {
      let updatedContext: UserContext;
      
      if (currentGoal && currentGoal.goalStatus === 'completed') {
        updatedContext = {
          ...userContext,
          currentGoal: null,
          previousGoal: {
            goalType: currentGoal.goalType,
            goalAction: currentGoal.goalAction,
            goalStatus: currentGoal.goalStatus,
            currentStepIndex: currentGoal.currentStepIndex,
            collectedData: currentGoal.collectedData,
            flowKey: currentGoal.flowKey
          },
          frequentlyDiscussedTopics: Array.isArray(userContext.frequentlyDiscussedTopics) 
            ? userContext.frequentlyDiscussedTopics.join(', ')
            : userContext.frequentlyDiscussedTopics || null
        };
      } else {
        updatedContext = {
          ...userContext,
          currentGoal: currentGoal ? {
            goalType: currentGoal.goalType,
            goalAction: currentGoal.goalAction,
            goalStatus: currentGoal.goalStatus,
            currentStepIndex: currentGoal.currentStepIndex,
            collectedData: currentGoal.collectedData,
            flowKey: currentGoal.flowKey
          } : null,
          frequentlyDiscussedTopics: Array.isArray(userContext.frequentlyDiscussedTopics) 
            ? userContext.frequentlyDiscussedTopics.join(', ')
            : userContext.frequentlyDiscussedTopics || null
        };
      }

      const chatMessages: ChatMessage[] = [...fullHistory];
      
      // Check if this user message is already in the history to avoid duplicates
      const lastUserMessage = chatMessages.slice().reverse().find(msg => msg.role === 'user');
      const isNewMessage = !lastUserMessage || lastUserMessage.content !== userMessage;
      
      if (isNewMessage) {
        const currentTimestamp = new Date().toISOString();
        
        // Always add the user message
        chatMessages.push({
          role: 'user',
          content: userMessage,
          timestamp: currentTimestamp
        });
        
        // Only add bot response if it's not empty (avoid ghost messages)
        if (botResponse && botResponse.trim() !== '') {
          chatMessages.push({
            role: 'bot',
            content: botResponse,
            timestamp: currentTimestamp
          });
          console.log(`[StatePersister] Adding message pair: user="${userMessage}", bot="${botResponse}"`);
        } else {
          console.log(`[StatePersister] Adding user message only: user="${userMessage}" (bot silent)`);
        }
      } else {
        console.log(`[StatePersister] Skipping duplicate message: "${userMessage}"`);
      }

      await persistState(sessionId, updatedContext, chatMessages);
    } catch (error) {
      console.error(`[StatePersister] Error persisting session state:`, error);
    }
} 