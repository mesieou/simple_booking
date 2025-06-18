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
}

export interface ContextualResponse {
  text: string;
  shouldShowButtons: boolean;
  customButtons?: Array<{buttonText: string, buttonValue: string, buttonDescription?: string}>;
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
4. "switch_topic" - User wants to start a completely different conversation
5. "restart" - User wants to restart the current booking process

ANALYSIS RULES:
- If user provides direct answer to current step question → "continue" or "advance"
- If user says "change", "go back", "modify", "different" about previous choices → "go_back"
- If user mentions different service, completely new topic → "switch_topic"
- If user says "start over", "restart", "begin again" → "restart"
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
   * Generates contextual response based on conversation state and history
   */
  async generateContextualResponse(
    currentGoal: UserGoal,
    chatContext: ChatContext,
    lastUserMessage: string,
    conversationDecision: ConversationDecision,
    messageHistory: Array<{role: 'user' | 'assistant', content: string, timestamp: Date}>
  ): Promise<ContextualResponse> {
    
    const currentFlow = conversationFlowBlueprints[currentGoal.flowKey];
    const currentStepName = currentFlow[currentGoal.currentStepIndex];
    const currentStepHandler = botTasks[currentStepName];
    
    const systemPrompt = `You are a friendly, professional booking assistant. Generate a natural, helpful response based on the conversation context.

CURRENT CONTEXT:
- User Goal: ${currentGoal.goalType} 
- Current Step: ${currentStepName}
- Flow Decision: ${conversationDecision.action}
- Decision Reasoning: ${conversationDecision.reasoning}
- Data Collected: ${JSON.stringify(currentGoal.collectedData)}

RESPONSE GUIDELINES:
1. Be natural and conversational, not robotic
2. Acknowledge what the user said
3. Guide them appropriately based on the flow decision
4. If going back or switching, be understanding and helpful
5. Keep responses concise but friendly
6. Don't repeat information unnecessarily

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

USER'S LAST MESSAGE: "${lastUserMessage}"

Generate an appropriate response for this situation.`;

    try {
      const response = await executeChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        "gpt-4o",
        0.7, // Higher temperature for more natural responses
        500
      );

      const resultText = response.choices[0]?.message?.content?.trim();
      if (!resultText) {
        return this.getFallbackResponse(currentStepName);
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
      return this.getFallbackResponse(currentStepName);
    }
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
   * Provides fallback response when generation fails
   */
  private getFallbackResponse(stepName: string): ContextualResponse {
    return {
      text: "I'm here to help you. Could you please let me know what you'd like to do?",
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
} 