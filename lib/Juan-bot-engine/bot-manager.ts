import { Business } from "../database/models/business";
import { extractSessionHistoryAndContext } from "../conversation-engine/llm-actions/chat-interactions/functions/extract-history-and-context.ts";
import { persistSessionState } from "../conversation-engine/llm-actions/chat-interactions/functions/save-history-and-context";
import { ChatMessage } from "../database/models/chat-session";
import { UserContext } from "../database/models/user-context";
import { IntelligentLLMService } from './services/intelligent-llm-service';
// --- Core Type Definitions ---
export type ConversationalParticipantType = 'business' | 'customer';
type UserGoalType = 'accountManagement' | 'serviceBooking' | 'frequentlyAskedQuestion' | 'humanAgentEscalation';
type GoalActionType = 'create' | 'delete' | 'update';

// Configuration constants
const BOT_CONFIG = {
  DEFAULT_TIMEZONE: 'Australia/Melbourne',
  DEFAULT_LANGUAGE: 'en',
  SESSION_TIMEOUT_HOURS: 24
} as const;

export interface ConversationalParticipant {
  id: string;
  type: ConversationalParticipantType;
  associatedBusinessId?: string;
  businessWhatsappNumber?: string; // The business WhatsApp number customers message TO (for WhatsApp)
  customerWhatsappNumber?: string; // The customer's WhatsApp number who is messaging FROM (for WhatsApp)
  creationTimestamp: Date;
  lastUpdatedTimestamp: Date;
}

interface ChatConversationSession {
  id: string;
  participantId: string;
  participantType: ConversationalParticipantType;
  activeGoals: UserGoal[];
  sessionStartTimestamp: Date;
  lastMessageTimestamp: Date;
  sessionStatus: 'active' | 'completed' | 'expired';
  communicationChannel: 'whatsapp' | 'web' | 'messenger';
  sessionMetadata?: {
    deviceInformation?: string;
    locationInformation?: string;
    languagePreference?: string;
  };
}

export interface UserGoal {
  goalType: UserGoalType;
  goalAction?: GoalActionType;
  goalStatus: 'inProgress' | 'completed' | 'failed';
  currentStepIndex: number;
  collectedData: Record<string, any>;
  messageHistory: Array<{
    speakerRole: 'user' | 'chatbot';
    content: string;
    messageTimestamp: Date;
  }>;
  flowKey: string;
}

export interface LLMProcessingResult {
  detectedUserGoalType?: UserGoalType;
  detectedGoalAction?: GoalActionType;
  extractedInformation?: Record<string, any>;
  confidenceScore?: number;
  generatedTextContent?: string;
  isValidInput?: boolean;
  validationErrorMessage?: string;
  errorMessageDetails?: string;
  transformedInput?: string; // For intelligent input transformation (e.g., service name -> service ID)
}

export interface ChatContext {
  currentConversationSession?: ChatConversationSession;
  previousConversationSession?: ChatConversationSession;
  currentParticipant: ConversationalParticipant;
  lastCompletedGoal?: UserGoal;
  frequentlyDiscussedTopics: string[];
  participantPreferences: {
    language: string;
    timezone: string;
    notificationSettings: Record<string, boolean>;
  };
}

export type ButtonConfig = {
  buttonText: string;
  buttonValue: string;
  buttonDescription?: string;
  buttonType?: 'postback' | 'link';
};

export interface IndividualStepHandler {
  defaultChatbotPrompt?: string;
  validateUserInput: (userInput: string, currentGoalData: Record<string, any>, chatContext: ChatContext) => Promise<boolean | LLMProcessingResult>;
  processAndExtractData: (validatedInput: string, currentGoalData: Record<string, any>, chatContext: ChatContext) => Promise<Record<string, any> | LLMProcessingResult>;
  fixedUiButtons?: (currentGoalData: Record<string, any>, chatContext: ChatContext) => Promise<ButtonConfig[]> | ButtonConfig[];
  autoAdvance?: boolean;
}

// --- Conversation Flow Configuration ---
export const conversationFlowBlueprints: Record<string, string[]> = {
  businessAccountCreation: ['getName', 'getBusinessEmail', 'getBusinessPhone', 'selectTimeZone', 'confirmAccountDetails'],
  businessAccountDeletion: ['confirmDeletionRequest', 'verifyUserPassword', 'initiateAccountDeletion'],
  bookingCreatingForMobileService: ['askAddress', 'validateAddress', 'selectService', 'confirmLocation', 'showAvailableTimes', 'handleTimeChoice', 'showDayBrowser', 'selectSpecificDay', 'showHoursForDay', 'selectSpecificTime', 'checkExistingUser', 'handleUserStatus', 'askUserName', 'createNewUser', 'quoteSummary', 'handleQuoteChoice', 'createBooking', 'displayConfirmedBooking'],
  bookingCreatingForNoneMobileService: ['selectService', 'confirmLocation', 'showAvailableTimes', 'handleTimeChoice', 'showDayBrowser', 'selectSpecificDay', 'showHoursForDay', 'selectSpecificTime', 'checkExistingUser', 'handleUserStatus', 'askUserName', 'createNewUser', 'quoteSummary', 'handleQuoteChoice', 'createBooking', 'displayConfirmedBooking'],
  customerFaqHandling: ['identifyUserQuestion', 'searchKnowledgeBase', 'provideAnswerToUser', 'checkUserSatisfaction'],
};

// Import step handlers
import { getBusinessEmailHandler } from './step-handlers/business-account-steps';
import { 
    askAddressHandler,
    validateAddressHandler,
    selectServiceHandler, 
    confirmLocationHandler,
    // New simplified handlers
    showAvailableTimesHandler,
    handleTimeChoiceHandler,
    showDayBrowserHandler,
    selectSpecificDayHandler,
    showHoursForDayHandler,
    selectSpecificTimeHandler,
    // Quote and booking handlers
    quoteSummaryHandler,
    handleQuoteChoiceHandler,
    // User management handlers
    checkExistingUserHandler,
    handleUserStatusHandler,
    askUserNameHandler,
    createNewUserHandler,
    // Other handlers
    askEmailHandler,
    createBookingHandler,
    displayConfirmedBookingHandler
} from './step-handlers/customer-booking-steps';

export const botTasks: Record<string, IndividualStepHandler> = {
  getBusinessEmail: getBusinessEmailHandler,
  askAddress: askAddressHandler,
  validateAddress: validateAddressHandler,
  selectService: selectServiceHandler,
  confirmLocation: confirmLocationHandler,
  // New simplified time/date handlers
  showAvailableTimes: showAvailableTimesHandler,
  handleTimeChoice: handleTimeChoiceHandler,
  showDayBrowser: showDayBrowserHandler,
  selectSpecificDay: selectSpecificDayHandler,
  showHoursForDay: showHoursForDayHandler,
  selectSpecificTime: selectSpecificTimeHandler,
  // Quote and booking handlers
  quoteSummary: quoteSummaryHandler,
  handleQuoteChoice: handleQuoteChoiceHandler,
  // User management handlers
  checkExistingUser: checkExistingUserHandler,
  handleUserStatus: handleUserStatusHandler,
  askUserName: askUserNameHandler,
  createNewUser: createNewUserHandler,
  // Other handlers
  askEmail: askEmailHandler,
  createBooking: createBookingHandler,
  displayConfirmedBooking: displayConfirmedBookingHandler,
};

// --- Helper function for step skipping ---
const skippableStepsForQuickBooking = [
  'showDayBrowser',
  'selectSpecificDay',
  'showHoursForDay',
  'selectSpecificTime',
];

const skippableStepsForExistingUser = [
  'handleUserStatus',
  'askUserName',
  'createNewUser',
];

function shouldSkipStep(stepName: string, goalData: Record<string, any>): boolean {
  if (!!goalData.quickBookingSelected && skippableStepsForQuickBooking.includes(stepName)) {
    return true;
  }
  if (!!goalData.existingUserFound && skippableStepsForExistingUser.includes(stepName)) {
    console.log(`[MessageProcessor] Skipping step for existing user: ${stepName}`);
    return true;
  }
  return false;
}

// --- Enhanced LLM Interface using Intelligent Service ---

// --- Message Processing Logic ---
class MessageProcessor {
  private llmService = new IntelligentLLMService();

  /**
   * Advances the goal's step index, skipping any steps that are not applicable
   * based on the current collected data (e.g., skipping browsing steps in a quick booking).
   */
  private advanceAndSkipStep(userCurrentGoal: UserGoal) {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    let nextStepName: string;
    
    do {
      userCurrentGoal.currentStepIndex++;
      if (userCurrentGoal.currentStepIndex < currentSteps.length) {
        nextStepName = currentSteps[userCurrentGoal.currentStepIndex];
        console.log(`[MessageProcessor] Advanced to step: ${nextStepName} (${userCurrentGoal.currentStepIndex})`);
      } else {
        // Reached the end of the flow
        nextStepName = ''; 
      }
    } while (nextStepName && shouldSkipStep(nextStepName, userCurrentGoal.collectedData));
  }

