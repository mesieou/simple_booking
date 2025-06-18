import { MultiIntentClassifier } from './nlu/multi-intent-classifier';
import { BookingManager } from './handlers/booking-manager';
import { FAQHandler } from './handlers/faq-handler';
import { ChitchatHandler } from './handlers/chitchat-handler';
import { ConversationOrchestrator } from './conversation-orchestrator';
import { 
  DetectedIntent, 
  DialogueState, 
  TaskHandlerResult, 
  ButtonConfig, 
  MultiIntentResult 
} from './nlu/types';
import { UserContext } from '@/lib/database/models/user-context';
import { ChatMessage } from '@/lib/database/models/chat-session';

/**
 * Main Orchestrator for V2 Conversation Engine
 * 
 * Clean, modular architecture that coordinates all V2 components:
 * 1. Intent Classification
 * 2. Task Handler Dispatch  
 * 3. Response Orchestration
 * 4. Context Management
 * 
 * Each function has a single responsibility and clear separation of concerns.
 */

// Main orchestrator input
export interface ConversationInput {
  userMessage: string;
  userContext: UserContext;
  currentDialogueState: DialogueState | null;
  chatHistory: ChatMessage[];
  sessionId: string;
}

// Main orchestrator output
export interface ConversationOutput {
  response: string;
  buttons: ButtonConfig[];
  updatedDialogueState: DialogueState;
  shouldPersistContext: boolean;
  error?: string;
}

/**
 * Main entry point for V2 conversation processing
 * Orchestrates the complete pipeline in a clean, modular way
 */
export class MainOrchestrator {
  
