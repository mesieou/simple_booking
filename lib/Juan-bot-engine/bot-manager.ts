// --- Core Type Definitions ---
export type ConversationalParticipantType = 'business' | 'customer';
type UserGoalType = 'accountManagement' | 'serviceBooking' | 'frequentlyAskedQuestion' | 'humanAgentEscalation';
type GoalActionType = 'create' | 'delete' | 'update';
type StepProgressStatus = 'waitingForInput' | 'inputReceivedAndProcessed' | 'processingFailed';

// Configuration constants
const BOT_CONFIG = {
  DEFAULT_BUSINESS_ID: 'd6f5e8b7-cb97-4ad4-abbc-bccece483b4d', // Beauty Asiul business ID
  DEFAULT_TIMEZONE: 'Australia/Melbourne',
  DEFAULT_LANGUAGE: 'en',
  SESSION_TIMEOUT_HOURS: 24
} as const;

export interface ConversationalParticipant {
  id: string;
  type: ConversationalParticipantType;
  associatedBusinessId?: string;
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

interface UserGoal {
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
}

interface StepProcessingOutcome {
  wasSuccessful: boolean;
  updatedData?: Record<string, any>;
  nextStepIndexInFlow?: number;
  suggestedChatbotResponse?: string;
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
  buttonType?: 'postback' | 'link';
};

export interface IndividualStepHandler {
  defaultChatbotPrompt?: string;
  validateUserInput: (userInput: string, currentGoalData: Record<string, any>, chatContext: ChatContext) => Promise<boolean | LLMProcessingResult>;
  processAndExtractData: (validatedInput: string, currentGoalData: Record<string, any>, chatContext: ChatContext) => Promise<Record<string, any> | LLMProcessingResult>;
  fixedUiButtons?: (currentGoalData: Record<string, any>, chatContext: ChatContext) => Promise<ButtonConfig[]> | ButtonConfig[];
}

// --- Conversation Flow Configuration ---
const conversationFlowBlueprints: Record<string, { orderedSteps: string[] }> = {
  'business-accountManagement-create': {
    orderedSteps: ['getName', 'getBusinessEmail', 'getBusinessPhone', 'selectTimeZone', 'confirmAccountDetails']
  },
  'business-accountManagement-delete': {
    orderedSteps: ['confirmDeletionRequest', 'verifyUserPassword', 'initiateAccountDeletion']
  },
  'customer-serviceBooking-create': {
    orderedSteps: ['displayServices', 'getServicesChosen', 'askAddressesForChosenService', 'validateAddress', 'displayConfirmedAddresses','displayQuote', "displayQuoteInDetail", "askToBook", "displayNextAvailableTimes", "getDate",  "displayAvailableHoursPerDay", "getTime", "isNewUser", "askEmail", "validateEmail", "createBooking", "displayConfirmedBooking", "sendEmailBookingConfirmation"]
  },
  'customer-frequentlyAskedQuestion': {
    orderedSteps: ['identifyUserQuestion', 'searchKnowledgeBase', 'provideAnswerToUser', 'checkUserSatisfaction']
  },
};

// Import step handlers
import { getBusinessEmailHandler } from './step-handlers/business-account-steps';
import { 
    displayServicesHandler, 
    getServicesChosenHandler, 
    askAddressesForChosenServiceHandler 
} from './step-handlers/customer-booking-steps';

const individualStepHandlers: Record<string, IndividualStepHandler> = {
  'getBusinessEmail': getBusinessEmailHandler,
  'displayServices': displayServicesHandler,
  'getServicesChosen': getServicesChosenHandler,
  'askAddressesForChosenService': askAddressesForChosenServiceHandler,
};

// --- Flow Navigation Class ---
class ConversationFlowNavigator {
  private currentFlowKey: string;
  private definedSteps: string[];

  constructor(participantType: ConversationalParticipantType, userGoalType: UserGoalType, goalAction?: GoalActionType) {
    this.currentFlowKey = `${participantType}-${userGoalType}${goalAction ? '-' + goalAction : ''}`;
    const flowBlueprint = conversationFlowBlueprints[this.currentFlowKey];
    if (!flowBlueprint) {
      throw new Error(`Conversation flow blueprint not found for: ${this.currentFlowKey}`);
    }
    this.definedSteps = flowBlueprint.orderedSteps;
  }

