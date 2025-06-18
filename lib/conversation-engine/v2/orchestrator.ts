import { MultiIntentClassifier } from './nlu/multi-intent-classifier';
import { DetectedIntent, DialogueState, TaskHandlerResult, MultiIntentResult } from './nlu/types';
import { UserContext } from '../../database/models/user-context';
import { BookingManager } from './handlers/booking-manager';
import { FAQHandler } from './handlers/faq-handler';
import { ChitchatHandler } from './handlers/chitchat-handler';
import { BotResponse } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';

/**
 * ConversationOrchestrator - V2 Multi-Intent Conversation Manager
 * 
 * Coordinates the V2 intelligent conversation system:
 * - Analyzes user messages using MultiIntentClassifier
 * - Routes intents to appropriate task handlers
 * - Manages response order: chitchat → FAQ → booking
 * - Handles context updates and state management
 * - Integrates with existing WhatsApp system
 * - Provides fallback to V1 system if needed
 */
export class ConversationOrchestrator {
  
  /**
   * Main entry point for V2 conversation processing
   */
  static async processConversation(
    userMessage: string,
    userContext: UserContext,
    currentDialogueState?: DialogueState | null
  ): Promise<{
    response: BotResponse;
    updatedContext: UserContext;
    dialogueState: DialogueState;
  }> {
    
    try {
      console.log('[V2 Orchestrator] Processing conversation:', {
        userMessage: userMessage.substring(0, 100),
        hasActiveBooking: currentDialogueState?.activeBooking ? true : false,
        businessId: userContext.businessId
      });
      
      // Step 1: Analyze user message for multiple intents
      const analysisResult = await MultiIntentClassifier.analyzeMessage(
        userMessage,
        currentDialogueState
      );
      
      console.log('[V2 Orchestrator] Intent analysis complete:', {
        intentCount: analysisResult.intents.length,
        intentTypes: analysisResult.intents.map(i => i.type),
        hasBookingContext: analysisResult.bookingContext.hasActiveBooking
      });
      
      // Step 2: Process intents through appropriate handlers
      const handlerResults = await this.processIntents(
        analysisResult.intents,
        currentDialogueState,
        userContext,
        userMessage
      );
      
      // Step 3: Combine responses in priority order
      const combinedResponse = this.combineResponses(handlerResults, analysisResult.intents);
      
      // Step 4: Apply context updates
      const updatedDialogueState = this.applyContextUpdates(
        currentDialogueState,
        analysisResult,
        handlerResults
      );
      
      // Step 5: Update user context if needed
      const updatedUserContext = this.updateUserContext(
        userContext,
        updatedDialogueState
      );
      
      console.log('[V2 Orchestrator] Processing complete:', {
        responseLength: combinedResponse.text?.length || 0,
        hasActions: combinedResponse.buttons ? combinedResponse.buttons.length > 0 : false,
        contextUpdated: updatedDialogueState !== currentDialogueState
      });
      
      return {
        response: combinedResponse,
        updatedContext: updatedUserContext,
        dialogueState: updatedDialogueState
      };
      
    } catch (error) {
      console.error('[V2 Orchestrator] Error processing conversation:', error);
      
      // Fallback response
      return {
        response: {
          text: "I'm having trouble processing that right now. Could you please try again?"
        },
        updatedContext: userContext,
        dialogueState: currentDialogueState || this.createDefaultDialogueState()
      };
    }
  }
  