  /**
   * Generic smart navigation that adapts to any flow by analyzing step requirements
   */
  private navigateToAppropriateStep(userCurrentGoal: UserGoal): string {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const currentStepIndex = userCurrentGoal.currentStepIndex;
    const goalData = userCurrentGoal.collectedData;
    
    // Don't use smart navigation if user is in browse mode (wants to explore options)
    // BUT still check for skippable steps for existing users
    if (goalData.browseModeSelected) {
      console.log('[NavigateToAppropriateStep] Browse mode active - using normal sequential flow');
      let nextStepIndex = currentStepIndex + 1;
      
      // Even in browse mode, skip steps that should be skipped for existing users
      while (nextStepIndex < currentSteps.length && shouldSkipStep(currentSteps[nextStepIndex], goalData)) {
        console.log(`[NavigateToAppropriateStep] Skipping step in browse mode: ${currentSteps[nextStepIndex]}`);
        nextStepIndex++;
      }
      
      return currentSteps[nextStepIndex] || currentSteps[currentStepIndex];
    }
    
    // Check if we have all data needed for quote generation
    const hasCompleteBookingData = !!(
      goalData.selectedService && 
      goalData.selectedDate && 
      goalData.selectedTime && 
      goalData.finalServiceAddress &&
      goalData.userId
    );
    
    // If we have complete booking data, jump to quote step
    if (hasCompleteBookingData) {
      const quoteStepIndex = currentSteps.findIndex(step => 
        step.toLowerCase().includes('quote') && 
        step.toLowerCase().includes('summary')
      );
      
      if (quoteStepIndex !== -1 && quoteStepIndex > currentStepIndex) {
        console.log(`[MessageProcessor] Smart jump: Complete booking data detected, jumping to quoteSummary (${quoteStepIndex})`);
        return currentSteps[quoteStepIndex];
      }
    }
    
    // Standard navigation - find next step that needs data
    for (let i = currentStepIndex + 1; i < currentSteps.length; i++) {
      const stepName = currentSteps[i];
      
      // Skip steps that should be skipped
      if (shouldSkipStep(stepName, goalData)) {
        console.log(`[MessageProcessor] Skipping step: ${stepName}`);
        continue;
      }
      
      // Check if this step needs data that we don't have
      if (this.stepNeedsData(stepName, goalData)) {
        console.log(`[MessageProcessor] Smart navigation: Jumping to step ${stepName} (${i}) - this step still needs data`);
        return stepName;
      }
    }
    
    // If we get here, continue with normal flow
    return currentSteps[currentStepIndex + 1] || currentSteps[currentStepIndex];
  }

  /**
   * Generic check if a step needs data that we don't currently have
   * This works for any step in any flow by analyzing common data patterns
   */
  private stepNeedsData(stepName: string, collectedData: Record<string, any>): boolean {
    const stepLower = stepName.toLowerCase();
    
    // Service-related steps
    if (stepLower.includes('service') && !collectedData.selectedService) {
      return true;
    }
    
    // Address/location-related steps  
    if ((stepLower.includes('address') || stepLower.includes('location')) && 
        !collectedData.finalServiceAddress && !collectedData.customerAddress) {
      return true;
    }
    
    // Time/date-related steps
    if ((stepLower.includes('time') || stepLower.includes('date') || stepLower.includes('day') || stepLower.includes('hour')) && 
        (!collectedData.selectedDate || !collectedData.selectedTime)) {
      return true;
    }
    
    // User-related steps
    if ((stepLower.includes('user') || stepLower.includes('name')) && 
        !collectedData.userId && !collectedData.existingUserFound) {
      return true;
    }
    
    // Quote/summary steps need complete booking data
    if ((stepLower.includes('quote') || stepLower.includes('summary')) && 
        (!collectedData.selectedService || !collectedData.selectedDate || 
         !collectedData.selectedTime || !collectedData.finalServiceAddress)) {
      return true;
    }
    
    // If we can't determine, assume the step needs data (safer approach)
    return true;
  }

  /**
   * Maps LLM-suggested step names to actual blueprint step names (generic for any flow)
   */
  private mapToActualStep(suggestedStep: string, flowKey: string): string | undefined {
    const currentSteps = conversationFlowBlueprints[flowKey];
    
    // Direct match first
    if (currentSteps.includes(suggestedStep)) {
      return suggestedStep;
    }
    
    // Generic pattern matching based on step name content
    const suggestion = suggestedStep.toLowerCase();
    
    // Find steps in the current flow that match the intention
    for (const stepName of currentSteps) {
      const stepLower = stepName.toLowerCase();
      
      // Service-related intentions
      if ((suggestion.includes('service') || suggestion.includes('change service')) && 
          stepLower.includes('service')) {
        console.log(`[MessageProcessor] Mapped "${suggestedStep}" to "${stepName}" (service-related)`);
        return stepName;
      }
      
      // Time/date-related intentions
      if ((suggestion.includes('time') || suggestion.includes('date') || 
           suggestion.includes('when') || suggestion.includes('schedule')) && 
          (stepLower.includes('time') || stepLower.includes('date') || 
           stepLower.includes('day') || stepLower.includes('hour') || 
           stepLower.includes('available'))) {
        console.log(`[MessageProcessor] Mapped "${suggestedStep}" to "${stepName}" (time-related)`);
        return stepName;
      }
      
      // Address/location-related intentions
      if ((suggestion.includes('address') || suggestion.includes('location') || 
           suggestion.includes('where')) && 
          (stepLower.includes('address') || stepLower.includes('location'))) {
        console.log(`[MessageProcessor] Mapped "${suggestedStep}" to "${stepName}" (location-related)`);
        return stepName;
      }
      
      // User/name-related intentions
      if ((suggestion.includes('user') || suggestion.includes('name') || 
           suggestion.includes('details')) && 
          (stepLower.includes('user') || stepLower.includes('name'))) {
        console.log(`[MessageProcessor] Mapped "${suggestedStep}" to "${stepName}" (user-related)`);
        return stepName;
      }
      
      // Quote/summary-related intentions
      if ((suggestion.includes('quote') || suggestion.includes('summary') || 
           suggestion.includes('confirm') || suggestion.includes('review')) && 
          (stepLower.includes('quote') || stepLower.includes('summary'))) {
        console.log(`[MessageProcessor] Mapped "${suggestedStep}" to "${stepName}" (quote-related)`);
        return stepName;
      }
    }
    
    return undefined;
  }

  /**
   * Infers the correct step based on user intent when LLM suggestion doesn't match (generic for any flow)
   */
  private inferStepFromUserIntent(suggestedStep: string, flowKey: string): string | undefined {
    const currentSteps = conversationFlowBlueprints[flowKey];
    const lowerSuggestion = suggestedStep.toLowerCase();
    
    // Find the first step in the flow that matches the user's intent
    for (const stepName of currentSteps) {
      const stepLower = stepName.toLowerCase();
      
      // Time/date-related intent
      if ((lowerSuggestion.includes('date') || lowerSuggestion.includes('time') || 
           lowerSuggestion.includes('when') || lowerSuggestion.includes('schedule')) &&
          (stepLower.includes('time') || stepLower.includes('date') || 
           stepLower.includes('day') || stepLower.includes('hour') || 
           stepLower.includes('available'))) {
        console.log(`[MessageProcessor] Inferred step "${stepName}" for date/time change request`);
        return stepName;
      }
      
      // Service-related intent
      if (lowerSuggestion.includes('service') && stepLower.includes('service')) {
        console.log(`[MessageProcessor] Inferred step "${stepName}" for service change request`);
        return stepName;
      }
      
      // Address/location-related intent
      if ((lowerSuggestion.includes('address') || lowerSuggestion.includes('location') || 
           lowerSuggestion.includes('where')) &&
          (stepLower.includes('address') || stepLower.includes('location'))) {
        console.log(`[MessageProcessor] Inferred step "${stepName}" for address/location change request`);
        return stepName;
      }
      
      // User/name-related intent
      if ((lowerSuggestion.includes('user') || lowerSuggestion.includes('name') || 
           lowerSuggestion.includes('details')) &&
          (stepLower.includes('user') || stepLower.includes('name'))) {
        console.log(`[MessageProcessor] Inferred step "${stepName}" for user details change request`);
        return stepName;
      }
    }
    
    console.log(`[MessageProcessor] Could not infer step from: ${suggestedStep}`);
    return undefined;
  }

  /**
   * Navigates back to a specific step in the flow for editing purposes
   */
  private navigateBackToStep(userCurrentGoal: UserGoal, targetStepName: string) {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const targetStepIndex = currentSteps.indexOf(targetStepName);
    
    if (targetStepIndex !== -1) {
      userCurrentGoal.currentStepIndex = targetStepIndex;
      console.log(`[MessageProcessor] Navigated back to step: ${targetStepName} (${targetStepIndex})`);
      
      // Clear navigation flag and edit-related flags
      userCurrentGoal.collectedData.navigateBackTo = undefined;
      userCurrentGoal.collectedData.showEditOptions = false;
      
      // Generic data clearing based on step type (works for any flow)
      this.clearDataForStepType(userCurrentGoal.collectedData, targetStepName);
    } else {
      console.error(`[MessageProcessor] Target step not found in flow: ${targetStepName}`);
    }
  }

