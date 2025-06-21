import { Business } from "@/lib/database/models/business";
import { extractSessionHistoryAndContext } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/extract-history-and-context.ts";
import { ChatMessage } from "@/lib/database/models/chat-session";
import { UserContext } from "@/lib/database/models/user-context";
import { IntelligentLLMService } from '@/lib/Juan-bot-engine/services/intelligent-llm-service';
import { BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { franc } from 'franc-min';
import { 
  getOrCreateChatContext, 
  persistSessionState,
  START_BOOKING_PAYLOAD 
} from '@/lib/Juan-bot-engine/bot-manager-helpers';


// --- Core Type Definitions ---
export type ConversationalParticipantType = 'business' | 'customer';
type UserGoalType = 'accountManagement' | 'serviceBooking' | 'frequentlyAskedQuestion' | 'humanAgentEscalation';
type GoalActionType = 'create' | 'delete' | 'update';

// Configuration constants
export const BOT_CONFIG = {
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

export interface ChatConversationSession {
  id: string;
  participantId: string;
  participantType: ConversationalParticipantType;
  activeGoals: UserGoal[];
  sessionStartTimestamp: Date;
  lastMessageTimestamp: Date;
  sessionStatus: 'active' | 'completed' | 'expired' | 'escalated';
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
  bookingCreatingForMobileService: ['askAddress', 'validateAddress', 'selectService', 'confirmLocation', 'showAvailableTimes', 'handleTimeChoice', 'showDayBrowser', 'selectSpecificDay', 'showHoursForDay', 'selectSpecificTime', 'checkExistingUser', 'handleUserStatus', 'askUserName', 'createNewUser', 'quoteSummary', 'handleQuoteChoice', 'createBooking'],
  bookingCreatingForNoneMobileService: ['selectService', 'confirmLocation', 'showAvailableTimes', 'handleTimeChoice', 'showDayBrowser', 'selectSpecificDay', 'showHoursForDay', 'selectSpecificTime', 'checkExistingUser', 'handleUserStatus', 'askUserName', 'createNewUser', 'quoteSummary', 'handleQuoteChoice', 'createBooking'],
  customerFaqHandling: ['handleFaqQuestion'],
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

// --- Message Processing Logic ---
class MessageProcessor {
  private llmService = new IntelligentLLMService();

  // Main processing method
  async processIncomingMessage(incomingUserMessage: string, currentUser: ConversationalParticipant): Promise<BotResponse> {
    if (!incomingUserMessage || incomingUserMessage.trim() === '') {
      return { text: '' };
    }

    const { context: currentContext, sessionId, userContext, customerUser } = await getOrCreateChatContext(currentUser);
    let activeSession: ChatConversationSession = currentContext.currentConversationSession!;
    if (!activeSession) {
        // This case should ideally not happen if getOrCreateChatContext guarantees a session, but it's a safe guard.
        console.error("Critical: No active session found for user.");
        return { text: "I'm sorry, I'm having trouble retrieving our conversation." };
    }
    
    let userCurrentGoal: UserGoal | undefined = activeSession.activeGoals.find(g => g.goalStatus === 'inProgress');
    let responseToUser: string;
    let uiButtonsToDisplay: ButtonConfig[] | undefined;

    // --- LANGUAGE DETECTION ---
    try {
      const existingLang = currentContext.participantPreferences.language;

      // Only detect language if it's not already set to a non-English language.
      // This makes the language preference "sticky".
      if (!existingLang || existingLang === 'en') {
        // Detect language from user message (ISO 639-3)
        const langCode3 = franc(incomingUserMessage, { minLength: 3 });

        // Map to ISO 639-1 (2-letter code) if needed
        const langMap: { [key: string]: string } = {
          'spa': 'es',
          'eng': 'en',
          // Add other mappings as needed
        };

        const langCode2 = langMap[langCode3] || 'en'; // Default to English

        if (existingLang !== langCode2) {
          console.log(`[MessageProcessor] Language preference set to ${langCode2}`);
          currentContext.participantPreferences.language = langCode2;
        }
      } else {
        console.log(`[MessageProcessor] Sticky language preference maintained: ${existingLang}`);
      }
    } catch (error) {
      console.error('[MessageProcessor] Error detecting language:', error);
      // Proceed with default language
    }
    // --- END LANGUAGE DETECTION ---

    // Handle explicit request to start booking
    if (incomingUserMessage.trim().toUpperCase() === START_BOOKING_PAYLOAD.toUpperCase()) {
      console.log('[MessageProcessor] Detected START_BOOKING_PAYLOAD, initiating new booking goal.');
      if (userCurrentGoal) {
        userCurrentGoal.goalStatus = 'completed'; // End any active goal
      }

      const bookingGoalResult: LLMProcessingResult = {
        detectedUserGoalType: 'serviceBooking',
        detectedGoalAction: 'create',
      };
      
      userCurrentGoal = await this.createNewGoal(bookingGoalResult, currentUser.type, currentContext);
      activeSession.activeGoals = [userCurrentGoal]; // Set as the only active goal
      
      const result = await this.executeFirstStep(userCurrentGoal, currentContext, incomingUserMessage);
      responseToUser = result.responseToUser;
      uiButtonsToDisplay = result.uiButtonsToDisplay;
    } else if (!userCurrentGoal) {
      // No active goal, detect new one
      const llmGoalDetectionResult = await this.llmService.detectIntention(incomingUserMessage, currentContext);
      
      if (llmGoalDetectionResult.detectedUserGoalType) {
        userCurrentGoal = await this.createNewGoal(llmGoalDetectionResult, currentUser.type, currentContext);
        activeSession.activeGoals.push(userCurrentGoal);
        const result = await this.executeFirstStep(userCurrentGoal, currentContext, incomingUserMessage);
        responseToUser = result.responseToUser;
        uiButtonsToDisplay = result.uiButtonsToDisplay;
      } else {
        responseToUser = "Could you tell me more clearly what you'd like to do?";
      }
    } else {
      const result = await this.processExistingGoalIntelligent(userCurrentGoal, currentContext, incomingUserMessage, customerUser);
      responseToUser = result.responseToUser;
      uiButtonsToDisplay = result.uiButtonsToDisplay;
    }

    await this.persistUpdatedState(sessionId, userContext, activeSession, userCurrentGoal, incomingUserMessage, responseToUser);
    
    return this.finalizeAndTranslateResponse({
        text: responseToUser,
        buttons: uiButtonsToDisplay,
        listActionText: userCurrentGoal?.collectedData.listActionText,
        listSectionTitle: userCurrentGoal?.collectedData.listSectionTitle
    }, currentContext);
  }

  /**
   * Takes the final response pieces, translates them if necessary, and returns the final object.
   * This is the single exit point for all user-facing responses from the booking engine.
   */
  private async finalizeAndTranslateResponse(response: BotResponse, chatContext: ChatContext): Promise<BotResponse> {
    const targetLanguage = chatContext.participantPreferences.language;

    if (!targetLanguage || targetLanguage === 'en') {
      return response;
    }

    console.log(`[MessageProcessor] Translating booking response to ${targetLanguage}`);
    const textsToTranslate: string[] = [];

    if (response.text) textsToTranslate.push(response.text);
    if (response.listActionText) textsToTranslate.push(response.listActionText);
    if (response.listSectionTitle) textsToTranslate.push(response.listSectionTitle);
    response.buttons?.forEach(btn => {
        if (btn.buttonText) textsToTranslate.push(btn.buttonText);
        if (btn.buttonDescription) textsToTranslate.push(btn.buttonDescription);
    });

    if (textsToTranslate.length === 0) {
        return response;
    }

    try {
        const translatedTexts = await this.llmService.translate(textsToTranslate, targetLanguage) as string[];
        const mutableTranslatedTexts = [...translatedTexts];

        const translatedResponse: BotResponse = { ...response };

        if (translatedResponse.text) translatedResponse.text = mutableTranslatedTexts.shift() || translatedResponse.text;
        if (translatedResponse.listActionText) translatedResponse.listActionText = mutableTranslatedTexts.shift() || translatedResponse.listActionText;
        if (translatedResponse.listSectionTitle) translatedResponse.listSectionTitle = mutableTranslatedTexts.shift() || translatedResponse.listSectionTitle;
        
        translatedResponse.buttons = translatedResponse.buttons?.map(btn => {
            const newBtn = { ...btn };
            if (newBtn.buttonText) newBtn.buttonText = mutableTranslatedTexts.shift() || newBtn.buttonText;
            if (newBtn.buttonDescription) newBtn.buttonDescription = mutableTranslatedTexts.shift() || newBtn.buttonDescription;
            return newBtn;
        });

        return translatedResponse;
    } catch (error) {
        console.error(`[MessageProcessor] Error translating booking response:`, error);
        return response; 
    }
  }

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
          const { Service } = await import('@/lib/database/models/service');
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

    // After processing, check if the goal has been marked as completed by the step
    if (userCurrentGoal.collectedData.goalStatus === 'completed') {
        userCurrentGoal.goalStatus = 'completed'; // Update the top-level status
        console.log(`[MessageProcessor] Goal completed during auto-advance at step: ${stepName}`);
        
        const responseToUser = userCurrentGoal.collectedData.confirmationMessage || "Your request has been completed.";
        return { responseToUser, uiButtonsToDisplay: undefined };
    }

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
      
      if (conversationDecision.action === 'switch_topic' && conversationDecision.confidence >= 0.8) {
        const topicSwitchResult = await this.handleTopicSwitch(currentContext, conversationDecision, incomingUserMessage, userCurrentGoal);
        
        // If a new goal was created, update the session
        if (topicSwitchResult.newGoal) {
          // Replace the current goal with the new goal
          if (currentContext.currentConversationSession) {
            currentContext.currentConversationSession.activeGoals = [topicSwitchResult.newGoal];
          }
          console.log(`[MessageProcessor] Updated session with new goal for topic switch`);
        }
        
        return {
          responseToUser: topicSwitchResult.responseToUser,
          uiButtonsToDisplay: topicSwitchResult.uiButtonsToDisplay
        };  
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
      return this.processExistingGoalIntelligent(userCurrentGoal, currentContext, incomingUserMessage);
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
    incomingUserMessage: string,
    currentGoal?: UserGoal
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[]; newGoal?: UserGoal }> {
    console.log(`[MessageProcessor] Handling topic switch to: ${conversationDecision.newGoalType}`);
    
    // For booking topic switches (like "another booking"), create a new booking goal
    if (conversationDecision.newGoalType === 'serviceBooking' && conversationDecision.newGoalAction === 'create') {
      console.log(`[MessageProcessor] Creating new booking goal for topic switch`);
      
      // Mark the current goal as completed if it exists
      if (currentGoal) {
        currentGoal.goalStatus = 'completed';
        console.log(`[MessageProcessor] Marked previous goal as completed`);
      }
      
      // Create a new goal from scratch
      const newGoal = await this.createNewGoal(
        {
          detectedUserGoalType: 'serviceBooking',
          detectedGoalAction: 'create',
          extractedInformation: conversationDecision.extractedData || {}
        },
        'customer',
        currentContext
      );
      
      console.log(`[MessageProcessor] Created new goal, executing first step`);
      
      // Execute the first step of the new goal
      const result = await this.executeFirstStep(newGoal, currentContext, incomingUserMessage);
      
      // Return the result with the new goal
      return {
        ...result,
        newGoal
      };
    }
    
    // For other topic switches, return a generic message for now
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
      
      // Check if flow is completed OR if the goal is marked as completed by a step
      if (userCurrentGoal.currentStepIndex >= currentSteps.length || userCurrentGoal.collectedData.goalStatus === 'completed') {
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
            responseToUser = contextualResponse.text;
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

  private async persistUpdatedState(
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
          // ...
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
          // ...
        };
      }

      const chatMessages: ChatMessage[] = [];
      if (activeSession.activeGoals.length > 0 && activeSession.activeGoals[0].messageHistory) {
        // ...
      }

      await persistSessionState(sessionId, updatedContext, activeSession, currentGoal, userMessage, botResponse);
    } catch (error) {
      console.error(`[MessageProcessor] Error persisting session state:`, error);
      // Don't throw - we don't want persistence errors to break the conversation flow
    }
  }
}

// --- Main Export Function ---
const messageProcessor = new MessageProcessor();

export async function processIncomingMessage(incomingUserMessage: string, currentUser: ConversationalParticipant): Promise<BotResponse> {
  return messageProcessor.processIncomingMessage(incomingUserMessage, currentUser);
}