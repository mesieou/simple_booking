// --- Core Type Definitions ---
import { UserContext, UserGoal as UserGoalSchema } from "@/lib/database/models/user-context";
import { AnalyzedIntent, GoalAction, GoalType } from "./llm-actions/chat-interactions/functions/intention-detector";

// --- Type Aliases & Mocks ---

// Using an alias to avoid confusion with the class name 'UserGoal' in this file.
// This refers to the database schema for a user's goal.
type UserGoal = UserGoalSchema; 

// Mock AnalyzedIntent for standalone testing
const mockAnalyzedIntent: AnalyzedIntent = {
    goalType: 'serviceBooking',
    goalAction: 'create',
    contextSwitch: false,
    confidence: 0.9,
    extractedInformation: { "serviceName": "manicure" }
};

// --- Interfaces & Types from Original System ---
// These are kept for compatibility with the step handlers.

export type ConversationalParticipantType = 'business' | 'customer';

// Note: These types are more specific than the schema `string` type.
// The state manager ensures only these values are used when creating a goal.
type HandledGoalType = 'accountManagement' | 'serviceBooking' | 'frequentlyAskedQuestion';
type HandledGoalActionType = 'create' | 'delete' | 'update';

const BOT_CONFIG = {
  DEFAULT_BUSINESS_ID: '2b4d2e67-a00f-4e36-81a1-64e6ac397394',
  DEFAULT_TIMEZONE: 'Australia/Melbourne',
  DEFAULT_LANGUAGE: 'en',
} as const;

export interface ConversationalParticipant {
  id: string; // channelUserId
  type: ConversationalParticipantType;
  associatedBusinessId?: string;
  businessWhatsappNumber?: string;
  creationTimestamp: Date;
  lastUpdatedTimestamp: Date;
}

// This interface is a temporary, in-memory object created on-the-fly
// to provide the step handlers with the context they need.
export interface ChatContext {
  currentParticipant: ConversationalParticipant;
  frequentlyDiscussedTopics: string[];
  participantPreferences: {
    language: string;
    timezone: string;
    notificationSettings: Record<string, boolean>;
  };
}

export interface LLMProcessingResult {
  isValidInput?: boolean;
  validationErrorMessage?: string;
  extractedInformation?: Record<string, any>;
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
  autoAdvance?: boolean;
}

// --- Conversation Flow Configuration ---
const conversationFlowBlueprints: Record<string, string[]> = {
  businessAccountCreation: ['getName', 'getBusinessEmail', 'getBusinessPhone', 'selectTimeZone', 'confirmAccountDetails'],
  businessAccountDeletion: ['confirmDeletionRequest', 'verifyUserPassword', 'initiateAccountDeletion'],
  bookingCreatingForMobileService: ['askAddress', 'validateAddress', 'selectService', 'confirmLocation', 'showAvailableTimes', 'handleTimeChoice', 'showDayBrowser', 'selectSpecificDay', 'showHoursForDay', 'selectSpecificTime', 'checkExistingUser', 'handleUserStatus', 'askUserName', 'createNewUser', 'quoteSummary', 'handleQuoteChoice', 'createBooking', 'displayConfirmedBooking'],
  bookingCreatingForNoneMobileService: ['selectService', 'confirmLocation', 'showAvailableTimes', 'handleTimeChoice', 'showDayBrowser', 'selectSpecificDay', 'showHoursForDay', 'selectSpecificTime', 'checkExistingUser', 'handleUserStatus', 'askUserName', 'createNewUser', 'quoteSummary', 'handleQuoteChoice', 'createBooking', 'displayConfirmedBooking'],
};

// --- Step Handler Imports ---
import { 
    getNameHandler, 
    getBusinessEmailHandler, 
    getBusinessPhoneHandler, 
    selectTimeZoneHandler, 
    confirmAccountDetailsHandler,
    confirmDeletionRequestHandler,
    verifyUserPasswordHandler,
    initiateAccountDeletionHandler
} from './flows/account/business-account-steps';
import { 
    askAddressHandler,
    validateAddressHandler,
    selectServiceHandler, 
    confirmLocationHandler,
    showAvailableTimesHandler,
    handleTimeChoiceHandler,
    showDayBrowserHandler,
    selectSpecificDayHandler,
    showHoursForDayHandler,
    selectSpecificTimeHandler,
    checkExistingUserHandler,
    handleUserStatusHandler,
    askUserNameHandler,
    createNewUserHandler,
    quoteSummaryHandler,
    handleQuoteChoiceHandler,
    createBookingHandler,
    displayConfirmedBookingHandler,
} from './flows/bookings/customer-booking-steps';

