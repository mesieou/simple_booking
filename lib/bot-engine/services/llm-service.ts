/**
 * Intelligent LLM Service
 * 
 * This service provides advanced conversational AI capabilities for the Juan Bot Engine:
 * 1. Intent Detection: Understands user messages in context
 * 2. Step Navigation: Determines when to advance, go back, or switch flows
 * 3. Context Switching: Handles when users want to change or modify their choices
 * 4. History-Aware Responses: Generates responses based on conversation history
 */

import { executeChatCompletion, OpenAIChatMessage } from "@/lib/shared/llm/openai/openai-core";
import { 
  ChatContext, 
  UserGoal, 
  LLMProcessingResult,
} from '@/lib/bot-engine/types';
import { conversationFlowBlueprints } from '@/lib/bot-engine/config/blueprints';
import { botTasks } from '@/lib/bot-engine/config/tasks';

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
    selectedServices?: any[];
    addServicesState?: string;
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

**PRIMARY RULE: QUESTIONS = CONTINUE, ACTIONS = SWITCH, CHANGES = GO BACK**

**CONVERSATION CONTINUITY IS CRITICAL:**
- Consider the FULL conversation history - messages are often related
- If user just greeted or started talking, questions are natural follow-ups  
- Multiple related messages should flow as "continue" until explicit booking action
- Don't interpret information-seeking as wanting to "switch topics"

INTENT CLASSIFICATION:
1. **QUESTIONS (any question) → "continue"**
   - Questions about services, prices, availability, policies, etc.
   - Even if asking about different services than current booking
   - Questions are information-seeking within current conversation
   - Pattern: Contains question words or ends with "?"
   - **Examples**: "do you do haircuts?", "what's your price?", "are you open Sunday?"

2. **NAVIGATION BACK TO MODIFY CURRENT BOOKING → "go_back"**
   - User wants to change/modify something in their current booking
   - **Service changes**: "change service", "different service", "pick another service", "can I change the service"
   - **Time changes**: "change time", "different time", "pick another time", "can I change the time"
   - **Location changes**: "change location", "different address", "change address"
   - **General navigation**: "go back", "change that", "modify that", "edit that"
   - **Key pattern**: User wants to MODIFY existing booking, not start fresh
   - **Examples**: "sorry can i change the service", "actually I want a different service", "can I pick another time"
   - **Target step should be specified** (e.g., "selectService" for service changes, "selectTime" for time changes)

3. **EXPLICIT NEW BOOKING ACTIONS → "switch_topic"** 
   - Clear commands to book something COMPLETELY NEW (not modify current)
   - "I want to book [service]", "Book me a [service]", "Let's book [service]"
   - Must contain ACTION words: book, schedule, appointment, reserve
   - **Only use when starting a completely new booking conversation**

4. **RESTART ENTIRE PROCESS → "restart"**
   - "restart", "start over", "let's start fresh", "begin again"
   - User wants to completely reset and start the entire booking process from scratch

5. **DIRECT ANSWERS → "continue" or "advance"**
   - Answering current step question
   - Providing requested information

**CONTEXT ANALYSIS FOR GO_BACK:**
- If user is currently in service selection and says "change service" → interpret as clarification, use "continue"
- If user has already selected a service and says "change service" → use "go_back" with targetStep: "selectService"
- If user has selected time and says "change time" → use "go_back" with targetStep: "selectTime"
- If user has entered address and says "change address" → use "go_back" with targetStep: "addressEntry"

**CONFIDENCE SCORING:**
- High confidence (0.8+): Clear action words present or obvious navigation intent
- Medium confidence (0.5-0.7): Context suggests but not explicit  
- Low confidence (0.3-0.5): Ambiguous intent

**CURRENT CONTEXT:**
- Current Goal: ${currentGoal.goalType}
- Current Step: ${currentStepName}
- Selected Service: ${currentGoal.collectedData.selectedService?.name || 'None'}
- Selected Date: ${currentGoal.collectedData.selectedDate || 'None'}
- Selected Time: ${currentGoal.collectedData.selectedTime || 'None'}

