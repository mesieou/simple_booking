import {
  UserGoal,
  ChatContext,
  ButtonConfig
} from '@/lib/bot-engine/types';
import { conversationFlowBlueprints } from "@/lib/bot-engine/config/blueprints";
import { botTasks } from "@/lib/bot-engine/config/tasks";
import { IntelligentLLMService } from '@/lib/bot-engine/services/llm-service';

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
    console.log(`[FlowController] Skipping step for existing user: ${stepName}`);
    return true;
  }
  return false;
}

export class FlowController {
  private llmService = new IntelligentLLMService();

  public advanceAndSkipStep(userCurrentGoal: UserGoal) {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    let nextStepName: string;
    
    do {
      userCurrentGoal.currentStepIndex++;
      if (userCurrentGoal.currentStepIndex < currentSteps.length) {
        nextStepName = currentSteps[userCurrentGoal.currentStepIndex];
        console.log(`[FlowController] Advanced to step: ${nextStepName} (${userCurrentGoal.currentStepIndex})`);
      } else {
        nextStepName = ''; 
      }
    } while (nextStepName && shouldSkipStep(nextStepName, userCurrentGoal.collectedData));
  }

  public navigateToAppropriateStep(userCurrentGoal: UserGoal): string {
    const currentSteps = conversationFlowBlueprints[userCurrentGoal.flowKey];
    const currentStepIndex = userCurrentGoal.currentStepIndex;
    const goalData = userCurrentGoal.collectedData;
    
    if (goalData.browseModeSelected) {
      console.log('[FlowController] Browse mode active - using normal sequential flow');
      
      // CRITICAL FIX: First check if the current step still needs data, even in browse mode
      const currentStepName = currentSteps[currentStepIndex];
      if (currentStepName && this.stepNeedsData(currentStepName, goalData)) {
        console.log(`[FlowController] Browse mode: Current step ${currentStepName} still needs data - staying on current step`);
        return currentStepName;
      }
      
      let nextStepIndex = currentStepIndex + 1;
      
      while (nextStepIndex < currentSteps.length && shouldSkipStep(currentSteps[nextStepIndex], goalData)) {
        console.log(`[FlowController] Skipping step in browse mode: ${currentSteps[nextStepIndex]}`);
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
        console.log(`[FlowController] Smart jump: Complete booking data detected, jumping to quoteSummary (${quoteStepIndex})`);
        return currentSteps[quoteStepIndex];
      }
    }
    
    if (goalData.paymentLinkGenerated && !goalData.paymentCompleted) {
      console.log('[FlowController] Payment pending - staying on current step to wait for payment');
      return currentSteps[currentStepIndex];
    }
    
    // CRITICAL FIX: First check if the current step still needs data
    const currentStepName = currentSteps[currentStepIndex];
    if (currentStepName && this.stepNeedsData(currentStepName, goalData)) {
      console.log(`[FlowController] Current step ${currentStepName} still needs data - staying on current step`);
      return currentStepName;
    }
    
    // Then check future steps
    for (let i = currentStepIndex + 1; i < currentSteps.length; i++) {
      const stepName = currentSteps[i];
      
      if (shouldSkipStep(stepName, goalData)) {
        console.log(`[FlowController] Skipping step: ${stepName}`);
        continue;
      }
      
      if (this.stepNeedsData(stepName, goalData)) {
        console.log(`[FlowController] Smart navigation: Jumping to step ${stepName} (${i}) - this step still needs data`);
        return stepName;
      }
    }
    
    return currentSteps[currentStepIndex + 1] || currentSteps[currentStepIndex];
  }

