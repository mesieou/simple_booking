/**
 * @fileoverview This file contains the core state management engine.
 * 
 * It is responsible for:
 * 1.  Receiving the current user state (UserContext) and the analyzed user intent (AnalyzedIntent).
 * 2.  Implementing the "Goal Switcher" logic to pause and resume tasks.
 * 3.  Executing the current step of a given "flow" (e.g., booking, FAQ).
 * 4.  Returning the new, updated UserContext.
 * 
 * This engine is purely for state and flow orchestration. It does not contain any
 * specific business logic for individual steps, which are delegated to handlers
 * within the `flows` directory.
 */ 


import { UserContext, UserGoal } from '../database/models/user-context';
import { AnalyzedIntent } from './llm-actions/chat-interactions/functions/intention-detector';
import { bookingCreatingForMobileService, bookingCreatingForNoneMobileService } from './flows/booking/booking.flow';
import { selectServiceHandler } from './flows/booking/selectService.handler';
import { Service } from '../database/models/service';

// Type Definitions
// These types define the structure for flow blueprints and individual step handlers.
export type ButtonConfig = {
  buttonText: string;
  buttonValue: string;
  buttonType?: 'postback' | 'link';
};

// Represents a single, self-contained step in a conversation flow.
export interface IndividualStepHandler {
  // A default prompt to send to the user if the step doesn't generate a dynamic one.
  defaultChatbotPrompt?: string;

  // Validates the user's input for the current step.
  validateUserInput: (userInput: string, currentGoalData: Record<string, any>, userContext: UserContext) => Promise<boolean>;

  // Processes valid input, extracts data, and updates the goal's collectedData.
  processAndExtractData: (validatedInput: string, currentGoalData: Record<string, any>, userContext: UserContext) => Promise<Record<string, any>>;

  // Generates fixed UI buttons (like multiple choice options).
  fixedUiButtons?: (currentGoalData: Record<string, any>, userContext: UserContext) => Promise<ButtonConfig[]> | ButtonConfig[];
  
  // If true, the engine will automatically advance to the next step without user input.
  autoAdvance?: boolean;
}

// --- Flow Registries ---
// These will be populated by the specific flow files (e.g., booking.flow.ts).

// Maps a flowKey to an array of step names (the "recipe").
const conversationFlowBlueprints: Record<string, string[]> = {
  bookingCreatingForMobileService,
  bookingCreatingForNoneMobileService,
};

// Maps a step name to its handler logic.
const botTasks: Record<string, IndividualStepHandler> = {
  selectService: selectServiceHandler,
  // Other handlers will be imported and added here as we port them.
};


// --- Core State Management Engine ---

/**
 * Handles a context switch by pausing the current goal.
 * @param userContext The user's current context.
 * @returns The updated UserContext.
 */
function handleContextSwitch(userContext: UserContext): UserContext {
  if (!userContext.currentGoal) {
    return userContext;
  }

  console.log(`[StateManager] CONTEXT SWITCH: Pausing goal ${userContext.currentGoal.flowKey}.`);
  const pausedGoal = { ...userContext.currentGoal, goalStatus: 'paused' as const };
  userContext.previousGoal = pausedGoal;
  userContext.currentGoal = null;

  return userContext;
}

/**
 * Creates a new goal based on the user's intent.
 * @param userContext The user's current context.
 * @param analyzedIntent The analyzed intent from the NLP module.
 * @returns The updated UserContext with a new currentGoal.
 */
async function createNewGoal(userContext: UserContext, analyzedIntent: AnalyzedIntent): Promise<UserContext> {
  console.log(`[StateManager] Creating new goal for intent: ${analyzedIntent.goalType}`);
  
  let flowKey: string | undefined;
  
  // Determine the correct flow to use based on the intent.
  if (analyzedIntent.goalType === 'serviceBooking' && userContext.businessId) {
    // Check if the business has mobile services to decide which booking flow to use.
    try {
      const services = await Service.getByBusiness(userContext.businessId);
      const hasMobileServices = services.some(service => service.getData().mobile === true);
      flowKey = hasMobileServices ? 'bookingCreatingForMobileService' : 'bookingCreatingForNoneMobileService';
    } catch (error) {
      console.error('[StateManager] Error loading services for flow determination:', error);
      // Default to a flow if service check fails.
      flowKey = 'bookingCreatingForNoneMobileService';
    }
  } else if (analyzedIntent.goalType === 'frequentlyAskedQuestion') {
    // flowKey = 'faqHandling'; // To be implemented later
  }
  // ... other goal types can be handled here.

  if (!flowKey) {
    console.log(`[StateManager] No flow found for intent: ${analyzedIntent.goalType}.`);
    // Optionally, we could set a 'chitChat' or 'default' goal here.
    return userContext;
  }

  const newGoal: UserGoal = {
    goalType: analyzedIntent.goalType,
    goalAction: analyzedIntent.goalAction,
    goalStatus: 'inProgress',
    currentStepIndex: 0,
    collectedData: { 
      ...analyzedIntent.extractedInformation 
    },
    messageHistory: [],
    flowKey: flowKey,
  };

  userContext.currentGoal = newGoal;
  console.log(`[StateManager] New goal created with flow: ${flowKey}`);
  
  return userContext;
}