  /**
   * Processes multiple intents through appropriate handlers
   */
  private static async processIntents(
    intents: DetectedIntent[],
    currentContext: DialogueState | null,
    userContext: UserContext,
    userMessage: string
  ): Promise<TaskHandlerResult[]> {
    
    const results: TaskHandlerResult[] = [];
    
    for (const intent of intents) {
      try {
        let result: TaskHandlerResult;
        
        switch (intent.handlerName) {
          case 'BookingManager':
            result = await BookingManager.processIntent(intent, currentContext, userContext, userMessage);
            break;
            
          case 'FAQHandler':
            result = await FAQHandler.processIntent(intent, currentContext, userContext, userMessage);
            break;
            
          case 'ChitchatHandler':
            result = await ChitchatHandler.processIntent(intent, currentContext, userContext, userMessage);
            break;
            
          default:
            console.warn('[V2 Orchestrator] Unknown handler:', intent.handlerName);
            result = {
              response: "I'm not sure how to handle that request.",
              shouldUpdateContext: false
            };
        }
        
        results.push(result);
        
      } catch (error) {
        console.error(`[V2 Orchestrator] Error processing intent ${intent.type}:`, error);
        results.push({
          response: `I had trouble processing your ${intent.type} request.`,
          shouldUpdateContext: false
        });
      }
    }
    
    return results;
  }
  
  /**
   * Combines multiple handler responses into a single coherent response
   * Priority order: chitchat → FAQ → booking
   */
  private static combineResponses(
    handlerResults: TaskHandlerResult[],
    originalIntents: DetectedIntent[]
  ): BotResponse {
    
    if (handlerResults.length === 0) {
      return {
        text: "I'm not sure how to help with that. Could you please try rephrasing your request?"
      };
    }
    
    // Single intent - return as-is
    if (handlerResults.length === 1) {
      return this.formatSingleResponse(handlerResults[0]);
    }
    
    // Multiple intents - combine intelligently
    return this.formatMultiIntentResponse(handlerResults, originalIntents);
  }
  
  /**
   * Formats a single handler response
   */
  private static formatSingleResponse(result: TaskHandlerResult): BotResponse {
    const response: BotResponse = {
      text: result.response
    };
    
    // Add suggested actions as buttons if they exist and fit WhatsApp constraints
    if (result.suggestedActions && result.suggestedActions.length > 0) {
      const maxButtons = 3; // WhatsApp limit
      const buttons = result.suggestedActions.slice(0, maxButtons).map(action => ({
        text: action.text,
        value: action.action
      }));
      
      response.buttons = buttons;
    }
    
    return response;
  }
  
  /**
   * Formats multiple handler responses into a coherent single response
   */
  private static formatMultiIntentResponse(
    results: TaskHandlerResult[],
    originalIntents: DetectedIntent[]
  ): BotResponse {
    
    // Separate responses by type
    const chitchatResponses = results.filter((_, i) => originalIntents[i]?.type === 'chitchat');
    const faqResponses = results.filter((_, i) => originalIntents[i]?.type === 'faq');
    const bookingResponses = results.filter((_, i) => originalIntents[i]?.type === 'booking');
    
    const responseParts: string[] = [];
    let primaryActions: Array<{text: string, action: string}> = [];
    
    // 1. Chitchat first (brief acknowledgment)
    if (chitchatResponses.length > 0) {
      const chitchatText = chitchatResponses[0].response;
      // Shorten chitchat for multi-intent responses
      const briefChitchat = this.shortenChitchatResponse(chitchatText);
      responseParts.push(briefChitchat);
    }
    
    // 2. FAQ second (main informational content)
    if (faqResponses.length > 0) {
      responseParts.push(faqResponses[0].response);
      // FAQ actions are secondary
      if (faqResponses[0].suggestedActions) {
        primaryActions = [...primaryActions, ...faqResponses[0].suggestedActions];
      }
    }
    
    // 3. Booking last (most important, actionable)
    if (bookingResponses.length > 0) {
      responseParts.push(bookingResponses[0].response);
      // Booking actions take priority
      if (bookingResponses[0].suggestedActions) {
        primaryActions = [...bookingResponses[0].suggestedActions, ...primaryActions];
      }
    }
    
    // Combine response parts
    const combinedText = responseParts.join('\n\n');
    
    const response: BotResponse = {
      text: combinedText
    };
    
    // Add buttons (prioritize booking actions, limit to WhatsApp constraints)
    if (primaryActions.length > 0) {
      const maxButtons = 3;
      const uniqueActions = this.deduplicateActions(primaryActions);
      const buttons = uniqueActions.slice(0, maxButtons).map(action => ({
        text: action.text,
        value: action.action
      }));
      
      response.buttons = buttons;
    }
    
    return response;
  }
  