  /**
   * Clears appropriate data when navigating back to a step (generic for any flow)
   */
  private clearDataForStepType(collectedData: Record<string, any>, targetStepName: string) {
    const stepLower = targetStepName.toLowerCase();
    
    // Service-related steps - clear service and dependent data
    if (stepLower.includes('service')) {
      collectedData.selectedService = undefined;
      collectedData.finalServiceAddress = undefined;
      collectedData.serviceLocation = undefined;
      collectedData.bookingSummary = undefined;
      // Clear quote data since service changed
      collectedData.persistedQuote = undefined;
      collectedData.quoteId = undefined;
      console.log(`[MessageProcessor] Cleared service-related data for step: ${targetStepName}`);
    }
    
    // Time/date-related steps - clear timing data (but NOT for showAvailableTimes)
    if ((stepLower.includes('time') || stepLower.includes('date') || 
         stepLower.includes('day') || stepLower.includes('hour')) && 
        !stepLower.includes('show') && !stepLower.includes('available')) {
      collectedData.selectedDate = undefined;
      collectedData.selectedTime = undefined;
      collectedData.quickBookingSelected = undefined;
      collectedData.browseModeSelected = undefined;
      collectedData.next3AvailableSlots = undefined;
      collectedData.availableHours = undefined;
      collectedData.formattedAvailableHours = undefined;
      // Clear quote data since timing changed
      collectedData.persistedQuote = undefined;
      collectedData.quoteId = undefined;
      collectedData.bookingSummary = undefined;
      console.log(`[MessageProcessor] Cleared time/date-related data for step: ${targetStepName}`);
    }
    
    // Address/location-related steps - clear location data
    if (stepLower.includes('address') || stepLower.includes('location')) {
      collectedData.finalServiceAddress = undefined;
      collectedData.serviceLocation = undefined;
      collectedData.customerAddress = undefined;
      // Clear quote data since location might affect pricing
      collectedData.persistedQuote = undefined;
      collectedData.quoteId = undefined;
      collectedData.bookingSummary = undefined;
      console.log(`[MessageProcessor] Cleared address/location-related data for step: ${targetStepName}`);
    }
    
    // User-related steps - clear user data
    if (stepLower.includes('user') || stepLower.includes('name')) {
      collectedData.userId = undefined;
      collectedData.existingUserFound = undefined;
      collectedData.customerName = undefined;
      console.log(`[MessageProcessor] Cleared user-related data for step: ${targetStepName}`);
    }
  }



  // Converts database models to internal session format
  private convertToInternalSession(historyAndContext: any, participant: ConversationalParticipant): ChatConversationSession {
    // Convert ChatMessage[] to our internal UserGoal format
    const activeGoals: UserGoal[] = [];
    
    // If there's a current goal in the user context that's still in progress, reconstruct it
    if (historyAndContext.userContext.currentGoal && historyAndContext.userContext.currentGoal.goalStatus === 'inProgress') {
      const currentGoal = historyAndContext.userContext.currentGoal;
      
      // Convert message history from ChatMessage[] to our internal format
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
      console.log(`[ConvertToInternalSession] Restored in-progress goal: ${currentGoal.goalType} at step ${currentGoal.currentStepIndex}`);
    } else if (historyAndContext.userContext.currentGoal) {
      console.log(`[ConvertToInternalSession] Found completed/failed goal, not restoring to active goals`);
    } else {
      console.log(`[ConvertToInternalSession] No current goal found, ready for new conversation`);
    }

    return {
      id: historyAndContext.currentSessionId,
      participantId: participant.id,
      participantType: participant.type,
      activeGoals: activeGoals,
      sessionStartTimestamp: new Date(), // This could be improved with actual session start time
      lastMessageTimestamp: new Date(),
      sessionStatus: 'active' as const,
      communicationChannel: 'whatsapp' as const,
      sessionMetadata: {
        languagePreference: historyAndContext.userContext.participantPreferences?.language || BOT_CONFIG.DEFAULT_LANGUAGE
      }
    };
  }

