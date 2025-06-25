/**
 * Intelligent LLM Service
 * 
 * This service provides advanced conversational AI capabilities for the Juan Bot Engine:
 * 1. Intent Detection: Understands user messages in context
 * 2. Step Navigation: Determines when to advance, go back, or switch flows
 * 3. Context Switching: Handles when users want to change or modify their choices
 * 4. History-Aware Responses: Generates responses based on conversation history
 */

import { executeChatCompletion, OpenAIChatMessage } from "@/lib/conversation-engine/llm-actions/chat-interactions/openai-config/openai-core";
import { 
  ChatContext, 
  UserGoal, 
  LLMProcessingResult,
  conversationFlowBlueprints,
  botTasks
} from "../bot-manager";

export interface ConversationDecision {
  action: 'continue' | 'advance' | 'go_back' | 'switch_topic' | 'restart';
  targetStep?: string;
  newGoalType?: string;
  newGoalAction?: string;
  confidence: number;
  reasoning: string;
  extractedData?: Record<string, any>;
  customButtons?: Array<{buttonText: string, buttonValue: string, buttonDescription?: string}>;
}

export interface EscalationAnalysis {
  escalate: boolean;
  reason: 'human_request' | 'aggression' | 'none';
  summary_for_agent: string;
}

export interface ContextualResponse {
  text: string;
  shouldShowButtons: boolean;
  customButtons?: Array<{buttonText: string, buttonValue: string, buttonDescription?: string}>;
}

export interface ComprehensiveContext {
  customer: {
    name?: string;
    phoneNumber?: string;
    id?: string;
  };
  business: {
    name?: string;
    whatsappNumber?: string;
    id?: string;
  };
  currentBooking: {
    step?: string;
    service?: any;
    date?: string;
    time?: string;
    location?: any;
    address?: string;
    price?: number;
    summary?: any;
  };
  availableServices: any[];
  messageHistory: Array<{role: 'user' | 'assistant', content: string, timestamp: Date}>;
  previousGoals: any[];
  preferences: any;
}

export class IntelligentLLMService {
  
  /**
   * Analyzes user message and determines conversation flow decision
   */
  async analyzeConversationFlow(
    userMessage: string,
    currentGoal: UserGoal,
    chatContext: ChatContext,
    messageHistory: Array<{role: 'user' | 'assistant', content: string, timestamp: Date}>
  ): Promise<ConversationDecision> {
    
    const currentFlow = conversationFlowBlueprints[currentGoal.flowKey];
    const currentStepName = currentFlow[currentGoal.currentStepIndex];
    const currentStepHandler = botTasks[currentStepName];
    
    const systemPrompt = `You are an expert conversation flow analyst for a booking system. Your task is to analyze a user's message and determine the best conversation flow action.

CURRENT CONTEXT:
- User Goal: ${currentGoal.goalType} (${currentGoal.goalAction})
- Current Step: ${currentStepName} (${currentGoal.currentStepIndex + 1}/${currentFlow.length})
- Flow: ${currentGoal.flowKey}
- Data Collected: ${JSON.stringify(currentGoal.collectedData)}

AVAILABLE FLOW ACTIONS:
1. "continue" - User is providing expected input for current step
2. "advance" - User provided valid input, ready to move to next step  
3. "go_back" - User wants to change/modify previous choices
4. "switch_topic" - User wants to start a completely different conversation or booking
5. "restart" - User wants to restart the current booking process

ANALYSIS RULES:
- If user provides direct answer to current step question → "continue" or "advance"
- If user says "change", "go back", "modify", "different" about previous choices → "go_back"
- If user says "start over", "restart", "begin again" → "restart"
- **FAQ QUESTIONS should be "continue"**: Questions like "what services?", "what are your prices?", "what hours?", "how much does it cost?" are informational questions WITHIN the current booking flow, not topic switches
- **ONLY use "switch_topic" for actual new bookings**: "I want to book something else", "let's make another appointment", "different booking entirely"
- Consider conversation context and what was previously discussed

Return ONLY a JSON object with this structure:
{
  "action": "continue|advance|go_back|switch_topic|restart",
  "targetStep": "optional_step_name_if_going_back",
  "newGoalType": "optional_if_switching_topic",
  "newGoalAction": "optional_if_switching_topic", 
  "confidence": 0.8,
  "reasoning": "brief explanation of decision",
  "extractedData": {"key": "value"}
}`;

    const historyText = messageHistory
      .slice(-6) // Last 6 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `CONVERSATION HISTORY:
${historyText}

CURRENT USER MESSAGE: "${userMessage}"

Analyze this message and determine the appropriate conversation flow action.`;

    try {
      const response = await executeChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        "gpt-4o",
        0.3,
        300
      );

      const resultText = response.choices[0]?.message?.content?.trim();
      if (!resultText) {
        return this.getFallbackDecision('continue');
      }

      // Parse JSON response
      let jsonText = resultText;
      if (resultText.includes('```')) {
        const jsonStart = resultText.indexOf('{');
        const jsonEnd = resultText.lastIndexOf('}') + 1;
        jsonText = resultText.substring(jsonStart, jsonEnd);
      }

