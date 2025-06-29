import {
  ConversationalParticipant,
  ChatContext,
  UserGoal,
  LLMProcessingResult,
  ButtonConfig,
  ChatConversationSession,
} from "@/lib/bot-engine/types";
import { ChatMessage } from "@/lib/database/models/chat-session";
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

export class MessageProcessor {
  private llmService = new IntelligentLLMService();
  private flowController = new FlowController();
  private goalManager = new GoalManager();

  async processIncomingMessage(
    incomingUserMessage: string,
    currentUser: ConversationalParticipant,
    historyForLLM?: ChatMessage[]
  ): Promise<BotResponse> {
    if (!incomingUserMessage || incomingUserMessage.trim() === "") {
      return { text: "" };
    }

    // =================================================================
    // SPECIAL ROUTING FOR PAYMENT COMPLETION
    // =================================================================
    if (incomingUserMessage.startsWith('PAYMENT_COMPLETED_')) {
        console.log('[MessageProcessor] Detected payment completion message. Routing to booking creation.');
        
        // Extract quote ID from the message
        const quoteId = incomingUserMessage.replace('PAYMENT_COMPLETED_', '');
        console.log(`[MessageProcessor] Payment completed for quote: ${quoteId}`);
        
        // Get or create chat context
        const { context: currentContext } = await getOrCreateChatContext(currentUser);
        let activeSession = currentContext.currentConversationSession!;
        
        // Find existing booking goal or create one if needed
        let bookingGoal = activeSession.activeGoals.find(g => 
            g.goalType === 'serviceBooking' && g.goalStatus === 'inProgress'
        );
        
        if (!bookingGoal) {
            // Create booking goal for payment completion with data from quote
            console.log('[MessageProcessor] No active booking goal found, creating one for payment completion');
            
            // Try to retrieve booking data from the quote
            let collectedDataFromQuote: Record<string, any> = {
                paymentCompleted: true,
                quoteId: quoteId
            };
            
            try {
                const { Quote } = await import('@/lib/database/models/quote');
                const quote = await Quote.getById(quoteId);
                
                if (quote) {
                    console.log('[MessageProcessor] Retrieved quote data for session restoration');
                    // Extract booking details from quote if available
                    const quoteData = {
                        proposedDateTime: quote.proposedDateTime,
                        serviceIds: quote.serviceIds, // Multi-service support - now an array
                        dropOff: quote.dropOff,
                        pickUp: quote.pickUp,
                        userId: quote.userId
                    };
                    
                    // Map quote data to session data format
                    if (quoteData.proposedDateTime) {
                        try {
                            const { DateTime } = await import('luxon');
                            const dateTimeObj = DateTime.fromISO(quoteData.proposedDateTime);
                            
                            if (dateTimeObj.isValid) {
                                collectedDataFromQuote.selectedDate = dateTimeObj.toISODate(); // Returns YYYY-MM-DD
                                collectedDataFromQuote.selectedTime = dateTimeObj.toFormat('HH:mm'); // Returns HH:mm
                                console.log('[MessageProcessor] Parsed date/time from quote:', {
                                    selectedDate: collectedDataFromQuote.selectedDate,
                                    selectedTime: collectedDataFromQuote.selectedTime
                                });
                            } else {
                                console.warn('[MessageProcessor] Invalid proposedDateTime in quote, skipping date/time extraction');
                            }
                        } catch (error) {
                            console.error('[MessageProcessor] Error parsing proposedDateTime from quote:', error);
                        }
                    }
                    
                    // Handle service restoration (both single and multi-service)
                    if (quoteData.serviceIds && quoteData.serviceIds.length > 0) {
                        const { Service } = await import('@/lib/database/models/service');
                        
                        if (quoteData.serviceIds.length === 1) {
                            // Single service - restore as selectedService for backward compatibility
                            const service = await Service.getById(quoteData.serviceIds[0]);
                            if (service) {
                                const serviceData = service.getData();
                                collectedDataFromQuote.selectedService = {
                                    id: serviceData.id,
                                    name: serviceData.name,
                                    mobile: serviceData.mobile,
                                    price: serviceData.fixedPrice,
                                    duration: serviceData.durationEstimate
                                };
                            }
                        } else {
                            // Multi-service - restore as selectedServices array
                            const services = await Promise.all(
                                quoteData.serviceIds.map(id => Service.getById(id))
                            );
                            const servicesData = services
                                .filter(service => service !== null)
                                .map(service => {
                                    const serviceData = service.getData();
                                    return {
                                        id: serviceData.id,
                                        name: serviceData.name,
                                        mobile: serviceData.mobile,
                                        price: serviceData.fixedPrice,
                                        duration: serviceData.durationEstimate
                                    };
                                });
                            
                            if (servicesData.length > 0) {
                                collectedDataFromQuote.selectedServices = servicesData;
                                collectedDataFromQuote.selectedService = servicesData[0]; // Primary service
                                collectedDataFromQuote.addServicesState = 'completed';
                            }
                        }
                    }
                    
                    if (quoteData.dropOff) {
                        collectedDataFromQuote.finalServiceAddress = quoteData.dropOff;
                        collectedDataFromQuote.serviceLocation = quoteData.pickUp === quoteData.dropOff ? 'business_location' : 'customer_address';
                    }
                    
                    if (quoteData.userId) {
                        collectedDataFromQuote.userId = quoteData.userId;
                        collectedDataFromQuote.existingUserFound = true;
                    }
                    
                    console.log('[MessageProcessor] Restored session data from quote:', Object.keys(collectedDataFromQuote));
                } else {
                    console.warn('[MessageProcessor] Quote not found, proceeding with minimal data');
                }
            } catch (error) {
                console.error('[MessageProcessor] Error retrieving quote data for session restoration:', error);
            }
            
            // Determine flow key
            let flowKey = 'bookingCreatingForMobileService'; // Default
            const businessId = currentContext.currentParticipant.associatedBusinessId;
            if (businessId) {
                try {
                    const { Service } = await import('@/lib/database/models/service');
                    const services = await Service.getByBusiness(businessId);
                    const servicesData = services.map(s => s.getData());
                    const hasMobileServices = servicesData.some((service: any) => service.mobile === true);
                    flowKey = hasMobileServices ? 'bookingCreatingForMobileService' : 'bookingCreatingForNoneMobileService';
                } catch (error) {
                    console.error('[MessageProcessor] Error determining flow key:', error);
                }
            }
            
            bookingGoal = {
                goalType: 'serviceBooking',
                goalAction: 'create',
                goalStatus: 'inProgress',
                currentStepIndex: conversationFlowBlueprints[flowKey].indexOf('createBooking'),
                collectedData: collectedDataFromQuote,
                messageHistory: [],
                flowKey
            };
            
            activeSession.activeGoals = [bookingGoal];
        } else {
            // Update existing goal to go to createBooking step
            console.log('[MessageProcessor] Found existing booking goal, updating for payment completion');
            const createBookingIndex = conversationFlowBlueprints[bookingGoal.flowKey].indexOf('createBooking');
            if (createBookingIndex !== -1) {
                bookingGoal.currentStepIndex = createBookingIndex;
                
                // PRESERVE EXISTING SESSION DATA - this is critical for booking creation
                bookingGoal.collectedData = {
                    ...bookingGoal.collectedData, // Keep all existing data like selectedDate, selectedTime, etc.
                    paymentCompleted: true,
                    quoteId: quoteId
                };
                
                console.log('[MessageProcessor] Preserved existing session data:', Object.keys(bookingGoal.collectedData));
            }
        }
    }
    // =================================================================

    const {
      context: currentContext,
      sessionId,
      userContext,
      historyForLLM: fetchedHistory,
      customerUser,
    } = await getOrCreateChatContext(currentUser);

    // Use the history passed from the webhook if available, otherwise use the freshly fetched one.
    const messageHistoryToUse = historyForLLM || fetchedHistory;

    let activeSession: ChatConversationSession =
      currentContext.currentConversationSession!;
    if (!activeSession) {
      console.error("Critical: No active session found for user.");
      return { text: "I'm sorry, I'm having trouble retrieving our conversation." };
    }

    let userCurrentGoal: UserGoal | undefined = activeSession.activeGoals.find(
      (g) => g.goalStatus === "inProgress"
    );
    let botResponse: BotResponse;

    await LanguageDetectionService.detectAndUpdateLanguage(
      incomingUserMessage,
      currentContext,
      "[MessageProcessor]"
    );

    if (
      incomingUserMessage.trim().toUpperCase() ===
      START_BOOKING_PAYLOAD.toUpperCase()
    ) {
      if (userCurrentGoal) {
        userCurrentGoal.goalStatus = "completed";
      }

      const bookingGoalResult: LLMProcessingResult = {
        detectedUserGoalType: "serviceBooking",
        detectedGoalAction: "create",
      };

      userCurrentGoal = await this.goalManager.createNewGoal(
        bookingGoalResult,
        currentUser.type,
        currentContext
      );
      
      // --- FIX: Preserve existing message history ---
      if (messageHistoryToUse && messageHistoryToUse.length > 0) {
        userCurrentGoal.messageHistory = messageHistoryToUse.map((msg) => ({
          speakerRole: msg.role === "user" ? "user" : "chatbot",
          content:
            typeof msg.content === "string"
              ? msg.content
              : (msg.content as any).text || "[Interactive Message]",
          messageTimestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        }));
        console.log(
          `[MessageProcessor] Preserved ${userCurrentGoal.messageHistory.length} messages from existing history.`
        );
      }
      // --- END FIX ---

      activeSession.activeGoals = [userCurrentGoal];

      const result = await this.executeFirstStep(
        userCurrentGoal,
        currentContext,
        incomingUserMessage
      );
      botResponse = {
        text: result.responseToUser,
        buttons: result.uiButtonsToDisplay,
      };
    } else if (!userCurrentGoal) {
      const llmGoalDetectionResult = await this.llmService.detectIntention(
        incomingUserMessage,
        currentContext
      );

      if (llmGoalDetectionResult.detectedUserGoalType) {
        userCurrentGoal = await this.goalManager.createNewGoal(
          llmGoalDetectionResult,
          currentUser.type,
          currentContext
        );
        activeSession.activeGoals.push(userCurrentGoal);
        const result = await this.executeFirstStep(
          userCurrentGoal,
          currentContext,
          incomingUserMessage
        );
        botResponse = {
          text: result.responseToUser,
          buttons: result.uiButtonsToDisplay,
        };
      } else {
        botResponse = {
          text: "Could you tell me more clearly what you'd like to do?",
          buttons: undefined,
        };
      }
    } else {
      const result = await this.processExistingGoalIntelligent(
        userCurrentGoal,
        currentContext,
        incomingUserMessage,
        messageHistoryToUse,
        customerUser
      );
      botResponse = {
        text: result.responseToUser,
        buttons: result.uiButtonsToDisplay,
      };
    }

    // --- FIX: Persist the full BotResponse object ---
    const finalResponse = {
      ...botResponse,
      listActionText: userCurrentGoal?.collectedData.listActionText,
      listSectionTitle: userCurrentGoal?.collectedData.listSectionTitle,
    };

    await persistSessionState(
      sessionId,
      userContext,
      activeSession,
      userCurrentGoal,
      incomingUserMessage,
      finalResponse, // Pass the complete object
      messageHistoryToUse
    );

    return this.finalizeAndTranslateResponse(
      finalResponse,
      currentContext
    );
  }

