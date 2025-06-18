import { DetectedIntent, ChitchatIntent, DialogueState, TaskHandlerResult, ButtonConfig } from '../nlu/types';
import { UserContext } from '@/lib/database/models/user-context';
import { executeChatCompletion, OpenAIChatMessage } from '../../llm-actions/chat-interactions/openai-config/openai-core';

/**
 * ChitchatHandler - LLM-powered conversational responses for V2 system
 * 
 * Handles chitchat intents with natural language generation:
 * - Context-aware responses based on active bookings
 * - Business-focused suggested actions
 * - Natural conversation flow without rigid templates
 * - Graceful fallback for LLM failures
 */
export class ChitchatHandler {
  
  /**
   * Main entry point for processing chitchat intents
   */
  static async processIntent(
    intent: DetectedIntent,
    currentContext: DialogueState | null,
    userContext: UserContext,
    userMessage: string
  ): Promise<TaskHandlerResult> {
    
    const chitchatData = intent.data as ChitchatIntent;
    
    try {
      // Use LLM to generate natural chitchat response
      const llmResponse = await this.generateChitchatResponse(
        userMessage,
        chitchatData,
        currentContext,
        userContext
      );
      
      return {
        response: llmResponse.response,
        shouldUpdateContext: false, // Chitchat typically doesn't update context
        buttons: llmResponse.buttons
      };
      
    } catch (error) {
      console.error('[ChitchatHandler] Error generating LLM response:', error);
      return this.createFallbackResponse(chitchatData);
    }
  }
  
  /**
   * Generates natural chitchat response using LLM
   */
  private static async generateChitchatResponse(
    userMessage: string,
    chitchatData: ChitchatIntent,
    currentContext: DialogueState | null,
    userContext: UserContext
  ): Promise<{ response: string; buttons: ButtonConfig[] }> {
    
    const systemPrompt = this.buildSystemPrompt(currentContext);
    const userPrompt = this.buildUserPrompt(userMessage, chitchatData, currentContext);
    
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
    
    const completion = await executeChatCompletion(messages, 'gpt-4o', 0.7, 300);
    const responseContent = completion.choices[0]?.message?.content?.trim();
    
    if (!responseContent) {
      throw new Error('Empty response from LLM');
    }
    
    try {
      const parsedResponse = JSON.parse(responseContent);
      
      // Convert suggested actions to ButtonConfig format
      const buttons: ButtonConfig[] = (parsedResponse.suggestedActions || []).map((action: any) => ({
        buttonText: action.text,
        buttonValue: action.action
      }));
      
      return {
        response: parsedResponse.response,
        buttons: buttons
      };
      
    } catch (parseError) {
      console.error('[ChitchatHandler] Failed to parse LLM JSON response:', parseError);
      // Return raw response without buttons if JSON parsing fails
      return {
        response: responseContent,
        buttons: this.getDefaultButtons(currentContext)
      };
    }
  }
  
  /**
   * Builds the system prompt for the LLM
   */
  private static buildSystemPrompt(currentContext: DialogueState | null): string {
    return `You are a friendly, professional beauty service assistant chatbot. Your personality is warm, helpful, and subtly business-focused.

CORE PERSONALITY:
- Always be genuinely friendly and conversational
- Show interest in the customer's wellbeing
- Naturally guide conversations toward beauty/wellness services when appropriate
- Use emojis sparingly but effectively (1-2 per response max)
- Keep responses concise (under 200 characters typically)

BUSINESS CONTEXT:
- You work for a beauty service business offering manicures, facials, treatments, etc.
- Your goal is to provide excellent customer service and encourage bookings
- Always be helpful and never pushy

${currentContext?.activeBooking ? `
ACTIVE BOOKING CONTEXT:
- Customer has an active booking in progress
- Service: ${currentContext.activeBooking.serviceName || 'Not specified'}
- Date: ${currentContext.activeBooking.date || 'Not selected'}
- Time: ${currentContext.activeBooking.time || 'Not selected'}
- Status: ${currentContext.activeBooking.status}
- Use this context to personalize your responses
` : ''}

RESPONSE FORMAT:
You must respond with valid JSON in this exact format:
{
  "response": "Your natural, conversational response here",
  "suggestedActions": [
    {"text": "Button text", "action": "button_value"},
    {"text": "Button text", "action": "button_value"}
  ]
}

BUTTON GUIDELINES:
- Include 2-3 relevant action buttons maximum
- Always include business-relevant actions when appropriate
- Common actions: "Check Availability", "View Services", "Book a Service", "Ask a Question"
- Make button text natural and helpful
- Button values should be snake_case action identifiers`;
  }
  