  // Gets the handler for the current step
  getHandlerForCurrentStep(stepIndex: number): IndividualStepHandler | null {
    const stepName = this.definedSteps[stepIndex];
    return individualStepHandlers[stepName] || null;
  }

  // Checks if all steps are completed
  isFlowCompleted(currentStepIndex: number): boolean {
    return currentStepIndex >= this.definedSteps.length;
  }
}

// --- LLM Interface (Mock Implementation) ---
class LLMService {
  
  // Detects user intention from message content
  async detectIntention(userMessage: string, context: ChatContext): Promise<LLMProcessingResult> {
    const message = userMessage.toLowerCase();
    const participantType = context.currentParticipant.type;
    
    // Business user intentions
    if (participantType === 'business') {
      if (message.includes('create account')) return { detectedUserGoalType: 'accountManagement', detectedGoalAction: 'create', confidenceScore: 0.9 };
      if (message.includes('delete account')) return { detectedUserGoalType: 'accountManagement', detectedGoalAction: 'delete', confidenceScore: 0.9 };
    }
    
    // Customer user intentions
    if (participantType === 'customer') {
      // Explicit booking requests
      if (message.includes('book') || message.includes('appointment') || message.includes('schedule')) {
        return { detectedUserGoalType: 'serviceBooking', detectedGoalAction: 'create', confidenceScore: 0.9 };
      }
      
      // FAQ-style questions
      if (message.includes('question') || message.includes('how') || message.includes('what') || message.includes('when') || message.includes('where') || message.includes('price') || message.includes('cost')) {
        return { detectedUserGoalType: 'frequentlyAskedQuestion', confidenceScore: 0.7 };
      }
      
      // Greetings and general messages - default to booking for service businesses
      if (message.includes('hola') || message.includes('hello') || message.includes('hi') || message.includes('hey') || message.length < 20) {
        return { detectedUserGoalType: 'serviceBooking', detectedGoalAction: 'create', confidenceScore: 0.6 };
      }
      
      // Default for customers: assume they want to book something
      return { detectedUserGoalType: 'serviceBooking', detectedGoalAction: 'create', confidenceScore: 0.5 };
    }
    
    return {}; // No clear intention detected
  }

  // Validates user input
  async validateInput(content: string): Promise<LLMProcessingResult> {
    return { isValidInput: content.includes('@') }; // Simple email validation mock
  }

  // Extracts information from user input
  async extractInformation(content: string): Promise<LLMProcessingResult> {
    return { extractedInformation: { extractedValue: content } };
  }
}

// --- Message Processing Logic ---
class MessageProcessor {
  private llmService = new LLMService();

  // Creates a new chat session for a participant
  private async createNewChatSession(participant: ConversationalParticipant): Promise<ChatConversationSession> {
    console.log(`[MessageProcessor] Creating new session for participant: ${participant.id}`);
    const newSession: ChatConversationSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      participantId: participant.id,
      participantType: participant.type,
      activeGoals: [],
      sessionStartTimestamp: new Date(),
      lastMessageTimestamp: new Date(),
      sessionStatus: 'active',
      communicationChannel: 'whatsapp',
      sessionMetadata: { languagePreference: BOT_CONFIG.DEFAULT_LANGUAGE }
    };
    activeSessionsDB[participant.id] = newSession;
    return newSession;
  }

  // Gets or creates chat context for a participant
  private async getOrCreateChatContext(participant: ConversationalParticipant): Promise<ChatContext> {
    console.log(`[MessageProcessor] Building context for participant: ${participant.id}`);
    const existingSession = activeSessionsDB[participant.id];

    const participantWithBusinessId: ConversationalParticipant = {
      ...participant,
      associatedBusinessId: BOT_CONFIG.DEFAULT_BUSINESS_ID
    };

    return {
      currentParticipant: participantWithBusinessId,
      currentConversationSession: existingSession,
      previousConversationSession: completedSessionsDB[participant.id]?.slice(-1)[0],
      frequentlyDiscussedTopics: ['general queries', 'booking help'],
      participantPreferences: userPreferencesDB[participant.id] || { 
        language: BOT_CONFIG.DEFAULT_LANGUAGE, 
        timezone: BOT_CONFIG.DEFAULT_TIMEZONE, 
        notificationSettings: { email: true } 
      }
    };
  }