  private async finalizeAndTranslateResponse(
    response: BotResponse,
    chatContext: ChatContext
  ): Promise<BotResponse> {
    const targetLanguage = chatContext.participantPreferences.language;

    if (!targetLanguage || targetLanguage === "en") {
      return response;
    }

    const textsToTranslate: string[] = [];
    if (response.text) textsToTranslate.push(response.text);
    response.buttons?.forEach((btn) => {
      if (btn.buttonText) textsToTranslate.push(btn.buttonText);
      if (btn.buttonDescription) textsToTranslate.push(btn.buttonDescription);
    });

    if (textsToTranslate.length === 0) {
      return response;
    }

    try {
      const translatedTexts = (await this.llmService.translate(
        textsToTranslate,
        targetLanguage
      )) as string[];
      const mutableTranslatedTexts = [...translatedTexts];
      const translatedResponse: BotResponse = { ...response };

      if (translatedResponse.text)
        translatedResponse.text =
          mutableTranslatedTexts.shift() || translatedResponse.text;
      translatedResponse.buttons = translatedResponse.buttons?.map((btn) => {
        const newBtn = { ...btn };
        if (newBtn.buttonText)
          newBtn.buttonText =
            mutableTranslatedTexts.shift() || newBtn.buttonText;
        if (newBtn.buttonDescription)
          newBtn.buttonDescription =
            mutableTranslatedTexts.shift() || newBtn.buttonDescription;
        return newBtn;
      });

      return translatedResponse;
    } catch (error) {
      console.error(
        `[MessageProcessor] Error translating booking response:`,
        error
      );
      return response;
    }
  }