  /**
   * Shortens chitchat responses for multi-intent scenarios
   */
  private static shortenChitchatResponse(chitchatText: string): string {
    // Extract just the greeting/acknowledgment part
    const sentences = chitchatText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    if (sentences.length === 0) return chitchatText;
    
    // Return first sentence for brevity in multi-intent responses
    const firstSentence = sentences[0];
    
    // Add punctuation if missing
    if (!firstSentence.match(/[.!?]$/)) {
      return firstSentence + '!';
    }
    
    return firstSentence;
  }
  
  /**
   * Removes duplicate actions based on action value
   */
  private static deduplicateActions(
    actions: Array<{text: string, action: string}>
  ): Array<{text: string, action: string}> {
    
    const seen = new Set<string>();
    const unique: Array<{text: string, action: string}> = [];
    
    for (const action of actions) {
      if (!seen.has(action.action)) {
        seen.add(action.action);
        unique.push(action);
      }
    }
    
    return unique;
  }
  
  /**
   * Applies context updates from intent analysis and handler results
   */
  private static applyContextUpdates(
    currentContext: DialogueState | null,
    analysisResult: MultiIntentResult,
    handlerResults: TaskHandlerResult[]
  ): DialogueState {
    
    // Start with current context or default
    let updatedContext = currentContext ? { ...currentContext } : this.createDefaultDialogueState();
    
    // Apply context updates from intent analysis
    if (analysisResult.contextUpdates) {
      updatedContext = { ...updatedContext, ...analysisResult.contextUpdates };
    }
    
    // Apply context updates from handlers (handlers take priority)
    for (const result of handlerResults) {
      if (result.shouldUpdateContext && result.contextUpdates) {
        updatedContext = { ...updatedContext, ...result.contextUpdates };
      }
    }
    
    // Always update activity timestamp
    updatedContext.lastActivityAt = new Date().toISOString();
    
    return updatedContext;
  }
  
  /**
   * Updates the user context based on dialogue state changes
   */
  private static updateUserContext(
    userContext: UserContext,
    dialogueState: DialogueState
  ): UserContext {
    
    // For now, we don't need to update the UserContext based on dialogue state
    // The dialogue state is managed separately
    // Future enhancement: could store dialogue state in UserContext.currentGoal
    
    return userContext;
  }
  
  /**
   * Creates a default dialogue state
   */
  private static createDefaultDialogueState(): DialogueState {
    return {
      lastActivityAt: new Date().toISOString()
    };
  }
  
  /**
   * Checks if the V2 system should be used for this conversation
   * Provides feature flagging and gradual rollout capability
   */
  static shouldUseV2System(userContext: UserContext): boolean {
    // For now, always use V2 system
    // Future enhancement: add feature flags, A/B testing, etc.
    
    const businessId = userContext.businessId;
    if (!businessId) {
      console.warn('[V2 Orchestrator] No business ID found, falling back to V1');
      return false;
    }
    
    // Could add business-specific feature flags here
    // Could add user-specific feature flags here
    // Could add percentage-based rollout here
    
    return true;
  }
  
  /**
   * Fallback method for V1 compatibility
   * Used when V2 system is disabled or encounters errors
   */
  static async fallbackToV1(
    userMessage: string,
    userContext: UserContext
  ): Promise<{
    response: BotResponse;
    updatedContext: UserContext;
    dialogueState: DialogueState;
  }> {
    
    console.log('[V2 Orchestrator] Falling back to V1 system');
    
    // This would integrate with the existing V1 conversation system
    // For now, return a simple response
    return {
      response: {
        text: "I'm processing your request using the standard system. How can I help you today?"
      },
      updatedContext: userContext,
      dialogueState: this.createDefaultDialogueState()
    };
  }
} 