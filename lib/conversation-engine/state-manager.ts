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
  /**
   * An optional, transformed version of the user's input. If provided, the state
   * manager will use this string for the `processAndExtractData` step instead of
   * the original user message. This allows a validation step to also perform
   * sanitization or semantic interpretation.
   */
  transformedInput?: string;
  /**
   * A specific reason for validation failure, used by the orchestrator for nuanced responses.
   */
  reason?: 'NOT_FOUND' | 'AMBIGUOUS' | 'OTHER';
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
  /**
   * A list of keys to delete from the `collectedData` object *after* this step
   * has been successfully processed. This is used for progressive context pruning.
   */
  pruneKeysAfterCompletion?: string[];
}

// --- Conversation Flow Configuration ---
const conversationFlowBlueprints: Record<string, string[]> = {
  businessAccountCreation: ['getName', 'getBusinessEmail', 'getBusinessPhone', 'selectTimeZone', 'confirmAccountDetails'],
  businessAccountDeletion: ['confirmDeletionRequest', 'verifyUserPassword', 'initiateAccountDeletion'],
  bookingCreatingForMobileService: ['askAddress', 'validateAddress', 'selectService', 'confirmLocation', 'selectTime', 'selectDay', 'selectHour', 'checkExistingUser', 'handleUserStatus', 'askUserName', 'createNewUser', 'quoteSummary', 'handleQuoteChoice', 'showEditOptions', 'createBooking', 'displayConfirmedBooking'],
  bookingCreatingForNoneMobileService: ['selectService', 'confirmLocation', 'selectTime', 'selectDay', 'selectHour', 'checkExistingUser', 'handleUserStatus', 'askUserName', 'createNewUser', 'quoteSummary', 'handleQuoteChoice', 'showEditOptions', 'createBooking', 'displayConfirmedBooking'],
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
    selectTimeHandler,
    selectDayHandler,
    selectHourHandler,
    checkExistingUserHandler,
    handleUserStatusHandler,
    askUserNameHandler,
    createNewUserHandler,
    quoteSummaryHandler,
    handleQuoteChoiceHandler,
    createBookingHandler,
    displayConfirmedBookingHandler,
    showEditOptionsHandler,
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
  selectTime: selectTimeHandler,
  selectDay: selectDayHandler,
  selectHour: selectHourHandler,
  checkExistingUser: checkExistingUserHandler,
  handleUserStatus: handleUserStatusHandler,
  askUserName: askUserNameHandler,
  createNewUser: createNewUserHandler,
  quoteSummary: quoteSummaryHandler,
  handleQuoteChoice: handleQuoteChoiceHandler,
  createBooking: createBookingHandler,
  displayConfirmedBooking: displayConfirmedBookingHandler,
  showEditOptions: showEditOptionsHandler,
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
  // If the user has confirmed the quote, skip the step for showing edit options.
  if (stepName === 'showEditOptions' && !!goalData.quoteConfirmedFromSummary) {
    console.log(`[State Manager] Skipping edit options step because quote is confirmed.`);
    return true;
  }
  return false;
}

/**
 * A centralized function to prune keys from the context's collectedData object.
 * This is the core of the "Progressive Pruning" strategy.
 * @param collectedData The `collectedData` object from the current goal.
 * @param keysToPrune An array of string keys to delete from the object.
 */
