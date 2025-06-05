// --- Core Type Definitions ---
export type ConversationalParticipantType = 'business' | 'customer';
type UserGoalType = 'accountManagement' | 'serviceBooking' | 'frequentlyAskedQuestion' | 'humanAgentEscalation';
type GoalActionType = 'create' | 'delete' | 'update';
type StepProgressStatus = 'waitingForInput' | 'inputReceivedAndProcessed' | 'processingFailed';

// Configuration constants
const BOT_CONFIG = {
  DEFAULT_BUSINESS_ID: '26f1f7ce-f595-45bd-aca0-5d8497fb36e0', // Beauty Asiul business ID
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
const conversationFlowBlueprints: Record<string, string[]> = {
  businessAccountCreation: ['getName', 'getBusinessEmail', 'getBusinessPhone', 'selectTimeZone', 'confirmAccountDetails'],
  businessAccountDeletion: ['confirmDeletionRequest', 'verifyUserPassword', 'initiateAccountDeletion'],
  bookingCreatingForMobileService: ['askAddress', 'validateAddress', 'selectService', 'confirmLocation', 'displayQuote', 'displayQuoteInDetail', 'askToBook', 'displayNextAvailableTimes', 'getDate', 'displayAvailableHoursPerDay', 'getTime', 'isNewUser', 'askEmail', 'validateEmail', 'createBooking', 'displayConfirmedBooking', 'sendEmailBookingConfirmation'],
  bookingCreatingForNoneMobileService: ['selectService', 'confirmLocation', 'displayNextAvailableTimes', 'getDate', 'displayAvailableHoursPerDay', 'getTime', 'isNewUser', 'askEmail', 'validateEmail', 'createBooking', 'displayConfirmedBooking', 'sendEmailBookingConfirmation'],
  customerFaqHandling: ['identifyUserQuestion', 'searchKnowledgeBase', 'provideAnswerToUser', 'checkUserSatisfaction'],
};

// Import step handlers
import { getBusinessEmailHandler } from './step-handlers/business-account-steps';
import { 
    askAddressHandler,
    validateAddressHandler,
    selectServiceHandler, 
    confirmLocationHandler,
    displayQuoteHandler,
    displayQuoteInDetailHandler,
    askToBookHandler,
    displayNextAvailableTimesHandler,
    getDateHandler,
    displayAvailableHoursPerDayHandler,
    getTimeHandler,
    isNewUserHandler,
    askEmailHandler,
    validateEmailHandler,
    createBookingHandler,
    displayConfirmedBookingHandler,
    sendEmailBookingConfirmationHandler
} from './step-handlers/customer-booking-steps';

const botTasks: Record<string, IndividualStepHandler> = {
  getBusinessEmail: getBusinessEmailHandler,
  askAddress: askAddressHandler,
  validateAddress: validateAddressHandler,
  selectService: selectServiceHandler,
  confirmLocation: confirmLocationHandler,
  displayQuote: displayQuoteHandler,
  displayQuoteInDetail: displayQuoteInDetailHandler,
  askToBook: askToBookHandler,
  displayNextAvailableTimes: displayNextAvailableTimesHandler,
  getDate: getDateHandler,
  displayAvailableHoursPerDay: displayAvailableHoursPerDayHandler,
  getTime: getTimeHandler,
  isNewUser: isNewUserHandler,
  askEmail: askEmailHandler,
  validateEmail: validateEmailHandler,
  createBooking: createBookingHandler,
  displayConfirmedBooking: displayConfirmedBookingHandler,
  sendEmailBookingConfirmation: sendEmailBookingConfirmationHandler,
};

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
    currentContext: ChatContext,
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    if (!currentSteps || !currentSteps[userCurrentGoal.currentStepIndex]) {
      throw new Error('No handler found for current step');
    }

    const stepName = currentSteps[userCurrentGoal.currentStepIndex];
    const currentStepHandler = botTasks[stepName];

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
          // Execute the next step's processAndExtractData to generate dynamic content
          const nextStepResult = await nextStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
          userCurrentGoal.collectedData = typeof nextStepResult === 'object' && 'extractedInformation' in nextStepResult ?
                                          { ...userCurrentGoal.collectedData, ...nextStepResult.extractedInformation } :
                                          nextStepResult as Record<string, any>;
          
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
        
        await this.updateChatSession(activeSession, { lastMessageTimestamp: new Date(), activeGoals: activeSession.activeGoals });
        return { chatbotResponse: responseToUser, uiButtons: uiButtonsToDisplay };
      } else {
        responseToUser = "Could you tell me more clearly what you'd like to do?";
        await this.updateChatSession(activeSession, { lastMessageTimestamp: new Date() });
        return { chatbotResponse: responseToUser };
      }
    }

    // Process existing goal
    const result = await this.processExistingGoal(userCurrentGoal, currentContext, incomingUserMessage);
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