  private async executeFirstStep(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    if (!currentSteps || !currentSteps[userCurrentGoal.currentStepIndex]) {
      throw new Error("No handler found for first step");
    }

    const stepName = currentSteps[userCurrentGoal.currentStepIndex];
    const firstStepHandler = botTasks[stepName];

    if (!firstStepHandler) {
      throw new Error("No handler found for first step");
    }

    const processingResult = await firstStepHandler.processAndExtractData(
      "",
      userCurrentGoal.collectedData,
      currentContext
    );
    userCurrentGoal.collectedData =
      typeof processingResult === "object" &&
      "extractedInformation" in processingResult
        ? {
            ...userCurrentGoal.collectedData,
            ...processingResult.extractedInformation,
          }
        : (processingResult as Record<string, any>);

    if (firstStepHandler.autoAdvance) {
      console.log(`[MessageProcessor] Auto-advancing from step: ${stepName}`);
      this.flowController.advanceAndSkipStep(userCurrentGoal);

      if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
        userCurrentGoal.goalStatus = "completed";
        const responseToUser = "Great! Your booking request has been processed.";
        const uiButtonsToDisplay = undefined;

        userCurrentGoal.messageHistory.push({
          speakerRole: "user",
          content: incomingUserMessage,
          messageTimestamp: new Date(),
        });
        userCurrentGoal.messageHistory.push({
          speakerRole: "chatbot",
          content: responseToUser,
          messageTimestamp: new Date(),
        });

        return { responseToUser, uiButtonsToDisplay };
      } else {
        return await this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
      }
    }