/**
 * Processes the current step of the active goal.
 * @param userContext The user's current context.
 * @param incomingUserMessage The raw message from the user.
 * @returns The updated UserContext after processing the step.
 */
async function processStep(userContext: UserContext, incomingUserMessage: string): Promise<UserContext> {
  if (!userContext.currentGoal) {
    console.error("[StateManager] processStep called without a currentGoal.");
    return userContext;
  }

  const goal = userContext.currentGoal;
  console.log(`[StateManager] Processing step ${goal.currentStepIndex} for flow: ${goal.flowKey}`);

  const flowSteps = conversationFlowBlueprints[goal.flowKey];
  if (!flowSteps || goal.currentStepIndex >= flowSteps.length) {
    console.log(`[StateManager] Goal flow has been completed or is invalid.`);
    goal.goalStatus = 'completed';
    // We could add a final confirmation message to collectedData here.
    goal.collectedData.confirmationMessage = "It looks like we've finished!";
    return userContext;
  }

  const stepName = flowSteps[goal.currentStepIndex];
  const stepHandler = botTasks[stepName];

  if (!stepHandler) {
    console.error(`[StateManager] No handler found for step: ${stepName}`);
    goal.goalStatus = 'failed';
    goal.collectedData.stepError = `System error: Step handler for '${stepName}' is not implemented.`;
    return userContext;
  }

  // --- Execute the handler ---
  
  // 1. Validate user input for the current step.
  // An empty message is passed on the first execution of a step.
  const isValid = await stepHandler.validateUserInput(incomingUserMessage, goal.collectedData, userContext);
  
  if (!isValid) {
    console.log(`[StateManager] Step validation failed for step: ${stepName}.`);
    goal.collectedData.stepError = "I'm sorry, I didn't understand that. Could you please try again?";
    // The user stays on the current step.
    return userContext;
  }

  // 2. Process the data. This is where the main logic of the step happens.
  const updatedData = await stepHandler.processAndExtractData(incomingUserMessage, goal.collectedData, userContext);
  goal.collectedData = updatedData;
  
  // 3. Generate buttons for the response.
  if (stepHandler.fixedUiButtons) {
    goal.collectedData.uiButtons = await stepHandler.fixedUiButtons(goal.collectedData, userContext);
  }

  // 4. Advance to the next step.
  goal.currentStepIndex++;

  // --- Handle auto-advancing steps ---
  // This section is a simplified version for now. A full implementation would loop through
  // subsequent auto-advancing steps until it finds a step that requires user input.
  
  const nextStepIndex = goal.currentStepIndex;
  if (nextStepIndex < flowSteps.length) {
    const nextStepName = flowSteps[nextStepIndex];
    const nextStepHandler = botTasks[nextStepName];
    if (nextStepHandler?.autoAdvance) {
      console.log(`[StateManager] Auto-advancing to step: ${nextStepName}`);
      // As this is a simplified version, we just increment the step index.
      // A full implementation would recursively call a processing function here.
      goal.currentStepIndex++; 
    }
  }

  // Check if the flow has completed after advancing.
  if (goal.currentStepIndex >= flowSteps.length) {
    goal.goalStatus = 'completed';
    goal.collectedData.confirmationMessage = "Great! We've completed that task.";
  }

  return userContext;
}


/**
 * The main entry point for the state management engine.
 * It orchestrates goal switching, creation, and step processing.
 * @param userContext The complete state of the user.
 * @param analyzedIntent The structured analysis of the user's last message.
 * @param incomingUserMessage The raw text of the user's message.
 * @returns A promise resolving to the updated UserContext.
 */
export async function manageState(
  userContext: UserContext,
  analyzedIntent: AnalyzedIntent,
  incomingUserMessage: string
): Promise<UserContext> {
  
  console.log(`[StateManager] Managing state for user ${userContext.channelUserId}. Intent: ${analyzedIntent.goalType}`);

  if (analyzedIntent.contextSwitch) {
    userContext = handleContextSwitch(userContext);
  }

  // A flag to track if this is the first execution of a new goal.
  const isNewGoal = !userContext.currentGoal;

  if (!userContext.currentGoal) {
    // No active goal, so create a new one based on the intent.
    userContext = await createNewGoal(userContext, analyzedIntent);
  }

  if (userContext.currentGoal) {
    // If it's a new goal, the incoming message was already used for intent detection, 
    // so we process the first step with an empty string to trigger its initial state.
    const messageForStep = isNewGoal ? "" : incomingUserMessage;
    userContext = await processStep(userContext, messageForStep);
  } else {
    console.log(`[StateManager] No current goal to process after intent analysis. Awaiting next message.`);
  }
  
  // The function must always return the (potentially modified) userContext.
  return userContext;
} 

// .