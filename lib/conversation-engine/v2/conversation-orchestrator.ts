import { DetectedIntent, DialogueState, TaskHandlerResult, ButtonConfig, MultiIntentResult } from './nlu/types';
import { UserContext } from '@/lib/database/models/user-context';
import { ChatSession } from '@/lib/database/models/chat-session';
import { executeChatCompletion, OpenAIChatMessage } from '../llm-actions/chat-interactions/openai-config/openai-core';

/**
 * ConversationOrchestrator - Main LLM Response Generator for V2 System
 * 
 * The central coordinator that processes results from multiple handlers and generates
 * unified, human-like responses. Handles multi-intent fusion, context management,
 * and maintains conversation flow.
 * 
 * Key Features:
 * - Multi-intent response fusion using LLM
 * - Chat history integration from chatSessions table
 * - Priority-based response ordering (Booking > FAQ > Chitchat)
 * - Context conflict resolution
 * - WhatsApp-optimized button prioritization
 * - Natural conversation flow maintenance
 */
export class ConversationOrchestrator {
  
  /**
   * Main entry point for generating unified responses
   */
  static async generateUnifiedResponse(
    handlerResults: TaskHandlerResult[],
    detectedIntents: DetectedIntent[],
    classificationResult: MultiIntentResult,
    currentContext: DialogueState | null,
    userContext: UserContext,
    userMessage: string
  ): Promise<{
    response: string;
    buttons: ButtonConfig[];
    contextUpdates: Partial<DialogueState>;
  }> {
    
    try {
      // Get recent chat history for context
      const chatHistory = await this.getRecentChatHistory(userContext);
      
      // Apply priority-based response ordering
      const prioritizedResults = this.prioritizeHandlerResults(handlerResults, detectedIntents);
      
      // Handle booking conflicts and context updates
      const resolvedContext = this.resolveContextConflicts(
        prioritizedResults,
        classificationResult,
        currentContext
      );
      
      // Generate unified response using LLM
      const unifiedResponse = await this.generateLLMResponse(
        prioritizedResults,
        detectedIntents,
        userMessage,
        chatHistory,
        resolvedContext,
        userContext
      );
      
      // Prioritize and merge buttons
      const finalButtons = this.prioritizeButtons(prioritizedResults, resolvedContext);
      
      // Merge all context updates
      const finalContextUpdates = this.mergeContextUpdates(
        prioritizedResults,
        classificationResult,
        resolvedContext
      );
      
      return {
        response: unifiedResponse,
        buttons: finalButtons,
        contextUpdates: finalContextUpdates
      };
      
    } catch (error) {
      console.error('[ConversationOrchestrator] Error generating unified response:', error);
      return this.createFallbackResponse();
    }
  }
  