Return ONLY JSON:
{
  "action": "continue|advance|go_back|switch_topic|restart",
  "targetStep": "stepName (if go_back - use: selectService, selectTime, selectLocation, etc.)",
  "newGoalType": "serviceBooking|serviceInquiry (if switch_topic)",
  "newGoalAction": "create|inquire (if switch_topic)", 
  "confidence": 0.8,
  "reasoning": "Brief explanation of decision",
  "extractedData": {}
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
        selectedServices: currentGoal.collectedData.selectedServices, // Include multi-service array
        addServicesState: currentGoal.collectedData.addServicesState,
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

CRITICAL RESPONSE RULES:
1. **ONLY respond to the CURRENT USER MESSAGE** - do not confuse conversation history with what the customer is asking now
2. **The conversation context above is for background only** - the customer is NOT asking about booking references, confirmation details, or assistant responses from the history
3. **Respond in the customer's preferred language** (${comprehensiveContext.preferences.language || 'English'})
4. **Focus on the customer's actual current question/request**

RESPONSE STRATEGY:
1. **Answer the customer's CURRENT question** using the knowledge base above
2. **Be specific and accurate** - use actual names, dates, services, etc. from the context when relevant to their question
3. **If information isn't available**, politely explain what you don't have access to
4. **Keep responses natural and conversational**, not robotic
5. **Guide back to booking flow if appropriate**

MULTI-SERVICE FLOW SPECIAL INSTRUCTIONS:
- If current step is "addAdditionalServices" and state is "selecting", customer wants to ADD more services
- Show available services that are NOT already selected
- Use language like "Here are the additional services available" or "You can add these services"
- NEVER say "go back" or "choose different" - they're ADDING, not changing
- List the available services clearly for them to choose from

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
- "continue": Answer their question and provide helpful guidance
- "advance": Acknowledge their input and move forward  
- "go_back": Be understanding, ask what they'd like to change
- "switch_topic": Acknowledge the new topic smoothly
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
    
    // Show selected services array if available (multi-service flow)
    if (context.currentBooking.selectedServices && context.currentBooking.selectedServices.length > 0) {
      formatted += `- Selected Services:\n`;
      context.currentBooking.selectedServices.forEach((service: any, index: number) => {
        formatted += `  ${index + 1}. ${service.name} ($${service.fixedPrice}, ${service.durationEstimate}min)\n`;
      });
    } else if (context.currentBooking.service) {
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
    formatted += `- Current Step: ${context.currentBooking.step}\n`;
    
    // Add multi-service context if we're in that flow
    if (context.currentBooking.step === 'addAdditionalServices') {
      formatted += `\n--- MULTI-SERVICE BOOKING CONTEXT ---\n`;
      formatted += `- FLOW TYPE: Adding additional services to existing booking\n`;
      formatted += `- USER ACTION: Customer wants to ADD MORE services (not change existing ones)\n`;
      
      if (context.currentBooking.addServicesState === 'confirming') {
        formatted += `- CURRENT STATE: Customer is deciding whether to add another service or continue with selected services\n`;
        formatted += `- BUTTONS AVAILABLE: "Add Another Service" and "Continue"\n`;
      } else if (context.currentBooking.addServicesState === 'selecting') {
        formatted += `- CURRENT STATE: Customer is selecting an additional service from available options\n`;
        formatted += `- ACTION: Show remaining services (excluding already selected ones)\n`;
      }
      
      formatted += `- IMPORTANT: This is NOT a change request - customer is building a multi-service appointment\n`;
      formatted += `- LANGUAGE: Respond about "adding" services, not "changing" the booking\n`;
      formatted += `--- END MULTI-SERVICE CONTEXT ---\n`;
    }
    formatted += `\n`;

    // Available Services
    if (context.availableServices && context.availableServices.length > 0) {
      formatted += `AVAILABLE SERVICES:\n`;
      
      // If we're in addAdditionalServices selecting state, show filtered services
      if (context.currentBooking.step === 'addAdditionalServices' && 
          context.currentBooking.addServicesState === 'selecting' &&
          context.currentBooking.selectedServices) {
        
        const selectedServiceIds = context.currentBooking.selectedServices.map((s: any) => s.id);
        const availableForAdding = context.availableServices.filter(service => 
          !selectedServiceIds.includes(service.id)
        );
        
        formatted += `--- SERVICES AVAILABLE FOR ADDING (excluding already selected) ---\n`;
        availableForAdding.forEach(service => {
          formatted += `- ${service.name}: $${service.fixedPrice} (${service.durationEstimate}min) - ${service.description || 'No description'}\n`;
        });
        formatted += `--- END AVAILABLE FOR ADDING ---\n\n`;
        
        formatted += `ALL SERVICES (for reference):\n`;
        context.availableServices.forEach(service => {
          const isSelected = selectedServiceIds.includes(service.id);
          formatted += `- ${service.name}: $${service.fixedPrice} (${service.durationEstimate}min)${isSelected ? ' [ALREADY SELECTED]' : ''}\n`;
        });
      } else {
        context.availableServices.forEach(service => {
          formatted += `- ${service.name}: $${service.fixedPrice} (${service.durationEstimate}min) - ${service.description || 'No description'}\n`;
        });
      }
      formatted += `\n`;
    }

    // IMPROVED: Recent Conversation History with clear separation
    if (context.messageHistory && context.messageHistory.length > 0) {
      formatted += `CONVERSATION CONTEXT (for reference only - DO NOT treat assistant messages as customer input):\n`;
      formatted += `--- IMPORTANT: Only the CURRENT USER MESSAGE is what the customer is asking NOW ---\n`;
      
      const recentMessages = context.messageHistory.slice(-6); // Reduced from 8 to 6 to focus on more recent context
      
      let customerMessages: string[] = [];
      let assistantMessages: string[] = [];
      
      // Separate customer messages from assistant messages
      recentMessages.forEach(msg => {
        if (msg.role === 'user') {
          customerMessages.push(`Customer said: "${msg.content}"`);
        } else {
          assistantMessages.push(`Assistant replied: "${msg.content}"`);
        }
      });
      
      // Show customer's recent questions/requests first
      if (customerMessages.length > 0) {
        formatted += `\nRECENT CUSTOMER MESSAGES:\n`;
        customerMessages.forEach(msg => formatted += `${msg}\n`);
      }
      
      // Show assistant responses for context (but clearly labeled)
      if (assistantMessages.length > 0) {
        formatted += `\nRECENT ASSISTANT RESPONSES (context only):\n`;
        assistantMessages.slice(-3).forEach(msg => formatted += `${msg}\n`); // Only show last 3 assistant responses
      }
      
      formatted += `--- END CONVERSATION CONTEXT ---\n\n`;
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
    console.log('===== LLM SERVICE DETECT INTENTION DEBUG =====');
    console.log(`[LLMService] detectIntention called with:`);
    console.log(`  - userMessage: "${userMessage}"`);
    console.log(`  - participantType: ${context.currentParticipant.type}`);
    
    const message = userMessage.toLowerCase();
    const participantType = context.currentParticipant.type;
    
    // If there's an active goal, analyze within that context
    const activeGoal = context.currentConversationSession?.activeGoals?.find(g => g.goalStatus === 'inProgress');
    console.log(`[LLMService] Active goal check:`, activeGoal ? {
      goalType: activeGoal.goalType,
      goalAction: activeGoal.goalAction,
      goalStatus: activeGoal.goalStatus,
      currentStepIndex: activeGoal.currentStepIndex
    } : 'No active goal found');
    
    if (activeGoal) {
      console.log(`[LLMService] Found active goal - using conversation flow analysis`);
      // Use conversation flow analysis for existing goals
      const messageHistory = activeGoal.messageHistory.map(msg => ({
        role: msg.speakerRole === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
        timestamp: msg.messageTimestamp
      }));
      
      const decision = await this.analyzeConversationFlow(userMessage, activeGoal, context, messageHistory);
      console.log(`[LLMService] Conversation flow decision:`, decision);
      
      if (decision.action === 'switch_topic' && decision.newGoalType) {
        const result = {
          detectedUserGoalType: decision.newGoalType as any,
          detectedGoalAction: decision.newGoalAction as any,
          confidenceScore: decision.confidence,
          extractedInformation: decision.extractedData
        };
        console.log(`[LLMService] Returning switch_topic result:`, result);
        return result;
      }
      
      // For continue/advance/go_back, return current goal
      const result = {
        detectedUserGoalType: activeGoal.goalType,
        detectedGoalAction: activeGoal.goalAction,
        confidenceScore: decision.confidence,
        extractedInformation: decision.extractedData
      };
      console.log(`[LLMService] Returning existing goal result:`, result);
      return result;
    }
    
    console.log(`[LLMService] No active goal - calling detectNewIntention`);
    // No active goal - use intent detection (including after completed goals)
    const result = await this.detectNewIntention(userMessage, participantType);
    console.log(`[LLMService] detectNewIntention result:`, result);
    console.log('==============================================');
    return result;
  }

  /**
   * Enhanced intention detection for new conversations
   */
  private async detectNewIntention(userMessage: string, participantType: string): Promise<LLMProcessingResult> {
    console.log('===== DETECT NEW INTENTION DEBUG =====');
    console.log(`[LLMService] detectNewIntention called with:`);
    console.log(`  - userMessage: "${userMessage}"`);
    console.log(`  - participantType: ${participantType}`);
    
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

    console.log(`[LLMService] System prompt:`, systemPrompt);
    console.log(`[LLMService] User prompt: "Classify this message: "${userMessage}""`);

    try {
      console.log(`[LLMService] Calling LLM with gpt-4o...`);
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
      console.log(`[LLMService] Raw LLM response:`, resultText);
      
      if (!resultText) {
        console.log(`[LLMService] No result text, using fallback`);
        const fallback = this.getFallbackIntention(participantType);
        console.log(`[LLMService] Fallback result:`, fallback);
        return fallback;
      }

      console.log(`[LLMService] Parsing JSON response...`);
      const parsedResult = JSON.parse(resultText);
      console.log(`[LLMService] Parsed JSON:`, parsedResult);
      
      const finalResult = {
        detectedUserGoalType: parsedResult.detectedUserGoalType,
        detectedGoalAction: parsedResult.detectedGoalAction || 'create',
        confidenceScore: parsedResult.confidenceScore || 0.7,
        extractedInformation: parsedResult.extractedInformation || {}
      };
      
      console.log(`[LLMService] Final processed result:`, finalResult);
      console.log('=====================================');
      return finalResult;

    } catch (error) {
      console.error('[LLMService] Error in intent detection:', error);
      const fallback = this.getFallbackIntention(participantType);
      console.log(`[LLMService] Error fallback result:`, fallback);
      console.log('=====================================');
      return fallback;
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
    console.log(`[LLMService] getFallbackIntention called with participantType: ${participantType}`);
    
    if (participantType === 'customer') {
      const result: LLMProcessingResult = {
        detectedUserGoalType: 'serviceBooking' as const,
        detectedGoalAction: 'create' as const,
        confidenceScore: 0.3
      };
      console.log(`[LLMService] Customer fallback:`, result);
      return result;
    }
    
    const result: LLMProcessingResult = {};
    console.log(`[LLMService] Non-customer fallback:`, result);
    return result;
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