  // Creates a new goal when intention is detected
  private createNewGoal(detectionResult: LLMProcessingResult): UserGoal {
    return {
      goalType: detectionResult.detectedUserGoalType!,
      goalAction: detectionResult.detectedGoalAction,
        goalStatus: 'inProgress',
        currentStepIndex: 0,
      collectedData: detectionResult.extractedInformation || {},
      messageHistory: []
    };
  }

  // Executes the first step of a new goal immediately
  private async executeFirstStep(
    userCurrentGoal: UserGoal, 
    flowNavigator: ConversationFlowNavigator, 
    currentContext: ChatContext, 
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    
    const firstStepHandler = flowNavigator.getHandlerForCurrentStep(userCurrentGoal.currentStepIndex);
    
    if (!firstStepHandler) {
      throw new Error('No handler found for first step');
    }

    // Execute the first step immediately to display initial information
    const processingResult = await firstStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
    userCurrentGoal.collectedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult ?
                                    { ...userCurrentGoal.collectedData, ...processingResult.extractedInformation } :
                                    processingResult as Record<string, any>;

    // Show the first step's prompt and buttons
    const responseToUser = firstStepHandler.defaultChatbotPrompt || "Let's get started with your booking.";
    
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

  // Processes user input for an existing goal
  private async processExistingGoal(
    userCurrentGoal: UserGoal,
    flowNavigator: ConversationFlowNavigator,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    
  const currentStepHandler = flowNavigator.getHandlerForCurrentStep(userCurrentGoal.currentStepIndex);

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

      userCurrentGoal.currentStepIndex++;
      
      if (flowNavigator.isFlowCompleted(userCurrentGoal.currentStepIndex)) {
        userCurrentGoal.goalStatus = 'completed';
        responseToUser = "Great! Your booking request has been processed.";
        uiButtonsToDisplay = undefined;
      } else {
        // Get the NEXT step handler and show its prompt and buttons
        const nextStepHandler = flowNavigator.getHandlerForCurrentStep(userCurrentGoal.currentStepIndex);
        if (nextStepHandler) {
          responseToUser = nextStepHandler.defaultChatbotPrompt || "Let's continue with your booking.";
          
          if (nextStepHandler.fixedUiButtons) {
          if (typeof nextStepHandler.fixedUiButtons === 'function') {
            uiButtonsToDisplay = await nextStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
          } else {
            uiButtonsToDisplay = nextStepHandler.fixedUiButtons;
            }
          }
        } else {
          responseToUser = "Something went wrong with the booking flow.";
        }
      }
    } else {
      // Handle validation failure
      responseToUser = specificValidationError || currentStepHandler.defaultChatbotPrompt || "I didn't understand that. Could you please try again?";
      
      if (currentStepHandler.fixedUiButtons) {
        if (typeof currentStepHandler.fixedUiButtons === 'function') {
          uiButtonsToDisplay = await currentStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
        } else {
          uiButtonsToDisplay = currentStepHandler.fixedUiButtons;
        }
      }
    }

    userCurrentGoal.messageHistory.push({ speakerRole: 'chatbot', content: responseToUser, messageTimestamp: new Date() });
    return { responseToUser, uiButtonsToDisplay };
  }

