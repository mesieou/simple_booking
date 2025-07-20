import {
  ConversationalParticipant,
  ChatContext,
  UserGoal,
  ChatConversationSession,
  getBotConfig,
} from "@/lib/bot-engine/types";
import { extractSessionHistoryAndContext } from "@/lib/shared/llm/functions/extract-history-and-context.ts";
import { UserContext } from "@/lib/database/models/user-context";
import { ChatMessage } from "@/lib/database/models/chat-session";
import { User } from "@/lib/database/models/user";
import { Business } from "@/lib/database/models/business";
import { getCurrentEnvironment } from "@/lib/database/supabase/environment";

// Converts database models to internal session format
function convertToInternalSession(
  historyAndContext: any,
  participant: ConversationalParticipant,
  botConfig: { DEFAULT_LANGUAGE: string; DEFAULT_TIMEZONE: string; SESSION_TIMEOUT_HOURS: number }
): ChatConversationSession {
  const activeGoals: UserGoal[] = [];

  console.log(`[SessionManager] DEBUG - convertToInternalSession called:`, {
    hasUserContext: !!historyAndContext.userContext,
    hasCurrentGoal: !!historyAndContext.userContext?.currentGoal,
    currentGoalType: historyAndContext.userContext?.currentGoal?.goalType,
    currentGoalStatus: historyAndContext.userContext?.currentGoal?.goalStatus,
    participantId: participant.id,
    businessId: participant.associatedBusinessId,
    hasSessionData: !!historyAndContext.userContext?.sessionData
  });

  if (
    historyAndContext.userContext.currentGoal &&
    historyAndContext.userContext.currentGoal.goalStatus === "inProgress"
  ) {
    const currentGoal = historyAndContext.userContext.currentGoal;
    console.log(`[SessionManager] DEBUG - Found inProgress goal, adding to activeGoals:`, {
      goalType: currentGoal.goalType,
      goalStatus: currentGoal.goalStatus,
      currentStepIndex: currentGoal.currentStepIndex,
      flowKey: currentGoal.flowKey
    });

    const messageHistory = historyAndContext.historyForLLM.map(
      (msg: ChatMessage) => ({
        speakerRole: msg.role === "user" ? ("user" as const) : ("chatbot" as const),
        content: msg.content,
        messageTimestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })
    );

    const userGoal: UserGoal = {
      goalType: currentGoal.goalType || "serviceBooking",
      goalAction: currentGoal.goalAction,
      goalStatus: currentGoal.goalStatus,
      currentStepIndex: currentGoal.currentStepIndex || 0,
      collectedData: currentGoal.collectedData || {},
      messageHistory: messageHistory,
      flowKey: currentGoal.flowKey || "bookingCreatingForMobileService",
    };

    activeGoals.push(userGoal);
    console.log(`[SessionManager] DEBUG - Successfully added goal to activeGoals. Total goals: ${activeGoals.length}`);
  } else {
    console.log(`[SessionManager] DEBUG - No inProgress goal found. Reasons:`, {
      noCurrentGoal: !historyAndContext.userContext.currentGoal,
      goalStatus: historyAndContext.userContext.currentGoal?.goalStatus,
      expectedStatus: "inProgress"
    });
  }

  // Restore userData from persisted sessionData
  let userData = undefined;
  if (historyAndContext.userContext.sessionData) {
    userData = historyAndContext.userContext.sessionData;
    console.log(`[SessionManager] DEBUG - Restored userData from sessionData:`, userData);
  }

  return {
    id: historyAndContext.currentSessionId,
    participantId: participant.id,
    participantType: participant.type,
    activeGoals: activeGoals,
    sessionStartTimestamp: new Date(),
    lastMessageTimestamp: new Date(),
    sessionStatus: "active" as const,
    communicationChannel: "whatsapp" as const,
    sessionMetadata: {
      languagePreference:
        historyAndContext.userContext.participantPreferences?.language ||
        botConfig.DEFAULT_LANGUAGE, // 🎯 Now uses business config
    },
    userData: userData, // Restore the userData field
  };
}