  // Gets or creates chat context for a participant using database persistence
  private async getOrCreateChatContext(participant: ConversationalParticipant): Promise<{context: ChatContext, sessionId: string, userContext: UserContext, customerUser?: any}> {
    console.log(`[MessageProcessor] Building context for participant: ${participant.id}`);

    // Dynamically find the business ID - LENIENT like old mock storage
    let associatedBusinessId: string | undefined;
    if (participant.businessWhatsappNumber) {
        let business = await Business.getByWhatsappNumber(participant.businessWhatsappNumber);
        
        if (!business) {
            // If direct lookup fails, just use the first available business (like old mock storage)
            const allBusinesses = await Business.getAll();
            if (allBusinesses.length > 0) {
                business = allBusinesses[0]; // Just use first business - lenient like before
            }
        }
        
        if (business && business.id) {
            associatedBusinessId = business.id;
        } else {
            // Even if no business found, continue with a default ID (like old mock storage did)
            associatedBusinessId = undefined; // Let it continue without business ID
        }
    }

    // Look up customer user information for name context
    let customerUser: any = undefined;
    if (participant.customerWhatsappNumber && participant.type === 'customer') {
        try {
            const { User } = await import('../database/models/user');
            customerUser = await User.findUserByCustomerWhatsappNumber(participant.customerWhatsappNumber);
            if (customerUser) {
                console.log(`[MessageProcessor] Found customer user: ${customerUser.firstName} ${customerUser.lastName}`);
            } else {
                console.log(`[MessageProcessor] No customer user found for WhatsApp: ${participant.customerWhatsappNumber}`);
            }
        } catch (error) {
            console.error(`[MessageProcessor] Error looking up customer user:`, error);
        }
    }

    const participantWithBusinessId: ConversationalParticipant = {
      ...participant,
      associatedBusinessId: associatedBusinessId,
      businessWhatsappNumber: participant.businessWhatsappNumber,
      customerWhatsappNumber: participant.customerWhatsappNumber
    };

    // Use the persistence layer to get session history and context - LENIENT like old mock storage
    let historyAndContext;
    if (associatedBusinessId) {
      historyAndContext = await extractSessionHistoryAndContext(
        'whatsapp', // channel
        participant.customerWhatsappNumber || participant.id, // channelUserId 
        associatedBusinessId, // businessId
        BOT_CONFIG.SESSION_TIMEOUT_HOURS, // sessionTimeoutHours
        {
          // Don't pass userId since we don't have a proper user UUID mapping yet
          // The channelUserId (phone number) is sufficient for session management
        }
      );
    } else {
      // No business ID found - create minimal mock-like context (like old system)
      historyAndContext = null;
    }

    if (!historyAndContext) {
      // Create a minimal mock-like response when persistence fails (like old mock storage)
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

    // Convert database models to our internal format
    const currentSession = this.convertToInternalSession(historyAndContext, participantWithBusinessId);
    
    // Convert frequentlyDiscussedTopics from comma-separated string to array
    const frequentlyDiscussedTopics = historyAndContext.userContext.frequentlyDiscussedTopics
      ? historyAndContext.userContext.frequentlyDiscussedTopics.split(', ').filter(topic => topic.trim() !== '')
      : ['general queries', 'booking help'];
    
    const context: ChatContext = {
      currentParticipant: participantWithBusinessId,
      currentConversationSession: currentSession,
      previousConversationSession: undefined, // Previous sessions are already included in history
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
      customerUser
    };
  }

  // Creates a new goal when intention is detected
  private async createNewGoal(detectionResult: LLMProcessingResult, participantType: ConversationalParticipantType, context: ChatContext): Promise<UserGoal> {
    // Determine the correct flow to use
    let flowKey: string;
    let servicesData: any[] = [];
    
    if (participantType === 'customer' && detectionResult.detectedUserGoalType === 'serviceBooking' && detectionResult.detectedGoalAction === 'create') {
      // Check if business has mobile services upfront
      const businessId = context.currentParticipant.associatedBusinessId;
      if (businessId) {
        try {
          const { Service } = await import('../database/models/service');
          const services = await Service.getByBusiness(businessId);
          servicesData = services.map(s => s.getData());
          const hasMobileServices = servicesData.some((service: any) => service.mobile === true);
          flowKey = hasMobileServices ? 'bookingCreatingForMobileService' : 'bookingCreatingForNoneMobileService';
        } catch (error) {
          console.error('Error loading services for flow determination:', error);
          flowKey = 'bookingCreatingForMobileService'; // Default fallback
        }
      } else {
        flowKey = 'bookingCreatingForMobileService'; // Default fallback
      }
    } else if (participantType === 'customer' && detectionResult.detectedUserGoalType === 'frequentlyAskedQuestion') {
      flowKey = 'customerFaqHandling';
    } else if (participantType === 'business' && detectionResult.detectedUserGoalType === 'accountManagement') {
      flowKey = detectionResult.detectedGoalAction === 'create' ? 'businessAccountCreation' : 'businessAccountDeletion';
    } else {
      throw new Error(`No flow found for: ${participantType}-${detectionResult.detectedUserGoalType}-${detectionResult.detectedGoalAction || 'none'}`);
    }
    
    return {
      goalType: detectionResult.detectedUserGoalType!,
      goalAction: detectionResult.detectedGoalAction,
      goalStatus: 'inProgress',
      currentStepIndex: 0,
      collectedData: { 
        ...detectionResult.extractedInformation,
        availableServices: servicesData // Store services data from the start
      },
      messageHistory: [],
      flowKey
    };
  }

  // Executes the first step of a new goal immediately
  private async executeFirstStep(
    userCurrentGoal: UserGoal, 
    currentContext: ChatContext, 
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    if (!currentSteps || !currentSteps[userCurrentGoal.currentStepIndex]) {
      throw new Error('No handler found for first step');
    }

    const stepName = currentSteps[userCurrentGoal.currentStepIndex];
    const firstStepHandler = botTasks[stepName];
    
    if (!firstStepHandler) {
      throw new Error('No handler found for first step');
    }

    // Execute the first step immediately to display initial information
    const processingResult = await firstStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
    userCurrentGoal.collectedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult ?
                                    { ...userCurrentGoal.collectedData, ...processingResult.extractedInformation } :
                                    processingResult as Record<string, any>;

    // Check if this step should auto-advance
    if (firstStepHandler.autoAdvance) {
      console.log(`[MessageProcessor] Auto-advancing from step: ${stepName}`);
      this.advanceAndSkipStep(userCurrentGoal);
      
      // Check if flow is completed
      if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
        userCurrentGoal.goalStatus = 'completed';
        const responseToUser = "Great! Your booking request has been processed.";
        const uiButtonsToDisplay = undefined;
        
        userCurrentGoal.messageHistory.push({ speakerRole: 'user', content: incomingUserMessage, messageTimestamp: new Date() });
        userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
        
        return { responseToUser, uiButtonsToDisplay };
      } else {
        // Process the next step automatically
        return await this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
      }
    }

    // Show the first step's prompt and buttons
    const responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                          firstStepHandler.defaultChatbotPrompt || 
                          "Let's get started with your booking.";
    
    let uiButtonsToDisplay: ButtonConfig[] | undefined;
    if (firstStepHandler.fixedUiButtons) {
      if (typeof firstStepHandler.fixedUiButtons === 'function') {
        uiButtonsToDisplay = await firstStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
    } else {
        uiButtonsToDisplay = firstStepHandler.fixedUiButtons;
      }
    }

    userCurrentGoal.messageHistory.push({ speakerRole: 'user', content: incomingUserMessage, messageTimestamp: new Date() });
    userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });

    return { responseToUser, uiButtonsToDisplay };
  }

  // Executes auto-advance steps
  private async executeAutoAdvanceStep(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const stepName = currentSteps[userCurrentGoal.currentStepIndex];
    const stepHandler = botTasks[stepName];

    if (!stepHandler) {
      throw new Error(`No handler found for auto-advance step: ${stepName}`);
    }

    // Execute the step
    const processingResult = await stepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
    userCurrentGoal.collectedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult ?
                                    { ...userCurrentGoal.collectedData, ...processingResult.extractedInformation } :
                                    processingResult as Record<string, any>;

    const shouldConditionallyAdvance = userCurrentGoal.collectedData.shouldAutoAdvance;

    // Check if this step should also auto-advance
    if ((stepHandler.autoAdvance || shouldConditionallyAdvance) && userCurrentGoal.currentStepIndex + 1 < currentSteps.length) {
      console.log(`[MessageProcessor] Auto-advancing from step: ${stepName}`);
      
      // Reset the flag after using it to prevent infinite loops
      if (shouldConditionallyAdvance) {
        userCurrentGoal.collectedData.shouldAutoAdvance = false;
      }
      
      const targetStep = this.navigateToAppropriateStep(userCurrentGoal);
      const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
      const targetStepIndex = currentSteps.indexOf(targetStep);
      if (targetStepIndex !== -1) {
        userCurrentGoal.currentStepIndex = targetStepIndex;
      } else {
        this.advanceAndSkipStep(userCurrentGoal);
      }
      return await this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
    }

    // Show the step's response
    const responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                          stepHandler.defaultChatbotPrompt || 
                          "Continuing with your booking...";
    
    let uiButtonsToDisplay: ButtonConfig[] | undefined;
    if (stepHandler.fixedUiButtons) {
      if (typeof stepHandler.fixedUiButtons === 'function') {
        uiButtonsToDisplay = await stepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
      } else {
        uiButtonsToDisplay = stepHandler.fixedUiButtons;
      }
    }

    return { responseToUser, uiButtonsToDisplay };
  }

  // Enhanced goal processing with intelligent analysis while preserving blueprint flow
  private async processExistingGoalIntelligent(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string,
    customerUser?: {firstName: string, lastName: string, id: string}
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    console.log(`[MessageProcessor] Processing existing goal with intelligent enhancement`);
    
    // Check if this is a known button value - if so, skip LLM analysis and use original flow
    const knownButtonValues = [
      'choose_another_day', 'open_calendar', 'confirm_quote', 'edit_quote', 
      'edit_service', 'edit_time', 'tomorrow_7am', 'tomorrow_9am'
    ];
    
    const isButtonClick = knownButtonValues.includes(incomingUserMessage) || 
                         incomingUserMessage.startsWith('slot_') || 
                         incomingUserMessage.startsWith('day_') ||
                         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incomingUserMessage);

    if (isButtonClick) {
      console.log(`[MessageProcessor] Detected button click: "${incomingUserMessage}" - using original blueprint flow`);
      return this.processOriginalFlowWithIntelligentEnhancement(
        userCurrentGoal, 
        currentContext, 
        incomingUserMessage,
        undefined,
        customerUser
      );
    }
    
    // Prepare message history for LLM analysis
    const messageHistory = userCurrentGoal.messageHistory.map(msg => ({
      role: msg.speakerRole === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content,
      timestamp: msg.messageTimestamp
    }));

    try {
      // Analyze conversation flow decision with LLM
      const conversationDecision = await this.llmService.analyzeConversationFlow(
        incomingUserMessage,
        userCurrentGoal,
        currentContext,
        messageHistory
      );

      console.log(`[MessageProcessor] Intelligent analysis:`, conversationDecision);

      // Handle special navigation requests ONLY
      if (conversationDecision.action === 'go_back' && conversationDecision.confidence > 0.7) {
        return this.handleGoBack(userCurrentGoal, currentContext, conversationDecision, customerUser);
      }
      
      if (conversationDecision.action === 'restart' && conversationDecision.confidence > 0.8) {
        return this.handleRestart(userCurrentGoal, currentContext);
      }
      
      if (conversationDecision.action === 'switch_topic' && conversationDecision.confidence > 0.8) {
        return this.handleTopicSwitch(currentContext, conversationDecision, incomingUserMessage);
      }

      // For all other cases (continue/advance), use original blueprint flow with intelligent enhancement
      return this.processOriginalFlowWithIntelligentEnhancement(
        userCurrentGoal, 
        currentContext, 
        incomingUserMessage, 
        conversationDecision,
        customerUser
      );

    } catch (error) {
      console.error(`[MessageProcessor] LLM analysis failed, falling back to original flow:`, error);
      // Fallback to original processing if LLM fails
      return this.processExistingGoal(userCurrentGoal, currentContext, incomingUserMessage);
    }
  }

  // Handles when user wants to go back and change something
  private async handleGoBack(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    conversationDecision: any,
    customerUser?: {firstName: string, lastName: string, id: string}
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    console.log(`[MessageProcessor] Handling go_back request`);
    
    // Map LLM suggested steps to actual blueprint steps
    let actualTargetStep: string | undefined;
    
    if (conversationDecision.targetStep) {
      actualTargetStep = this.mapToActualStep(conversationDecision.targetStep, userCurrentGoal.flowKey);
    }

    // If we have a valid target step, navigate there
    if (actualTargetStep) {
      this.navigateBackToStep(userCurrentGoal, actualTargetStep);
    } else if (conversationDecision.targetStep) {
      // LLM suggested a step but it doesn't exist - try to infer from the suggestion
      actualTargetStep = this.inferStepFromUserIntent(conversationDecision.targetStep, userCurrentGoal.flowKey);
      if (actualTargetStep) {
        this.navigateBackToStep(userCurrentGoal, actualTargetStep);
      } else {
        // Default: go back one step if possible
        if (userCurrentGoal.currentStepIndex > 0) {
          userCurrentGoal.currentStepIndex--;
        }
      }
    } else {
      // Default: go back one step if possible
      if (userCurrentGoal.currentStepIndex > 0) {
        userCurrentGoal.currentStepIndex--;
      }
    }

    // Now execute the target step to show the actual content/buttons
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const targetStepName = currentSteps[userCurrentGoal.currentStepIndex];
    const targetStepHandler = botTasks[targetStepName];
    
    console.log(`[MessageProcessor] Executing target step after go_back: ${targetStepName}`);

    if (targetStepHandler) {
      // Execute the target step's processAndExtractData to get the actual content
      const targetStepResult = await targetStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
      userCurrentGoal.collectedData = typeof targetStepResult === 'object' && 'extractedInformation' in targetStepResult ?
                                      { ...userCurrentGoal.collectedData, ...targetStepResult.extractedInformation } :
                                      targetStepResult as Record<string, any>;
      
      // Generate contextual response for going back
      let responseToUser: string;
      try {
        const contextualResponse = await this.llmService.generateContextualResponse(
          userCurrentGoal,
          currentContext,
          'User wants to go back and change something',
          conversationDecision,
          userCurrentGoal.messageHistory.map(msg => ({
            role: msg.speakerRole === 'user' ? 'user' as const : 'assistant' as const,
            content: msg.content,
            timestamp: msg.messageTimestamp
          })),
          customerUser
        );
        responseToUser = contextualResponse.text;
      } catch (error) {
        console.error(`[MessageProcessor] LLM response generation failed for go_back:`, error);
        responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                        targetStepHandler.defaultChatbotPrompt || 
                        "Let's update your selection.";
      }
      
      // Get the actual buttons from the target step handler
      let uiButtonsToDisplay: ButtonConfig[] | undefined;
      if (targetStepHandler.fixedUiButtons) {
        if (typeof targetStepHandler.fixedUiButtons === 'function') {
          uiButtonsToDisplay = await targetStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
        } else {
          uiButtonsToDisplay = targetStepHandler.fixedUiButtons;
        }
      }

      return {
        responseToUser,
        uiButtonsToDisplay
      };
    } else {
      console.error(`[MessageProcessor] No handler found for target step: ${targetStepName}`);
      return {
        responseToUser: "Something went wrong while navigating back. Please try again.",
        uiButtonsToDisplay: []
      };
    }
  }

  // Handles when user wants to restart the conversation
  private async handleRestart(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    console.log(`[MessageProcessor] Handling restart request`);
    
    // Reset goal to beginning
    userCurrentGoal.currentStepIndex = 0;
    userCurrentGoal.collectedData = {
      availableServices: userCurrentGoal.collectedData.availableServices // Keep services data
    };

    // Execute first step
    return this.executeFirstStep(userCurrentGoal, currentContext, "restart");
  }

  // Handles when user switches to a completely different topic
  private async handleTopicSwitch(
    currentContext: ChatContext,
    conversationDecision: any,
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    console.log(`[MessageProcessor] Handling topic switch to: ${conversationDecision.newGoalType}`);
    
    // This will be handled by creating a new goal in the main processing logic
    // For now, return a response indicating we understand the topic change
    return {
      responseToUser: "I understand you'd like to switch topics. Let me help you with that.",
      uiButtonsToDisplay: []
    };
  }

  // Enhanced original flow that preserves all blueprint steps and buttons but adds intelligent responses
  private async processOriginalFlowWithIntelligentEnhancement(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string,
    conversationDecision?: any,
    customerUser?: {firstName: string, lastName: string, id: string}
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    console.log(`[MessageProcessor] Processing original blueprint flow with intelligent enhancement`);
    
    // Add user message to goal history
    userCurrentGoal.messageHistory.push({ 
      speakerRole: 'user', 
      content: incomingUserMessage, 
      messageTimestamp: new Date() 
    });

    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    if (!currentSteps || !currentSteps[userCurrentGoal.currentStepIndex]) {
      throw new Error('No handler found for current step');
    }

    const stepName = currentSteps[userCurrentGoal.currentStepIndex];
    const currentStepHandler = botTasks[stepName];

    console.log(`[MessageProcessor] Current step: ${stepName} (${userCurrentGoal.currentStepIndex})`);
    console.log(`[MessageProcessor] Processing user input: "${incomingUserMessage}"`);

    if (!currentStepHandler) {
      throw new Error('No handler found for current step');
    }

    // === ORIGINAL VALIDATION LOGIC ===
    const validationResult = await currentStepHandler.validateUserInput(incomingUserMessage, userCurrentGoal.collectedData, currentContext);
    const isInputValid = typeof validationResult === 'boolean' ? validationResult : validationResult.isValidInput || false;
    const specificValidationError = typeof validationResult === 'object' ? validationResult.validationErrorMessage : undefined;
    const transformedInput = typeof validationResult === 'object' ? validationResult.transformedInput : undefined;

    let responseToUser: string;
    let uiButtonsToDisplay: ButtonConfig[] | undefined;

    if (isInputValid) {
      // === ENHANCED PROCESSING LOGIC - Use transformed input if available ===
      const inputToProcess = transformedInput || incomingUserMessage;
      console.log(`[MessageProcessor] Processing input: "${inputToProcess}" ${transformedInput ? '(transformed from: "' + incomingUserMessage + '")' : ''}`);
      const processingResult = await currentStepHandler.processAndExtractData(inputToProcess, userCurrentGoal.collectedData, currentContext);
      userCurrentGoal.collectedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult ?
                                      { ...userCurrentGoal.collectedData, ...processingResult.extractedInformation } :
                                      processingResult as Record<string, any>;

      // === ORIGINAL SPECIAL HANDLING LOGIC ===
      // Handle restart booking flow
      if (userCurrentGoal.collectedData.restartBookingFlow) {
        return this.handleOriginalRestartFlow(userCurrentGoal, currentContext);
      }

      // Handle navigate back
      if (userCurrentGoal.collectedData.navigateBackTo) {
        return this.handleOriginalNavigateBack(userCurrentGoal, currentContext);
      }

      // === SMART NAVIGATION STEP ADVANCEMENT ===
      const targetStep = this.navigateToAppropriateStep(userCurrentGoal);
      const targetStepIndex = currentSteps.indexOf(targetStep);
      if (targetStepIndex !== -1) {
        userCurrentGoal.currentStepIndex = targetStepIndex;
      } else {
        this.advanceAndSkipStep(userCurrentGoal);
      }
      
      // Check if flow is completed
      if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
        userCurrentGoal.goalStatus = 'completed';
        responseToUser = "Great! Your booking request has been processed.";
        uiButtonsToDisplay = undefined;
      } else {
        // === ORIGINAL NEXT STEP EXECUTION ===
        const nextStepName = currentSteps[userCurrentGoal.currentStepIndex];
        const nextStepHandler = botTasks[nextStepName];
        if (nextStepHandler) {
          console.log(`[MessageProcessor] Executing next step: ${nextStepName}`);
          
          const nextStepResult = await nextStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
          userCurrentGoal.collectedData = typeof nextStepResult === 'object' && 'extractedInformation' in nextStepResult ?
                                          { ...userCurrentGoal.collectedData, ...nextStepResult.extractedInformation } :
                                          nextStepResult as Record<string, any>;
          
          // === ORIGINAL AUTO-ADVANCE LOGIC ===
          if (nextStepHandler.autoAdvance || userCurrentGoal.collectedData.shouldAutoAdvance) {
            console.log(`[MessageProcessor] Auto-advancing from step: ${nextStepName}`);
            if (userCurrentGoal.collectedData.shouldAutoAdvance) {
                userCurrentGoal.collectedData.shouldAutoAdvance = false;
            }
            const targetStep = this.navigateToAppropriateStep(userCurrentGoal);
            const targetStepIndex = currentSteps.indexOf(targetStep);
            if (targetStepIndex !== -1) {
              userCurrentGoal.currentStepIndex = targetStepIndex;
            } else {
              this.advanceAndSkipStep(userCurrentGoal);
            }
            
            if (userCurrentGoal.currentStepIndex < currentSteps.length) {
              const autoAdvanceResult = await this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
              responseToUser = autoAdvanceResult.responseToUser;
              uiButtonsToDisplay = autoAdvanceResult.uiButtonsToDisplay;
            } else {
              userCurrentGoal.goalStatus = 'completed';
              responseToUser = "Great! Your booking request has been processed.";
              uiButtonsToDisplay = undefined;
            }
          } else {
            // === ENHANCED: Use intelligent response generation while keeping original buttons ===
            try {
              if (conversationDecision) {
                const contextualResponse = await this.llmService.generateContextualResponse(
                  userCurrentGoal,
                  currentContext,
                  incomingUserMessage,
                  conversationDecision,
                  userCurrentGoal.messageHistory.map(msg => ({
                    role: msg.speakerRole === 'user' ? 'user' as const : 'assistant' as const,
                    content: msg.content,
                    timestamp: msg.messageTimestamp
                  })),
                  customerUser
                );
                responseToUser = contextualResponse.text;
              } else {
                // Fallback to original response
                responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                                nextStepHandler.defaultChatbotPrompt || 
                                "Let's continue with your booking.";
              }
            } catch (error) {
              console.error(`[MessageProcessor] LLM response generation failed, using original:`, error);
              responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                              nextStepHandler.defaultChatbotPrompt || 
                              "Let's continue with your booking.";
            }
            
            // === ALWAYS USE ORIGINAL BUTTONS ===
            if (nextStepHandler.fixedUiButtons) {
              try {
                if (typeof nextStepHandler.fixedUiButtons === 'function') {
                  uiButtonsToDisplay = await nextStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
                  console.log(`[MessageProcessor] Generated ${uiButtonsToDisplay?.length || 0} buttons for next step`);
                } else {
                  uiButtonsToDisplay = nextStepHandler.fixedUiButtons;
                  console.log(`[MessageProcessor] Using fixed buttons for next step`);
                }
              } catch (error) {
                console.error(`[MessageProcessor] Error generating buttons for next step:`, error);
                uiButtonsToDisplay = [];
              }
            }
          }
        } else {
          responseToUser = "Something went wrong with the booking flow.";
        }
      }
    } else {
      // === ENHANCED VALIDATION FAILURE HANDLING ===
      // Check if this is an off-topic question that should be handled intelligently
      if (conversationDecision && 
          (conversationDecision.action === 'continue' || conversationDecision.action === 'switch_topic') && 
          conversationDecision.confidence > 0.7) {
        console.log(`[MessageProcessor] Off-topic question detected (${conversationDecision.action}) - providing intelligent response`);
        try {
          const contextualResponse = await this.llmService.generateContextualResponse(
            userCurrentGoal,
            currentContext,
            incomingUserMessage,
            conversationDecision,
            userCurrentGoal.messageHistory.map(msg => ({
              role: msg.speakerRole === 'user' ? 'user' as const : 'assistant' as const,
              content: msg.content,
              timestamp: msg.messageTimestamp
            })),
            customerUser
          );
          responseToUser = contextualResponse.text;
          
          // Show current step buttons to continue the booking flow
          if (currentStepHandler.fixedUiButtons) {
            try {
              if (typeof currentStepHandler.fixedUiButtons === 'function') {
                uiButtonsToDisplay = await currentStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
                console.log(`[MessageProcessor] Generated ${uiButtonsToDisplay?.length || 0} buttons for off-topic response`);
                              } else {
                  uiButtonsToDisplay = currentStepHandler.fixedUiButtons;
                  console.log(`[MessageProcessor] Using fixed buttons for off-topic response`);
                }
            } catch (error) {
              console.error(`[MessageProcessor] Error generating buttons for off-topic response:`, error);
              uiButtonsToDisplay = [];
            }
          } else {
            console.log(`[MessageProcessor] No buttons available for current step: ${stepName}`);
          }
        } catch (error) {
          console.error(`[MessageProcessor] LLM response generation failed for off-topic question:`, error);
          responseToUser = "I'd be happy to help with that, but let's focus on completing your booking first.";
          
          if (currentStepHandler.fixedUiButtons) {
            if (typeof currentStepHandler.fixedUiButtons === 'function') {
              uiButtonsToDisplay = await currentStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
            } else {
              uiButtonsToDisplay = currentStepHandler.fixedUiButtons;
            }
          }
        }
      } else if (specificValidationError === '' || !specificValidationError) {
        console.log(`[MessageProcessor] Validation failed with empty error - advancing to next step`);
        return this.handleOriginalEmptyValidationError(userCurrentGoal, currentContext, incomingUserMessage);
      } else {
        // === ENHANCED: Use intelligent response for validation errors while keeping original buttons ===
        try {
          if (conversationDecision) {
            const contextualResponse = await this.llmService.generateContextualResponse(
              userCurrentGoal,
              currentContext,
              incomingUserMessage,
              { ...conversationDecision, action: 'continue' },
              userCurrentGoal.messageHistory.map(msg => ({
                role: msg.speakerRole === 'user' ? 'user' as const : 'assistant' as const,
                content: msg.content,
                timestamp: msg.messageTimestamp
              })),
              customerUser
            );
            responseToUser = contextualResponse.text || specificValidationError;
          } else {
            responseToUser = specificValidationError;
          }
        } catch (error) {
          console.error(`[MessageProcessor] LLM error response generation failed:`, error);
          responseToUser = specificValidationError || "I didn't understand that. Could you please try again?";
        }
        
        // === ALWAYS USE ORIGINAL BUTTONS ===
        if (currentStepHandler.fixedUiButtons) {
          try {
            if (typeof currentStepHandler.fixedUiButtons === 'function') {
              uiButtonsToDisplay = await currentStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
              console.log(`[MessageProcessor] Generated ${uiButtonsToDisplay?.length || 0} buttons for validation error response`);
            } else {
              uiButtonsToDisplay = currentStepHandler.fixedUiButtons;
              console.log(`[MessageProcessor] Using fixed buttons for validation error response`);
            }
          } catch (error) {
            console.error(`[MessageProcessor] Error generating buttons for validation error:`, error);
            uiButtonsToDisplay = [];
          }
        }
      }
    }

    userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
    return { responseToUser, uiButtonsToDisplay };
  }

  // Helper methods for original flow logic
  private async handleOriginalRestartFlow(userCurrentGoal: UserGoal, currentContext: ChatContext) {
    console.log(`[MessageProcessor] Handling original restart booking flow`);
    const selectedService = userCurrentGoal.collectedData.selectedService;
    let targetStep: string;
    
    if (selectedService?.mobile) {
      targetStep = 'askAddress';
    } else {
      targetStep = 'confirmLocation';
    }
    
    userCurrentGoal.collectedData.restartBookingFlow = false;
    this.navigateBackToStep(userCurrentGoal, targetStep);
    
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const targetStepName = currentSteps[userCurrentGoal.currentStepIndex];
    const targetStepHandler = botTasks[targetStepName];
    
    if (targetStepHandler) {
      const targetStepResult = await targetStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
      userCurrentGoal.collectedData = typeof targetStepResult === 'object' && 'extractedInformation' in targetStepResult ?
                                      { ...userCurrentGoal.collectedData, ...targetStepResult.extractedInformation } :
                                      targetStepResult as Record<string, any>;
      
      const responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                      targetStepHandler.defaultChatbotPrompt || 
                      "Let's continue with your new service selection.";
      
      let uiButtonsToDisplay: ButtonConfig[] | undefined;
      if (targetStepHandler.fixedUiButtons) {
        if (typeof targetStepHandler.fixedUiButtons === 'function') {
          uiButtonsToDisplay = await targetStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
        } else {
          uiButtonsToDisplay = targetStepHandler.fixedUiButtons;
        }
      }
      
      userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
      return { responseToUser, uiButtonsToDisplay };
    } else {
      const responseToUser = "Something went wrong while restarting the booking. Please try again.";
      userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
      return { responseToUser };
    }
  }

  private async handleOriginalNavigateBack(userCurrentGoal: UserGoal, currentContext: ChatContext) {
    const targetStep = userCurrentGoal.collectedData.navigateBackTo as string;
    console.log(`[MessageProcessor] Handling original navigate back to: ${targetStep}`);
    
    this.navigateBackToStep(userCurrentGoal, targetStep);
    
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const targetStepName = currentSteps[userCurrentGoal.currentStepIndex];
    const targetStepHandler = botTasks[targetStepName];
    
    if (targetStepHandler) {
      const targetStepResult = await targetStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
      userCurrentGoal.collectedData = typeof targetStepResult === 'object' && 'extractedInformation' in targetStepResult ?
                                      { ...userCurrentGoal.collectedData, ...targetStepResult.extractedInformation } :
                                      targetStepResult as Record<string, any>;
      
      const responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                      targetStepHandler.defaultChatbotPrompt || 
                      "Let's update your selection.";
      
      let uiButtonsToDisplay: ButtonConfig[] | undefined;
      if (targetStepHandler.fixedUiButtons) {
        if (typeof targetStepHandler.fixedUiButtons === 'function') {
          uiButtonsToDisplay = await targetStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
        } else {
          uiButtonsToDisplay = targetStepHandler.fixedUiButtons;
        }
      }
      
      userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
      return { responseToUser, uiButtonsToDisplay };
    } else {
      const responseToUser = "Something went wrong while navigating back. Please try again.";
      userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
      return { responseToUser };
    }
  }

  private async handleOriginalEmptyValidationError(userCurrentGoal: UserGoal, currentContext: ChatContext, incomingUserMessage: string) {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    this.advanceAndSkipStep(userCurrentGoal);
    
    if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
      userCurrentGoal.goalStatus = 'completed';
      const responseToUser = "Great! Your booking request has been processed.";
      userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
      return { responseToUser };
    } else {
      const nextStepName = currentSteps[userCurrentGoal.currentStepIndex];
      const nextStepHandler = botTasks[nextStepName];
      if (nextStepHandler) {
        console.log(`[MessageProcessor] Processing user input "${incomingUserMessage}" with next step: ${nextStepName}`);
        
        const nextValidationResult = await nextStepHandler.validateUserInput(incomingUserMessage, userCurrentGoal.collectedData, currentContext);
        const nextIsInputValid = typeof nextValidationResult === 'boolean' ? nextValidationResult : nextValidationResult.isValidInput || false;
        
        if (nextIsInputValid) {
          const nextStepResult = await nextStepHandler.processAndExtractData(incomingUserMessage, userCurrentGoal.collectedData, currentContext);
          userCurrentGoal.collectedData = typeof nextStepResult === 'object' && 'extractedInformation' in nextStepResult ?
                                          { ...userCurrentGoal.collectedData, ...nextStepResult.extractedInformation } :
                                          nextStepResult as Record<string, any>;
          
          if (nextStepHandler.autoAdvance || userCurrentGoal.collectedData.shouldAutoAdvance) {
            console.log(`[MessageProcessor] Auto-advancing from step: ${nextStepName}`);
            if (userCurrentGoal.collectedData.shouldAutoAdvance) {
                userCurrentGoal.collectedData.shouldAutoAdvance = false;
            }
            this.advanceAndSkipStep(userCurrentGoal);
            
            if (userCurrentGoal.currentStepIndex < currentSteps.length) {
              const autoAdvanceResult = await this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
              userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: autoAdvanceResult.responseToUser, messageTimestamp: new Date() });
              return autoAdvanceResult;
            } else {
              userCurrentGoal.goalStatus = 'completed';
              const responseToUser = "Great! Your booking request has been processed.";
              userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
              return { responseToUser };
            }
          } else {
            const responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                            nextStepHandler.defaultChatbotPrompt || 
                            "Let's continue with your booking.";
            
            let uiButtonsToDisplay: ButtonConfig[] | undefined;
            if (nextStepHandler.fixedUiButtons) {
              if (typeof nextStepHandler.fixedUiButtons === 'function') {
                uiButtonsToDisplay = await nextStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
              } else {
                uiButtonsToDisplay = nextStepHandler.fixedUiButtons;
              }
            }
            
            userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
            return { responseToUser, uiButtonsToDisplay };
          }
        } else {
          const responseToUser = "I didn't understand that. Could you please try again?";
          userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
          return { responseToUser };
        }
      } else {
        const responseToUser = "Something went wrong with the booking flow.";
        userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
        return { responseToUser };
      }
    }
  }

  // Original method for backward compatibility and fallback
  private async processExistingGoal(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    if (!currentSteps || !currentSteps[userCurrentGoal.currentStepIndex]) {
      throw new Error('No handler found for current step');
    }

    const stepName = currentSteps[userCurrentGoal.currentStepIndex];
    const currentStepHandler = botTasks[stepName];

    console.log(`[MessageProcessor] Current step index: ${userCurrentGoal.currentStepIndex}`);
    console.log(`[MessageProcessor] Current step name: ${stepName}`);
    console.log(`[MessageProcessor] Processing user input: "${incomingUserMessage}"`);

    if (!currentStepHandler) {
      throw new Error('No handler found for current step');
    }

    userCurrentGoal.messageHistory.push({ speakerRole: 'user', content: incomingUserMessage, messageTimestamp: new Date() });

    // Validate user input
    const validationResult = await currentStepHandler.validateUserInput(incomingUserMessage, userCurrentGoal.collectedData, currentContext);
    const isInputValid = typeof validationResult === 'boolean' ? validationResult : validationResult.isValidInput || false;
    const specificValidationError = typeof validationResult === 'object' ? validationResult.validationErrorMessage : undefined;

    let responseToUser: string;
    let uiButtonsToDisplay: ButtonConfig[] | undefined;

    if (isInputValid) {
      // Process valid input and advance to next step
      const processingResult = await currentStepHandler.processAndExtractData(incomingUserMessage, userCurrentGoal.collectedData, currentContext);
      userCurrentGoal.collectedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult ?
                                      { ...userCurrentGoal.collectedData, ...processingResult.extractedInformation } :
                                      processingResult as Record<string, any>;

      // Check if we need to restart the booking flow with a new service
      if (userCurrentGoal.collectedData.restartBookingFlow) {
        console.log(`[MessageProcessor] Restarting booking flow with new service`);
        
        // Determine the appropriate step based on service type
        const selectedService = userCurrentGoal.collectedData.selectedService;
        let targetStep: string;
        
        if (selectedService?.mobile) {
          // Mobile service - start from address collection
          targetStep = 'askAddress';
        } else {
          // Non-mobile service - start from location confirmation
          targetStep = 'confirmLocation';
        }
        
        console.log(`[MessageProcessor] Navigating to step: ${targetStep} for ${selectedService?.mobile ? 'mobile' : 'non-mobile'} service`);
        
        // Clear the restart flag
        userCurrentGoal.collectedData.restartBookingFlow = false;
        
        this.navigateBackToStep(userCurrentGoal, targetStep);
        
        // Execute the target step to show its content
        const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
        const targetStepName = currentSteps[userCurrentGoal.currentStepIndex];
        const targetStepHandler = botTasks[targetStepName];
        
        if (targetStepHandler) {
          // Execute the target step's processAndExtractData for initial display
          const targetStepResult = await targetStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
          userCurrentGoal.collectedData = typeof targetStepResult === 'object' && 'extractedInformation' in targetStepResult ?
                                          { ...userCurrentGoal.collectedData, ...targetStepResult.extractedInformation } :
                                          targetStepResult as Record<string, any>;
          
          responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                          targetStepHandler.defaultChatbotPrompt || 
                          "Let's continue with your new service selection.";
          
          if (targetStepHandler.fixedUiButtons) {
            if (typeof targetStepHandler.fixedUiButtons === 'function') {
              uiButtonsToDisplay = await targetStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
            } else {
              uiButtonsToDisplay = targetStepHandler.fixedUiButtons;
            }
          }
        } else {
          responseToUser = "Something went wrong while restarting the booking. Please try again.";
        }
        
        userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
        return { responseToUser, uiButtonsToDisplay };
      }

      // Check if we need to navigate back to a specific step (for editing)
      if (userCurrentGoal.collectedData.navigateBackTo) {
        const targetStep = userCurrentGoal.collectedData.navigateBackTo as string;
        console.log(`[MessageProcessor] Navigating back to step: ${targetStep}`);
        
        this.navigateBackToStep(userCurrentGoal, targetStep);
        
        // Execute the target step to show its content
        const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
        const targetStepName = currentSteps[userCurrentGoal.currentStepIndex];
        const targetStepHandler = botTasks[targetStepName];
        
        if (targetStepHandler) {
          // Execute the target step's processAndExtractData for initial display
          const targetStepResult = await targetStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
          userCurrentGoal.collectedData = typeof targetStepResult === 'object' && 'extractedInformation' in targetStepResult ?
                                          { ...userCurrentGoal.collectedData, ...targetStepResult.extractedInformation } :
                                          targetStepResult as Record<string, any>;
          
          responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                          targetStepHandler.defaultChatbotPrompt || 
                          "Let's update your selection.";
          
          if (targetStepHandler.fixedUiButtons) {
            if (typeof targetStepHandler.fixedUiButtons === 'function') {
              uiButtonsToDisplay = await targetStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
            } else {
              uiButtonsToDisplay = targetStepHandler.fixedUiButtons;
            }
          }
        } else {
          responseToUser = "Something went wrong while navigating back. Please try again.";
        }
        
        userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
        return { responseToUser, uiButtonsToDisplay };
      }

      this.advanceAndSkipStep(userCurrentGoal);
      
      // Check if flow is completed
      if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
        userCurrentGoal.goalStatus = 'completed';
        responseToUser = "Great! Your booking request has been processed.";
        uiButtonsToDisplay = undefined;
      } else {
        // Get the NEXT step handler and execute it to show dynamic content
        const nextStepName = currentSteps[userCurrentGoal.currentStepIndex];
        const nextStepHandler = botTasks[nextStepName];
        if (nextStepHandler) {
          console.log(`[MessageProcessor] Executing next step: ${nextStepName}`);
          
          // Execute the next step's processAndExtractData to generate dynamic content
          // Pass empty string to indicate this is initial execution of the step, not user input
          const nextStepResult = await nextStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
          userCurrentGoal.collectedData = typeof nextStepResult === 'object' && 'extractedInformation' in nextStepResult ?
                                          { ...userCurrentGoal.collectedData, ...nextStepResult.extractedInformation } :
                                          nextStepResult as Record<string, any>;
          
          // Check if this step should auto-advance
          if (nextStepHandler.autoAdvance || userCurrentGoal.collectedData.shouldAutoAdvance) {
            console.log(`[MessageProcessor] Auto-advancing from step: ${nextStepName}`);

            // Reset the flag
            if (userCurrentGoal.collectedData.shouldAutoAdvance) {
                userCurrentGoal.collectedData.shouldAutoAdvance = false;
            }

            this.advanceAndSkipStep(userCurrentGoal);
            
            // Execute auto-advance chain
            if (userCurrentGoal.currentStepIndex < currentSteps.length) {
              const autoAdvanceResult = await this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
              responseToUser = autoAdvanceResult.responseToUser;
              uiButtonsToDisplay = autoAdvanceResult.uiButtonsToDisplay;
            } else {
              // Flow completed
              userCurrentGoal.goalStatus = 'completed';
              responseToUser = "Great! Your booking request has been processed.";
              uiButtonsToDisplay = undefined;
            }
          } else {
            // Use dynamic content if available, otherwise fall back to default prompt
            responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                            nextStepHandler.defaultChatbotPrompt || 
                            "Let's continue with your booking.";
            
            if (nextStepHandler.fixedUiButtons) {
              if (typeof nextStepHandler.fixedUiButtons === 'function') {
                uiButtonsToDisplay = await nextStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
              } else {
                uiButtonsToDisplay = nextStepHandler.fixedUiButtons;
              }
            }
          }
        } else {
          responseToUser = "Something went wrong with the booking flow.";
        }
      }
    } else {
      // Handle validation failure
      // If validation failed with empty error message, advance to next step with user input
      if (specificValidationError === '' || !specificValidationError) {
        console.log(`[MessageProcessor] Validation failed with empty error - advancing to next step with user input`);
        
        this.advanceAndSkipStep(userCurrentGoal);
        
        // Check if flow is completed
        if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
          userCurrentGoal.goalStatus = 'completed';
          responseToUser = "Great! Your booking request has been processed.";
          uiButtonsToDisplay = undefined;
        } else {
          // Get the NEXT step handler and process user input
          const nextStepName = currentSteps[userCurrentGoal.currentStepIndex];
          const nextStepHandler = botTasks[nextStepName];
          if (nextStepHandler) {
            console.log(`[MessageProcessor] Processing user input "${incomingUserMessage}" with next step: ${nextStepName}`);
            
            // Validate input with next step handler
            const nextValidationResult = await nextStepHandler.validateUserInput(incomingUserMessage, userCurrentGoal.collectedData, currentContext);
            const nextIsInputValid = typeof nextValidationResult === 'boolean' ? nextValidationResult : nextValidationResult.isValidInput || false;
            
            if (nextIsInputValid) {
              // Process the user input with the next step
              const nextStepResult = await nextStepHandler.processAndExtractData(incomingUserMessage, userCurrentGoal.collectedData, currentContext);
              userCurrentGoal.collectedData = typeof nextStepResult === 'object' && 'extractedInformation' in nextStepResult ?
                                              { ...userCurrentGoal.collectedData, ...nextStepResult.extractedInformation } :
                                              nextStepResult as Record<string, any>;
              
              // Check if this step should auto-advance
              if (nextStepHandler.autoAdvance || userCurrentGoal.collectedData.shouldAutoAdvance) {
                console.log(`[MessageProcessor] Auto-advancing from step: ${nextStepName}`);

                // Reset the flag
                if (userCurrentGoal.collectedData.shouldAutoAdvance) {
                    userCurrentGoal.collectedData.shouldAutoAdvance = false;
                }

                this.advanceAndSkipStep(userCurrentGoal);
                
                // Execute auto-advance chain
                if (userCurrentGoal.currentStepIndex < currentSteps.length) {
                  const autoAdvanceResult = await this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
                  responseToUser = autoAdvanceResult.responseToUser;
                  uiButtonsToDisplay = autoAdvanceResult.uiButtonsToDisplay;
                } else {
                  // Flow completed
                  userCurrentGoal.goalStatus = 'completed';
                  responseToUser = "Great! Your booking request has been processed.";
                  uiButtonsToDisplay = undefined;
                }
              } else {
                // Use dynamic content if available, otherwise fall back to default prompt
                responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
                                nextStepHandler.defaultChatbotPrompt || 
                                "Let's continue with your booking.";
                
                if (nextStepHandler.fixedUiButtons) {
                  if (typeof nextStepHandler.fixedUiButtons === 'function') {
                    uiButtonsToDisplay = await nextStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
                  } else {
                    uiButtonsToDisplay = nextStepHandler.fixedUiButtons;
                  }
                }
              }
            } else {
              responseToUser = "I didn't understand that. Could you please try again?";
            }
          } else {
            responseToUser = "Something went wrong with the booking flow.";
          }
        }
      } else {
        // Normal validation failure - stay on current step and show error
        responseToUser = specificValidationError || currentStepHandler.defaultChatbotPrompt || "I didn't understand that. Could you please try again?";
        
        if (currentStepHandler.fixedUiButtons) {
          if (typeof currentStepHandler.fixedUiButtons === 'function') {
            uiButtonsToDisplay = await currentStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
          } else {
            uiButtonsToDisplay = currentStepHandler.fixedUiButtons;
          }
        }
      }
    }

    userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
    return { responseToUser, uiButtonsToDisplay };
  }



  // Persists the updated conversation state to the database
  private async persistUpdatedState(
    sessionId: string,
    userContext: UserContext,
    activeSession: ChatConversationSession,
    currentGoal: UserGoal | undefined,
    userMessage: string,
    botResponse: string
  ): Promise<void> {
    try {
      // Update userContext with current goal state
      let updatedContext: UserContext;
      
      if (currentGoal && currentGoal.goalStatus === 'completed') {
        // If goal is completed, move it to previousGoal and clear currentGoal
        updatedContext = {
          ...userContext,
          currentGoal: null, // Clear current goal to allow new bookings
          previousGoal: {
            goalType: currentGoal.goalType,
            goalAction: currentGoal.goalAction,
            goalStatus: currentGoal.goalStatus,
            currentStepIndex: currentGoal.currentStepIndex,
            collectedData: currentGoal.collectedData,
            flowKey: currentGoal.flowKey
          },
          // Update frequently discussed topics if needed (stored as comma-separated string)
          frequentlyDiscussedTopics: Array.isArray(userContext.frequentlyDiscussedTopics) 
            ? userContext.frequentlyDiscussedTopics.join(', ')
            : userContext.frequentlyDiscussedTopics || null
        };
        console.log(`[PersistUpdatedState] Goal completed - moved to previousGoal and cleared currentGoal`);
      } else {
        // Goal is still in progress, save as currentGoal
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
          // Update frequently discussed topics if needed (stored as comma-separated string)
          frequentlyDiscussedTopics: Array.isArray(userContext.frequentlyDiscussedTopics) 
            ? userContext.frequentlyDiscussedTopics.join(', ')
            : userContext.frequentlyDiscussedTopics || null
        };
      }

      // Convert message history to ChatMessage format
      const chatMessages: ChatMessage[] = [];
      
      // Add existing messages from session
      if (activeSession.activeGoals.length > 0 && activeSession.activeGoals[0].messageHistory) {
        for (const msg of activeSession.activeGoals[0].messageHistory) {
          chatMessages.push({
            role: msg.speakerRole === 'user' ? 'user' : 'bot',
            content: msg.content,
            timestamp: msg.messageTimestamp.toISOString()
          });
        }
      }

      // Add the current message exchange if not already included
      const lastMessage = chatMessages[chatMessages.length - 1];
      
      if (!lastMessage || lastMessage.content !== botResponse) {
        // Add user message
        chatMessages.push({
          role: 'user',
          content: userMessage,
          timestamp: new Date().toISOString()
        });
        
        // Add bot response
        chatMessages.push({
          role: 'bot',
          content: botResponse,
          timestamp: new Date().toISOString()
        });
      }

      // Persist to database
      await persistSessionState(sessionId, updatedContext, chatMessages);
    } catch (error) {
      console.error(`[MessageProcessor] Error persisting session state:`, error);
      // Don't throw - we don't want persistence errors to break the conversation flow
    }
  }

  // Main processing method
  async processIncomingMessage(incomingUserMessage: string, currentUser: ConversationalParticipant): Promise<{ chatbotResponse: string; uiButtons?: ButtonConfig[] }> {
    // Validate that we have actual user input to process
    if (!incomingUserMessage || incomingUserMessage.trim() === '') {
      console.log('[MessageProcessor] Empty or null user message - not processing');
      return { chatbotResponse: '' }; // Return empty response for empty input
    }

    // Establish conversational context
    const contextResult = await this.getOrCreateChatContext(currentUser);
    const currentContext: ChatContext = contextResult.context;
    const sessionId = contextResult.sessionId;
    const userContext = contextResult.userContext;
    const customerUser = contextResult.customerUser;

    // Manage chat session (handled by persistence layer)
    let activeSession: ChatConversationSession = currentContext.currentConversationSession!;

    // Find or detect user goal
    let userCurrentGoal: UserGoal | undefined = activeSession.activeGoals.find(g => g.goalStatus === 'inProgress');
    let responseToUser: string = "I'm not sure how to help with that. Can you please rephrase?";
    let uiButtonsToDisplay: ButtonConfig[] | undefined;

    if (!userCurrentGoal) {
      // No active goal, detect new one
      const llmGoalDetectionResult = await this.llmService.detectIntention(incomingUserMessage, currentContext);
      
      if (llmGoalDetectionResult.detectedUserGoalType) {
        userCurrentGoal = await this.createNewGoal(llmGoalDetectionResult, currentUser.type, currentContext);
        activeSession.activeGoals.push(userCurrentGoal);

        // Execute first step immediately
        const result = await this.executeFirstStep(userCurrentGoal, currentContext, incomingUserMessage);
        responseToUser = result.responseToUser;
        uiButtonsToDisplay = result.uiButtonsToDisplay;
        
        // Convert internal state to database format and persist
        await this.persistUpdatedState(sessionId, userContext, activeSession, userCurrentGoal, incomingUserMessage, responseToUser);
        return { chatbotResponse: responseToUser, uiButtons: uiButtonsToDisplay };
      } else {
        responseToUser = "Could you tell me more clearly what you'd like to do?";
        // Still persist even if no goal was detected
        await this.persistUpdatedState(sessionId, userContext, activeSession, undefined, incomingUserMessage, responseToUser);
        return { chatbotResponse: responseToUser };
      }
    }

    // Process existing goal using intelligent conversation analysis
    const result = await this.processExistingGoalIntelligent(userCurrentGoal, currentContext, incomingUserMessage, customerUser);
    responseToUser = result.responseToUser;
    uiButtonsToDisplay = result.uiButtonsToDisplay;

    // Convert internal state to database format and persist
    await this.persistUpdatedState(sessionId, userContext, activeSession, userCurrentGoal, incomingUserMessage, responseToUser);
    return { chatbotResponse: responseToUser, uiButtons: uiButtonsToDisplay };
  }
}

// --- Main Export Function ---
const messageProcessor = new MessageProcessor();

export async function processIncomingMessage(incomingUserMessage: string, currentUser: ConversationalParticipant): Promise<{ chatbotResponse: string; uiButtons?: ButtonConfig[] }> {
  return messageProcessor.processIncomingMessage(incomingUserMessage, currentUser);
}

// Mock storage removed - now using database persistence