  // Updates chat session in storage
  private async updateChatSession(session: ChatConversationSession, updates: Partial<ChatConversationSession>): Promise<ChatConversationSession> {
    console.log(`[MessageProcessor] Updating session ${session.id}`);
  
  let currentSession = activeSessionsDB[session.participantId];
  if (!currentSession || currentSession.id !== session.id) {
      currentSession = session;
  }
  
  const updatedSession = { ...currentSession, ...updates };
  updatedSession.activeGoals = updates.activeGoals || currentSession.activeGoals || [];

  if (updatedSession.sessionStatus === 'completed' || updatedSession.sessionStatus === 'expired') {
    if (!completedSessionsDB[updatedSession.participantId]) {
        completedSessionsDB[updatedSession.participantId] = [];
    }
    completedSessionsDB[updatedSession.participantId]?.push(updatedSession);
    delete activeSessionsDB[updatedSession.participantId];
  } else {
    activeSessionsDB[updatedSession.participantId] = updatedSession;
  }
  return updatedSession;
}

  // Main processing method
  async processIncomingMessage(incomingUserMessage: string, currentUser: ConversationalParticipant): Promise<{ chatbotResponse: string; uiButtons?: ButtonConfig[] }> {
    // Establish conversational context
    const currentContext: ChatContext = await this.getOrCreateChatContext(currentUser);

    // Manage chat session
    let activeSession: ChatConversationSession = currentContext.currentConversationSession || await this.createNewChatSession(currentUser);

    // Find or detect user goal
    let userCurrentGoal: UserGoal | undefined = activeSession.activeGoals.find(g => g.goalStatus === 'inProgress');
    let flowNavigator: ConversationFlowNavigator;
    let responseToUser: string = "I'm not sure how to help with that. Can you please rephrase?";
    let uiButtonsToDisplay: ButtonConfig[] | undefined;

    if (!userCurrentGoal) {
      // No active goal, detect new one
      const llmGoalDetectionResult = await this.llmService.detectIntention(incomingUserMessage, currentContext);
      
      if (llmGoalDetectionResult.detectedUserGoalType) {
        userCurrentGoal = this.createNewGoal(llmGoalDetectionResult);
        activeSession.activeGoals.push(userCurrentGoal);

        // Execute first step immediately
        flowNavigator = new ConversationFlowNavigator(currentUser.type, userCurrentGoal.goalType, userCurrentGoal.goalAction);
        const result = await this.executeFirstStep(userCurrentGoal, flowNavigator, currentContext, incomingUserMessage);
        responseToUser = result.responseToUser;
        uiButtonsToDisplay = result.uiButtonsToDisplay;
        
        await this.updateChatSession(activeSession, { lastMessageTimestamp: new Date(), activeGoals: activeSession.activeGoals });
        return { chatbotResponse: responseToUser, uiButtons: uiButtonsToDisplay };
      } else {
        responseToUser = "Could you tell me more clearly what you'd like to do?";
        await this.updateChatSession(activeSession, { lastMessageTimestamp: new Date() });
        return { chatbotResponse: responseToUser };
      }
    }

    // Process existing goal
    flowNavigator = new ConversationFlowNavigator(currentUser.type, userCurrentGoal.goalType, userCurrentGoal.goalAction);
    const result = await this.processExistingGoal(userCurrentGoal, flowNavigator, currentContext, incomingUserMessage);
    responseToUser = result.responseToUser;
    uiButtonsToDisplay = result.uiButtonsToDisplay;

    await this.updateChatSession(activeSession, { lastMessageTimestamp: new Date(), activeGoals: activeSession.activeGoals });
    return { chatbotResponse: responseToUser, uiButtons: uiButtonsToDisplay };
  }
}

// --- Main Export Function ---
const messageProcessor = new MessageProcessor();

export async function processIncomingMessage(incomingUserMessage: string, currentUser: ConversationalParticipant): Promise<{ chatbotResponse: string; uiButtons?: ButtonConfig[] }> {
  return messageProcessor.processIncomingMessage(incomingUserMessage, currentUser);
}

// --- Mock Storage (temporary) ---
const activeSessionsDB: Record<string, ChatConversationSession | undefined> = {};
const completedSessionsDB: Record<string, ChatConversationSession[] | undefined> = {};
const userPreferencesDB: Record<string, ChatContext['participantPreferences'] | undefined> = {
    'user123': { language: 'en', timezone: 'America/New_York', notificationSettings: { email: true, sms: false } }
};