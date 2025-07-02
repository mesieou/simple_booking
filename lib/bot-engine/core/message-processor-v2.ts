import { BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { ConversationalParticipant, UserGoal } from "@/lib/bot-engine/types";
import { sessionManager } from "@/lib/bot-engine/session/session-manager-v2";
import { IntelligentLLMService } from "@/lib/bot-engine/services/llm-service";
import { GoalManager } from "./goal-manager";
import { FlowController } from "./flow-controller";
import { botTasks } from "@/lib/bot-engine/config/tasks";
import { conversationFlowBlueprints } from "@/lib/bot-engine/config/blueprints";

export interface MessageProcessorConfig {
  maxRetries: number;
  timeoutMs: number;
}

export class ScalableMessageProcessor {
  private llmService = new IntelligentLLMService();
  private goalManager = new GoalManager();
  private flowController = new FlowController();

  private config: MessageProcessorConfig = {
    maxRetries: 3,
    timeoutMs: 30000
  };

  constructor(config?: Partial<MessageProcessorConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async processMessage(
    participantId: string,
    businessId: string,
    message: string,
    attachments?: any[]
  ): Promise<BotResponse> {
    const sessionKey = `session:${businessId}:${participantId}`;
    let retries = 0;

    while (retries < this.config.maxRetries) {
      try {
        return await this.processWithRetry(sessionKey, participantId, businessId, message, attachments);
      } catch (error) {
        retries++;
        console.warn(`[MessageProcessor] Attempt ${retries} failed for ${sessionKey}:`, error);
        
        if (retries >= this.config.maxRetries) {
          console.error(`[MessageProcessor] All retries exhausted for ${sessionKey}`);
          return { text: "I'm having trouble processing your message. Please try again in a moment." };
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retries)));
      }
    }

    return { text: "Service temporarily unavailable. Please try again later." };
  }

  private async processWithRetry(
    sessionKey: string,
    participantId: string,
    businessId: string,
    message: string,
    attachments?: any[]
  ): Promise<BotResponse> {
    // 1. Get or create session
    const session = await sessionManager.getSession(participantId, businessId);
    
    // 2. Get current active goal
    const activeGoal = session.context.currentConversationSession?.activeGoals
      .find(g => g.goalStatus === 'inProgress');

    // 3. Determine intent (only if no active goal)
    let goalToProcess = activeGoal;
    
    if (!activeGoal) {
      const intent = await this.llmService.detectIntention(message, session.context);
      
      if (intent.detectedUserGoalType) {
        const newGoal = await this.goalManager.createNewGoal(
          intent,
          'customer',
          session.context
        );
        
        // Add goal to session
        const added = await sessionManager.addGoal(sessionKey, newGoal);
        if (!added) {
          throw new Error('Failed to add goal to session (version conflict)');
        }
        
        goalToProcess = newGoal;
        console.log(`[MessageProcessor] Created new ${newGoal.goalType} goal`);
      }
    }

    // 4. Process message with goal
    if (!goalToProcess) {
      // Handle FAQ/chitchat
      return this.handleFaqResponse(message, session.context);
    }

    // 5. Process booking flow
    const response = await this.processBookingFlow(sessionKey, goalToProcess, message, session.context);
    
    return response;
  }

  private async processBookingFlow(
    sessionKey: string,
    goal: UserGoal,
    message: string,
    context: any
  ): Promise<BotResponse> {
    const currentSteps = conversationFlowBlueprints[goal.flowKey];
    const stepName = currentSteps[goal.currentStepIndex];
    const stepHandler = botTasks[stepName];

    if (!stepHandler) {
      throw new Error(`No handler found for step: ${stepName}`);
    }

    // Validate input
    const validationResult = await stepHandler.validateUserInput(
      message,
      goal.collectedData,
      context
    );

    const isValid = typeof validationResult === 'boolean' 
      ? validationResult 
      : validationResult.isValidInput;

    if (!isValid) {
      const errorMessage = typeof validationResult === 'object' 
        ? validationResult.validationErrorMessage 
        : "Invalid input. Please try again.";
      
      return { text: errorMessage };
    }

    // Process and extract data
    const processingResult = await stepHandler.processAndExtractData(
      message,
      goal.collectedData,
      context
    );

    // Update goal with new data
    const updatedCollectedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult
      ? { ...goal.collectedData, ...processingResult.extractedInformation }
      : processingResult as Record<string, any>;

    // Update the goal in session
    const updated = await sessionManager.updateGoal(sessionKey, (currentGoal) => ({
      ...currentGoal,
      collectedData: updatedCollectedData,
      messageHistory: [
        ...currentGoal.messageHistory,
        {
          speakerRole: 'user' as const,
          content: message,
          messageTimestamp: new Date()
        }
      ]
    }));

    if (!updated) {
      throw new Error('Failed to update goal (version conflict)');
    }

    // Determine next step or completion
    const shouldAdvance = stepHandler.autoAdvance || 
                         updatedCollectedData.shouldAutoAdvance ||
                         this.shouldAdvanceStep(stepHandler, updatedCollectedData);

    if (shouldAdvance) {
      // Advance to next step
      await sessionManager.updateGoal(sessionKey, (currentGoal) => ({
        ...currentGoal,
        currentStepIndex: currentGoal.currentStepIndex + 1
      }));

      // Check if flow is complete
      if (goal.currentStepIndex + 1 >= currentSteps.length) {
        await sessionManager.updateGoal(sessionKey, (currentGoal) => ({
          ...currentGoal,
          goalStatus: 'completed'
        }));
        
        return { text: "Great! Your booking request has been completed." };
      }
    }

    // Generate response
    const responseText = updatedCollectedData.confirmationMessage ||
                        stepHandler.defaultChatbotPrompt ||
                        "Let's continue with your booking.";

    let buttons = undefined;
    if (stepHandler.fixedUiButtons) {
      buttons = typeof stepHandler.fixedUiButtons === 'function'
        ? await stepHandler.fixedUiButtons(updatedCollectedData, context)
        : stepHandler.fixedUiButtons;
    }

    // Add bot response to history
    await sessionManager.updateGoal(sessionKey, (currentGoal) => ({
      ...currentGoal,
      messageHistory: [
        ...currentGoal.messageHistory,
        {
          speakerRole: 'chatbot' as const,
          content: responseText,
          messageTimestamp: new Date()
        }
      ]
    }));

    return {
      text: responseText,
      buttons: buttons
    };
  }

  private async handleFaqResponse(message: string, context: any): Promise<BotResponse> {
    // Import FAQ handler
    const { handleFaqOrChitchat } = await import('@/lib/bot-engine/steps/faq/faq-handler');
    return handleFaqOrChitchat(context, message, []);
  }

  private shouldAdvanceStep(stepHandler: any, collectedData: Record<string, any>): boolean {
    // Add logic to determine if we should advance based on collected data
    // This could be based on required fields being filled, etc.
    return false;
  }
}

// Factory function for easy usage
export function createMessageProcessor(config?: Partial<MessageProcessorConfig>): ScalableMessageProcessor {
  return new ScalableMessageProcessor(config);
}

// Default instance
export const messageProcessor = createMessageProcessor(); 