  /**
   * Processes a user message through the complete V2 pipeline
   * 
   * @param input - Complete conversation input with message and context
   * @returns Promise<ConversationOutput> - Unified response and updated state
   */
  static async processConversation(input: ConversationInput): Promise<ConversationOutput> {
    try {
      // Step 1: Analyze user message for multiple intents
      const classification = await this.classifyUserMessage(
        input.userMessage, 
        input.currentDialogueState
      );
      
      // Step 2: Process each detected intent with appropriate handlers
      const handlerResults = await this.processDetectedIntents(
        classification.intents,
        input.currentDialogueState,
        input.userContext,
        input.userMessage
      );
      
      // Step 3: Generate unified response from all handler results
      const unifiedResponse = await this.generateUnifiedResponse(
        handlerResults,
        classification,
        input.currentDialogueState,
        input.userContext,
        input.userMessage,
        input.chatHistory
      );
      
      // Step 4: Create final dialogue state with all updates
      const finalDialogueState = this.buildFinalDialogueState(
        input.currentDialogueState,
        unifiedResponse.contextUpdates
      );
      
      return {
        response: unifiedResponse.response,
        buttons: unifiedResponse.buttons,
        updatedDialogueState: finalDialogueState,
        shouldPersistContext: true
      };
      
    } catch (error) {
      console.error('[MainOrchestrator] Error processing conversation:', error);
      
      return this.createErrorResponse(
        input.currentDialogueState,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }
  
  /**
   * Step 1: Classifies user message for multiple intents
   * Single responsibility: Intent detection only
   */
  private static async classifyUserMessage(
    userMessage: string,
    currentState: DialogueState | null
  ): Promise<MultiIntentResult> {
    
    try {
      return await MultiIntentClassifier.analyzeMessage(userMessage, currentState);
      
    } catch (error) {
      console.error('[MainOrchestrator] Intent classification failed:', error);
      
      // Fallback to chitchat intent
      return {
        intents: [{
          type: 'chitchat',
          data: { greeting: true },
          priority: 1,
          handlerName: 'ChitchatHandler'
        }],
        bookingContext: {
          hasActiveBooking: currentState?.activeBooking ? true : false,
          shouldUpdateBooking: false,
          shouldCreateNewBooking: false,
          slotsDetected: []
        }
      };
    }
  }
  
  /**
   * Step 2: Processes each detected intent with appropriate handler
   * Single responsibility: Intent-to-handler dispatch
   */
  private static async processDetectedIntents(
    intents: DetectedIntent[],
    currentState: DialogueState | null,
    userContext: UserContext,
    userMessage: string
  ): Promise<TaskHandlerResult[]> {
    
    const results: TaskHandlerResult[] = [];
    
    for (const intent of intents) {
      try {
        const result = await this.dispatchToHandler(
          intent,
          currentState,
          userContext,
          userMessage
        );
        
        results.push(result);
        
      } catch (error) {
        console.error(`[MainOrchestrator] Handler ${intent.handlerName} failed:`, error);
        
        // Add fallback result for failed handler
        results.push(this.createHandlerFallback(intent.type));
      }
    }
    
    return results;
  }
  
  /**
   * Dispatches individual intent to appropriate handler
   * Single responsibility: Route intent to correct handler
   */
  private static async dispatchToHandler(
    intent: DetectedIntent,
    currentState: DialogueState | null,
    userContext: UserContext,
    userMessage: string
  ): Promise<TaskHandlerResult> {
    
    switch (intent.handlerName) {
      case 'BookingManager':
        return await BookingManager.processIntent(
          intent,
          currentState,
          userContext,
          userMessage
        );
        
      case 'FAQHandler':
        return await FAQHandler.processIntent(
          intent,
          currentState,
          userContext,
          userMessage
        );
        
      case 'ChitchatHandler':
        return await ChitchatHandler.processIntent(
          intent,
          currentState,
          userContext,
          userMessage
        );
        
      default:
        console.warn(`[MainOrchestrator] Unknown handler: ${intent.handlerName}`);
        return this.createHandlerFallback(intent.type);
    }
  }
  
  /**
   * Step 3: Generates unified response from all handler results
   * Single responsibility: Response unification and orchestration
   */
  private static async generateUnifiedResponse(
    handlerResults: TaskHandlerResult[],
    classification: MultiIntentResult,
    currentState: DialogueState | null,
    userContext: UserContext,
    userMessage: string,
    chatHistory: ChatMessage[]
  ): Promise<{
    response: string;
    buttons: ButtonConfig[];
    contextUpdates: Partial<DialogueState>;
  }> {
    
    try {
      return await ConversationOrchestrator.generateUnifiedResponse(
        handlerResults,
        classification.intents,
        classification,
        currentState,
        userContext,
        userMessage
      );
      
    } catch (error) {
      console.error('[MainOrchestrator] Response orchestration failed:', error);
      
      // Fallback to first handler result
      if (handlerResults.length > 0) {
        const primary = handlerResults[0];
        return {
          response: primary.response,
          buttons: primary.buttons || [],
          contextUpdates: {
            lastActivityAt: new Date().toISOString(),
            ...(primary.contextUpdates || {})
          }
        };
      }
      
      // Ultimate fallback
      return {
        response: "I'm here to help! How can I assist you with your beauty service needs?",
        buttons: [
          { buttonText: '📅 Book a service', buttonValue: 'start_booking' },
          { buttonText: '🛍️ View services', buttonValue: 'show_services' }
        ],
        contextUpdates: {
          lastActivityAt: new Date().toISOString()
        }
      };
    }
  }
  
  /**
   * Step 4: Builds final dialogue state with all updates
   * Single responsibility: State consolidation
   */
  private static buildFinalDialogueState(
    currentState: DialogueState | null,
    contextUpdates: Partial<DialogueState>
  ): DialogueState {
    
    const baseState: DialogueState = currentState || {
      lastActivityAt: new Date().toISOString()
    };
    
    return {
      ...baseState,
      ...contextUpdates,
      lastActivityAt: new Date().toISOString() // Always update activity timestamp
    };
  }
  
  /**
   * Creates fallback result when handler fails
   * Single responsibility: Error recovery
   */
  private static createHandlerFallback(intentType: string): TaskHandlerResult {
    
    const fallbacks = {
      booking: {
        response: "I'd be happy to help you with booking! Could you please tell me what service you're interested in?",
        buttons: [
          { buttonText: '🛍️ View services', buttonValue: 'show_services' },
          { buttonText: '📅 Check availability', buttonValue: 'check_availability' }
        ]
      },
      faq: {
        response: "I'm here to answer any questions about our services! What would you like to know?",
        buttons: [
          { buttonText: '🛍️ View services', buttonValue: 'show_services' },
          { buttonText: '💰 View pricing', buttonValue: 'view_pricing' }
        ]
      },
      chitchat: {
        response: "Hello! How can I help you today? 😊",
        buttons: [
          { buttonText: '📅 Book a service', buttonValue: 'start_booking' },
          { buttonText: '❓ Ask a question', buttonValue: 'ask_question' }
        ]
      }
    };
    
    const fallback = fallbacks[intentType as keyof typeof fallbacks] || fallbacks.chitchat;
    
    return {
      response: fallback.response,
      shouldUpdateContext: false,
      buttons: fallback.buttons
    };
  }
  
  /**
   * Creates error response when entire pipeline fails
   * Single responsibility: Complete error recovery
   */
  private static createErrorResponse(
    currentState: DialogueState | null,
    errorMessage: string
  ): ConversationOutput {
    
    console.error('[MainOrchestrator] Creating error response:', errorMessage);
    
    return {
      response: "I apologize, but I'm having some technical difficulties right now. Please try again in a moment, or feel free to contact our support team.",
      buttons: [
        { buttonText: '🔄 Try again', buttonValue: 'retry' },
        { buttonText: '📞 Contact support', buttonValue: 'contact_support' },
        { buttonText: '🛍️ View services', buttonValue: 'show_services' }
      ],
      updatedDialogueState: currentState || {
        lastActivityAt: new Date().toISOString()
      },
      shouldPersistContext: false,
      error: errorMessage
    };
  }
}

/**
 * Utility Functions for External Integration
 */

/**
 * Converts chat history to dialogue state context
 * Single responsibility: History analysis
 */
export function extractDialogueStateFromHistory(
  chatHistory: ChatMessage[],
  userContext: UserContext
): DialogueState | null {
  
  if (!chatHistory || chatHistory.length === 0) {
    return null;
  }
  
  // For now, return basic state - can be enhanced to parse booking info from history
  return {
    userEmail: userContext.channelUserId,
    lastActivityAt: new Date().toISOString()
  };
}

/**
 * Validates input parameters
 * Single responsibility: Input validation
 */
export function validateConversationInput(input: ConversationInput): boolean {
  
  if (!input.userMessage || input.userMessage.trim().length === 0) {
    console.error('[MainOrchestrator] Invalid input: Empty user message');
    return false;
  }
  
  if (!input.userContext || !input.userContext.channelUserId) {
    console.error('[MainOrchestrator] Invalid input: Missing user context');
    return false;
  }
  
  if (!input.sessionId) {
    console.error('[MainOrchestrator] Invalid input: Missing session ID');
    return false;
  }
  
  return true;
}

/**
 * Creates conversation input from raw parameters
 * Single responsibility: Input construction
 */
export function createConversationInput(
  userMessage: string,
  userContext: UserContext,
  chatHistory: ChatMessage[],
  sessionId: string,
  currentDialogueState?: DialogueState | null
): ConversationInput {
  
  return {
    userMessage: userMessage.trim(),
    userContext,
    currentDialogueState: currentDialogueState || extractDialogueStateFromHistory(chatHistory, userContext),
    chatHistory: chatHistory || [],
    sessionId
  };
} 