  /**
   * Builds the user prompt for the LLM
   */
  private static buildUserPrompt(
    userMessage: string,
    chitchatData: ChitchatIntent,
    currentContext: DialogueState | null
  ): string {
    
    const intentType = this.detectChitchatType(chitchatData);
    
    return `USER MESSAGE: "${userMessage}"

DETECTED INTENT TYPE: ${intentType}

CONTEXT AWARENESS:
${currentContext?.activeBooking ? 
  `- Customer has active ${currentContext.activeBooking.serviceName || 'service'} booking in progress` :
  '- New conversation, no active booking'
}

Generate a natural, conversational response that:
1. Responds appropriately to the ${intentType}
2. Maintains a warm, professional tone
3. ${currentContext?.activeBooking ? 
    'References their booking context naturally if relevant' : 
    'Subtly encourages engagement with your services'}
4. Includes helpful action buttons

Respond with the JSON format specified in the system prompt.`;
  }
  
  /**
   * Detects the specific type of chitchat
   */
  private static detectChitchatType(chitchatData: ChitchatIntent): string {
    if (chitchatData.greeting) return 'greeting';
    if (chitchatData.thanks) return 'thanks/gratitude';
    if (chitchatData.farewell) return 'farewell';
    if (chitchatData.pleasantries) return 'pleasantries/small talk';
    return 'general chitchat';
  }
  
  /**
   * Creates fallback response when LLM fails
   */
  private static createFallbackResponse(chitchatData: ChitchatIntent): TaskHandlerResult {
    let response = '';
    let buttons: ButtonConfig[] = [];
    
    if (chitchatData.greeting) {
      response = 'Hi there! How can I help you today? 😊';
      buttons = [
        { buttonText: 'Check Availability', buttonValue: 'check_availability' },
        { buttonText: 'View Services', buttonValue: 'view_services' },
        { buttonText: 'Ask a Question', buttonValue: 'ask_question' }
      ];
    } else if (chitchatData.thanks) {
      response = 'You\'re very welcome! Is there anything else I can help you with?';
      buttons = [
        { buttonText: 'Book a Service', buttonValue: 'start_booking' },
        { buttonText: 'Ask a Question', buttonValue: 'ask_question' }
      ];
    } else if (chitchatData.farewell) {
      response = 'Take care! Feel free to reach out anytime you need our services. 😊';
      buttons = [
        { buttonText: 'Check Availability', buttonValue: 'check_availability' },
        { buttonText: 'View Services', buttonValue: 'view_services' }
      ];
    } else {
      response = 'Thanks for chatting! How can I assist you with your beauty needs?';
      buttons = [
        { buttonText: 'Check Availability', buttonValue: 'check_availability' },
        { buttonText: 'View Services', buttonValue: 'view_services' },
        { buttonText: 'Start Booking', buttonValue: 'start_booking' }
      ];
    }
    
    return {
      response,
      shouldUpdateContext: false,
      buttons
    };
  }
  
  /**
   * Gets default buttons when LLM response parsing fails
   */
  private static getDefaultButtons(currentContext: DialogueState | null): ButtonConfig[] {
    if (currentContext?.activeBooking) {
      return [
        { buttonText: 'Continue Booking', buttonValue: 'continue_booking' },
        { buttonText: 'Check Availability', buttonValue: 'check_availability' },
        { buttonText: 'Ask a Question', buttonValue: 'ask_question' }
      ];
    }
    
    return [
      { buttonText: 'Check Availability', buttonValue: 'check_availability' },
      { buttonText: 'View Services', buttonValue: 'view_services' },
      { buttonText: 'Start Booking', buttonValue: 'start_booking' }
    ];
  }
} 