    const responseToUser =
      userCurrentGoal.collectedData.confirmationMessage ||
      firstStepHandler.defaultChatbotPrompt ||
      "Let's get started with your booking.";

    let uiButtonsToDisplay: ButtonConfig[] | undefined;
    if (firstStepHandler.fixedUiButtons) {
      if (typeof firstStepHandler.fixedUiButtons === "function") {
        uiButtonsToDisplay = await firstStepHandler.fixedUiButtons(
          userCurrentGoal.collectedData,
          currentContext
        );
      } else {
        uiButtonsToDisplay = firstStepHandler.fixedUiButtons;
      }
    }

    userCurrentGoal.messageHistory.push({
      speakerRole: "user",
      content: incomingUserMessage,
      messageTimestamp: new Date(),
    });
    userCurrentGoal.messageHistory.push({
      speakerRole: "chatbot",
      content: responseToUser,
      messageTimestamp: new Date(),
    });

    return { responseToUser, uiButtonsToDisplay };
  }

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

    const processingResult = await stepHandler.processAndExtractData(
      "",
      userCurrentGoal.collectedData,
      currentContext
    );
    userCurrentGoal.collectedData =
      typeof processingResult === "object" &&
      "extractedInformation" in processingResult
        ? {
            ...userCurrentGoal.collectedData,
            ...processingResult.extractedInformation,
          }
        : (processingResult as Record<string, any>);

    if (userCurrentGoal.collectedData.goalStatus === "completed") {
      userCurrentGoal.goalStatus = "completed";
      console.log(
        `[MessageProcessor] Goal completed during auto-advance at step: ${stepName}`
      );

      const responseToUser =
        userCurrentGoal.collectedData.confirmationMessage ||
        "Your request has been completed.";
      return { responseToUser, uiButtonsToDisplay: undefined };
    }

    const shouldConditionallyAdvance =
      userCurrentGoal.collectedData.shouldAutoAdvance;

    if (
      (stepHandler.autoAdvance || shouldConditionallyAdvance) &&
      userCurrentGoal.currentStepIndex + 1 < currentSteps.length
    ) {
      console.log(`[MessageProcessor] Auto-advancing from step: ${stepName}`);

      if (shouldConditionallyAdvance) {
        userCurrentGoal.collectedData.shouldAutoAdvance = false;
      }

      const targetStep =
        this.flowController.navigateToAppropriateStep(userCurrentGoal);
      const targetStepIndex = currentSteps.indexOf(targetStep);
      if (targetStepIndex !== -1) {
        userCurrentGoal.currentStepIndex = targetStepIndex;
      } else {
        this.flowController.advanceAndSkipStep(userCurrentGoal);
      }
      return await this.executeAutoAdvanceStep(userCurrentGoal, currentContext);
    }

    const responseToUser =
      userCurrentGoal.collectedData.confirmationMessage ||
      stepHandler.defaultChatbotPrompt ||
      "Continuing with your booking...";

    let uiButtonsToDisplay: ButtonConfig[] | undefined;
    if (stepHandler.fixedUiButtons) {
      if (typeof stepHandler.fixedUiButtons === "function") {
        uiButtonsToDisplay = await stepHandler.fixedUiButtons(
          userCurrentGoal.collectedData,
          currentContext
        );
      } else {
        uiButtonsToDisplay = stepHandler.fixedUiButtons;
      }
    }

    return { responseToUser, uiButtonsToDisplay };
  }

  private async processExistingGoalIntelligent(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string,
    historyForLLM?: ChatMessage[],
    customerUser?: { firstName: string; lastName: string; id: string }
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const messageHistory = userCurrentGoal.messageHistory.map((msg) => ({
      role: msg.speakerRole === "user" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
      timestamp: msg.messageTimestamp,
    }));

    // CRITICAL FIX: Skip LLM analysis for system button IDs to prevent misinterpretation
    const systemButtonIds = [
      'add_another_service',
      'continue_with_services', 
      'confirm_quote',
      'edit_quote',
      'confirm_address',
      'enter_different_address',
      'start_booking_flow',
      'choose_another_day',
      'open_calendar',
      'edit_service',
      'edit_time',
      'tomorrow_7am',
      'tomorrow_9am'
    ];
    
    const isSystemButtonAction = systemButtonIds.includes(incomingUserMessage.toLowerCase().trim()) ||
      incomingUserMessage.startsWith("slot_") ||
      incomingUserMessage.startsWith("day_") ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incomingUserMessage);
    
    if (isSystemButtonAction) {
      console.log(`[MessageProcessor] Bypassing LLM analysis for system button: ${incomingUserMessage}`);
      // Process directly with the current step handler
      return this.processOriginalFlowWithIntelligentEnhancement(
        userCurrentGoal,
        currentContext,
        incomingUserMessage,
        undefined, // No conversation decision - let step handler process it
        historyForLLM,
        customerUser
      );
    }

    console.log(
      `[MessageProcessor] Using intelligent flow analysis with ${messageHistory.length} messages`
    );

    try {
      const conversationDecision = await this.llmService.analyzeConversationFlow(
        incomingUserMessage,
        userCurrentGoal,
        currentContext,
        messageHistory
      );

      if (
        conversationDecision.action === "go_back" &&
        conversationDecision.confidence > 0.7
      ) {
        return this.flowController.handleGoBack(
          userCurrentGoal,
          currentContext,
          conversationDecision,
          customerUser
        );
      }

      if (
        conversationDecision.action === "restart" &&
        conversationDecision.confidence > 0.8
      ) {
        return this.flowController.handleRestart(
          userCurrentGoal,
          currentContext,
          this.executeFirstStep.bind(this)
        );
      }

      if (
        conversationDecision.action === "switch_topic" &&
        conversationDecision.confidence >= 0.8
      ) {
        const topicSwitchResult = await this.goalManager.handleTopicSwitch(
          currentContext,
          conversationDecision,
          incomingUserMessage,
          userCurrentGoal
        );

        if (topicSwitchResult.newGoal) {
          if (currentContext.currentConversationSession) {
            currentContext.currentConversationSession.activeGoals = [
              topicSwitchResult.newGoal,
            ];
          }
        }

        return {
          responseToUser: topicSwitchResult.responseToUser,
          uiButtonsToDisplay: topicSwitchResult.uiButtonsToDisplay,
        };
      }

      return this.processOriginalFlowWithIntelligentEnhancement(
        userCurrentGoal,
        currentContext,
        incomingUserMessage,
        conversationDecision,
        historyForLLM,
        customerUser
      );
    } catch (error) {
      console.error(
        `[MessageProcessor] LLM analysis failed, falling back to original flow:`,
        error
      );
      return this.processExistingGoalIntelligent(
        userCurrentGoal,
        currentContext,
        incomingUserMessage
      );
    }
  }

  private async processOriginalFlowWithIntelligentEnhancement(
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

    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const stepName = currentSteps[userCurrentGoal.currentStepIndex];
    const currentStepHandler = botTasks[stepName];

    if (!currentStepHandler) {
      throw new Error("No handler found for current step");
    }

    const validationResult = await currentStepHandler.validateUserInput(
      incomingUserMessage,
      userCurrentGoal.collectedData,
      currentContext
    );
    const isInputValid =
      typeof validationResult === "boolean"
        ? validationResult
        : validationResult.isValidInput || false;
    const specificValidationError =
      typeof validationResult === "object"
        ? validationResult.validationErrorMessage
        : undefined;
    const transformedInput =
      typeof validationResult === "object"
        ? validationResult.transformedInput
        : undefined;

    let responseToUser: string;
    let uiButtonsToDisplay: ButtonConfig[] | undefined;

    if (isInputValid) {
      const inputToProcess = transformedInput || incomingUserMessage;
      const processingResult = await currentStepHandler.processAndExtractData(
        inputToProcess,
        userCurrentGoal.collectedData,
        currentContext
      );
      userCurrentGoal.collectedData =
        typeof processingResult === "object" &&
        "extractedInformation" in processingResult
          ? {
              ...userCurrentGoal.collectedData,
              ...processingResult.extractedInformation,
            }
          : (processingResult as Record<string, any>);

      if (userCurrentGoal.collectedData.restartBookingFlow) {
        return this.flowController.handleOriginalRestartFlow(
          userCurrentGoal,
          currentContext
        );
      }

      if (userCurrentGoal.collectedData.navigateBackTo) {
        return this.flowController.handleOriginalNavigateBack(
          userCurrentGoal,
          currentContext
        );
      }

      const targetStep =
        this.flowController.navigateToAppropriateStep(userCurrentGoal);
      const targetStepIndex = currentSteps.indexOf(targetStep);
      if (targetStepIndex !== -1) {
        userCurrentGoal.currentStepIndex = targetStepIndex;
      } else {
        this.flowController.advanceAndSkipStep(userCurrentGoal);
      }

      if (
        userCurrentGoal.currentStepIndex >= currentSteps.length ||
        userCurrentGoal.collectedData.goalStatus === "completed"
      ) {
        userCurrentGoal.goalStatus = "completed";
        responseToUser = "Great! Your booking request has been processed.";
        uiButtonsToDisplay = undefined;
      } else {
        const nextStepName = currentSteps[userCurrentGoal.currentStepIndex];
        const nextStepHandler = botTasks[nextStepName];
        if (nextStepHandler) {
          const nextStepResult = await nextStepHandler.processAndExtractData(
            "",
            userCurrentGoal.collectedData,
            currentContext
          );
          userCurrentGoal.collectedData =
            typeof nextStepResult === "object" &&
            "extractedInformation" in nextStepResult
              ? {
                  ...userCurrentGoal.collectedData,
                  ...nextStepResult.extractedInformation,
                }
              : (nextStepResult as Record<string, any>);

          if (
            nextStepHandler.autoAdvance ||
            userCurrentGoal.collectedData.shouldAutoAdvance
          ) {
            const autoAdvanceResult = await this.executeAutoAdvanceStep(
              userCurrentGoal,
              currentContext
            );
            responseToUser = autoAdvanceResult.responseToUser;
            uiButtonsToDisplay = autoAdvanceResult.uiButtonsToDisplay;
          } else {
            try {
              if (conversationDecision) {
                const contextualResponse =
                  await this.llmService.generateContextualResponse(
                    userCurrentGoal,
                    currentContext,
                    incomingUserMessage,
                    conversationDecision,
                    userCurrentGoal.messageHistory.map((msg) => ({
                      role:
                        msg.speakerRole === "user"
                          ? ("user" as const)
                          : ("assistant" as const),
                      content: msg.content,
                      timestamp: msg.messageTimestamp,
                    })),
                    customerUser
                  );
                responseToUser = contextualResponse.text;
              } else {
                responseToUser =
                  userCurrentGoal.collectedData.confirmationMessage ||
                  nextStepHandler.defaultChatbotPrompt ||
                  "Let's continue with your booking.";
              }
            } catch (error) {
              console.error(
                `[MessageProcessor] LLM response generation failed, using original:`,
                error
              );
              responseToUser =
                userCurrentGoal.collectedData.confirmationMessage ||
                nextStepHandler.defaultChatbotPrompt ||
                "Let's continue with your booking.";
            }

            if (nextStepHandler.fixedUiButtons) {
              try {
                if (typeof nextStepHandler.fixedUiButtons === "function") {
                  uiButtonsToDisplay = await nextStepHandler.fixedUiButtons(
                    userCurrentGoal.collectedData,
                    currentContext
                  );
                } else {
                  uiButtonsToDisplay = nextStepHandler.fixedUiButtons;
                }
              } catch (error) {
                console.error(
                  `[MessageProcessor] Error generating buttons for next step:`,
                  error
                );
                uiButtonsToDisplay = [];
              }
            }
          }
        } else {
          responseToUser = "Something went wrong with the booking flow.";
        }
      }
    } else {
      if (
        conversationDecision &&
        (conversationDecision.action === "continue" ||
          conversationDecision.action === "switch_topic") &&
        conversationDecision.confidence > 0.7
      ) {
        try {
          const contextualResponse =
            await this.llmService.generateContextualResponse(
              userCurrentGoal,
              currentContext,
              incomingUserMessage,
              conversationDecision,
              userCurrentGoal.messageHistory.map((msg) => ({
                role:
                  msg.speakerRole === "user"
                    ? ("user" as const)
                    : ("assistant" as const),
                content: msg.content,
                timestamp: msg.messageTimestamp,
              })),
              customerUser
            );
          responseToUser = contextualResponse.text;

          if (currentStepHandler.fixedUiButtons) {
            try {
              if (typeof currentStepHandler.fixedUiButtons === "function") {
                uiButtonsToDisplay = await currentStepHandler.fixedUiButtons(
                  userCurrentGoal.collectedData,
                  currentContext
                );
              } else {
                uiButtonsToDisplay = currentStepHandler.fixedUiButtons;
              }
            } catch (error) {
              console.error(
                `[MessageProcessor] Error generating buttons for off-topic response:`,
                error
              );
              uiButtonsToDisplay = [];
            }
          }
        } catch (error) {
          console.error(
            `[MessageProcessor] LLM response generation failed for off-topic question:`,
            error
          );
          responseToUser =
            "I'd be happy to help with that, but let's focus on completing your booking first.";

          if (currentStepHandler.fixedUiButtons) {
            if (typeof currentStepHandler.fixedUiButtons === "function") {
              uiButtonsToDisplay = await currentStepHandler.fixedUiButtons(
                userCurrentGoal.collectedData,
                currentContext
              );
            } else {
              uiButtonsToDisplay = currentStepHandler.fixedUiButtons;
            }
          }
        }
      } else if (specificValidationError === "" || !specificValidationError) {
        return this.handleOriginalEmptyValidationError(
          userCurrentGoal,
          currentContext,
          incomingUserMessage
        );
      } else {
        try {
          if (conversationDecision) {
            const contextualResponse =
              await this.llmService.generateContextualResponse(
                userCurrentGoal,
                currentContext,
                incomingUserMessage,
                { ...conversationDecision, action: "continue" },
                userCurrentGoal.messageHistory.map((msg) => ({
                  role:
                    msg.speakerRole === "user"
                      ? ("user" as const)
                      : ("assistant" as const),
                  content: msg.content,
                  timestamp: msg.messageTimestamp,
                })),
                customerUser
              );
            responseToUser = contextualResponse.text;
          } else {
            responseToUser = specificValidationError;
          }
        } catch (error) {
          console.error(
            `[MessageProcessor] LLM error response generation failed:`,
            error
          );
          responseToUser =
            specificValidationError ||
            "I didn't understand that. Could you please try again?";
        }

        try {
          const stepUIDataResult =
            await currentStepHandler.processAndExtractData(
              "",
              userCurrentGoal.collectedData,
              currentContext
            );
          userCurrentGoal.collectedData =
            typeof stepUIDataResult === "object" &&
            "extractedInformation" in stepUIDataResult
              ? {
                  ...userCurrentGoal.collectedData,
                  ...stepUIDataResult.extractedInformation,
                }
              : (stepUIDataResult as Record<string, any>);
        } catch (e) {
          console.error(
            `[MessageProcessor] Failed to refresh UI data for step ${stepName}`,
            e
          );
        }

        if (currentStepHandler.fixedUiButtons) {
          try {
            if (typeof currentStepHandler.fixedUiButtons === "function") {
              uiButtonsToDisplay = await currentStepHandler.fixedUiButtons(
                userCurrentGoal.collectedData,
                currentContext
              );
            } else {
              uiButtonsToDisplay = currentStepHandler.fixedUiButtons;
            }
          } catch (error) {
            console.error(
              `[MessageProcessor] Error generating buttons for validation error:`,
              error
            );
            uiButtonsToDisplay = [];
          }
        }
      }
    }

    userCurrentGoal.messageHistory.push({
      speakerRole: "chatbot",
      content: responseToUser,
      messageTimestamp: new Date(),
    });
    return { responseToUser, uiButtonsToDisplay };
  }

  private async handleOriginalEmptyValidationError(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    incomingUserMessage: string
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    this.flowController.advanceAndSkipStep(userCurrentGoal);

    if (userCurrentGoal.currentStepIndex >= currentSteps.length) {
      userCurrentGoal.goalStatus = "completed";
      const responseToUser = "Great! Your booking request has been processed.";
      userCurrentGoal.messageHistory.push({
        speakerRole: "chatbot",
        content: responseToUser,
        messageTimestamp: new Date(),
      });
      return { responseToUser };
    } else {
      const nextStepName = currentSteps[userCurrentGoal.currentStepIndex];
      const nextStepHandler = botTasks[nextStepName];
      if (nextStepHandler) {
        const nextValidationResult = await nextStepHandler.validateUserInput(
          incomingUserMessage,
          userCurrentGoal.collectedData,
          currentContext
        );
        const nextIsInputValid =
          typeof nextValidationResult === "boolean"
            ? nextValidationResult
            : nextValidationResult.isValidInput || false;

        if (nextIsInputValid) {
          const nextStepResult = await nextStepHandler.processAndExtractData(
            incomingUserMessage,
            userCurrentGoal.collectedData,
            currentContext
          );
          userCurrentGoal.collectedData =
            typeof nextStepResult === "object" &&
            "extractedInformation" in nextStepResult
              ? {
                  ...userCurrentGoal.collectedData,
                  ...nextStepResult.extractedInformation,
                }
              : (nextStepResult as Record<string, any>);

          if (
            nextStepHandler.autoAdvance ||
            userCurrentGoal.collectedData.shouldAutoAdvance
          ) {
            this.flowController.advanceAndSkipStep(userCurrentGoal);

            if (userCurrentGoal.currentStepIndex < currentSteps.length) {
              const autoAdvanceResult = await this.executeAutoAdvanceStep(
                userCurrentGoal,
                currentContext
              );
              userCurrentGoal.messageHistory.push({
                speakerRole: "chatbot",
                content: autoAdvanceResult.responseToUser,
                messageTimestamp: new Date(),
              });
              return autoAdvanceResult;
            } else {
              userCurrentGoal.goalStatus = "completed";
              const responseToUser =
                "Great! Your booking request has been processed.";
              userCurrentGoal.messageHistory.push({
                speakerRole: "chatbot",
                content: responseToUser,
                messageTimestamp: new Date(),
              });
              return { responseToUser };
            }
          } else {
            const responseToUser =
              userCurrentGoal.collectedData.confirmationMessage ||
              nextStepHandler.defaultChatbotPrompt ||
              "Let's continue with your booking.";

            let uiButtonsToDisplay: ButtonConfig[] | undefined;
            if (nextStepHandler.fixedUiButtons) {
              if (typeof nextStepHandler.fixedUiButtons === "function") {
                uiButtonsToDisplay = await nextStepHandler.fixedUiButtons(
                  userCurrentGoal.collectedData,
                  currentContext
                );
              } else {
                uiButtonsToDisplay = nextStepHandler.fixedUiButtons;
              }
            }

            userCurrentGoal.messageHistory.push({
              speakerRole: "chatbot",
              content: responseToUser,
              messageTimestamp: new Date(),
            });
            return { responseToUser, uiButtonsToDisplay };
          }
        } else {
          const responseToUser =
            "I didn't understand that. Could you please try again?";
          userCurrentGoal.messageHistory.push({
            speakerRole: "chatbot",
            content: responseToUser,
            messageTimestamp: new Date(),
          });
          return { responseToUser };
        }
      } else {
        const responseToUser = "Something went wrong with the booking flow.";
        userCurrentGoal.messageHistory.push({
          speakerRole: "chatbot",
          content: responseToUser,
          messageTimestamp: new Date(),
        });
        return { responseToUser };
      }
    }
  }
}

export async function processIncomingMessage(
  incomingUserMessage: string,
  currentUser: ConversationalParticipant,
  historyForLLM?: ChatMessage[]
): Promise<BotResponse> {
  const processor = new MessageProcessor();
  return processor.processIncomingMessage(incomingUserMessage, currentUser, historyForLLM);
}