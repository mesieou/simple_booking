import {
    UserGoal,
    ChatContext,
    LLMProcessingResult,
    ButtonConfig,
  } from '@/lib/bot-engine/types';
  import { conversationFlowBlueprints, businessCategoryToBookingFlowKey } from "@/lib/bot-engine/config/blueprints";
  
  export class GoalManager {
  
    public async createNewGoal(detectionResult: LLMProcessingResult, participantType: 'business' | 'customer', context: ChatContext): Promise<UserGoal> {
      // COMPREHENSIVE LOGGING FOR DEBUGGING
      console.log('===== GOAL MANAGER DEBUG =====');
      console.log(`[GoalManager] createNewGoal called with:`);
      console.log(`  - participantType: ${participantType}`);
      console.log(`  - detectionResult:`, JSON.stringify(detectionResult, null, 2));
      console.log(`  - detectedUserGoalType: ${detectionResult.detectedUserGoalType}`);
      console.log(`  - detectedGoalAction: ${detectionResult.detectedGoalAction}`);
      console.log(`  - extractedInformation:`, detectionResult.extractedInformation);
      console.log('===============================');
      
      let flowKey: string;
      let servicesData: any[] = [];
      let userInfo: { userId?: string; customerName?: string; existingUserFound?: boolean } = {};
      
      if (participantType === 'customer' && detectionResult.detectedUserGoalType === 'serviceBooking' && detectionResult.detectedGoalAction === 'create') {
        const businessId = context.currentParticipant.associatedBusinessId;
        if (businessId) {
          try {
            // Get business category for flow routing
            const { Business } = await import('@/lib/database/models/business');
            const business = await Business.getById(businessId);
            const businessCategory = business.businessCategory || 'default';
            flowKey = businessCategoryToBookingFlowKey[businessCategory] || businessCategoryToBookingFlowKey.default;
            
            console.log(`[GoalManager] Business category: ${businessCategory}, Selected flow: ${flowKey}`);
            
            // Still load services for use in the flow
            const { Service } = await import('@/lib/database/models/service');
            const services = await Service.getByBusiness(businessId);
            servicesData = services.map(s => s.getData());
          } catch (error) {
            console.error('Error loading business/services for flow determination:', error);
            flowKey = businessCategoryToBookingFlowKey.default;
          }
        } else {
          flowKey = businessCategoryToBookingFlowKey.default;
        }

        // Get user information that was already collected during FAQ phase
        console.log('[GoalManager] Retrieving user info from session...');
        userInfo = this.getUserInfoFromSession(context);
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
          availableServices: servicesData,
          ...userInfo // Include user information that was already collected
        },
        messageHistory: [],
        flowKey
      };
    }

    private getUserInfoFromSession(context: ChatContext): { userId?: string; customerName?: string; existingUserFound?: boolean } {
      const sessionUserInfo = context.currentConversationSession?.userData;
      
      if (sessionUserInfo?.userId) {
        console.log(`[GoalManager] Found user info in session: ${sessionUserInfo.customerName} (${sessionUserInfo.userId})`);
        return {
          userId: sessionUserInfo.userId,
          customerName: sessionUserInfo.customerName,
          existingUserFound: sessionUserInfo.existingUserFound || false
        };
      }
      
      console.log('[GoalManager] No user info found in session - this should not happen if FAQ flow is working correctly');
      return { existingUserFound: false };
    }

    // Remove the old user creation methods since they're now handled in FAQ phase
    // Keep this method for backward compatibility but it should not be needed
    public async createUserForBookingGoal(customerName: string, context: ChatContext): Promise<{ userId?: string; customerName: string }> {
      console.warn('[GoalManager] createUserForBookingGoal called - this should not happen with new flow');
      try {
        const { User } = await import('@/lib/database/models/user');
        
        const newUser = new User(
          customerName,
          '', // lastName
          'customer',
          context.currentParticipant.associatedBusinessId || ''
        );
        
        await newUser.add({
          whatsappNumber: context.currentParticipant.customerWhatsappNumber
        });
        
        console.log(`[GoalManager] Created new user: ${newUser.firstName} (${newUser.id})`);
        return {
          userId: newUser.id,
          customerName: newUser.firstName
        };
        
      } catch (error) {
        console.error('[GoalManager] Error creating user:', error);
        throw error;
      }
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
        
        const responseToUser = newGoal.collectedData.confirmationMessage || "Let's get started with your booking.";
        
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

      throw new Error(`Unsupported topic switch: ${conversationDecision.newGoalType}-${conversationDecision.newGoalAction}`);
    }
  }