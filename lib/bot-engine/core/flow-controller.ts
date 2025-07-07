import {
  UserGoal,
  ChatContext,
  ButtonConfig
} from '@/lib/bot-engine/types';
import { conversationFlowBlueprints } from "@/lib/bot-engine/config/blueprints";
import { botTasks } from "@/lib/bot-engine/config/tasks";
import { IntelligentLLMService } from '@/lib/bot-engine/services/llm-service';
import { FlowControllerLogger } from '@/lib/bot-engine/utils/logger';

function shouldSkipStep(stepName: string, goalData: Record<string, any>): boolean {
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

  if (!!goalData.quickBookingSelected && skippableStepsForQuickBooking.includes(stepName)) {
    return true;
  }
  if (!!goalData.existingUserFound && skippableStepsForExistingUser.includes(stepName)) {
    FlowControllerLogger.flow('Skipping step for existing user', 
      { step: stepName },
      { reason: 'existing_user_found' }
    );
    return true;
  }
  return false;
}

export class FlowController {
  private llmService = new IntelligentLLMService();

  public advanceAndSkipStep(userCurrentGoal: UserGoal) {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    let nextStepName: string;
    let skippedSteps: string[] = [];
    
    do {
      userCurrentGoal.currentStepIndex++;
      if (userCurrentGoal.currentStepIndex < currentSteps.length) {
        nextStepName = currentSteps[userCurrentGoal.currentStepIndex];
        
        if (shouldSkipStep(nextStepName, userCurrentGoal.collectedData)) {
          skippedSteps.push(nextStepName);
        } else {
          FlowControllerLogger.flow('Advanced to step', {
            goalType: userCurrentGoal.goalType,
            step: nextStepName
          }, { 
            stepIndex: userCurrentGoal.currentStepIndex,
            skippedSteps: skippedSteps.length > 0 ? skippedSteps : undefined
          });
        }
      } else {
        nextStepName = ''; 
      }
    } while (nextStepName && shouldSkipStep(nextStepName, userCurrentGoal.collectedData));
  }