// Gets or creates chat context for a participant using database persistence
export async function getOrCreateChatContext(
  participant: ConversationalParticipant
): Promise<{
  context: ChatContext;
  sessionId: string;
  userContext: UserContext;
  historyForLLM: ChatMessage[];
  customerUser?: any;
}> {
  const currentEnvironment = getCurrentEnvironment();
  const LOG_PREFIX = `[SessionManager ${currentEnvironment.toUpperCase()}]`;
  
  console.log(`${LOG_PREFIX} Creating chat context for participant: ${participant.id}`);
  
  let associatedBusinessId: string;
  let business: Business | null;

  // 🎯 MULTI-CHANNEL BUSINESS IDENTIFICATION
  if (participant.associatedBusinessId) {
    // Universal approach: businessId already provided (web, messenger, SMS, etc.)
    associatedBusinessId = participant.associatedBusinessId;
    console.log(`${LOG_PREFIX} Using provided businessId: ${associatedBusinessId}`);
    
    business = await Business.getById(associatedBusinessId);
    if (!business || !business.id) {
      throw new Error(
        `[getOrCreateChatContext] Critical: Could not find business with ID ${associatedBusinessId}`
      );
    }
  } else if (participant.businessWhatsappNumber) {
    // WhatsApp fallback: lookup business by WhatsApp number
    console.log(`${LOG_PREFIX} Falling back to WhatsApp number lookup for: ${participant.businessWhatsappNumber}`);
    
    // Normalize the WhatsApp number to ensure it has a '+' prefix for DB lookup.
    let numberToSearch = participant.businessWhatsappNumber;
    if (!numberToSearch.startsWith("+")) {
      numberToSearch = `+${numberToSearch}`;
    }

    business = await Business.getByWhatsappNumber(numberToSearch);
    if (!business || !business.id) {
      console.error(
        `[getOrCreateChatContext] Critical: Could not find business associated with WhatsApp number ${numberToSearch}`
      );
      throw new Error(
        `[getOrCreateChatContext] Critical: Could not find business associated with WhatsApp number ${participant.businessWhatsappNumber}`
      );
    }
    associatedBusinessId = business.id;
  } else {
    // No business identifier provided
    throw new Error(
      "[getOrCreateChatContext] Critical: No business identifier provided. Need either associatedBusinessId or businessWhatsappNumber."
    );
  }

  console.log(`${LOG_PREFIX} Successfully identified business: ${business.name} (ID: ${associatedBusinessId})`);

  // 🎯 Get business-specific configuration
  const botConfig = await getBotConfig(associatedBusinessId);
  console.log(`${LOG_PREFIX} Using business timezone: ${botConfig.DEFAULT_TIMEZONE}`);

  // 🆕 PROXY SESSION CHECK: If this is an admin message, check for active proxy session first
  if (participant.type === 'business') {
    console.log(`${LOG_PREFIX} Admin message detected, checking for active proxy session...`);
    console.log(`${LOG_PREFIX} Debug - participant.type: ${participant.type}, participant.id: ${participant.id}`);
    
    try {
      const { getProxySessionByAdmin } = await import('@/lib/bot-engine/escalation/proxy-session-manager');
      const proxySession = await getProxySessionByAdmin(participant.id);
      
      if (proxySession) {
        console.log(`${LOG_PREFIX} Found active proxy session for admin, using customer session: ${proxySession.sessionId}`);
        
        // Use the customer's session instead of creating a new admin session
        const customerParticipant: ConversationalParticipant = {
          ...participant,
          customerWhatsappNumber: proxySession.customerPhone,
          associatedBusinessId: associatedBusinessId,
          type: 'customer' as const // Temporarily treat as customer to get their session
        };
        
        // Get the customer's session context
        const customerContext = await extractSessionHistoryAndContext(
          "whatsapp",
          proxySession.customerPhone,
          associatedBusinessId || "",
          botConfig.SESSION_TIMEOUT_HOURS, // 🎯 Use business config
          {}
        );
        
        if (customerContext) {
          // Convert back to admin participant for the context
          const adminParticipant: ConversationalParticipant = {
            ...participant,
            associatedBusinessId: associatedBusinessId,
          };
          
          const currentSession = convertToInternalSession(
            customerContext,
            adminParticipant,
            botConfig
          );
          
          const context: ChatContext = {
            currentParticipant: adminParticipant,
            currentConversationSession: currentSession,
            previousConversationSession: undefined,
            frequentlyDiscussedTopics: customerContext.userContext.frequentlyDiscussedTopics
              ? customerContext.userContext.frequentlyDiscussedTopics.split(", ").filter((topic: string) => topic.trim() !== "")
              : ["general queries", "booking help"],
            participantPreferences: customerContext.userContext.participantPreferences || {
              language: botConfig.DEFAULT_LANGUAGE,   // 🎯 Use business config
              timezone: botConfig.DEFAULT_TIMEZONE,   // 🎯 Use business config  
              notificationSettings: { email: true },
            },
          };
          
          return {
            context,
            sessionId: proxySession.sessionId,
            userContext: customerContext.userContext,
            historyForLLM: customerContext.historyForLLM,
            customerUser: undefined, // Admin doesn't have customer user
          };
        }
      } else {
        console.log(`${LOG_PREFIX} No active proxy session found for admin, proceeding with normal session creation`);
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Error checking proxy session for admin:`, error);
      // Continue with normal session creation if proxy check fails
    }
  } else {
    console.log(`${LOG_PREFIX} Customer message - participant.type: ${participant.type}, participant.id: ${participant.id}`);
  }

  let customerUser: any = undefined;

  if (participant.customerWhatsappNumber && participant.type === "customer") {
    try {
      customerUser = await User.findUserByCustomerWhatsappNumber(
        participant.customerWhatsappNumber
      );
    } catch (error) {
      console.error(`[MessageProcessor] Error looking up customer user:`, error);
    }
  }

  const participantWithBusinessId: ConversationalParticipant = {
    ...participant,
    associatedBusinessId: associatedBusinessId || undefined,
  };

  let historyAndContext = await extractSessionHistoryAndContext(
    "whatsapp",
    participant.customerWhatsappNumber || participant.id,
    associatedBusinessId || "", // Pass empty string if null
    botConfig.SESSION_TIMEOUT_HOURS, // 🎯 Use business config
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
        frequentlyDiscussedTopics: null,
        sessionData: null,
      },
    };
  }

  // If no customer user found, clear any cached user data from the session
  // to prevent old super admin or other non-customer data from persisting
  if (!customerUser && historyAndContext?.userContext?.sessionData?.userId) {
    console.log(`[SessionManager] No customer found but session has cached user data - clearing cached data`);
    // Clear the cached user data from the session
    if (historyAndContext.userContext.sessionData) {
      historyAndContext.userContext.sessionData = {
        ...historyAndContext.userContext.sessionData,
        userId: undefined,
        customerName: undefined,
        existingUserFound: false
      };
    }
  }

  const currentSession = convertToInternalSession(
    historyAndContext,
    participantWithBusinessId,
    botConfig
  );

  const frequentlyDiscussedTopics = historyAndContext.userContext
    .frequentlyDiscussedTopics
    ? historyAndContext.userContext.frequentlyDiscussedTopics
        .split(", ")
        .filter((topic: string) => topic.trim() !== "")
    : ["general queries", "booking help"];

  const context: ChatContext = {
    currentParticipant: participantWithBusinessId,
    currentConversationSession: currentSession,
    previousConversationSession: undefined,
    frequentlyDiscussedTopics: frequentlyDiscussedTopics,
    participantPreferences: historyAndContext.userContext
      .participantPreferences || {
      language: botConfig.DEFAULT_LANGUAGE,   // 🎯 Use business config
      timezone: botConfig.DEFAULT_TIMEZONE,   // 🎯 Use business config  
      notificationSettings: { email: true },
    },
  };

  return {
    context,
    sessionId: historyAndContext.currentSessionId,
    userContext: historyAndContext.userContext,
    historyForLLM: historyAndContext.historyForLLM,
    customerUser,
  };
} 