  private stepNeedsData(stepName: string, collectedData: Record<string, any>): boolean {
    const stepLower = stepName.toLowerCase();
    
    // ===================================================================
    // STEPS THAT NEED USER INPUT (explicit whitelist approach)
    // ===================================================================
    
    // Service selection steps
    if (stepLower === 'selectservice') {
      return !collectedData.selectedService;
    }
    
    if (stepLower === 'addadditionalservices') {
      return collectedData.addServicesState !== 'completed';
    }
    
    // Time/Date selection steps (but only non-auto-advance ones)
    if (stepLower === 'showavailabletimes') {
      // Always needs to be shown to display time options
      return true;
    }
    
    if (stepLower === 'showdaybrowser') {
      return !collectedData.selectedDate;
    }
    
    if (stepLower === 'selectspecificday') {
      return !collectedData.selectedDate;
    }
    
    if (stepLower === 'showhoursforday') {
      return !collectedData.selectedTime;
    }
    
    if (stepLower === 'selectspecifictime') {
      return !collectedData.selectedTime;
    }
    
    // Address/Location steps that need user input
    if (stepLower === 'askaddress') {
      return !collectedData.customerAddress;
    }
    
    if (stepLower === 'validateaddress') {
      return !collectedData.addressConfirmed && !collectedData.isAddressValidated;
    }
    
    // User information steps that need input
    if (stepLower === 'askusername') {
      return !collectedData.existingUserFound && !collectedData.customerName;
    }
    
    if (stepLower === 'askemail') {
      return !collectedData.customerEmail;
    }
    
    // Quote and booking choice steps
    if (stepLower === 'quotesummary') {
      // Needs data if we don't have all required booking information
      return !(
        collectedData.selectedService && 
        collectedData.selectedDate && 
        collectedData.selectedTime && 
        collectedData.finalServiceAddress
      );
    }
    
    if (stepLower === 'handlequotechoice') {
      // Needs user choice unless payment completed or quote confirmed
      const paymentCompleted = collectedData.paymentCompleted;
      const quoteConfirmed = collectedData.quoteConfirmedFromSummary;
      const paymentLinkGenerated = collectedData.paymentLinkGenerated;
      
      if (paymentCompleted || quoteConfirmed) {
        return false; // Choice has been made
      }
      
      if (paymentLinkGenerated && !paymentCompleted) {
        return true; // Waiting for payment
      }
      
      return true; // Needs user to make a choice
    }
    
    // ===================================================================
    // DEFAULT: AUTO-ADVANCE STEPS DON'T NEED DATA (safe default)
    // ===================================================================
    
    // All other steps are auto-advance and complete after execution:
    // - checkExistingUser
    // - handleUserStatus  
    // - createNewUser
    // - confirmLocation
    // - handleTimeChoice
    // - createBooking
    // - bookingConfirmation
    // - validateAddress (when auto-confirming)
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
      userCurrentGoal.currentStepIndex = targetStepIndex;
      console.log(`[FlowController] Navigated back to step: ${targetStepName} (${targetStepIndex})`);
      userCurrentGoal.collectedData.navigateBackTo = undefined;
      userCurrentGoal.collectedData.showEditOptions = false;
      this.clearDataForStepType(userCurrentGoal.collectedData, targetStepName);
    } else {
      console.error(`[FlowController] Target step not found in flow: ${targetStepName}`);
    }
  }

  private clearDataForStepType(collectedData: Record<string, any>, targetStepName: string) {
    const stepLower = targetStepName.toLowerCase();
    
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
    }
    
    if (stepLower === 'addadditionalservices') {
      // Only clear the additional services state, keep the first selected service
      collectedData.addServicesState = undefined;
      collectedData.finalServiceAddress = undefined;
      collectedData.serviceLocation = undefined;
      collectedData.bookingSummary = undefined;
      collectedData.persistedQuote = undefined;
      collectedData.quoteId = undefined;
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
    }
    
    if (stepLower.includes('address') || stepLower.includes('location')) {
      collectedData.finalServiceAddress = undefined;
      collectedData.serviceLocation = undefined;
      collectedData.customerAddress = undefined;
      collectedData.persistedQuote = undefined;
      collectedData.quoteId = undefined;
      collectedData.bookingSummary = undefined;
    }
    
    if (stepLower.includes('user') || stepLower.includes('name')) {
      collectedData.userId = undefined;
      collectedData.existingUserFound = undefined;
      collectedData.customerName = undefined;
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
        responseToUser = userCurrentGoal.collectedData.confirmationMessage || targetStepHandler.defaultChatbotPrompt || "Let's update your selection.";
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
      availableServices: userCurrentGoal.collectedData.availableServices
    };
    return executeFirstStep(userCurrentGoal, currentContext, "restart");
  }

  public async handleOriginalRestartFlow(userCurrentGoal: UserGoal, currentContext: ChatContext) {
    const selectedService = userCurrentGoal.collectedData.selectedService;
    let targetStep = selectedService?.mobile ? 'askAddress' : 'confirmLocation';
    
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
} 