const botTasks: Record<string, IndividualStepHandler> = {
  // Account Creation
  getName: getNameHandler,
  getBusinessEmail: getBusinessEmailHandler,
  getBusinessPhone: getBusinessPhoneHandler,
  selectTimeZone: selectTimeZoneHandler,
  confirmAccountDetails: confirmAccountDetailsHandler,

  // Account Deletion
  confirmDeletionRequest: confirmDeletionRequestHandler,
  verifyUserPassword: verifyUserPasswordHandler,
  initiateAccountDeletion: initiateAccountDeletionHandler,

  // Booking
  askAddress: askAddressHandler,
  validateAddress: validateAddressHandler,
  selectService: selectServiceHandler,
  confirmLocation: confirmLocationHandler,
  showAvailableTimes: showAvailableTimesHandler,
  handleTimeChoice: handleTimeChoiceHandler,
  showDayBrowser: showDayBrowserHandler,
  selectSpecificDay: selectSpecificDayHandler,
  showHoursForDay: showHoursForDayHandler,
  selectSpecificTime: selectSpecificTimeHandler,
  checkExistingUser: checkExistingUserHandler,
  handleUserStatus: handleUserStatusHandler,
  askUserName: askUserNameHandler,
  createNewUser: createNewUserHandler,
  quoteSummary: quoteSummaryHandler,
  handleQuoteChoice: handleQuoteChoiceHandler,
  createBooking: createBookingHandler,
  displayConfirmedBooking: displayConfirmedBookingHandler,
};

// --- Helper Functions ---
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
    console.log(`[State Manager] Skipping step for existing user: ${stepName}`);
    return true;
  }
  return false;
}

// --- Main State Machine Logic ---

/**
 * The MessageProcessor class is now a stateless service that processes a user's turn.
 * It does not hold any state itself; it receives the current state (UserContext),
 * processes it, and returns the new state.
 */
class MessageProcessor {

  /**
   * Builds the temporary `ChatContext` adapter object that the step handlers expect.
   * This bridges the new `UserContext` schema with the legacy structure Juan's step handlers were built for.
   */
  private buildChatContextAdapter(userContext: UserContext, businessWhatsappNumber?: string): ChatContext {
    const participant: ConversationalParticipant = {
      id: userContext.channelUserId,
      type: 'customer', // Assuming all interactions are from customers for now
      associatedBusinessId: userContext.businessId || BOT_CONFIG.DEFAULT_BUSINESS_ID,
      businessWhatsappNumber: businessWhatsappNumber,
      creationTimestamp: new Date(userContext.createdAt),
      lastUpdatedTimestamp: new Date(userContext.updatedAt),
    };

    return {
      currentParticipant: participant,
      frequentlyDiscussedTopics: userContext.frequentlyDiscussedTopics?.split(',') || ['general queries'],
      participantPreferences: userContext.participantPreferences || { 
        language: BOT_CONFIG.DEFAULT_LANGUAGE, 
        timezone: BOT_CONFIG.DEFAULT_TIMEZONE, 
        notificationSettings: { email: true } 
      }
    };
  }
  
