import {
  ConversationalParticipant,
  ChatContext,
  UserGoal,
  ChatConversationSession,
  BOT_CONFIG,
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
  participant: ConversationalParticipant
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
        BOT_CONFIG.DEFAULT_LANGUAGE,
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
  
  // 1. Identificar dinámicamente el negocio a través del número de WhatsApp.
  if (!participant.businessWhatsappNumber) {
    throw new Error(
      "[getOrCreateChatContext] Critical: businessWhatsappNumber is missing from participant."
    );
  }

  // Normalize the WhatsApp number to ensure it has a '+' prefix for DB lookup.
  let numberToSearch = participant.businessWhatsappNumber;
  if (!numberToSearch.startsWith("+")) {
    numberToSearch = `+${numberToSearch}`;
  }

  // Diagnostic log to confirm the number being searched.
  console.log(
    `[getOrCreateChatContext] Attempting to find business with normalized number: ${numberToSearch}`
  );

  const business = await Business.findByWhatsappNumber(numberToSearch);

  if (!business || !business.id) {
    // Si no se encuentra el negocio, no podemos continuar.
    // Log the exact number that was searched for to make debugging easier.
    console.error(
      `[getOrCreateChatContext] Critical: Could not find business associated with WhatsApp number ${numberToSearch}. Please ensure the number is registered correctly in the database.`
    );
    throw new Error(
      `[getOrCreateChatContext] Critical: Could not find business associated with WhatsApp number ${participant.businessWhatsappNumber}`
    );
  }
  const associatedBusinessId = business.id;
  console.log(
    `[getOrCreateChatContext] Dynamically identified business ID: ${associatedBusinessId}`
  );

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
        frequentlyDiscussedTopics: null,
      },
    };
  }

  const currentSession = convertToInternalSession(
    historyAndContext,
    participantWithBusinessId
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
      language: BOT_CONFIG.DEFAULT_LANGUAGE,
      timezone: BOT_CONFIG.DEFAULT_TIMEZONE,
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