  /**
   * Retrieves recent chat history from chatSessions table
   */
  private static async getRecentChatHistory(userContext: UserContext): Promise<Array<{
    type: 'user' | 'assistant';
    message: string;
    timestamp: string;
  }>> {
    try {
      // Get recent sessions by channelUserId (which is the phone number)
      const recentSessions = await this.getRecentChatSessions(userContext.channelUserId, 5);
      
      // Extract messages from allMessages array in each session
      const messages: Array<{ type: 'user' | 'assistant'; message: string; timestamp: string }> = [];
      
      for (const session of recentSessions) {
        for (const msg of session.allMessages) {
          messages.push({
            type: msg.role === 'user' ? 'user' : 'assistant',
            message: msg.content,
            timestamp: msg.timestamp || session.createdAt
          });
        }
      }
      
      // Sort by timestamp and take last 6 messages
      return messages
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-6);
      
    } catch (error) {
      console.error('[ConversationOrchestrator] Error fetching chat history:', error);
      return [];
    }
  }
  
  /**
   * Helper method to get recent chat sessions by channelUserId
   */
  private static async getRecentChatSessions(channelUserId: string, limit: number): Promise<any[]> {
    // For now, return empty array - this would need to be implemented in ChatSession model
    // TODO: Add ChatSession.getRecentByChannelUserId method
    console.warn('[ConversationOrchestrator] Chat history retrieval not fully implemented yet');
    return [];
  }
  
  /**
   * Applies priority-based ordering: Booking > FAQ > Chitchat
   */
  private static prioritizeHandlerResults(
    handlerResults: TaskHandlerResult[],
    detectedIntents: DetectedIntent[]
  ): TaskHandlerResult[] {
    
    const priorityOrder = ['BookingManager', 'FAQHandler', 'ChitchatHandler'];
    
    return handlerResults.sort((a, b) => {
      const intentA = detectedIntents.find(intent => intent.handlerName === this.getHandlerName(a));
      const intentB = detectedIntents.find(intent => intent.handlerName === this.getHandlerName(b));
      
      const priorityA = priorityOrder.indexOf(intentA?.handlerName || 'Unknown');
      const priorityB = priorityOrder.indexOf(intentB?.handlerName || 'Unknown');
      
      // Lower index = higher priority
      return (priorityA === -1 ? 999 : priorityA) - (priorityB === -1 ? 999 : priorityB);
    });
  }
  
  /**
   * Resolves context conflicts, especially booking conflicts
   */
  private static resolveContextConflicts(
    prioritizedResults: TaskHandlerResult[],
    classificationResult: MultiIntentResult,
    currentContext: DialogueState | null
  ): DialogueState | null {
    
    const hasBookingIntent = classificationResult.intents.some(intent => intent.type === 'booking');
    const hasActiveBooking = currentContext?.activeBooking ? true : false;
    
    // Handle booking conflicts - mention existing booking data and ask to modify
    if (hasBookingIntent && hasActiveBooking) {
      const existingBooking = currentContext!.activeBooking!;
      
      // Add conflict resolution context
      return {
        ...currentContext!,
        bookingConflict: {
          hasExistingBooking: true,
          existingBookingData: {
            service: existingBooking.serviceName || 'Not specified',
            date: existingBooking.date || 'Not selected',
            time: existingBooking.time || 'Not selected',
            name: existingBooking.userName || 'Not provided'
          },
          needsModification: true
        }
      };
    }
    
    return currentContext;
  }
  
  /**
   * Generates unified LLM response considering all handler results and context
   */
  private static async generateLLMResponse(
    prioritizedResults: TaskHandlerResult[],
    detectedIntents: DetectedIntent[],
    userMessage: string,
    chatHistory: Array<{ type: 'user' | 'assistant'; message: string; timestamp: string }>,
    resolvedContext: DialogueState | null,
    userContext: UserContext
  ): Promise<string> {
    
    // If only one result, use it directly (optimization)
    if (prioritizedResults.length === 1) {
      return this.enhanceSingleResponse(prioritizedResults[0], resolvedContext);
    }
    
    const systemPrompt = this.buildUnifiedSystemPrompt(resolvedContext, userContext);
    const userPrompt = this.buildUnifiedUserPrompt(
      userMessage,
      prioritizedResults,
      detectedIntents,
      chatHistory,
      resolvedContext
    );
    
    try {
      const response = await executeChatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        "gpt-4o",
        0.4, // Balanced creativity for natural responses
        500
      );
      
      const unifiedResponse = response.choices[0]?.message?.content?.trim();
      return unifiedResponse || prioritizedResults[0].response;
      
    } catch (error) {
      console.error('[ConversationOrchestrator] Error generating LLM response:', error);
      return this.mergePrioritizedResponses(prioritizedResults, resolvedContext);
    }
  }
  
  /**
   * Builds system prompt for unified response generation
   */
  private static buildUnifiedSystemPrompt(
    resolvedContext: DialogueState | null,
    userContext: UserContext
  ): string {
    
    const hasActiveBooking = resolvedContext?.activeBooking ? true : false;
    const hasBookingConflict = resolvedContext?.bookingConflict?.hasExistingBooking || false;
    
    return `You are an intelligent beauty service booking assistant. You excel at handling multiple customer intents in a single, natural response.

CORE PERSONALITY:
- Professional yet warm and conversational
- Always prioritize booking-related requests
- Acknowledge ALL customer intents naturally
- Maintain conversation flow smoothly
- Use emojis sparingly but effectively (1-2 per response)

 CURRENT CONTEXT:
 - Business: Beauty services (manicures, facials, treatments)
 - Customer ID: ${userContext.channelUserId}
 - Active Booking: ${hasActiveBooking ? 'YES' : 'NO'}
${hasBookingConflict ? `
- BOOKING CONFLICT DETECTED: Customer has existing booking but mentioned new booking info
- Existing Booking: ${JSON.stringify(resolvedContext?.bookingConflict?.existingBookingData || {})}
- Action Required: Mention existing booking and ask if they want to modify it
` : ''}

RESPONSE PRIORITIES (ALWAYS FOLLOW THIS ORDER):
1. **BOOKING REQUESTS** - Highest priority, address first and most prominently
2. **FAQ/QUESTIONS** - Address after booking matters
3. **CHITCHAT/GREETINGS** - Acknowledge but keep brief, focus on business

MULTI-INTENT FUSION RULES:
- **Address ALL intents** in a single, flowing response
- **Start with highest priority** (booking > FAQ > chitchat)
- **Natural transitions** between topics
- **Complete responses** - never leave intents unaddressed
- **Maintain context** from previous conversations

${hasBookingConflict ? `
BOOKING CONFLICT HANDLING:
- Acknowledge the new request
- Mention their existing booking details
- Ask if they want to modify the existing booking
- Be helpful, not confusing
` : ''}

RESPONSE FORMAT:
- Natural, conversational tone
- Maximum 300 characters for WhatsApp optimization
- Clear call-to-action when appropriate
- Professional but friendly

Generate a unified response that addresses all customer intents while following the priority order.`;
  }
  
  /**
   * Builds user prompt with all context and handler results
   */
  private static buildUnifiedUserPrompt(
    userMessage: string,
    prioritizedResults: TaskHandlerResult[],
    detectedIntents: DetectedIntent[],
    chatHistory: Array<{ type: 'user' | 'assistant'; message: string; timestamp: string }>,
    resolvedContext: DialogueState | null
  ): string {
    
    // Format chat history
    const historyText = chatHistory.length > 0 
      ? chatHistory.map(h => `${h.type}: ${h.message}`).join('\n')
      : 'No previous conversation';
    
    // Format handler responses
    const handlerResponses = prioritizedResults.map((result, index) => {
      const intent = detectedIntents[index];
      return `${intent?.type?.toUpperCase() || 'UNKNOWN'} Handler Response: "${result.response}"`;
    }).join('\n\n');
    
    // Format detected intents
    const intentsText = detectedIntents.map(intent => 
      `- ${intent.type} (${intent.handlerName}): ${JSON.stringify(intent.data)}`
    ).join('\n');
    
    return `CUSTOMER MESSAGE: "${userMessage}"

RECENT CHAT HISTORY:
${historyText}

DETECTED INTENTS:
${intentsText}

HANDLER RESPONSES TO MERGE:
${handlerResponses}

${resolvedContext?.bookingConflict ? `
⚠️ BOOKING CONFLICT:
Customer has existing booking: ${JSON.stringify(resolvedContext.bookingConflict.existingBookingData)}
New booking intent detected - need to ask about modifying existing booking.
` : ''}

Generate a single, natural response that:
1. Addresses the highest priority intent first (booking > FAQ > chitchat)
2. Smoothly incorporates responses from all handlers
3. Maintains conversational flow
4. Resolves any booking conflicts appropriately
5. Sounds human and professional

Merge these responses into ONE unified, natural message.`;
  }
  
  /**
   * Enhances single response with context awareness
   */
  private static enhanceSingleResponse(
    result: TaskHandlerResult,
    resolvedContext: DialogueState | null
  ): string {
    
    // Handle booking conflicts for single responses
    if (resolvedContext?.bookingConflict?.hasExistingBooking) {
      const existing = resolvedContext.bookingConflict.existingBookingData;
      return `I see you have an existing booking for ${existing?.service} on ${existing?.date} at ${existing?.time}. ${result.response} Would you like to modify your existing booking instead?`;
    }
    
    return result.response;
  }
  
  /**
   * Fallback method to merge responses without LLM
   */
  private static mergePrioritizedResponses(
    prioritizedResults: TaskHandlerResult[],
    resolvedContext: DialogueState | null
  ): string {
    
    if (prioritizedResults.length === 0) {
      return "I'm here to help! How can I assist you with your beauty service needs?";
    }
    
    // Simple concatenation with priority
    const primary = prioritizedResults[0].response;
    
    // Handle booking conflicts
    if (resolvedContext?.bookingConflict?.hasExistingBooking) {
      const existing = resolvedContext.bookingConflict.existingBookingData;
      return `I see you have an existing booking for ${existing?.service} on ${existing?.date} at ${existing?.time}. ${primary} Would you like to modify your existing booking?`;
    }
    
    if (prioritizedResults.length === 1) {
      return primary;
    }
    
    // Merge top 2 responses naturally
    const secondary = prioritizedResults[1].response;
    return `${primary} ${secondary}`;
  }
  
  /**
   * Prioritizes and merges buttons from multiple handlers
   */
  private static prioritizeButtons(
    prioritizedResults: TaskHandlerResult[],
    resolvedContext: DialogueState | null
  ): ButtonConfig[] {
    
    const allButtons: ButtonConfig[] = [];
    
    // Collect buttons in priority order
    for (const result of prioritizedResults) {
      if (result.buttons && result.buttons.length > 0) {
        allButtons.push(...result.buttons);
      }
    }
    
    // Handle booking conflict buttons
    if (resolvedContext?.bookingConflict?.hasExistingBooking) {
      return [
        { buttonText: '✏️ Modify existing booking', buttonValue: 'modify_existing_booking' },
        { buttonText: '🗓️ New booking instead', buttonValue: 'create_new_booking' },
        { buttonText: '📅 Check availability', buttonValue: 'check_availability' }
      ];
    }
    
    // Remove duplicates and prioritize booking buttons
    const uniqueButtons = this.removeDuplicateButtons(allButtons);
    const bookingButtons = uniqueButtons.filter(btn => 
      btn.buttonValue.includes('book') || 
      btn.buttonValue.includes('availability') ||
      btn.buttonValue.includes('continue')
    );
    const otherButtons = uniqueButtons.filter(btn => 
      !btn.buttonValue.includes('book') && 
      !btn.buttonValue.includes('availability') &&
      !btn.buttonValue.includes('continue')
    );
    
    // Combine with booking priority, max 3 for WhatsApp
    const finalButtons = [...bookingButtons, ...otherButtons].slice(0, 3);
    
    return finalButtons;
  }
  
  /**
   * Removes duplicate buttons based on buttonValue
   */
  private static removeDuplicateButtons(buttons: ButtonConfig[]): ButtonConfig[] {
    const seen = new Set<string>();
    return buttons.filter(button => {
      if (seen.has(button.buttonValue)) {
        return false;
      }
      seen.add(button.buttonValue);
      return true;
    });
  }
  
  /**
   * Merges context updates from all sources
   */
  private static mergeContextUpdates(
    prioritizedResults: TaskHandlerResult[],
    classificationResult: MultiIntentResult,
    resolvedContext: DialogueState | null
  ): Partial<DialogueState> {
    
    let finalUpdates: Partial<DialogueState> = {
      lastActivityAt: new Date().toISOString()
    };
    
    // Merge context updates from classification result
    if (classificationResult.contextUpdates) {
      finalUpdates = { ...finalUpdates, ...classificationResult.contextUpdates };
    }
    
    // Merge context updates from handlers (booking gets priority)
    for (const result of prioritizedResults) {
      if (result.shouldUpdateContext && result.contextUpdates) {
        finalUpdates = { ...finalUpdates, ...result.contextUpdates };
      }
    }
    
    // Add booking conflict resolution context
    if (resolvedContext?.bookingConflict) {
      finalUpdates.bookingConflict = resolvedContext.bookingConflict;
    }
    
    return finalUpdates;
  }
  
  /**
   * Gets handler name from result (helper method)
   */
  private static getHandlerName(result: TaskHandlerResult): string {
    // This would need to be determined based on result characteristics
    // For now, return unknown - this might need adjustment based on actual usage
    return 'Unknown';
  }
  
  /**
   * Creates fallback response when everything fails
   */
  private static createFallbackResponse(): {
    response: string;
    buttons: ButtonConfig[];
    contextUpdates: Partial<DialogueState>;
  } {
    return {
      response: "I'm here to help! How can I assist you with your beauty service needs? 😊",
      buttons: [
        { buttonText: '📅 Book a service', buttonValue: 'start_booking' },
        { buttonText: '🛍️ View services', buttonValue: 'show_services' },
        { buttonText: '❓ Ask a question', buttonValue: 'ask_question' }
      ],
      contextUpdates: {
        lastActivityAt: new Date().toISOString()
      }
    };
  }
} 