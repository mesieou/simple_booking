import { ConversationalParticipant, ChatContext, UserGoal, ChatConversationSession, BOT_CONFIG } from './bot-manager';
import { extractSessionHistoryAndContext } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/extract-history-and-context.ts";
import { persistSessionState as persistState } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/save-history-and-context";
import { UserContext } from '@/lib/database/models/user-context';
import { ChatMessage } from '@/lib/database/models/chat-session';
import { User } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';

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
    
    // 1. Identificar dinámicamente el negocio a través del número de WhatsApp.
    if (!participant.businessWhatsappNumber) {
        throw new Error("[getOrCreateChatContext] Critical: businessWhatsappNumber is missing from participant.");
    }

    // Normalize the WhatsApp number to ensure it has a '+' prefix for DB lookup.
    let numberToSearch = participant.businessWhatsappNumber;
    if (!numberToSearch.startsWith('+')) {
        numberToSearch = `+${numberToSearch}`;
    }

    // Diagnostic log to confirm the number being searched.
    console.log(`[getOrCreateChatContext] Attempting to find business with normalized number: ${numberToSearch}`);

    const business = await Business.findByWhatsappNumber(numberToSearch);

    if (!business || !business.id) {
        // Si no se encuentra el negocio, no podemos continuar.
        // Log the exact number that was searched for to make debugging easier.
        console.error(`[getOrCreateChatContext] Critical: Could not find business associated with WhatsApp number ${numberToSearch}. Please ensure the number is registered correctly in the database.`);
        throw new Error(`[getOrCreateChatContext] Critical: Could not find business associated with WhatsApp number ${participant.businessWhatsappNumber}`);
    }
    const associatedBusinessId = business.id;
    console.log(`[getOrCreateChatContext] Dynamically identified business ID: ${associatedBusinessId}`);

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
      associatedBusinessId: associatedBusinessId || undefined,
    };

    let historyAndContext = await extractSessionHistoryAndContext(
        'whatsapp',
        participant.customerWhatsappNumber || participant.id,
        associatedBusinessId || "", // Pass empty string if null
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
    botResponse: string
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

      const chatMessages: ChatMessage[] = [];
      
      if (activeSession.activeGoals.length > 0 && activeSession.activeGoals[0].messageHistory) {
        for (const msg of activeSession.activeGoals[0].messageHistory) {
          chatMessages.push({
            role: msg.speakerRole === 'user' ? 'user' : 'bot',
            content: msg.content,
            timestamp: msg.messageTimestamp.toISOString()
          });
        }
      }

      const lastMessage = chatMessages[chatMessages.length - 1];
      
      if (!lastMessage || lastMessage.content !== botResponse) {
        chatMessages.push({
          role: 'user',
          content: userMessage,
          timestamp: new Date().toISOString()
        });
        
        chatMessages.push({
          role: 'bot',
          content: botResponse,
          timestamp: new Date().toISOString()
        });
      }

      await persistState(sessionId, updatedContext, chatMessages);
    } catch (error) {
      console.error(`[StatePersister] Error persisting session state:`, error);
    }
} 