  public navigateToAppropriateStep(userCurrentGoal: UserGoal): string {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const currentStepIndex = userCurrentGoal.currentStepIndex;
    const goalData = userCurrentGoal.collectedData;
    
    FlowControllerLogger.debug('Starting navigation analysis', {
      goalType: userCurrentGoal.goalType,
      step: currentSteps[currentStepIndex]
    }, {
      currentStepIndex,
      browseModeSelected: goalData.browseModeSelected,
      hasCompleteBookingData: !!(goalData.selectedService && goalData.selectedDate && goalData.selectedTime)
    });
    
    if (goalData.browseModeSelected) {
      FlowControllerLogger.flow('Browse mode navigation active', {
        goalType: userCurrentGoal.goalType
      });
      
      // CRITICAL FIX: First check if the current step still needs data, even in browse mode
      const currentStepName = currentSteps[currentStepIndex];
      if (currentStepName && this.stepNeedsData(currentStepName, goalData, userCurrentGoal)) {
        FlowControllerLogger.flow('Browse mode: Current step needs data - staying', {
          goalType: userCurrentGoal.goalType,
          step: currentStepName
        });
        return currentStepName;
      }
      
      let nextStepIndex = currentStepIndex + 1;
      
      while (nextStepIndex < currentSteps.length && shouldSkipStep(currentSteps[nextStepIndex], goalData)) {
        FlowControllerLogger.debug('Skipping step in browse mode', {
          step: currentSteps[nextStepIndex]
        });
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
    
    if (hasCompleteBookingData) {
      const quoteStepIndex = currentSteps.findIndex(step => 
        step.toLowerCase().includes('quote') && 
        step.toLowerCase().includes('summary')
      );
      
      if (quoteStepIndex !== -1 && quoteStepIndex > currentStepIndex) {
        FlowControllerLogger.flow('Smart jump: Complete booking data detected', {
          goalType: userCurrentGoal.goalType,
          step: currentSteps[quoteStepIndex]
        }, {
          fromStepIndex: currentStepIndex,
          toStepIndex: quoteStepIndex,
          reason: 'complete_booking_data'
        });
        return currentSteps[quoteStepIndex];
      }
    }
    
    if (goalData.paymentLinkGenerated && !goalData.paymentCompleted) {
      FlowControllerLogger.flow('Payment pending - staying on current step', {
        goalType: userCurrentGoal.goalType,
        step: currentSteps[currentStepIndex]
      }, { reason: 'awaiting_payment' });
      return currentSteps[currentStepIndex];
    }
    
    // CRITICAL FIX: First check if the current step still needs data
    const currentStepName = currentSteps[currentStepIndex];
    if (currentStepName && this.stepNeedsData(currentStepName, goalData, userCurrentGoal)) {
      FlowControllerLogger.flow('Current step needs data - staying', {
        goalType: userCurrentGoal.goalType,
        step: currentStepName
      }, { reason: 'current_step_needs_data' });
      return currentStepName;
    }
    
    // Then check future steps
    for (let i = currentStepIndex + 1; i < currentSteps.length; i++) {
      const stepName = currentSteps[i];
      
      if (shouldSkipStep(stepName, goalData)) {
        FlowControllerLogger.debug('Skipping step in navigation analysis', {
          step: stepName
        });
        continue;
      }
      
      if (this.stepNeedsData(stepName, goalData, userCurrentGoal)) {
        FlowControllerLogger.flow('Smart navigation: Jumping to step that needs data', {
          goalType: userCurrentGoal.goalType,
          step: stepName
        }, {
          fromStepIndex: currentStepIndex,
          toStepIndex: i,
          reason: 'step_needs_data'
        });
        return stepName;
      }
    }
    
    const nextStep = currentSteps[currentStepIndex + 1] || currentSteps[currentStepIndex];
    FlowControllerLogger.flow('Default navigation to next step', {
      goalType: userCurrentGoal.goalType,
      step: nextStep
    }, { fallbackNavigation: true });
    
    return nextStep;
  }

  private stepNeedsData(stepName: string, collectedData: Record<string, any>, userCurrentGoal?: UserGoal): boolean {
    const stepLower = stepName.toLowerCase();
    
    // Address collection steps - need data if no address provided yet
    if (stepLower === 'askpickupaddress') {
      const needsData = !collectedData.pickupAddress && !collectedData.customerAddress;
      console.log('[FlowController] askPickupAddress stepNeedsData evaluation:', {
        stepName,
        pickupAddress: collectedData.pickupAddress,
        customerAddress: collectedData.customerAddress,
        needsData
      });
      if (needsData) {
        FlowControllerLogger.debug('Step needs pickup address input', { step: stepName });
      }
      return needsData;
    }
    
    if (stepLower === 'askdropoffaddress') {
      const needsData = !collectedData.dropoffAddress;
      if (needsData) {
        FlowControllerLogger.debug('Step needs dropoff address input', { step: stepName });
      }
      return needsData;
    }
    
    // Address validation steps - always need to run for Google API validation
    if (stepLower === 'validateaddress') {
      // Check if we have an unvalidated address that needs validation
      const hasUnvalidatedPickup = collectedData.pickupAddress && !collectedData.pickupAddressValidated;
      const hasUnvalidatedDropoff = collectedData.dropoffAddress && !collectedData.dropoffAddressValidated;
      const hasUnvalidatedCustomer = collectedData.customerAddress && !collectedData.isAddressValidated;
      const needsValidation = hasUnvalidatedPickup || hasUnvalidatedDropoff || hasUnvalidatedCustomer;
      
      // DEBUG: Add extensive logging to see what's happening
      console.log('[FlowController DEBUG] validateAddress step analysis:', {
        stepName,
        pickupAddress: collectedData.pickupAddress,
        pickupAddressValidated: collectedData.pickupAddressValidated,
        dropoffAddress: collectedData.dropoffAddress,
        dropoffAddressValidated: collectedData.dropoffAddressValidated,
        customerAddress: collectedData.customerAddress,
        isAddressValidated: collectedData.isAddressValidated,
        hasUnvalidatedPickup,
        hasUnvalidatedDropoff,
        hasUnvalidatedCustomer,
        needsValidation
      });
      
      if (needsValidation) {
        FlowControllerLogger.debug('Step needs address validation via Google API', { step: stepName });
      }
      return needsValidation;
    }
    
    // Service selection steps
    if (stepLower === 'selectservice') {
      const needsData = !collectedData.selectedService;
      if (needsData) {
        FlowControllerLogger.debug('Step needs service selection', { step: stepName });
      }
      return needsData;
    }
    
    if (stepLower === 'addadditionalservices') {
      const needsData = collectedData.addServicesState !== 'completed';
      if (needsData) {
        FlowControllerLogger.debug('Step needs additional services completion', { step: stepName });
      }
      return needsData;
    }
    
    // Time/Date selection steps (but only non-auto-advance ones)
    if (stepLower === 'showavailabletimes') {
      FlowControllerLogger.debug('Step always needs to show time options', { step: stepName });
      return true;
    }
    
    if (stepLower === 'showdaybrowser') {
      const needsData = !collectedData.selectedDate;
      if (needsData) {
        FlowControllerLogger.debug('Step needs date selection', { step: stepName });
      }
      return needsData;
    }
    
    // Quote and booking choice steps
    if (stepLower === 'quotesummary') {
      const needsData = !(
        collectedData.selectedService && 
        collectedData.selectedDate && 
        collectedData.selectedTime && 
        collectedData.finalServiceAddress
      );
      if (needsData) {
        FlowControllerLogger.debug('Step needs complete booking information for quote', { step: stepName });
      }
      return needsData;
    }
    
    if (stepLower === 'handlequotechoice') {
      const quotePresented = !!collectedData.persistedQuote || !!collectedData.bookingSummary;
      if (!quotePresented) {
        return false;
      }

      const paymentCompleted = collectedData.paymentCompleted;
      const quoteConfirmed = collectedData.quoteConfirmedFromSummary;
      if (paymentCompleted || quoteConfirmed) {
        return false;
      }
      
      const paymentLinkGenerated = collectedData.paymentLinkGenerated;
      if (paymentLinkGenerated && !paymentCompleted) {
        FlowControllerLogger.debug('Step waiting for payment completion', { step: stepName });
        return true;
      }
      
      FlowControllerLogger.debug('Step needs quote choice from user', { step: stepName });
      return true;
    }
    
    // All other steps are auto-advance and complete after execution
    return false;
  }

  private mapToActualStep(suggestedStep: string, flowKey: string): string | undefined {
    const currentSteps = conversationFlowBlueprints[flowKey];
    if (currentSteps.includes(suggestedStep)) return suggestedStep;
    
    const suggestion = suggestedStep.toLowerCase();
    for (const stepName of currentSteps) {
      const stepLower = stepName.toLowerCase();
      if ((suggestion.includes('service') || suggestion.includes('change service')) && stepLower.includes('service')) return stepName;
      if ((suggestion.includes('time') || suggestion.includes('date') || suggestion.includes('when') || suggestion.includes('schedule')) && (stepLower.includes('time') || stepLower.includes('date') || stepLower.includes('day') || stepLower.includes('hour') || stepLower.includes('available'))) return stepName;
      if ((suggestion.includes('address') || suggestion.includes('location') || suggestion.includes('where')) && (stepLower.includes('address') || stepLower.includes('location'))) return stepName;
      if ((suggestion.includes('user') || suggestion.includes('name') || suggestion.includes('details')) && (stepLower.includes('user') || stepLower.includes('name'))) return stepName;
      if ((suggestion.includes('quote') || suggestion.includes('summary') || suggestion.includes('confirm') || suggestion.includes('review')) && (stepLower.includes('quote') || stepLower.includes('summary'))) return stepName;
    }
    return undefined;
  }

  private inferStepFromUserIntent(suggestedStep: string, flowKey: string): string | undefined {
    const currentSteps = conversationFlowBlueprints[flowKey];
    const lowerSuggestion = suggestedStep.toLowerCase();
    for (const stepName of currentSteps) {
      const stepLower = stepName.toLowerCase();
      if ((lowerSuggestion.includes('date') || lowerSuggestion.includes('time') || lowerSuggestion.includes('when') || lowerSuggestion.includes('schedule')) && (stepLower.includes('time') || stepLower.includes('date') || stepLower.includes('day') || stepLower.includes('hour') || stepLower.includes('available'))) return stepName;
      if (lowerSuggestion.includes('service') && stepLower.includes('service')) return stepName;
      if ((lowerSuggestion.includes('address') || lowerSuggestion.includes('location') || lowerSuggestion.includes('where')) && (stepLower.includes('address') || stepLower.includes('location'))) return stepName;
      if ((lowerSuggestion.includes('user') || lowerSuggestion.includes('name') || lowerSuggestion.includes('details')) && (stepLower.includes('user') || stepLower.includes('name'))) return stepName;
    }
    return undefined;
  }

  private navigateBackToStep(userCurrentGoal: UserGoal, targetStepName: string) {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const targetStepIndex = currentSteps.indexOf(targetStepName);
    
    if (targetStepIndex !== -1) {
      const previousStep = currentSteps[userCurrentGoal.currentStepIndex];
      userCurrentGoal.currentStepIndex = targetStepIndex;
      
      FlowControllerLogger.journey('Navigated back to step', {
        goalType: userCurrentGoal.goalType,
        step: targetStepName
      }, {
        fromStep: previousStep,
        fromIndex: currentSteps.indexOf(previousStep),
        toIndex: targetStepIndex
      });
      
      userCurrentGoal.collectedData.navigateBackTo = undefined;
      userCurrentGoal.collectedData.showEditOptions = false;
      this.clearDataForStepType(userCurrentGoal.collectedData, targetStepName);
    } else {
      FlowControllerLogger.error('Target step not found in flow', {
        goalType: userCurrentGoal.goalType,
        step: targetStepName
      }, { flowKey: userCurrentGoal.flowKey, availableSteps: currentSteps });
    }
  }

  private clearDataForStepType(collectedData: Record<string, any>, targetStepName: string) {
    const stepLower = targetStepName.toLowerCase();
    let clearedDataTypes: string[] = [];
    
    if (stepLower === 'selectservice') {
      // Clear all service-related data when going back to initial service selection
      collectedData.selectedService = undefined;
      collectedData.selectedServices = undefined;
      collectedData.addServicesState = undefined;
      collectedData.finalServiceAddress = undefined;
      collectedData.serviceLocation = undefined;
      collectedData.bookingSummary = undefined;
      collectedData.persistedQuote = undefined;
      collectedData.quoteId = undefined;
      collectedData.browseModeSelected = undefined;
      clearedDataTypes.push('service', 'quote', 'location');
    }
    
    if (stepLower === 'addadditionalservices') {
      // Only clear the additional services state, keep the first selected service
      collectedData.addServicesState = undefined;
      collectedData.finalServiceAddress = undefined;
      collectedData.serviceLocation = undefined;
      collectedData.bookingSummary = undefined;
      collectedData.persistedQuote = undefined;
      collectedData.quoteId = undefined;
      clearedDataTypes.push('additional_services', 'quote', 'location');
    }
    
    if ((stepLower.includes('time') || stepLower.includes('date') || stepLower.includes('day') || stepLower.includes('hour')) && !stepLower.includes('show') && !stepLower.includes('available')) {
      collectedData.selectedDate = undefined;
      collectedData.selectedTime = undefined;
      collectedData.quickBookingSelected = undefined;
      collectedData.browseModeSelected = undefined;
      collectedData.next3AvailableSlots = undefined;
      collectedData.availableHours = undefined;
      collectedData.formattedAvailableHours = undefined;
      collectedData.persistedQuote = undefined;
      collectedData.quoteId = undefined;
      collectedData.bookingSummary = undefined;
      clearedDataTypes.push('time', 'date', 'quote');
    }
    
    if (stepLower.includes('address') || stepLower.includes('location')) {
      collectedData.finalServiceAddress = undefined;
      collectedData.serviceLocation = undefined;
      collectedData.customerAddress = undefined;
      collectedData.persistedQuote = undefined;
      collectedData.quoteId = undefined;
      collectedData.bookingSummary = undefined;
      clearedDataTypes.push('address', 'location', 'quote');
    }
    
    if (stepLower.includes('user') || stepLower.includes('name')) {
      collectedData.userId = undefined;
      collectedData.existingUserFound = undefined;
      collectedData.customerName = undefined;
      clearedDataTypes.push('user');
    }
    
    if (clearedDataTypes.length > 0) {
      FlowControllerLogger.info('Cleared collected data for step navigation', {
        step: targetStepName
      }, { clearedDataTypes });
    }
  }

  public async handleGoBack(
    userCurrentGoal: UserGoal,
    currentContext: ChatContext,
    conversationDecision: any,
    customerUser?: {firstName: string, lastName: string, id: string}
  ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    let actualTargetStep = conversationDecision.targetStep ? this.mapToActualStep(conversationDecision.targetStep, userCurrentGoal.flowKey) : undefined;

    if (actualTargetStep) {
      this.navigateBackToStep(userCurrentGoal, actualTargetStep);
    } else if (conversationDecision.targetStep) {
      actualTargetStep = this.inferStepFromUserIntent(conversationDecision.targetStep, userCurrentGoal.flowKey);
      if (actualTargetStep) this.navigateBackToStep(userCurrentGoal, actualTargetStep);
      else if (userCurrentGoal.currentStepIndex > 0) userCurrentGoal.currentStepIndex--;
    } else {
      if (userCurrentGoal.currentStepIndex > 0) userCurrentGoal.currentStepIndex--;
    }

    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const targetStepName = currentSteps[userCurrentGoal.currentStepIndex];
    const targetStepHandler = botTasks[targetStepName];
    
    if (targetStepHandler) {
      const targetStepResult = await targetStepHandler.processAndExtractData("", userCurrentGoal.collectedData, currentContext);
      userCurrentGoal.collectedData = typeof targetStepResult === 'object' && 'extractedInformation' in targetStepResult ?
                                      { ...userCurrentGoal.collectedData, ...targetStepResult.extractedInformation } :
                                      targetStepResult as Record<string, any>;
      
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
        responseToUser = userCurrentGoal.collectedData.confirmationMessage || "Let's update your selection.";
      }
      
      let uiButtonsToDisplay: ButtonConfig[] | undefined;
      if (targetStepHandler.fixedUiButtons) {
        if (typeof targetStepHandler.fixedUiButtons === 'function') {
          uiButtonsToDisplay = await targetStepHandler.fixedUiButtons(userCurrentGoal.collectedData, currentContext);
        } else {
          uiButtonsToDisplay = targetStepHandler.fixedUiButtons;
        }
      }

      return { responseToUser, uiButtonsToDisplay };
    } else {
      return { responseToUser: "Something went wrong while navigating back. Please try again.", uiButtonsToDisplay: [] };
    }
  }

  public async handleRestart(userCurrentGoal: UserGoal, currentContext: ChatContext, executeFirstStep: Function): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[] }> {
    userCurrentGoal.currentStepIndex = 0;
    userCurrentGoal.collectedData = {
      availableServices: userCurrentGoal.collectedData.availableServices,
      // Preserve user information across restarts since it's established during goal creation
      userId: userCurrentGoal.collectedData.userId,
      customerName: userCurrentGoal.collectedData.customerName,
      existingUserFound: userCurrentGoal.collectedData.existingUserFound
    };
    return executeFirstStep(userCurrentGoal, currentContext, "restart");
  }

  public async handleOriginalRestartFlow(userCurrentGoal: UserGoal, currentContext: ChatContext) {
    const selectedService = userCurrentGoal.collectedData.selectedService;
    // Since user creation now happens first, restart should jump to the appropriate step after user creation
    let targetStep = selectedService?.mobile ? 'askAddress' : 'selectService';
    
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

  public async handleOriginalNavigateBack(userCurrentGoal: UserGoal, currentContext: ChatContext) {
    const targetStep = userCurrentGoal.collectedData.navigateBackTo as string;
    
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
} 