      const parsedResult = JSON.parse(jsonText) as ConversationDecision;
      
      // Validate and sanitize
      const validActions = ['continue', 'advance', 'go_back', 'switch_topic', 'restart'];
      if (!validActions.includes(parsedResult.action)) {
        return this.getFallbackDecision('continue');
      }

      return {
        action: parsedResult.action,
        targetStep: parsedResult.targetStep,
        newGoalType: parsedResult.newGoalType,
        newGoalAction: parsedResult.newGoalAction,
        confidence: Math.max(0, Math.min(1, parsedResult.confidence || 0.5)),
        reasoning: parsedResult.reasoning || 'Analysis completed',
        extractedData: parsedResult.extractedData || {}
      };

    } catch (error) {
      console.error('[IntelligentLLMService] Error in flow analysis:', error);
      return this.getFallbackDecision('continue');
    }
  }

  /**
   * Builds comprehensive context from all available information
   */
  private async buildComprehensiveContext(
    currentGoal: UserGoal,
    chatContext: ChatContext,
    messageHistory: Array<{role: 'user' | 'assistant', content: string, timestamp: Date}>,
    customerUser?: {firstName: string, lastName: string, id: string}
  ): Promise<ComprehensiveContext> {
    
    const context: ComprehensiveContext = {
      customer: {
        name: customerUser ? `${customerUser.firstName} ${customerUser.lastName}` : undefined,
        phoneNumber: chatContext.currentParticipant.customerWhatsappNumber,
        id: customerUser?.id
      },
      business: {
        name: undefined, // Will be filled below
        whatsappNumber: chatContext.currentParticipant.businessWhatsappNumber,
        id: chatContext.currentParticipant.associatedBusinessId
      },
      currentBooking: {
        step: this.getCurrentStepName(currentGoal),
        service: currentGoal.collectedData.selectedService,
        date: currentGoal.collectedData.selectedDate,
        time: currentGoal.collectedData.selectedTime,
        location: currentGoal.collectedData.serviceLocation,
        address: currentGoal.collectedData.finalServiceAddress || currentGoal.collectedData.customerAddress,
        price: currentGoal.collectedData.selectedService?.fixedPrice,
        summary: currentGoal.collectedData.bookingSummary
      },
      availableServices: currentGoal.collectedData.availableServices || [],
      messageHistory: messageHistory,
      previousGoals: chatContext.previousConversationSession?.activeGoals || [],
      preferences: chatContext.participantPreferences
    };

    // Fetch business name if available
    if (context.business.id) {
      try {
        const { Business } = await import('@/lib/database/models/business');
        const business = await Business.getById(context.business.id);
        if (business) {
          context.business.name = business.name;
        }
      } catch (error) {
        console.error('[IntelligentLLMService] Error fetching business name:', error);
      }
    }

    return context;
  }

  /**
   * Gets current step name from goal
   */
  private getCurrentStepName(currentGoal: UserGoal): string {
    try {
      const { conversationFlowBlueprints } = require('@/lib/conversation-engine/juan-bot-engine-v2/bot-manager');
      const currentSteps = conversationFlowBlueprints[currentGoal.flowKey];
      return currentSteps[currentGoal.currentStepIndex] || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Enhanced contextual response that can answer ANY question from available context
   */
  async generateContextualResponse(
    currentGoal: UserGoal,
    chatContext: ChatContext,
    lastUserMessage: string,
    conversationDecision: ConversationDecision,
    messageHistory: Array<{role: 'user' | 'assistant', content: string, timestamp: Date}>,
    customerUser?: {firstName: string, lastName: string, id: string}
  ): Promise<ContextualResponse> {
    
    // Build comprehensive context
    const comprehensiveContext = await this.buildComprehensiveContext(
      currentGoal, 
      chatContext, 
      messageHistory, 
      customerUser
    );

    const currentFlow = conversationFlowBlueprints[currentGoal.flowKey];
    const currentStepName = currentFlow[currentGoal.currentStepIndex];
    
    const systemPrompt = `You are a friendly, professional booking assistant with access to comprehensive conversation context. Your role is to answer ANY question the user asks using the available information, then smoothly guide them back to their booking.

COMPREHENSIVE KNOWLEDGE BASE:
${this.formatContextForLLM(comprehensiveContext)}

CURRENT BOOKING CONTEXT:
- Current Step: ${currentStepName}
- Flow Decision: ${conversationDecision.action}
- Decision Reasoning: ${conversationDecision.reasoning}

RESPONSE STRATEGY:
1. **Answer ANY question** using the knowledge base above
2. **Be specific and accurate** - use actual names, dates, services, etc. from the context
3. **If information isn't available**, politely explain what you don't have access to
4. **Always end with booking guidance** to return to the main flow
5. **Be natural and conversational**, not robotic

EXAMPLE RESPONSE PATTERNS:
- Name question: "Hi [CustomerName]! Your name is [ActualName] from our customer records. Now, let's..."
- Service question: "We offer [ListServices]. You've selected [CurrentService]. Would you like to..."
- Booking status: "Your current booking is for [Service] on [Date] at [Time]. Let's..."
- Business question: "We're [BusinessName] located at [Address]. For your appointment..."

CRITICAL RULES:
- Use ACTUAL information from the knowledge base, never make up details
- If specific info isn't available, say so honestly
- Always transition back to the booking flow
- Keep responses concise but complete
- Use the customer's actual name when available

FLOW DECISION HANDLING:
- "continue": Ask for clarification or provide helpful guidance
- "advance": Acknowledge their input and move forward  
- "go_back": Be understanding, ask what they'd like to change
- "switch_topic": Acknowledge the topic change smoothly
- "restart": Confirm they want to start over

Return ONLY a JSON object:
{
  "text": "Your natural response text here",
  "shouldShowButtons": true/false,
  "customButtons": [{"buttonText": "Option", "buttonValue": "value", "buttonDescription": "desc"}]
}`;

    const historyText = messageHistory
      .slice(-4)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `RECENT CONVERSATION:
${historyText}

USER'S QUESTION: "${lastUserMessage}"

Using the comprehensive knowledge base above, answer the user's question with specific, accurate information, then guide them back to their booking.`;

    try {
      const response = await executeChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        "gpt-4o",
        0.7, // Higher temperature for more natural responses
        800 // Increased token limit for comprehensive responses
      );

      const resultText = response.choices[0]?.message?.content?.trim();
      if (!resultText) {
        return this.getFallbackResponse(currentStepName, comprehensiveContext);
      }

      // Parse JSON response
      let jsonText = resultText;
      if (resultText.includes('```')) {
        const jsonStart = resultText.indexOf('{');
        const jsonEnd = resultText.lastIndexOf('}') + 1;
        jsonText = resultText.substring(jsonStart, jsonEnd);
      }

      const parsedResult = JSON.parse(jsonText) as ContextualResponse;
      
      return {
        text: parsedResult.text || 'How can I help you?',
        shouldShowButtons: parsedResult.shouldShowButtons !== false,
        customButtons: parsedResult.customButtons || []
      };

    } catch (error) {
      console.error('[IntelligentLLMService] Error generating response:', error);
      return this.getFallbackResponse(currentStepName, comprehensiveContext);
    }
  }

  /**
   * Formats comprehensive context for LLM consumption
   */
  private formatContextForLLM(context: ComprehensiveContext): string {
    let formatted = "";

    // Customer Information
    if (context.customer.name) {
      formatted += `CUSTOMER INFO:\n- Name: ${context.customer.name}\n- Phone: ${context.customer.phoneNumber || 'Unknown'}\n\n`;
    } else {
      formatted += `CUSTOMER INFO:\n- Name: Not available in our records\n- Phone: ${context.customer.phoneNumber || 'Unknown'}\n\n`;
    }

    // Business Information
    if (context.business.name) {
      formatted += `BUSINESS INFO:\n- Name: ${context.business.name}\n- WhatsApp: ${context.business.whatsappNumber || 'Unknown'}\n\n`;
    }

    // Current Booking Progress
    formatted += `CURRENT BOOKING PROGRESS:\n`;
    if (context.currentBooking.service) {
      formatted += `- Service: ${context.currentBooking.service.name} ($${context.currentBooking.service.fixedPrice}, ${context.currentBooking.service.durationEstimate}min)\n`;
    }
    if (context.currentBooking.date) {
      formatted += `- Date: ${context.currentBooking.date}\n`;
    }
    if (context.currentBooking.time) {
      formatted += `- Time: ${context.currentBooking.time}\n`;
    }
    if (context.currentBooking.address) {
      formatted += `- Location: ${context.currentBooking.address}\n`;
    }
    if (context.currentBooking.summary) {
      formatted += `- Booking Summary: ${JSON.stringify(context.currentBooking.summary)}\n`;
    }
    formatted += `- Current Step: ${context.currentBooking.step}\n\n`;

    // Available Services
    if (context.availableServices && context.availableServices.length > 0) {
      formatted += `AVAILABLE SERVICES:\n`;
      context.availableServices.forEach(service => {
        formatted += `- ${service.name}: $${service.fixedPrice} (${service.durationEstimate}min) - ${service.description || 'No description'}\n`;
      });
      formatted += `\n`;
    }

    // Recent Conversation History
    if (context.messageHistory && context.messageHistory.length > 0) {
      formatted += `RECENT CONVERSATION:\n`;
      context.messageHistory.slice(-8).forEach(msg => {
        formatted += `${msg.role}: ${msg.content}\n`;
      });
      formatted += `\n`;
    }

    // Previous Goals/Bookings
    if (context.previousGoals && context.previousGoals.length > 0) {
      formatted += `PREVIOUS BOOKINGS:\n`;
      context.previousGoals.forEach(goal => {
        if (goal.collectedData?.selectedService) {
          formatted += `- ${goal.collectedData.selectedService.name} on ${goal.collectedData.selectedDate || 'unknown date'}\n`;
        }
      });
      formatted += `\n`;
    }

    return formatted;
  }

  /**
   * Detects user intention from message content with context awareness
   */
  async detectIntention(userMessage: string, context: ChatContext): Promise<LLMProcessingResult> {
    const message = userMessage.toLowerCase();
    const participantType = context.currentParticipant.type;
    
    // If there's an active goal, analyze within that context
    const activeGoal = context.currentConversationSession?.activeGoals?.find(g => g.goalStatus === 'inProgress');
    
    if (activeGoal) {
      // Use conversation flow analysis for existing goals
      const messageHistory = activeGoal.messageHistory.map(msg => ({
        role: msg.speakerRole === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
        timestamp: msg.messageTimestamp
      }));
      
      const decision = await this.analyzeConversationFlow(userMessage, activeGoal, context, messageHistory);
      
      if (decision.action === 'switch_topic' && decision.newGoalType) {
        return {
          detectedUserGoalType: decision.newGoalType as any,
          detectedGoalAction: decision.newGoalAction as any,
          confidenceScore: decision.confidence,
          extractedInformation: decision.extractedData
        };
      }
      
      // For continue/advance/go_back, return current goal
      return {
        detectedUserGoalType: activeGoal.goalType,
        detectedGoalAction: activeGoal.goalAction,
        confidenceScore: decision.confidence,
        extractedInformation: decision.extractedData
      };
    }
    
    // No active goal - use enhanced intent detection
    return this.detectNewIntention(userMessage, participantType);
  }

  /**
   * Enhanced intention detection for new conversations
   */
  private async detectNewIntention(userMessage: string, participantType: string): Promise<LLMProcessingResult> {
    const systemPrompt = `You are an expert intent classifier for a booking system. Analyze the user's message and classify their intention.

PARTICIPANT TYPE: ${participantType}

AVAILABLE INTENTS:
- serviceBooking: User wants to book an appointment/service
- frequentlyAskedQuestion: User has questions about services, pricing, hours, etc.
- accountManagement: User wants to manage their account (business users only)
- generalGreeting: Simple greeting or chitchat

CLASSIFICATION RULES:
- Most messages from customers should default to "serviceBooking" unless clearly asking questions
- Greetings ("hi", "hello") from customers usually lead to booking
- Questions about "price", "cost", "hours", "services" are FAQ
- Account management only for business users

Return ONLY JSON:
{
  "detectedUserGoalType": "serviceBooking|frequentlyAskedQuestion|accountManagement",
  "detectedGoalAction": "create|update|delete|view|none",
  "confidenceScore": 0.8,
  "extractedInformation": {}
}`;

    try {
      const response = await executeChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Classify this message: "${userMessage}"` }
        ],
        "gpt-4o",
        0.3,
        200
      );

      const resultText = response.choices[0]?.message?.content?.trim();
      if (!resultText) {
        return this.getFallbackIntention(participantType);
      }

      const parsedResult = JSON.parse(resultText);
      return {
        detectedUserGoalType: parsedResult.detectedUserGoalType,
        detectedGoalAction: parsedResult.detectedGoalAction || 'create',
        confidenceScore: parsedResult.confidenceScore || 0.5,
        extractedInformation: parsedResult.extractedInformation || {}
      };

    } catch (error) {
      console.error('[IntelligentLLMService] Error in intent detection:', error);
      return this.getFallbackIntention(participantType);
    }
  }

  /**
   * Provides fallback decisions when LLM analysis fails
   */
  private getFallbackDecision(action: ConversationDecision['action']): ConversationDecision {
    return {
      action,
      confidence: 0.3,
      reasoning: 'Fallback decision due to analysis error'
    };
  }

  /**
   * Enhanced fallback response with context awareness
   */
  private getFallbackResponse(stepName: string, context?: ComprehensiveContext): ContextualResponse {
    let fallbackText = "I'm here to help you";
    
    if (context?.customer.name) {
      fallbackText = `I'm here to help you, ${context.customer.name.split(' ')[0]}`;
    }
    
    if (context?.currentBooking.service) {
      fallbackText += ` with your ${context.currentBooking.service.name} booking`;
    }
    
    fallbackText += ". What would you like to know?";
    
    return {
      text: fallbackText,
      shouldShowButtons: true
    };
  }

  /**
   * Provides fallback intention when detection fails
   */
  private getFallbackIntention(participantType: string): LLMProcessingResult {
    if (participantType === 'customer') {
      return {
        detectedUserGoalType: 'serviceBooking',
        detectedGoalAction: 'create',
        confidenceScore: 0.3
      };
    }
    return {};
  }

  /**
   * Analyzes a user message to check for escalation triggers like aggression or explicit requests for a human.
   */
  async analyzeForEscalation(
    userMessage: string,
    messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<EscalationAnalysis> {
    const systemPrompt = `You are an escalation detection agent for a customer service bot. Your task is to analyze the user's message and recent conversation history to determine if the conversation needs to be escalated to a human agent.

There are two reasons for escalation:
1.  **Human Request:** The user explicitly asks to speak to a human, person, agent, or staff member.
2.  **Aggression:** The user is showing significant aggression, using insults, threats, or is extremely angry.

Based on the user's message and history, you must return a JSON object with the following structure:
{
  "escalate": true | false,
  "reason": "human_request" | "aggression" | "none",
  "summary_for_agent": "A brief, one-sentence summary of the user's problem to give the human agent context. If the reason is aggression, describe the nature of the aggression. If the user states their problem, summarize it."
}

CRITICAL RULES:
- If the user says something like "can a person help me with my booking?", you MUST escalate.
- If the user uses swear words or is clearly insulting the bot or service, you MUST escalate.
- If no escalation is needed, set "escalate" to false, "reason" to "none", and the summary can be an empty string.
- Provide the summary even if the user is just being aggressive without stating a problem. In that case, summarize the situation (e.g., "The user is expressing frustration and using aggressive language.").
`;

    const historyText = messageHistory
      .slice(-6)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `CONVERSATION HISTORY:
${historyText}

CURRENT USER MESSAGE: "${userMessage}"

Analyze this message and determine if an escalation is required. Return ONLY the JSON object.`;

    try {
      const response = await executeChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        'gpt-4o',
        0.1,
        200
      );

      const resultText = response.choices[0]?.message?.content?.trim();
      if (!resultText) {
        return { escalate: false, reason: 'none', summary_for_agent: '' };
      }

      let jsonText = resultText;
      if (resultText.includes('```')) {
        const jsonStart = resultText.indexOf('{');
        const jsonEnd = resultText.lastIndexOf('}') + 1;
        jsonText = resultText.substring(jsonStart, jsonEnd);
      }

      return JSON.parse(jsonText) as EscalationAnalysis;

    } catch (error) {
      console.error('[IntelligentLLMService] Error in escalation analysis:', error);
      return { escalate: false, reason: 'none', summary_for_agent: '' };
    }
  }

  /**
   * Translates a single text or an array of texts to a target language.
   * @param texts The text or array of texts to translate.
   * @param targetLanguage The target language code (e.g., 'es' for Spanish).
   * @returns A promise that resolves to the translated text or array of texts.
   */
  async translate(
    texts: string | string[],
    targetLanguage: string
  ): Promise<string | string[]> {
    const isSingleString = typeof texts === 'string';
    const textsToTranslate = isSingleString ? [texts] : texts;

    if (!textsToTranslate || textsToTranslate.length === 0) {
      return texts;
    }

    const systemPrompt = `You are a professional translation assistant. Translate the given JSON array of strings into the specified target language.

RULES:
- Maintain the original meaning and tone.
- Do NOT change the order of the strings in the array.
- Return ONLY a valid JSON array of the translated strings. For example: ["Hola", "Adiós"]
- If a string contains a variable like '{{name}}' or an emoji, keep it in the translated string.
- The target language is: ${targetLanguage}`;

    const userPrompt = JSON.stringify(textsToTranslate);

    try {
      const response = await executeChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        'gpt-4o',
        0.1,
        500 
      );

      const resultText = response.choices[0]?.message?.content?.trim();
      if (!resultText) {
        console.error('[IntelligentLLMService] Translation failed: No response from LLM.');
        return texts; // Return original texts on failure
      }

      const translatedArray = JSON.parse(resultText) as string[];

      if (translatedArray.length !== textsToTranslate.length) {
        console.error('[IntelligentLLMService] Translation failed: Mismatch in array length.');
        return texts; // Return original texts on failure
      }

      return isSingleString ? translatedArray[0] : translatedArray;
    } catch (error) {
      console.error(`[IntelligentLLMService] Error during translation to ${targetLanguage}:`, error);
      return texts; // Return original texts on error
    }
  }
} 