function pruneContextData(collectedData: Record<string, any>, keysToPrune: string[] | undefined): void {
  if (!keysToPrune || keysToPrune.length === 0) {
    return;
  }
  
  console.log(`[State Manager] Pruning the following keys from context...`);
  for (const key of keysToPrune) {
    if (collectedData.hasOwnProperty(key)) {
      console.log(`  - Pruning [${key}]:`, JSON.stringify(collectedData[key], null, 2));
      delete collectedData[key];
    }
  }
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
      } else if (targetStepName === 'selectTime') {
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
    incomingUserMessage: string,
    analyzedIntent: AnalyzedIntent,
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
    const validationFailureReason = typeof validationResult === 'object' ? validationResult.reason : undefined;

    // Reset previous response artifacts from collectedData
    delete userCurrentGoal.collectedData.confirmationMessage;
    delete userCurrentGoal.collectedData.uiButtons;
    // Also clear any previous validation failure reason
    delete userCurrentGoal.collectedData.validationFailureReason;

    if (isInputValid) {
      // If validation returned a transformed input, use it. Otherwise, use the original message.
      const inputForProcessor = (typeof validationResult === 'object' && validationResult.transformedInput)
          ? validationResult.transformedInput
          : incomingUserMessage;
          
      const processingResult = await currentStepHandler.processAndExtractData(inputForProcessor, userCurrentGoal.collectedData, currentContext);
      const extractedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult 
        ? processingResult.extractedInformation 
        : processingResult;
      userCurrentGoal.collectedData = { ...userCurrentGoal.collectedData, ...extractedData };
      
      // *** NEW: Prune data after successful processing ***
      pruneContextData(userCurrentGoal.collectedData, currentStepHandler.pruneKeysAfterCompletion);

      // Check if we need to navigate back to a specific step (for editing)
      const navigateBackTo = userCurrentGoal.collectedData.navigateBackTo as string | undefined;
      if (navigateBackTo) {
        console.log(`[State Manager] Navigating back to step: ${navigateBackTo}`);
        
        this.navigateBackToStep(userCurrentGoal, navigateBackTo);
        
        // Immediately execute the step we are navigating back to.
        await this.executeStep(userCurrentGoal, currentContext);
        return;
      }
      
      // Only advance if shouldAutoAdvance is not explicitly set to false
      if (userCurrentGoal.collectedData.shouldAutoAdvance !== false) {
        this.advanceAndSkipStep(userCurrentGoal);
        
        if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
          userCurrentGoal.goalStatus = 'completed';
          userCurrentGoal.collectedData.confirmationMessage = "Great! Your booking request has been processed.";
        } else {
          await this.executeStep(userCurrentGoal, currentContext);
        }
      }
    } else {
      // If validation fails, check if it's just a question. If so, stay on the current step.
      if (analyzedIntent.goalType === 'frequentlyAskedQuestion') {
          console.log('[State Manager] Validation failed, but it was an FAQ. Staying on the current step to preserve context and buttons.');
          // Regenerate the UI for the current step so the agent can display it after answering the question.
          if (currentStepHandler.fixedUiButtons) {
              userCurrentGoal.collectedData.uiButtons = typeof currentStepHandler.fixedUiButtons === 'function'
              ? await currentStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext)
              : currentStepHandler.fixedUiButtons;
          }
          return; // Stop processing, let the agent handle the response.
      }

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
          await this.processExistingGoal(userCurrentGoal, currentContext, incomingUserMessage, analyzedIntent);
        }
      } else {
        // Normal validation failure - stay on current step and show error.
        userCurrentGoal.collectedData.confirmationMessage = specificValidationError || currentStepHandler.defaultChatbotPrompt || "I didn't understand that.";
        if (currentStepHandler.fixedUiButtons) {
            userCurrentGoal.collectedData.uiButtons = typeof currentStepHandler.fixedUiButtons === 'function'
            ? await currentStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext)
            : currentStepHandler.fixedUiButtons;
        }
        // Persist the failure reason for the orchestrator
        if (validationFailureReason) {
          userCurrentGoal.collectedData.validationFailureReason = validationFailureReason;
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
    // A "hard" context switch (like switching to a different, major goal) should pause the current goal.
    // A "soft" context switch (like asking an FAQ during a booking) should be ignored here,
    // allowing the current goal to remain active so the Agent Brain can handle the question.
    const isInterruptingGoal = analyzedIntent.goalType === 'accountManagement'; // Define truly interrupting goals here

    if (analyzedIntent.contextSwitch && userCurrentGoal && isInterruptingGoal) {
      console.log(`[State Manager] Interrupting context switch detected. Pausing goal: ${userCurrentGoal.goalType}`);
      userCurrentGoal.goalStatus = 'paused';
      userContext.previousGoal = userCurrentGoal;
      userCurrentGoal = null; 
      userContext.currentGoal = null;
    } else if (analyzedIntent.contextSwitch) {
      console.log(`[State Manager] Non-interrupting context switch (e.g., FAQ) detected. Keeping current goal active to provide context to the agent.`);
    }
    
    // If there's no active goal, try to create one from the intent
    if (!userCurrentGoal) {
      console.log(`[State Manager] No active goal. Attempting to create new one for intent: ${analyzedIntent.goalType}`);
      try {
        // Create a new goal only for recognized, stateful tasks, not for one-off questions.
        const isActionableGoal = analyzedIntent.goalType === 'serviceBooking' || analyzedIntent.goalType === 'accountManagement';

        if (isActionableGoal) {
          userCurrentGoal = await this.createNewGoal(analyzedIntent, chatContextAdapter.currentParticipant.type, chatContextAdapter);
          userContext.currentGoal = userCurrentGoal;
          
          // Execute the first step to pre-load its data and get the correct prompt
          await this.executeStep(userCurrentGoal, chatContextAdapter);
          
          // Now, if the user's initial message could satisfy this first step, process it.
          // This prevents asking for information the user already provided.
          const firstStepHandler = botTasks[conversationFlowBlueprints[userCurrentGoal.flowKey][0]];
          const validationResult = await firstStepHandler.validateUserInput(incomingUserMessage, userCurrentGoal.collectedData, chatContextAdapter);
          const isInputValid = typeof validationResult === 'boolean' ? validationResult : validationResult.isValidInput;

          if (isInputValid) {
            console.log(`[State Manager] Initial user message is valid for the first step. Processing it now.`);
            await this.processExistingGoal(userCurrentGoal, chatContextAdapter, incomingUserMessage, analyzedIntent);
          } else {
            const validationFailureReason =
              typeof validationResult === 'object'
                ? validationResult.reason
                : undefined;
            if (validationFailureReason) {
              userCurrentGoal.collectedData.validationFailureReason =
                validationFailureReason;
            }
          }

        } else {
          // Intent is an FAQ, chit-chat, or is unknown. Do not create a goal.
          userContext.currentGoal = null; // Ensure no goal is active
          // The orchestrator's Agent Brain will handle this case statelessly.
          console.log(`[State Manager] Intent is ${analyzedIntent.goalType}, which is not an actionable goal. No state machine action taken.`);
        }
      } catch (error) {
        console.error("[State Manager] Error creating new goal:", error);
        // Set a response message in a temporary goal object for the orchestrator
        userContext.currentGoal = { 
          goalType: 'unknown', 
          goalStatus: 'failed', 
          flowKey: 'error', 
          currentStepIndex: 0, 
          collectedData: { confirmationMessage: "I'm sorry, I ran into an error trying to understand that." }
        };
      }
    } else {
      // Process the message against the existing, active goal
      console.log(`[State Manager] Processing existing goal: ${userCurrentGoal.goalType}, Step: ${userCurrentGoal.flowKey}[${userCurrentGoal.currentStepIndex}]`);
      await this.processExistingGoal(userCurrentGoal, chatContextAdapter, incomingUserMessage, analyzedIntent);
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