  private advanceAndSkipStep(userCurrentGoal: UserGoal) {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    let nextStepName: string;
    
    do {
      userCurrentGoal.currentStepIndex++;
      if (userCurrentGoal.currentStepIndex < currentSteps.length) {
        nextStepName = currentSteps[userCurrentGoal.currentStepIndex];
        console.log(`[MessageProcessor] Advanced to step: ${nextStepName} (${userCurrentGoal.currentStepIndex})`);
      } else {
        nextStepName = ''; 
      }
    } while (nextStepName && shouldSkipStep(nextStepName, userCurrentGoal.collectedData));
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
      
      // Clear step-specific data based on target step
      if (targetStepName === 'selectService') {
        userCurrentGoal.collectedData.selectedService = undefined;
        userCurrentGoal.collectedData.finalServiceAddress = undefined;
        userCurrentGoal.collectedData.serviceLocation = undefined;
        userCurrentGoal.collectedData.bookingSummary = undefined;
      } else if (targetStepName === 'showAvailableTimes') {
        userCurrentGoal.collectedData.selectedDate = undefined;
        userCurrentGoal.collectedData.selectedTime = undefined;
        userCurrentGoal.collectedData.quickBookingSelected = undefined;
        userCurrentGoal.collectedData.browseModeSelected = undefined;
        userCurrentGoal.collectedData.next3AvailableSlots = undefined;
        userCurrentGoal.collectedData.availableHours = undefined;
        userCurrentGoal.collectedData.formattedAvailableHours = undefined;
        userCurrentGoal.collectedData.bookingSummary = undefined;
      }
    } else {
      console.error(`[MessageProcessor] Target step not found in flow: ${targetStepName}`);
    }
  }

  private async createNewGoal(
    analyzedIntent: AnalyzedIntent, 
    participantType: ConversationalParticipantType, 
    context: ChatContext
  ): Promise<UserGoal> {
    let flowKey: string;
    let servicesData: any[] = [];
    
    if (participantType === 'customer' && analyzedIntent.goalType === 'serviceBooking' && analyzedIntent.goalAction === 'create') {
      const businessId = context.currentParticipant.associatedBusinessId;
      if (businessId) {
        try {
          const { Service } = await import('../database/models/service');
          const services = await Service.getByBusiness(businessId);
          servicesData = services.map((s: any) => s.getData());
          const hasMobileServices = servicesData.some((service: any) => service.mobile === true);
          flowKey = hasMobileServices ? 'bookingCreatingForMobileService' : 'bookingCreatingForNoneMobileService';
        } catch (error) {
          console.error('Error loading services for flow determination:', error);
          flowKey = 'bookingCreatingForMobileService';
        }
      } else {
        flowKey = 'bookingCreatingForMobileService';
      }
    } else if (participantType === 'customer' && analyzedIntent.goalType === 'frequentlyAskedQuestion') {
      flowKey = 'customerFaqHandling';
    } else if (participantType === 'business' && analyzedIntent.goalType === 'accountManagement') {
      flowKey = analyzedIntent.goalAction === 'create' ? 'businessAccountCreation' : 'businessAccountDeletion';
    } else {
      throw new Error(`No flow found for: ${participantType}-${analyzedIntent.goalType}-${analyzedIntent.goalAction || 'none'}`);
    }
    
    return {
      goalType: analyzedIntent.goalType as HandledGoalType,
      goalAction: analyzedIntent.goalAction as HandledGoalActionType,
      goalStatus: 'inProgress',
      currentStepIndex: 0,
      collectedData: { 
        ...analyzedIntent.extractedInformation,
        availableServices: servicesData 
      },
      messageHistory: [],
      flowKey
    };
  }

  private async executeStep(userCurrentGoal: UserGoal, currentContext: ChatContext): Promise<void> {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
        userCurrentGoal.goalStatus = 'completed';
        userCurrentGoal.collectedData.confirmationMessage = "Great! Your booking request has been processed.";
        return;
    }

    const stepName = currentSteps[userCurrentGoal.currentStepIndex];
    const stepHandler = botTasks[stepName];

    if (!stepHandler) throw new Error(`No handler found for step: ${stepName}`);

    // If the step is auto-advancing, process it and move to the next.
    if (stepHandler.autoAdvance) {
        console.log(`[State Manager] Auto-advancing from step: ${stepName}`);
        const processingResult = await stepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
        const extractedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult 
            ? processingResult.extractedInformation 
            : processingResult;
        userCurrentGoal.collectedData = { ...userCurrentGoal.collectedData, ...extractedData };
        
        this.advanceAndSkipStep(userCurrentGoal);
        await this.executeStep(userCurrentGoal, currentContext); // Recursively call to handle next step
        return;
    }
    
    // For regular steps, pre-process them to get their prompt/buttons for display.
    const processingResult = await stepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
    const extractedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult 
        ? processingResult.extractedInformation 
        : processingResult;
    userCurrentGoal.collectedData = { ...userCurrentGoal.collectedData, ...extractedData };

    if (!userCurrentGoal.collectedData.confirmationMessage) {
        userCurrentGoal.collectedData.confirmationMessage = stepHandler.defaultChatbotPrompt || "Let's continue.";
    }
    if (stepHandler.fixedUiButtons) {
        userCurrentGoal.collectedData.uiButtons = typeof stepHandler.fixedUiButtons === 'function'
        ? await stepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext)
        : stepHandler.fixedUiButtons;
    }
  }

  private async processExistingGoal(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): Promise<void> {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    if (!currentSteps || !currentSteps[userCurrentGoal.currentStepIndex]) {
      throw new Error('No handler found for current step');
    }

    const stepName = currentSteps[userCurrentGoal.currentStepIndex];
    const currentStepHandler = botTasks[stepName];

    if (!currentStepHandler) throw new Error('No handler found for current step');

    const validationResult = await currentStepHandler.validateUserInput(incomingUserMessage, userCurrentGoal.collectedData, currentContext);
    const isInputValid = typeof validationResult === 'boolean' ? validationResult : validationResult.isValidInput || false;
    const specificValidationError = typeof validationResult === 'object' ? validationResult.validationErrorMessage : undefined;

    // Reset previous response artifacts from collectedData
    delete userCurrentGoal.collectedData.confirmationMessage;
    delete userCurrentGoal.collectedData.uiButtons;

    if (isInputValid) {
      const processingResult = await currentStepHandler.processAndExtractData(incomingUserMessage, userCurrentGoal.collectedData, currentContext);
      const extractedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult 
        ? processingResult.extractedInformation 
        : processingResult;
      userCurrentGoal.collectedData = { ...userCurrentGoal.collectedData, ...extractedData };
      
      // Check if we need to navigate back to a specific step (for editing)
      const navigateBackTo = userCurrentGoal.collectedData.navigateBackTo as string | undefined;
      if (navigateBackTo) {
        console.log(`[State Manager] Navigating back to step: ${navigateBackTo}`);
        
        this.navigateBackToStep(userCurrentGoal, navigateBackTo);
        
        // Immediately execute the step we are navigating back to.
        await this.executeStep(userCurrentGoal, currentContext);
        return;
      }
      
      this.advanceAndSkipStep(userCurrentGoal);
      
      if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
        userCurrentGoal.goalStatus = 'completed';
        userCurrentGoal.collectedData.confirmationMessage = "Great! Your booking request has been processed.";
      } else {
        await this.executeStep(userCurrentGoal, currentContext);
      }
    } else {
      // If validation failed with an empty error message, it's a signal to advance
      // to the next step and re-process the input there.
      if (!specificValidationError) {
        console.log(`[State Manager] Validation failed with empty error - advancing to next step with user input`);
        
        this.advanceAndSkipStep(userCurrentGoal);
        
        // Check if flow is completed
        if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
          userCurrentGoal.goalStatus = 'completed';
          userCurrentGoal.collectedData.confirmationMessage = "Great! Your booking request has been processed.";
        } else {
          // Re-process the same user input with the new, advanced step
          await this.processExistingGoal(userCurrentGoal, currentContext, incomingUserMessage);
        }
      } else {
        // Normal validation failure - stay on current step and show error.
        userCurrentGoal.collectedData.confirmationMessage = specificValidationError || currentStepHandler.defaultChatbotPrompt || "I didn't understand that.";
        if (currentStepHandler.fixedUiButtons) {
            userCurrentGoal.collectedData.uiButtons = typeof currentStepHandler.fixedUiButtons === 'function'
            ? await currentStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext)
            : currentStepHandler.fixedUiButtons;
        }
      }
    }
  }

  /**
   * Main entry point for processing a user's turn. It is stateless.
   * It receives the current user context, processes the turn, and returns the updated context.
   */
  public async processTurn(
    userContext: UserContext,
    analyzedIntent: AnalyzedIntent,
    incomingUserMessage: string,
    businessWhatsappNumber?: string,
  ): Promise<UserContext> {

    const chatContextAdapter = this.buildChatContextAdapter(userContext, businessWhatsappNumber);
    let userCurrentGoal = userContext.currentGoal;

    // --- Guard Clause ---
    // If the active goal from the database is not 'inProgress', clear it before proceeding.
    // This prevents the system from trying to process a completed, failed, or paused goal.
    if (userCurrentGoal && userCurrentGoal.goalStatus !== 'inProgress') {
      console.log(`[State Manager] Clearing non-active goal (Status: ${userCurrentGoal.goalStatus})`);
      userCurrentGoal = null;
      userContext.currentGoal = null;
    }

    // --- Goal Management ---
    // Handle context switch: pause current goal if user changes topic
    if (analyzedIntent.contextSwitch && userContext.currentGoal) {
      console.log(`[State Manager] Context switch detected. Pausing goal: ${userContext.currentGoal.goalType}`);
      userContext.currentGoal.goalStatus = 'paused';
      userContext.previousGoal = userContext.currentGoal;
      userContext.currentGoal = null;
    }
    
    // Add user message to history of the current goal
    userCurrentGoal?.messageHistory.push({
      speakerRole: 'user',
      content: incomingUserMessage,
      messageTimestamp: new Date().toISOString()
    });

    // If there's no active goal, try to create one from the intent
    if (!userCurrentGoal) {
      console.log(`[State Manager] No active goal. Attempting to create new one for intent: ${analyzedIntent.goalType}`);
      try {
        // Create a new goal if the intent is recognized and actionable
        if (analyzedIntent.goalType !== 'unknown' && analyzedIntent.goalType !== 'generalChitChat') {
          userCurrentGoal = await this.createNewGoal(analyzedIntent, chatContextAdapter.currentParticipant.type, chatContextAdapter);
          userContext.currentGoal = userCurrentGoal;
          await this.executeStep(userCurrentGoal, chatContextAdapter);
        } else {
          // Intent is to chit-chat or is unknown, prepare a generic response.
          userContext.currentGoal = null; // Ensure no goal is active
          // The orchestrator will handle this case, e.g., by calling a generic AI response.
          console.log(`[State Manager] Intent is ${analyzedIntent.goalType}, no action taken.`);
        }
      } catch (error) {
        console.error("[State Manager] Error creating new goal:", error);
        // Set a response message in a temporary goal object for the orchestrator
        userContext.currentGoal = { 
          goalType: 'unknown', goalStatus: 'failed', flowKey: 'error', currentStepIndex: 0, collectedData: { confirmationMessage: "I'm sorry, I ran into an error trying to understand that." }, messageHistory: []
        };
      }
    } else {
      // Process the message against the existing, active goal
      console.log(`[State Manager] Processing existing goal: ${userCurrentGoal.goalType}, Step: ${userCurrentGoal.flowKey}[${userCurrentGoal.currentStepIndex}]`);
      await this.processExistingGoal(userCurrentGoal, chatContextAdapter, incomingUserMessage);
    }
    
    // Add chatbot response to history
    if (userCurrentGoal?.collectedData.confirmationMessage) {
        userCurrentGoal.messageHistory.push({
            speakerRole: 'chatbot',
            content: userCurrentGoal.collectedData.confirmationMessage,
            messageTimestamp: new Date().toISOString()
        });
    }

    return userContext;
  }
}

// --- Main Exported Function ---
// This creates a single instance of the processor to be used by the orchestrator.
const messageProcessor = new MessageProcessor();

/**
 * A stateless function to process a user's turn.
 * @param userContext The current, persistent state of the user.
 * @param analyzedIntent The output from the intention detector.
 * @param incomingUserMessage The raw text from the user.
 * @param businessWhatsappNumber The business number the user sent the message to.
 * @returns The updated user context after processing the turn.
 */
export async function processTurn(
  userContext: UserContext,
  analyzedIntent: AnalyzedIntent,
  incomingUserMessage: string,
  businessWhatsappNumber?: string,
): Promise<UserContext> {
  return messageProcessor.processTurn(userContext, analyzedIntent, incomingUserMessage, businessWhatsappNumber);
}