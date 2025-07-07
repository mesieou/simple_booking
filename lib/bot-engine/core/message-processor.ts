import {
  ConversationalParticipant,
  ChatContext,
  UserGoal,
  LLMProcessingResult,
  ButtonConfig,
  ChatConversationSession,
} from "@/lib/bot-engine/types";
import { ChatMessage } from "@/lib/database/models/chat-session";
import { UserContext } from "@/lib/database/models/user-context";
import { BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { getOrCreateChatContext } from "@/lib/bot-engine/session/session-manager";
import { persistSessionState } from "@/lib/bot-engine/session/state-persister";
import { IntelligentLLMService } from "@/lib/bot-engine/services/llm-service";
import { LanguageDetectionService } from "@/lib/bot-engine/services/language-service";
import { FlowController } from "./flow-controller";
import { GoalManager } from "./goal-manager";
import { botTasks } from "@/lib/bot-engine/config/tasks";
import { conversationFlowBlueprints } from "@/lib/bot-engine/config/blueprints";
import { START_BOOKING_PAYLOAD } from "@/lib/bot-engine/config/constants";
import { BOOKING_TRANSLATIONS } from "@/lib/bot-engine/config/translations";
import { MessageProcessorLogger } from "@/lib/bot-engine/utils/logger";

/**
 * Processes incoming messages and manages conversation flow for the bot engine
 */
export class MessageProcessor {
  private llmService = new IntelligentLLMService();
  private flowController = new FlowController();
  private goalManager = new GoalManager();

  /**
   * Retrieves localized fallback messages based on user's language preference
   */
  private getLocalizedFallback(chatContext: ChatContext, key: string): string {
    const language = chatContext.participantPreferences.language || 'en';
    const translations = BOOKING_TRANSLATIONS[language as 'en' | 'es'] || BOOKING_TRANSLATIONS.en;
    return translations.MESSAGES[key as keyof typeof translations.MESSAGES] || key;
  }

  /**
   * Handles payment completion messages by routing to booking creation
   */
  private async handlePaymentCompletion(
    incomingUserMessage: string,
    existingContext: {
      context: ChatContext;
      sessionId: string;
      userContext: UserContext;
      historyForLLM: ChatMessage[];
      customerUser?: any;
    }
  ): Promise<{ activeSession: ChatConversationSession; contextData: any }> {
    const quoteId = incomingUserMessage.replace('PAYMENT_COMPLETED_', '');
    
    MessageProcessorLogger.journey('Payment completion detected', {
      sessionId: existingContext.sessionId,
      source: 'webhook',
    }, { quoteId });
    
    const contextData = existingContext;
    
    let activeSession = contextData.context.currentConversationSession!;
    let bookingGoal = this.findActiveBookingGoal(activeSession);
    
    if (!bookingGoal) {
      MessageProcessorLogger.flow('Creating new booking goal from payment', {
        sessionId: contextData.sessionId,
        source: 'payment_completion'
      });
      bookingGoal = await this.createBookingGoalFromPayment(quoteId, contextData);
    } else {
      MessageProcessorLogger.flow('Updating existing booking goal for payment', {
        sessionId: contextData.sessionId,
        goalType: bookingGoal.goalType,
        step: bookingGoal.flowKey
      });
      bookingGoal = this.updateExistingGoalForPayment(bookingGoal, quoteId);
    }
    
    activeSession.activeGoals = [bookingGoal];
    return { activeSession, contextData };
  }

  /**
   * Finds an active booking goal in the current session
   */
  private findActiveBookingGoal(activeSession: ChatConversationSession): UserGoal | undefined {
    return activeSession.activeGoals.find(g => 
      g.goalType === 'serviceBooking' && g.goalStatus === 'inProgress'
    );
  }

  /**
   * Creates a new booking goal from payment completion data
   */
  private async createBookingGoalFromPayment(quoteId: string, contextData: any): Promise<UserGoal> {
    const collectedDataFromQuote = await this.retrieveQuoteData(quoteId);
    const flowKey = await this.determineBookingFlowKey(contextData.context.currentParticipant.associatedBusinessId);
    
    MessageProcessorLogger.info('Goal created from payment with quote data', {
      sessionId: contextData.sessionId,
      goalType: 'serviceBooking'
    }, { flowKey, hasQuoteData: Object.keys(collectedDataFromQuote).length > 2 });
    
    return {
      goalType: 'serviceBooking',
      goalAction: 'create',
      goalStatus: 'inProgress',
      currentStepIndex: conversationFlowBlueprints[flowKey].indexOf('createBooking'),
      collectedData: collectedDataFromQuote,
      messageHistory: [],
      flowKey
    };
  }

  /**
   * Updates existing booking goal for payment completion
   */
  private updateExistingGoalForPayment(bookingGoal: UserGoal, quoteId: string): UserGoal {
    const createBookingIndex = conversationFlowBlueprints[bookingGoal.flowKey].indexOf('createBooking');
    if (createBookingIndex !== -1) {
      bookingGoal.currentStepIndex = createBookingIndex;
      bookingGoal.collectedData = {
        ...bookingGoal.collectedData, // Preserve existing session data
        paymentCompleted: true,
        quoteId: quoteId
      };
      
      MessageProcessorLogger.info('Preserved existing session data for payment completion', 
        { goalType: bookingGoal.goalType },
        { preservedDataKeys: Object.keys(bookingGoal.collectedData) }
      );
    }
    
    return bookingGoal;
  }

  /**
   * Retrieves booking data from quote for session restoration
   */
  private async retrieveQuoteData(quoteId: string): Promise<Record<string, any>> {
    let collectedDataFromQuote: Record<string, any> = {
      paymentCompleted: true,
      quoteId: quoteId
    };
    
    try {
      const { Quote } = await import('@/lib/database/models/quote');
      const quote = await Quote.getById(quoteId);
      
      if (quote) {
        const quoteData = {
          proposedDateTime: quote.proposedDateTime,
          serviceIds: quote.serviceIds,
          dropOff: quote.dropOff,
          pickUp: quote.pickUp,
          userId: quote.userId
        };
        
        collectedDataFromQuote = { ...collectedDataFromQuote, ...quoteData };
        MessageProcessorLogger.info('Quote data retrieved for session restoration', 
          { source: 'quote_lookup' },
          { quoteId, dataKeys: Object.keys(quoteData) }
        );
      } else {
        MessageProcessorLogger.warn('Quote not found during payment completion', { source: 'quote_lookup' }, { quoteId });
      }
    } catch (error) {
      MessageProcessorLogger.error('Error retrieving quote data for session restoration', { source: 'quote_lookup' }, { quoteId, error });
    }
    
    return collectedDataFromQuote;
  }

  /**
   * Determines the appropriate booking flow key based on business services
   */
  private async determineBookingFlowKey(businessId: string): Promise<string> {
    let flowKey = 'bookingCreatingForMobileService'; // Default
    
    if (businessId) {
      try {
        const { Service } = await import('@/lib/database/models/service');
        const services = await Service.getByBusiness(businessId);
        const servicesData = services.map(s => s.getData());
        const hasMobileServices = servicesData.some((service: any) => service.mobile === true);
        flowKey = hasMobileServices ? 'bookingCreatingForMobileService' : 'bookingCreatingForNoneMobileService';
        
        MessageProcessorLogger.flow('Flow key determined based on business services', 
          { businessId },
          { flowKey, serviceCount: servicesData.length, hasMobileServices }
        );
      } catch (error) {
        MessageProcessorLogger.error('Error determining flow key', { businessId }, { error });
      }
    }
    
    return flowKey;
  }

  /**
   * Main entry point for processing incoming user messages
   */
  async processIncomingMessage(
    incomingUserMessage: string,
    currentUser: ConversationalParticipant,
    historyForLLM?: ChatMessage[],
    existingContext?: {
      context: ChatContext;
      sessionId: string;
      userContext: UserContext;
      historyForLLM: ChatMessage[];
      customerUser?: any;
    }
  ): Promise<BotResponse> {
    const sessionId = existingContext?.sessionId || 'unknown';
    
    MessageProcessorLogger.journey('Message processing started', {
      sessionId,
      userId: currentUser.customerWhatsappNumber,
      businessId: currentUser.associatedBusinessId
    }, { 
      messagePreview: incomingUserMessage.substring(0, 50) + (incomingUserMessage.length > 50 ? '...' : ''),
      hasExistingContext: !!existingContext
    });

    // Validate input message
    if (!incomingUserMessage || incomingUserMessage.trim() === "") {
      MessageProcessorLogger.warn('Empty message received', { sessionId });
      return { text: "" };
    }

    MessageProcessorLogger.startTimer('total_processing', { sessionId });

    // Handle special payment completion routing
    if (incomingUserMessage.startsWith('PAYMENT_COMPLETED_')) {
      if (existingContext) {
        const { activeSession, contextData } = await this.handlePaymentCompletion(incomingUserMessage, existingContext);
        existingContext = contextData;
      } else {
        MessageProcessorLogger.warn('Payment completion received without existing context', {}, { messagePreview: incomingUserMessage.substring(0, 50) });
      }
    }

    // Initialize or retrieve conversation context
    const contextData = existingContext || await getOrCreateChatContext(currentUser);
    const { context: currentContext, sessionId: finalSessionId, userContext, historyForLLM: fetchedHistory, customerUser } = contextData;
    const messageHistoryToUse = historyForLLM || fetchedHistory;

    // Validate active session
    let activeSession: ChatConversationSession = currentContext.currentConversationSession!;
    if (!activeSession) {
      MessageProcessorLogger.error('No active session found', { sessionId: finalSessionId, userId: currentUser.customerWhatsappNumber });
      return { text: "I'm sorry, I'm having trouble retrieving our conversation." };
    }

    // Detect and update user language preference
    await LanguageDetectionService.detectAndUpdateLanguage(
      incomingUserMessage,
      currentContext,
      "[MessageProcessor]"
    );

    MessageProcessorLogger.flow('Context initialized', {
      sessionId: finalSessionId,
      userId: currentUser.customerWhatsappNumber,
      goalType: activeSession.activeGoals[0]?.goalType
    }, {
      activeGoalsCount: activeSession.activeGoals.length,
      historyLength: messageHistoryToUse.length,
      language: currentContext.participantPreferences.language
    });

    // Process message based on type and current goal state
    const botResponse = await this.routeMessageProcessing(
      incomingUserMessage,
      currentUser,
      currentContext,
      activeSession,
      messageHistoryToUse,
      customerUser
    );

    // Persist session state with complete response
    const finalResponse = {
      ...botResponse,
      listActionText: activeSession.activeGoals[0]?.collectedData.listActionText,
      listSectionTitle: activeSession.activeGoals[0]?.collectedData.listSectionTitle,
    };

    await persistSessionState(
      finalSessionId,
      userContext,
      activeSession,
      activeSession.activeGoals.find(g => g.goalStatus === "inProgress"),
      incomingUserMessage,
      finalResponse,
      messageHistoryToUse
    );

    const duration = MessageProcessorLogger.endTimer('total_processing', { sessionId: finalSessionId });

    MessageProcessorLogger.journey('Message processing completed', {
      sessionId: finalSessionId,
      userId: currentUser.customerWhatsappNumber
    }, {
      responseType: finalResponse.text ? 'text' : 'none',
      hasButtons: !!finalResponse.buttons?.length,
      duration
    });

    return this.finalizeResponse(finalResponse, currentContext);
  }

  /**
   * Routes message processing based on message type and current goal state
   */
  private async routeMessageProcessing(
    incomingUserMessage: string,
    currentUser: ConversationalParticipant,
    currentContext: ChatContext,
    activeSession: ChatConversationSession,
    messageHistoryToUse: ChatMessage[],
    customerUser?: any
  ): Promise<BotResponse> {
    let userCurrentGoal = activeSession.activeGoals.find(g => g.goalStatus === "inProgress");
    
    const context = {
      sessionId: activeSession.id || 'unknown',
      userId: currentUser.customerWhatsappNumber,
      goalType: userCurrentGoal?.goalType,
      step: userCurrentGoal ? conversationFlowBlueprints[userCurrentGoal.flowKey]?.[userCurrentGoal.currentStepIndex] : undefined
    };

    // Handle explicit booking start command
    if (incomingUserMessage.trim().toUpperCase() === START_BOOKING_PAYLOAD.toUpperCase()) {
      MessageProcessorLogger.flow('Explicit booking start command detected', context);
      return this.handleBookingStartCommand(
        currentUser,
        currentContext,
        activeSession,
        messageHistoryToUse,
        incomingUserMessage
      );
    }

    // Handle case when no active goal exists
    if (!userCurrentGoal) {
      MessageProcessorLogger.flow('No active goal - initiating goal detection', context);
      return this.handleNoActiveGoal(
        incomingUserMessage,
        currentUser,
        currentContext,
        activeSession
      );
    }

    // Process existing goal
    MessageProcessorLogger.flow('Processing existing goal', context, {
      currentStepIndex: userCurrentGoal.currentStepIndex,
      flowKey: userCurrentGoal.flowKey
    });

    return this.processExistingGoal(
      userCurrentGoal,
      currentContext,
      incomingUserMessage,
      messageHistoryToUse,
      customerUser
    );
  }

  /**
   * Handles explicit booking start command
   */
  private async handleBookingStartCommand(
    currentUser: ConversationalParticipant,
    currentContext: ChatContext,
    activeSession: ChatConversationSession,
    messageHistoryToUse: ChatMessage[],
    incomingUserMessage: string
  ): Promise<BotResponse> {
    const sessionId = activeSession.id || 'unknown';
    
    // Complete any existing goal
    const existingGoal = activeSession.activeGoals.find(g => g.goalStatus === "inProgress");
    if (existingGoal) {
      existingGoal.goalStatus = "completed";
      MessageProcessorLogger.flow('Completed existing goal for new booking start', {
        sessionId,
        goalType: existingGoal.goalType,
        step: conversationFlowBlueprints[existingGoal.flowKey]?.[existingGoal.currentStepIndex]
      });
    }

    // Create new booking goal
    const bookingGoalResult: LLMProcessingResult = {
      detectedUserGoalType: "serviceBooking",
      detectedGoalAction: "create",
    };

    const userCurrentGoal = await this.goalManager.createNewGoal(
      bookingGoalResult,
      currentUser.type,
      currentContext
    );
    
    MessageProcessorLogger.journey('New booking goal created', {
      sessionId,
      goalType: userCurrentGoal.goalType,
      step: conversationFlowBlueprints[userCurrentGoal.flowKey]?.[userCurrentGoal.currentStepIndex]
    }, { flowKey: userCurrentGoal.flowKey });
    
    // Preserve message history
    this.preserveMessageHistory(userCurrentGoal, messageHistoryToUse);
    activeSession.activeGoals = [userCurrentGoal];

    const result = await this.executeFirstStep(userCurrentGoal, currentContext, incomingUserMessage);
    return { text: result.responseToUser, buttons: result.uiButtonsToDisplay };
  }

  /**
   * Handles cases where no active goal exists - uses LLM to detect user intention
   */
  private async handleNoActiveGoal(
    incomingUserMessage: string,
    currentUser: ConversationalParticipant,
    currentContext: ChatContext,
    activeSession: ChatConversationSession
  ): Promise<BotResponse> {
    const sessionId = activeSession.id || 'unknown';
    
    MessageProcessorLogger.flow('Starting LLM goal detection', {
      sessionId,
      userId: currentUser.customerWhatsappNumber
    }, { 
      messagePreview: incomingUserMessage.substring(0, 30),
      userType: currentUser.type 
    });
    
    const llmGoalDetectionResult = await this.llmService.detectIntention(
      incomingUserMessage,
      currentContext
    );
    
    MessageProcessorLogger.info('LLM goal detection completed', {
      sessionId,
      userId: currentUser.customerWhatsappNumber
    }, {
      detectedGoalType: llmGoalDetectionResult.detectedUserGoalType,
      detectedAction: llmGoalDetectionResult.detectedGoalAction,
      hasExtractedInfo: !!llmGoalDetectionResult.extractedInformation
    });

    if (llmGoalDetectionResult.detectedUserGoalType) {
      MessageProcessorLogger.journey('Goal detected - creating new goal', {
        sessionId,
        goalType: llmGoalDetectionResult.detectedUserGoalType
      });
      
      const userCurrentGoal = await this.goalManager.createNewGoal(
        llmGoalDetectionResult,
        currentUser.type,
        currentContext
      );
      
      activeSession.activeGoals.push(userCurrentGoal);
      const result = await this.executeFirstStep(userCurrentGoal, currentContext, incomingUserMessage);
      return { text: result.responseToUser, buttons: result.uiButtonsToDisplay };
    } else {
      MessageProcessorLogger.flow('No goal detected - sending clarification request', {
        sessionId,
        userId: currentUser.customerWhatsappNumber
      });
      
      return {
        text: this.getLocalizedFallback(currentContext, 'CLARIFICATION_REQUEST'),
        buttons: undefined,
      };
    }
  }

  /**
   * Processes messages when an active goal exists
   */
  private async processExistingGoal(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string,
    messageHistoryToUse: ChatMessage[],
    customerUser?: any
  ): Promise<BotResponse> {
    const result = await this.processExistingGoalIntelligent(
      userCurrentGoal,
      currentContext,
      incomingUserMessage,
      messageHistoryToUse,
      customerUser
    );
    return { text: result.responseToUser, buttons: result.uiButtonsToDisplay };
  }

  /**
   * Preserves message history when creating new goals
   */
  private preserveMessageHistory(userCurrentGoal: UserGoal, messageHistoryToUse: ChatMessage[]): void {
    if (messageHistoryToUse && messageHistoryToUse.length > 0) {
      userCurrentGoal.messageHistory = messageHistoryToUse.map((msg) => ({
        speakerRole: msg.role === "user" ? "user" : "chatbot",
        content: typeof msg.content === "string" ? msg.content : (msg.content as any).text || "[Interactive Message]",
        messageTimestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      }));
      
      MessageProcessorLogger.debug('Message history preserved for new goal', 
        { goalType: userCurrentGoal.goalType },
        { preservedMessageCount: userCurrentGoal.messageHistory.length }
      );
    }
  }

  /**
   * Finalizes and returns the response without LLM translation (uses proper localization)
   */
  private async finalizeResponse(response: BotResponse, chatContext: ChatContext): Promise<BotResponse> {
    // All booking-related text should use proper localization system
    // This prevents double-translation issues where Spanish text gets translated back to English
    MessageProcessorLogger.debug('Response finalized using proper localization system');
    return response;
  }

  /**
   * Executes the first step of a conversation flow
   */
  private async executeFirstStep(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const stepHandler = this.getStepHandler(userCurrentGoal);
    const currentStepName = conversationFlowBlueprints[userCurrentGoal.flowKey][userCurrentGoal.currentStepIndex];
    
    MessageProcessorLogger.flow('Executing first step', {
      goalType: userCurrentGoal.goalType,
      step: currentStepName
    }, { 
      stepIndex: userCurrentGoal.currentStepIndex,
      isAutoAdvance: stepHandler.autoAdvance 
    });
    
    // Process the first step
    const processingResult = await stepHandler.processAndExtractData(
      "",
      userCurrentGoal.collectedData,
      currentContext
    );
    
    this.updateGoalCollectedData(userCurrentGoal, processingResult);

    // Handle auto-advance steps
    if (stepHandler.autoAdvance) {
      MessageProcessorLogger.flow('First step auto-advancing', {
        goalType: userCurrentGoal.goalType,
        step: currentStepName
      });
      return this.handleAutoAdvanceFromFirstStep(userCurrentGoal, currentContext, incomingUserMessage);
    }

    // Generate response and buttons for non-auto-advance steps
    const responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
      this.getLocalizedFallback(currentContext, 'GETTING_STARTED_FALLBACK');

    const uiButtonsToDisplay = await this.generateStepButtons(stepHandler, userCurrentGoal, currentContext);
    
    MessageProcessorLogger.info('First step completed', {
      goalType: userCurrentGoal.goalType,
      step: currentStepName
    }, {
      hasResponse: !!responseToUser,
      buttonCount: uiButtonsToDisplay?.length || 0
    });
    
    this.addMessageToHistory(userCurrentGoal, incomingUserMessage, responseToUser);
    return { responseToUser, uiButtonsToDisplay };
  }

  /**
   * Handles auto-advance logic from the first step
   */
  private async handleAutoAdvanceFromFirstStep(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    
    this.flowController.advanceAndSkipStep(userCurrentGoal);

    if (this.isGoalCompleted(userCurrentGoal, currentSteps)) {
      MessageProcessorLogger.journey('Goal completed during first step auto-advance', {
        goalType: userCurrentGoal.goalType
      });
      return this.completeGoal(userCurrentGoal, currentContext, incomingUserMessage);
    }

    return this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
  }

  /**
   * Executes auto-advance steps recursively
   */
  private async executeAutoAdvanceStep(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const stepHandler = this.getStepHandler(userCurrentGoal);
    const currentStepName = conversationFlowBlueprints[userCurrentGoal.flowKey][userCurrentGoal.currentStepIndex];
    
    MessageProcessorLogger.flow('Executing auto-advance step', {
      goalType: userCurrentGoal.goalType,
      step: currentStepName
    }, { stepIndex: userCurrentGoal.currentStepIndex });
    
    // Process the current step
    const processingResult = await stepHandler.processAndExtractData(
      "",
      userCurrentGoal.collectedData,
      currentContext
    );
    
    this.updateGoalCollectedData(userCurrentGoal, processingResult);

    // Check if goal was completed during processing
    if (userCurrentGoal.collectedData.goalStatus === "completed") {
      userCurrentGoal.goalStatus = "completed";
      MessageProcessorLogger.journey('Goal completed during auto-advance step processing', {
        goalType: userCurrentGoal.goalType,
        step: currentStepName
      });
      
      const responseToUser = userCurrentGoal.collectedData.confirmationMessage ||
        this.getLocalizedFallback(currentContext, 'REQUEST_COMPLETED_FALLBACK');
      return { responseToUser, uiButtonsToDisplay: undefined };
    }

    // Handle conditional or continued auto-advance
    const shouldContinueAutoAdvance = stepHandler.autoAdvance || userCurrentGoal.collectedData.shouldAutoAdvance;
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    
    if (shouldContinueAutoAdvance && userCurrentGoal.currentStepIndex + 1 < currentSteps.length) {
      return this.continueAutoAdvance(userCurrentGoal, currentContext);
    }

    // Generate final response for this step
    const responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
      this.getLocalizedFallback(currentContext, 'CONTINUING_BOOKING_FALLBACK');

    const uiButtonsToDisplay = await this.generateStepButtons(stepHandler, userCurrentGoal, currentContext);
    
    MessageProcessorLogger.info('Auto-advance step completed', {
      goalType: userCurrentGoal.goalType,
      step: currentStepName
    }, {
      hasResponse: !!responseToUser,
      buttonCount: uiButtonsToDisplay?.length || 0
    });
    
    return { responseToUser, uiButtonsToDisplay };
  }

  /**
   * Continues auto-advance flow to the next appropriate step
   */
  private async continueAutoAdvance(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    console.log(`[MessageProcessor] Continuing auto-advance`);

    // Reset conditional auto-advance flag
    if (userCurrentGoal.collectedData.shouldAutoAdvance) {
      userCurrentGoal.collectedData.shouldAutoAdvance = false;
    }

    // Navigate to the appropriate next step
    const targetStep = this.flowController.navigateToAppropriateStep(userCurrentGoal);
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const targetStepIndex = currentSteps.indexOf(targetStep);
    
    if (targetStepIndex !== -1) {
      userCurrentGoal.currentStepIndex = targetStepIndex;
    } else {
      this.flowController.advanceAndSkipStep(userCurrentGoal);
    }
    
    return this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
  }

  /**
   * Completes a goal and returns completion message
   */
  private completeGoal(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): { responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] } {
    userCurrentGoal.goalStatus = "completed";
    const responseToUser = userCurrentGoal.collectedData.confirmationMessage ||
      this.getLocalizedFallback(currentContext, 'BOOKING_COMPLETED_FALLBACK');
    
    this.addMessageToHistory(userCurrentGoal, incomingUserMessage, responseToUser);
    return { responseToUser, uiButtonsToDisplay: undefined };
  }

  /**
   * Gets the step handler for the current step in the goal
   */
  private getStepHandler(userCurrentGoal: UserGoal): any {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const stepName = currentSteps[userCurrentGoal.currentStepIndex];
    const stepHandler = botTasks[stepName];

    if (!stepHandler) {
      throw new Error(`No handler found for step: ${stepName}`);
    }

    return stepHandler;
  }

  /**
   * Updates goal's collected data from processing result
   */
  private updateGoalCollectedData(userCurrentGoal: UserGoal, processingResult: any): void {
    const oldData = { ...userCurrentGoal.collectedData };
    userCurrentGoal.collectedData = typeof processingResult === "object" && "extractedInformation" in processingResult
      ? { ...userCurrentGoal.collectedData, ...processingResult.extractedInformation }
      : processingResult as Record<string, any>;
    
    // Debug logging for pickup address updates
    if (oldData.pickupAddress !== userCurrentGoal.collectedData.pickupAddress || 
        oldData.customerAddress !== userCurrentGoal.collectedData.customerAddress) {
      console.log('[MessageProcessor] Address data updated:', {
        oldPickupAddress: oldData.pickupAddress,
        newPickupAddress: userCurrentGoal.collectedData.pickupAddress,
        oldCustomerAddress: oldData.customerAddress,
        newCustomerAddress: userCurrentGoal.collectedData.customerAddress,
        pickupAddressValidated: userCurrentGoal.collectedData.pickupAddressValidated
      });
    }

    // CRITICAL LOGGING: Track error message flow
    if (userCurrentGoal.collectedData.confirmationMessage !== oldData.confirmationMessage ||
        userCurrentGoal.collectedData.lastErrorMessage !== oldData.lastErrorMessage) {
      console.log('[MessageProcessor] ERROR MESSAGE FLOW - Data update detected:', {
        oldConfirmationMessage: oldData.confirmationMessage,
        newConfirmationMessage: userCurrentGoal.collectedData.confirmationMessage,
        oldLastErrorMessage: oldData.lastErrorMessage,
        newLastErrorMessage: userCurrentGoal.collectedData.lastErrorMessage,
        isAddressValidated: userCurrentGoal.collectedData.isAddressValidated,
        pickupAddressValidated: userCurrentGoal.collectedData.pickupAddressValidated,
        stepContext: 'updateGoalCollectedData'
      });
    }
  }

  /**
   * Checks if the goal has completed all steps
   */
  private isGoalCompleted(userCurrentGoal: UserGoal, currentSteps: string[]): boolean {
    return userCurrentGoal.currentStepIndex >= currentSteps.length;
  }

  /**
   * Generates UI buttons for a step handler
   */
  private async generateStepButtons(
    stepHandler: any,
    userCurrentGoal: UserGoal,
    currentContext: ChatContext
  ): Promise<ButtonConfig[] | undefined> {
    if (!stepHandler.fixedUiButtons) {
      return undefined;
    }

    try {
      if (typeof stepHandler.fixedUiButtons === "function") {
        return await stepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
      } else {
        return stepHandler.fixedUiButtons;
      }
    } catch (error) {
      console.error(`[MessageProcessor] Error generating buttons:`, error);
      return [];
    }
  }

  /**
   * Adds user and bot messages to goal history
   */
  private addMessageToHistory(userCurrentGoal: UserGoal, userMessage: string, botResponse: string): void {
    userCurrentGoal.messageHistory.push(
      {
        speakerRole: "user",
        content: userMessage,
        messageTimestamp: new Date(),
      },
      {
        speakerRole: "chatbot",
        content: botResponse,
        messageTimestamp: new Date(),
      }
    );
  }

  /**
   * Processes existing goals with intelligent flow analysis and system button detection
   */
  private async processExistingGoalIntelligent(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string,
    historyForLLM?: ChatMessage[],
    customerUser?: { firstName: string; lastName: string; id: string }
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const messageHistory = this.buildMessageHistoryForLLM(userCurrentGoal);
    const currentStepName = conversationFlowBlueprints[userCurrentGoal.flowKey][userCurrentGoal.currentStepIndex];

    // Handle system button actions without LLM analysis
    if (this.isSystemButtonAction(incomingUserMessage)) {
      console.log(`[MessageProcessor] Bypassing LLM analysis for system button: ${incomingUserMessage}`);
      return this.processWithCurrentStepHandler(
        userCurrentGoal,
        currentContext,
        incomingUserMessage,
        undefined,
        historyForLLM,
        customerUser
      );
    }

    // CRITICAL FIX: For address collection steps, try step handler first before LLM analysis
    const isAddressCollectionStep = ['askPickupAddress', 'askDropoffAddress'].includes(currentStepName);
    const isExplicitNavigation = /\b(go back|change|edit|restart|different)\b/i.test(incomingUserMessage);
    
    if (isAddressCollectionStep && !isExplicitNavigation) {
      console.log(`[MessageProcessor] Address collection step - trying step handler first: ${currentStepName}`);
      
      // Try the step handler first
      const currentStepHandler = this.getStepHandler(userCurrentGoal);
      const validationResult = await this.validateUserInput(currentStepHandler, incomingUserMessage, userCurrentGoal, currentContext);
      
      if (validationResult.isValid) {
        console.log(`[MessageProcessor] Step handler validation passed - processing without LLM analysis`);
        return this.processWithCurrentStepHandler(
          userCurrentGoal,
          currentContext,
          incomingUserMessage,
          undefined,
          historyForLLM,
          customerUser
        );
      } else {
        console.log(`[MessageProcessor] Step handler validation failed - falling back to LLM analysis`);
      }
    }

    console.log(`[MessageProcessor] Using intelligent flow analysis with ${messageHistory.length} messages`);

    try {
      const conversationDecision = await this.llmService.analyzeConversationFlow(
        incomingUserMessage,
        userCurrentGoal,
        currentContext,
        messageHistory
      );

      return this.handleConversationDecision(
        conversationDecision,
        userCurrentGoal,
        currentContext,
        incomingUserMessage,
        historyForLLM,
        customerUser
      );
    } catch (error) {
      console.error(`[MessageProcessor] LLM analysis failed, falling back to original flow:`, error);
      return this.processExistingGoalIntelligent(userCurrentGoal, currentContext, incomingUserMessage);
    }
  }

  /**
   * Builds message history array for LLM analysis
   */
  private buildMessageHistoryForLLM(userCurrentGoal: UserGoal): Array<{role: 'user' | 'assistant', content: string, timestamp: Date}> {
    return userCurrentGoal.messageHistory.map((msg) => ({
      role: msg.speakerRole === "user" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
      timestamp: msg.messageTimestamp,
    }));
  }

  /**
   * Detects if incoming message is a system button action
   */
  private isSystemButtonAction(incomingUserMessage: string): boolean {
    const systemButtonIds = [
      'add_another_service', 'continue_with_services', 'confirm_quote', 'edit_quote',
      'confirm_address', 'enter_different_address', 'start_booking_flow', 'choose_another_day',
      'open_calendar', 'edit_service', 'edit_time', 'tomorrow_7am', 'tomorrow_9am'
    ];
    
    return systemButtonIds.includes(incomingUserMessage.toLowerCase().trim()) ||
      incomingUserMessage.startsWith("slot_") ||
      incomingUserMessage.startsWith("day_") ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incomingUserMessage);
  }

  /**
   * Handles conversation decisions from LLM analysis
   */
  private async handleConversationDecision(
    conversationDecision: any,
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string,
    historyForLLM?: ChatMessage[],
    customerUser?: any
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const currentStepName = conversationFlowBlueprints[userCurrentGoal.flowKey][userCurrentGoal.currentStepIndex];
    
    console.log('[MessageProcessor] ERROR MESSAGE FLOW - handleConversationDecision called:', {
      step: currentStepName,
      action: conversationDecision?.action,
      confidence: conversationDecision?.confidence,
      hasConfirmationMessage: !!userCurrentGoal.collectedData.confirmationMessage,
      hasLastErrorMessage: !!userCurrentGoal.collectedData.lastErrorMessage,
      stepContext: 'handleConversationDecision_start'
    });
    
    // Handle high-confidence navigation actions
    if (conversationDecision.action === "go_back" && conversationDecision.confidence > 0.7) {
      console.log('[MessageProcessor] ERROR MESSAGE FLOW - Handling go_back action');
      return this.flowController.handleGoBack(userCurrentGoal, currentContext, conversationDecision, customerUser);
    }

    if (conversationDecision.action === "restart" && conversationDecision.confidence > 0.8) {
      console.log('[MessageProcessor] ERROR MESSAGE FLOW - Handling restart action');
      return this.flowController.handleRestart(userCurrentGoal, currentContext, this.executeFirstStep.bind(this));
    }

    if (conversationDecision.action === "switch_topic" && conversationDecision.confidence >= 0.8) {
      console.log('[MessageProcessor] ERROR MESSAGE FLOW - Handling topic switch action');
      return this.handleTopicSwitch(conversationDecision, incomingUserMessage, userCurrentGoal, currentContext);
    }

    // Default to processing with current step handler
    console.log('[MessageProcessor] ERROR MESSAGE FLOW - Default processing with current step handler:', {
      step: currentStepName,
      action: conversationDecision?.action,
      confidence: conversationDecision?.confidence,
      stepContext: 'handleConversationDecision_defaultProcessing'
    });
    
    return this.processWithCurrentStepHandler(
      userCurrentGoal,
      currentContext,
      incomingUserMessage,
      conversationDecision,
      historyForLLM,
      customerUser
    );
  }

  /**
   * Handles topic switching when user changes conversation direction
   */
  private async handleTopicSwitch(
    conversationDecision: any,
    incomingUserMessage: string,
    userCurrentGoal: UserGoal,
    currentContext: ChatContext
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const topicSwitchResult = await this.goalManager.handleTopicSwitch(
      currentContext,
      conversationDecision,
      incomingUserMessage,
      userCurrentGoal
    );

    if (topicSwitchResult.newGoal && currentContext.currentConversationSession) {
      currentContext.currentConversationSession.activeGoals = [topicSwitchResult.newGoal];
    }

    return {
      responseToUser: topicSwitchResult.responseToUser,
      uiButtonsToDisplay: topicSwitchResult.uiButtonsToDisplay,
    };
  }

  /**
   * Processes message using the current step handler with intelligent enhancements
   */
  private async processWithCurrentStepHandler(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string,
    conversationDecision?: any,
    historyForLLM?: ChatMessage[],
    customerUser?: { firstName: string; lastName: string; id: string }
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    userCurrentGoal.messageHistory.push({
      speakerRole: "user",
      content: incomingUserMessage,
      messageTimestamp: new Date(),
    });

    const currentStepHandler = this.getStepHandler(userCurrentGoal);
    const validationResult = await this.validateUserInput(currentStepHandler, incomingUserMessage, userCurrentGoal, currentContext);

    if (validationResult.isValid) {
      return this.handleValidInput(
        validationResult,
        userCurrentGoal,
        currentContext,
        currentStepHandler,
        conversationDecision,
        customerUser
      );
    } else {
      return this.handleInvalidInput(
        validationResult,
        userCurrentGoal,
        currentContext,
        currentStepHandler,
        incomingUserMessage,
        conversationDecision,
        customerUser
      );
    }
  }

  /**
   * Validates user input using the current step handler
   */
  private async validateUserInput(
    currentStepHandler: any,
    incomingUserMessage: string,
    userCurrentGoal: UserGoal,
    currentContext: ChatContext
  ): Promise<{
    isValid: boolean;
    errorMessage?: string;
    transformedInput?: string;
    originalInput?: string;
  }> {
    const validationResult = await currentStepHandler.validateUserInput(
      incomingUserMessage,
      userCurrentGoal.collectedData,
      currentContext
    );

    return {
      isValid: typeof validationResult === "boolean" ? validationResult : validationResult.isValidInput || false,
      errorMessage: typeof validationResult === "object" ? validationResult.validationErrorMessage : undefined,
      transformedInput: typeof validationResult === "object" ? validationResult.transformedInput : undefined,
      originalInput: incomingUserMessage, // CRITICAL FIX: Include the original input
    };
  }

  /**
   * Handles valid user input and advances the conversation flow
   */
  private async handleValidInput(
    validationResult: any,
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    currentStepHandler: any,
    conversationDecision?: any,
    customerUser?: any
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const inputToProcess = validationResult.transformedInput || validationResult.originalInput;
    
    // Process and extract data
    const processingResult = await currentStepHandler.processAndExtractData(
      inputToProcess,
      userCurrentGoal.collectedData,
      currentContext
    );
    
    this.updateGoalCollectedData(userCurrentGoal, processingResult);

    // Handle special flow control commands
    if (userCurrentGoal.collectedData.restartBookingFlow) {
      return this.flowController.handleOriginalRestartFlow(userCurrentGoal, currentContext);
    }

    if (userCurrentGoal.collectedData.navigateBackTo) {
      return this.flowController.handleOriginalNavigateBack(userCurrentGoal, currentContext);
    }

    // Advance to next step
    this.advanceToNextStep(userCurrentGoal);

    console.log('[MessageProcessor] ERROR MESSAGE FLOW - After step advancement:', {
      step: conversationFlowBlueprints[userCurrentGoal.flowKey][userCurrentGoal.currentStepIndex],
      stepIndex: userCurrentGoal.currentStepIndex,
      hasConfirmationMessage: !!userCurrentGoal.collectedData.confirmationMessage,
      hasLastErrorMessage: !!userCurrentGoal.collectedData.lastErrorMessage,
      stepContext: 'handleValidInput_afterAdvancement'
    });

    // Check if goal is completed
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    if (this.isGoalCompleted(userCurrentGoal, currentSteps) || userCurrentGoal.collectedData.goalStatus === "completed") {
      console.log('[MessageProcessor] ERROR MESSAGE FLOW - Goal completed, returning completion message');
      return this.completeGoalWithMessage(userCurrentGoal, currentContext);
    }

    // Process next step
    console.log('[MessageProcessor] ERROR MESSAGE FLOW - Processing next step:', {
      step: conversationFlowBlueprints[userCurrentGoal.flowKey][userCurrentGoal.currentStepIndex],
      stepContext: 'handleValidInput_beforeProcessNextStep'
    });
    return this.processNextStep(userCurrentGoal, currentContext, conversationDecision, customerUser);
  }

  /**
   * Handles invalid user input with intelligent response generation
   */
  private async handleInvalidInput(
    validationResult: any,
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    currentStepHandler: any,
    incomingUserMessage: string,
    conversationDecision?: any,
    customerUser?: any
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    let responseToUser: string;

    // Generate contextual response for off-topic questions with high confidence
    if (conversationDecision?.action === "continue" || conversationDecision?.action === "switch_topic") {
      if (conversationDecision.confidence > 0.7) {
        responseToUser = await this.generateContextualErrorResponse(
          userCurrentGoal,
          currentContext,
          incomingUserMessage,
          conversationDecision,
          customerUser
        );
      } else {
        responseToUser = validationResult.errorMessage || "I didn't understand that. Could you please try again?";
      }
    } else if (validationResult.errorMessage === "" || !validationResult.errorMessage) {
      return this.handleEmptyValidationError(userCurrentGoal, currentContext, incomingUserMessage);
    } else {
      responseToUser = await this.generateContextualErrorResponse(
        userCurrentGoal,
        currentContext,
        incomingUserMessage,
        conversationDecision,
        customerUser
      ) || validationResult.errorMessage;
    }

    // Refresh UI data and generate buttons
    await this.refreshStepUIData(currentStepHandler, userCurrentGoal, currentContext);
    const uiButtonsToDisplay = await this.generateStepButtons(currentStepHandler, userCurrentGoal, currentContext);

    userCurrentGoal.messageHistory.push({
      speakerRole: "chatbot",
      content: responseToUser,
      messageTimestamp: new Date(),
    });

    return { responseToUser, uiButtonsToDisplay };
  }

  /**
   * Generates contextual error responses using LLM when available
   */
  private async generateContextualErrorResponse(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string,
    conversationDecision?: any,
    customerUser?: any
  ): Promise<string> {
    try {
      if (conversationDecision) {
        const contextualResponse = await this.llmService.generateContextualResponse(
          userCurrentGoal,
          currentContext,
          incomingUserMessage,
          conversationDecision,
          this.buildMessageHistoryForLLM(userCurrentGoal),
          customerUser
        );
        return contextualResponse.text;
      }
    } catch (error) {
      console.error(`[MessageProcessor] LLM error response generation failed:`, error);
    }
    
    return "I didn't understand that. Could you please try again?";
  }

  /**
   * Advances the goal to the next appropriate step
   */
  private advanceToNextStep(userCurrentGoal: UserGoal): void {
    const currentStepName = conversationFlowBlueprints[userCurrentGoal.flowKey][userCurrentGoal.currentStepIndex];
    console.log('[MessageProcessor] advanceToNextStep called:', {
      currentStep: currentStepName,
      currentStepIndex: userCurrentGoal.currentStepIndex,
      hasPickupAddress: !!userCurrentGoal.collectedData.pickupAddress,
      hasCustomerAddress: !!userCurrentGoal.collectedData.customerAddress
    });
    
    const targetStep = this.flowController.navigateToAppropriateStep(userCurrentGoal);
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const targetStepIndex = currentSteps.indexOf(targetStep);
    
    console.log('[MessageProcessor] Navigation result:', {
      targetStep,
      targetStepIndex,
      currentStepIndex: userCurrentGoal.currentStepIndex
    });
    
    if (targetStepIndex !== -1) {
      userCurrentGoal.currentStepIndex = targetStepIndex;
      console.log('[MessageProcessor] Advanced to step index:', targetStepIndex);
    } else {
      console.log('[MessageProcessor] Using fallback advance');
      this.flowController.advanceAndSkipStep(userCurrentGoal);
    }
  }

  /**
   * Completes goal and returns completion message
   */
  private completeGoalWithMessage(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext
  ): { responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] } {
    userCurrentGoal.goalStatus = "completed";
    const responseToUser = userCurrentGoal.collectedData.confirmationMessage || 
      this.getLocalizedFallback(currentContext, 'BOOKING_COMPLETED_FALLBACK');
    
    userCurrentGoal.messageHistory.push({
      speakerRole: "chatbot",
      content: responseToUser,
      messageTimestamp: new Date(),
    });
    
    return { responseToUser, uiButtonsToDisplay: undefined };
  }

  /**
   * Processes the next step in the conversation flow
   */
  private async processNextStep(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    conversationDecision?: any,
    customerUser?: any
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const currentStepName = conversationFlowBlueprints[userCurrentGoal.flowKey][userCurrentGoal.currentStepIndex];
    const nextStepHandler = this.getStepHandler(userCurrentGoal);
    
    console.log('[MessageProcessor] ERROR MESSAGE FLOW - processNextStep called:', {
      step: currentStepName,
      stepIndex: userCurrentGoal.currentStepIndex,
      hasConfirmationMessage: !!userCurrentGoal.collectedData.confirmationMessage,
      hasLastErrorMessage: !!userCurrentGoal.collectedData.lastErrorMessage,
      confirmationMessagePreview: userCurrentGoal.collectedData.confirmationMessage?.substring(0, 100),
      stepContext: 'processNextStep_start'
    });
    
    // Process next step data
    const nextStepResult = await nextStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
    this.updateGoalCollectedData(userCurrentGoal, nextStepResult);

    console.log('[MessageProcessor] ERROR MESSAGE FLOW - After processAndExtractData:', {
      step: currentStepName,
      hasConfirmationMessage: !!userCurrentGoal.collectedData.confirmationMessage,
      hasLastErrorMessage: !!userCurrentGoal.collectedData.lastErrorMessage,
      confirmationMessagePreview: userCurrentGoal.collectedData.confirmationMessage?.substring(0, 100),
      autoAdvance: nextStepHandler.autoAdvance,
      shouldAutoAdvance: userCurrentGoal.collectedData.shouldAutoAdvance,
      stepContext: 'processNextStep_afterProcessing'
    });

    // Handle auto-advance steps
    if (nextStepHandler.autoAdvance || userCurrentGoal.collectedData.shouldAutoAdvance) {
      console.log('[MessageProcessor] ERROR MESSAGE FLOW - Auto-advancing from step:', currentStepName);
      return this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
    }

    // Generate response and buttons for regular steps
    const responseToUser = await this.generateStepResponse(
      userCurrentGoal,
      currentContext,
      conversationDecision,
      customerUser
    );
    
    console.log('[MessageProcessor] ERROR MESSAGE FLOW - Generated response:', {
      step: currentStepName,
      responsePreview: responseToUser?.substring(0, 100),
      usedConfirmationMessage: responseToUser === userCurrentGoal.collectedData.confirmationMessage,
      stepContext: 'processNextStep_responseGenerated'
    });
    
    const uiButtonsToDisplay = await this.generateStepButtons(nextStepHandler, userCurrentGoal, currentContext);
    
    userCurrentGoal.messageHistory.push({
      speakerRole: "chatbot",
      content: responseToUser,
      messageTimestamp: new Date(),
    });

    return { responseToUser, uiButtonsToDisplay };
  }

  /**
   * Generates appropriate response for the current step
   */
  private async generateStepResponse(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    conversationDecision?: any,
    customerUser?: any
  ): Promise<string> {
    const currentStepName = conversationFlowBlueprints[userCurrentGoal.flowKey][userCurrentGoal.currentStepIndex];
    
    console.log('[MessageProcessor] ERROR MESSAGE FLOW - generateStepResponse called:', {
      step: currentStepName,
      hasConversationDecision: !!conversationDecision,
      hasConfirmationMessage: !!userCurrentGoal.collectedData.confirmationMessage,
      hasLastErrorMessage: !!userCurrentGoal.collectedData.lastErrorMessage,
      confirmationMessagePreview: userCurrentGoal.collectedData.confirmationMessage?.substring(0, 100),
      stepContext: 'generateStepResponse_start'
    });
    
    // CRITICAL FIX: Determine when to use LLM vs step-generated messages
    const hasValidationError = userCurrentGoal.collectedData.lastErrorMessage || 
                              (userCurrentGoal.collectedData.confirmationMessage?.includes('❌') || 
                               userCurrentGoal.collectedData.confirmationMessage?.includes('Invalid'));
    
    const isStepWithSpecificMessage = ['askPickupAddress', 'askDropoffAddress', 'validateAddress', 'selectService', 'addAdditionalServices'].includes(currentStepName);
    const hasStepGeneratedMessage = !!userCurrentGoal.collectedData.confirmationMessage;
    
    // Use LLM only for high-confidence navigation actions, not for normal step progression
    const shouldUseLLM = conversationDecision && 
                        ['go_back', 'restart', 'switch_topic'].includes(conversationDecision.action) &&
                        conversationDecision.confidence > 0.7;
    
    console.log('[MessageProcessor] ERROR MESSAGE FLOW - LLM usage analysis:', {
      step: currentStepName,
      hasValidationError,
      isStepWithSpecificMessage,
      hasStepGeneratedMessage,
      conversationAction: conversationDecision?.action,
      conversationConfidence: conversationDecision?.confidence,
      shouldUseLLM,
      stepContext: 'generateStepResponse_analysis'
    });
    
    if (hasValidationError) {
      console.log('[MessageProcessor] ERROR MESSAGE FLOW - Validation error detected - bypassing LLM:', {
        step: currentStepName,
        lastErrorMessage: userCurrentGoal.collectedData.lastErrorMessage,
        confirmationMessagePreview: userCurrentGoal.collectedData.confirmationMessage?.substring(0, 100),
        stepContext: 'generateStepResponse_validationError'
      });
      
      // Use the validation error message directly
      const fallbackMessage = this.getLocalizedFallback(currentContext, 'CONTINUE_BOOKING_FALLBACK');
      const finalResponse = userCurrentGoal.collectedData.confirmationMessage || fallbackMessage;
      
      console.log('[MessageProcessor] ERROR MESSAGE FLOW - Using validation error message directly:', {
        step: currentStepName,
        finalResponse: finalResponse?.substring(0, 100),
        stepContext: 'generateStepResponse_validationErrorResponse'
      });
      
      return finalResponse;
    }
    
    if (isStepWithSpecificMessage && hasStepGeneratedMessage && !shouldUseLLM) {
      console.log('[MessageProcessor] ERROR MESSAGE FLOW - Using step-generated message instead of LLM:', {
        step: currentStepName,
        stepMessage: userCurrentGoal.collectedData.confirmationMessage?.substring(0, 100),
        stepContext: 'generateStepResponse_stepMessage'
      });
      
      return userCurrentGoal.collectedData.confirmationMessage;
    }
    
    try {
      if (shouldUseLLM) {
        console.log('[MessageProcessor] ERROR MESSAGE FLOW - Using LLM for response generation:', {
          step: currentStepName,
          decisionAction: conversationDecision.action,
          decisionConfidence: conversationDecision.confidence,
          stepContext: 'generateStepResponse_llm'
        });
        
        const contextualResponse = await this.llmService.generateContextualResponse(
          userCurrentGoal,
          currentContext,
          "",
          conversationDecision,
          this.buildMessageHistoryForLLM(userCurrentGoal),
          customerUser
        );
        
        console.log('[MessageProcessor] ERROR MESSAGE FLOW - LLM response generated:', {
          step: currentStepName,
          llmResponse: contextualResponse.text?.substring(0, 100),
          stepContext: 'generateStepResponse_llmResult'
        });
        
        return contextualResponse.text;
      } else if (conversationDecision) {
        console.log('[MessageProcessor] ERROR MESSAGE FLOW - LLM decision present but not using LLM:', {
          step: currentStepName,
          decisionAction: conversationDecision.action,
          decisionConfidence: conversationDecision.confidence,
          reason: 'Normal step progression - using step message instead',
          stepContext: 'generateStepResponse_llmSkipped'
        });
      }
    } catch (error) {
      console.error(`[MessageProcessor] LLM response generation failed, using original:`, error);
    }
    
    const fallbackMessage = this.getLocalizedFallback(currentContext, 'CONTINUE_BOOKING_FALLBACK');
    const finalResponse = userCurrentGoal.collectedData.confirmationMessage || fallbackMessage;
    
    console.log('[MessageProcessor] ERROR MESSAGE FLOW - Using confirmation message or fallback:', {
      step: currentStepName,
      usingConfirmationMessage: !!userCurrentGoal.collectedData.confirmationMessage,
      finalResponse: finalResponse?.substring(0, 100),
      fallbackMessage,
      stepContext: 'generateStepResponse_fallback'
    });
    
    return finalResponse;
  }

  /**
   * Refreshes UI data for the current step
   */
  private async refreshStepUIData(
    stepHandler: any,
    userCurrentGoal: UserGoal,
    currentContext: ChatContext
  ): Promise<void> {
    try {
      const stepUIDataResult = await stepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
      this.updateGoalCollectedData(userCurrentGoal, stepUIDataResult);
    } catch (error) {
      console.error(`[MessageProcessor] Failed to refresh UI data for current step`, error);
    }
  }

  /**
   * Handles empty validation errors by advancing to the next step
   */
  private async handleEmptyValidationError(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    this.flowController.advanceAndSkipStep(userCurrentGoal);

    // Check if goal is completed after advancing
    if (this.isGoalCompleted(userCurrentGoal, currentSteps)) {
      return this.completeGoalWithFinalMessage(userCurrentGoal, currentContext, incomingUserMessage);
    }

    // Try to process with the next step
    return this.tryProcessingWithNextStep(userCurrentGoal, currentContext, incomingUserMessage);
  }

  /**
   * Completes goal with final message and history update
   */
  private completeGoalWithFinalMessage(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): { responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] } {
    userCurrentGoal.goalStatus = "completed";
    const responseToUser = userCurrentGoal.collectedData.confirmationMessage ||
      this.getLocalizedFallback(currentContext, 'BOOKING_COMPLETED_FALLBACK');
    
    this.addMessageToHistory(userCurrentGoal, incomingUserMessage, responseToUser);
    return { responseToUser, uiButtonsToDisplay: undefined };
  }

  /**
   * Attempts to process user input with the next step handler
   */
  private async tryProcessingWithNextStep(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const nextStepHandler = this.getStepHandler(userCurrentGoal);

    if (!nextStepHandler) {
      return this.createErrorResponse(userCurrentGoal, incomingUserMessage);
    }

    const validationResult = await this.validateUserInput(
      nextStepHandler,
      incomingUserMessage,
      userCurrentGoal,
      currentContext
    );

    if (validationResult.isValid) {
      return this.processValidInputForNextStep(
        nextStepHandler,
        userCurrentGoal,
        currentContext,
        incomingUserMessage,
        currentSteps
      );
    } else {
      return this.createValidationErrorResponse(userCurrentGoal, incomingUserMessage);
    }
  }

  /**
   * Processes valid input for the next step
   */
  private async processValidInputForNextStep(
    nextStepHandler: any,
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string,
    currentSteps: string[]
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    // Process the input with the next step handler
    const nextStepResult = await nextStepHandler.processAndExtractData(
      incomingUserMessage,
      userCurrentGoal.collectedData,
      currentContext
    );
    
    this.updateGoalCollectedData(userCurrentGoal, nextStepResult);

    // Handle auto-advance steps
    if (nextStepHandler.autoAdvance || userCurrentGoal.collectedData.shouldAutoAdvance) {
      this.flowController.advanceAndSkipStep(userCurrentGoal);

      if (this.isGoalCompleted(userCurrentGoal, currentSteps)) {
        return this.completeGoalWithFinalMessage(userCurrentGoal, currentContext, incomingUserMessage);
      } else {
        return this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
      }
    }

    // Generate response for regular steps
    const responseToUser = userCurrentGoal.collectedData.confirmationMessage ||
      this.getLocalizedFallback(currentContext, 'CONTINUE_BOOKING_FALLBACK');

    const uiButtonsToDisplay = await this.generateStepButtons(nextStepHandler, userCurrentGoal, currentContext);
    
    this.addMessageToHistory(userCurrentGoal, incomingUserMessage, responseToUser);
    return { responseToUser, uiButtonsToDisplay };
  }

  /**
   * Creates an error response for flow issues
   */
  private createErrorResponse(
    userCurrentGoal: UserGoal,
    incomingUserMessage: string
  ): { responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] } {
    const responseToUser = "Something went wrong with the booking flow.";
    this.addMessageToHistory(userCurrentGoal, incomingUserMessage, responseToUser);
    return { responseToUser, uiButtonsToDisplay: undefined };
  }

  /**
   * Creates a validation error response
   */
  private createValidationErrorResponse(
    userCurrentGoal: UserGoal,
    incomingUserMessage: string
  ): { responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] } {
    const responseToUser = "I didn't understand that. Could you please try again?";
    this.addMessageToHistory(userCurrentGoal, incomingUserMessage, responseToUser);
    return { responseToUser, uiButtonsToDisplay: undefined };
  }
}

/**
 * Main exported function for processing incoming messages
 * Creates a MessageProcessor instance and delegates the processing
 */
export async function processIncomingMessage(
  incomingUserMessage: string,
  currentUser: ConversationalParticipant,
  historyForLLM?: ChatMessage[],
  existingContext?: {
    context: ChatContext;
    sessionId: string;
    userContext: UserContext;
    historyForLLM: ChatMessage[];
    customerUser?: any;
  }
): Promise<BotResponse> {
  const processor = new MessageProcessor();
  return processor.processIncomingMessage(incomingUserMessage, currentUser, historyForLLM, existingContext);
}