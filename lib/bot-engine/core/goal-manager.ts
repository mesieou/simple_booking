import {
    UserGoal,
    ChatContext,
    LLMProcessingResult,
    ButtonConfig,
  } from '@/lib/bot-engine/types';
  import { conversationFlowBlueprints } from "@/lib/bot-engine/config/blueprints";
  
  export class GoalManager {
  
    public async createNewGoal(detectionResult: LLMProcessingResult, participantType: 'business' | 'customer', context: ChatContext): Promise<UserGoal> {
      let flowKey: string;
      let servicesData: any[] = [];
      
      if (participantType === 'customer' && detectionResult.detectedUserGoalType === 'serviceBooking' && detectionResult.detectedGoalAction === 'create') {
        const businessId = context.currentParticipant.associatedBusinessId;
        if (businessId) {
          try {
            const { Service } = await import('@/lib/database/models/service');
            const services = await Service.getByBusiness(businessId);
            servicesData = services.map(s => s.getData());
            const hasMobileServices = servicesData.some((service: any) => service.mobile === true);
            flowKey = hasMobileServices ? 'bookingCreatingForMobileService' : 'bookingCreatingForNoneMobileService';
          } catch (error) {
            console.error('Error loading services for flow determination:', error);
            flowKey = 'bookingCreatingForMobileService';
          }
        } else {
          flowKey = 'bookingCreatingForMobileService';
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
          availableServices: servicesData
        },
        messageHistory: [],
        flowKey
      };
    }
  
    public async handleTopicSwitch(
      currentContext: ChatContext,
      conversationDecision: any,
      incomingUserMessage: string,
      currentGoal?: UserGoal
    ): Promise<{ responseToUser: string; uiButtonsToDisplay?: ButtonConfig[]; newGoal?: UserGoal }> {
      if (conversationDecision.newGoalType === 'serviceBooking' && conversationDecision.newGoalAction === 'create') {
        if (currentGoal) {
          currentGoal.goalStatus = 'completed';
        }
        
        const newGoal = await this.createNewGoal(
          {
            detectedUserGoalType: 'serviceBooking',
            detectedGoalAction: 'create',
            extractedInformation: conversationDecision.extractedData || {}
          },
          'customer',
          currentContext
        );
        
        const { botTasks } = await import('@/lib/bot-engine/config/tasks');
        const firstStepHandler = botTasks[conversationFlowBlueprints[newGoal.flowKey][0]];
        const processingResult = await firstStepHandler.processAndExtractData("", newGoal.collectedData, currentContext);
        newGoal.collectedData = typeof processingResult === 'object' && 'extractedInformation' in processingResult ?
                                      { ...newGoal.collectedData, ...processingResult.extractedInformation } :
                                      processingResult as Record<string, any>;
        
        const responseToUser = newGoal.collectedData.confirmationMessage || firstStepHandler.defaultChatbotPrompt || "Let's get started with your booking.";
        
        let uiButtonsToDisplay: ButtonConfig[] | undefined;
        if (firstStepHandler.fixedUiButtons) {
          if (typeof firstStepHandler.fixedUiButtons === 'function') {
            uiButtonsToDisplay = await firstStepHandler.fixedUiButtons(newGoal.collectedData, currentContext);
          } else {
            uiButtonsToDisplay = firstStepHandler.fixedUiButtons;
          }
        }
        
        return {
          responseToUser,
          uiButtonsToDisplay,
          newGoal
        };
      }
      
      return {
        responseToUser: "I understand you'd like to switch topics. Let me help you with that.",
        uiButtonsToDisplay: []
      };
    }
  }