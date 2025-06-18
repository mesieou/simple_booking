import { DetectedIntent, FAQIntent, DialogueState, TaskHandlerResult, ButtonConfig } from '../nlu/types';
import { UserContext } from '../../../database/models/user-context';
import { getBestKnowledgeMatch, VectorSearchResult } from '../../llm-actions/chat-interactions/functions/vector-search';
import { executeChatCompletion } from '../../llm-actions/chat-interactions/openai-config/openai-core';
import { RAGfunction } from '../../llm-actions/chat-interactions/functions/embeddings';

/**
 * FAQHandler - Intelligent FAQ intent handler for V2 system
 * 
 * Handles FAQ intents using the existing RAG system:
 * - Semantic search across document embeddings
 * - Multi-answer LLM evaluation approach
 * - Context-aware answer generation  
 * - Service-specific knowledge boosting
 * - Intelligent button suggestions based on booking state
 */
export class FAQHandler {
  
  /**
   * Main entry point for processing FAQ intents
   */
  static async processIntent(
    intent: DetectedIntent,
    currentContext: DialogueState | null,
    userContext: UserContext,
    userMessage: string
  ): Promise<TaskHandlerResult> {
    
    const faqData = intent.data as FAQIntent;
    const businessId = userContext.businessId;
    
    if (!businessId) {
      return this.createErrorResponse('Business configuration error. Please try again.');
    }
    
    // Extract questions from the FAQ intent
    const questions = faqData.questions || [userMessage];
    
    // Process each question (for now, handle the first one)
    const primaryQuestion = questions[0];
    
    try {
      return await this.handleQuestion(primaryQuestion, businessId, currentContext);
    } catch (error) {
      console.error('[FAQHandler] Error processing FAQ intent:', error);
      return this.createErrorResponse('I\'m having trouble finding that information right now. Please try rephrasing your question.');
    }
  }
  
  /**
   * Handles a specific question using multi-answer RAG approach
   */
  private static async handleQuestion(
    question: string,
    businessId: string,
    currentContext: DialogueState | null
  ): Promise<TaskHandlerResult> {
    
    // Search for relevant knowledge using the combined RAG function
    const searchResults = await RAGfunction(businessId, question);
    
    if (!searchResults || searchResults.length === 0) {
      return this.handleUnknownQuestion(question, currentContext);
    }
    
    // Get top 3 results for LLM evaluation instead of using threshold
    const topResults = searchResults.slice(0, 3);
    
    // Generate context-aware answer using multiple knowledge sources
    const answer = await this.generateContextualAnswer(
      question,
      topResults,
      currentContext
    );
    
    // Generate smart buttons based on booking state
    const buttons = this.generateSmartButtons(currentContext, topResults);
    
    return {
      response: answer,
      shouldUpdateContext: false,
      buttons: buttons
    };
  }
  
  /**
   * Generates a contextual answer using multiple knowledge matches for LLM evaluation
   */
  private static async generateContextualAnswer(
    question: string,
    knowledgeMatches: VectorSearchResult[],
    currentContext: DialogueState | null
  ): Promise<string> {
    
    const hasActiveBooking = currentContext?.activeBooking ? true : false;
    const systemPrompt = this.buildAnswerSystemPrompt(hasActiveBooking);
    const userPrompt = this.buildAnswerUserPrompt(question, knowledgeMatches);
    
    try {
      const response = await executeChatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        "gpt-4o",
        0.3, // Slightly creative for natural answers
        400
      );
      
      const answer = response.choices[0]?.message?.content?.trim();
      return answer || knowledgeMatches[0].content;
      
    } catch (error) {
      console.error('[FAQHandler] Error generating contextual answer:', error);
      // Fallback to best content
      return this.formatRawContent(knowledgeMatches[0].content);
    }
  }
  
  /**
   * Builds the system prompt for multi-answer evaluation
   */
  private static buildAnswerSystemPrompt(hasActiveBooking: boolean): string {
    const bookingContext = hasActiveBooking 
      ? "The user currently has an active booking in progress."
      : "The user does not have an active booking.";
    
    return `You are a helpful service booking assistant. You will receive a customer question and multiple potential answers from business documents. Your job is to:

1. **Evaluate all provided answers** and select the most relevant information
2. **Generate a natural, conversational response** based on the best knowledge
3. **Be conversational and friendly** - avoid robotic responses
4. **Keep answers concise** - 1-2 sentences for simple questions, longer for complex ones
5. **Context awareness**: ${bookingContext}
6. **Encourage booking** - if relevant, subtly suggest booking services
7. **Use emojis sparingly** - only when they add value

CRITICAL RULES:
- **Only use information from the provided documents** - don't make up details
- **If none of the answers are relevant**, say "I don't have specific information about that"
- **Choose the BEST answer** from multiple options - don't combine unrelated info
- **Be natural** - sound like a helpful human, not a search engine

FORMAT:
- Start with a direct answer
- Add relevant details if helpful
- End with a booking nudge if appropriate

Remember: You're representing a service business, so be professional yet warm.`;
  }
  
  /**
   * Builds the user prompt with question and multiple knowledge sources
   */
  private static buildAnswerUserPrompt(question: string, knowledgeMatches: VectorSearchResult[]): string {
    const knowledgeOptions = knowledgeMatches.map((match, index) => 
      `Option ${index + 1} (Confidence: ${Math.round(match.confidenceScore * 100)}%):\n${match.content}`
    ).join('\n\n---\n\n');
    
    return `Customer Question: "${question}"

Available Knowledge Options:
${knowledgeOptions}

Please evaluate these options and generate the most helpful, natural response to the customer's question.`;
  }
  
  /**
   * Handles questions where no good knowledge match was found
   */
  private static async handleUnknownQuestion(
    question: string,
    currentContext: DialogueState | null
  ): Promise<TaskHandlerResult> {
    
    const buttons = this.generateSmartButtons(currentContext, []);
    
    return {
      response: `I don't have specific information about that right now. Let me help you with our services!`,
      shouldUpdateContext: false,
      buttons: buttons
    };
  }
  
  /**
   * Generates smart buttons based on user's current booking state
   */
  private static generateSmartButtons(
    currentContext: DialogueState | null,
    knowledgeMatches: VectorSearchResult[]
  ): ButtonConfig[] {
    
    const hasActiveBooking = currentContext?.activeBooking ? true : false;
    const buttons: ButtonConfig[] = [];
    
    if (hasActiveBooking) {
      // User is mid-booking - focus on booking completion
      buttons.push(
        { buttonText: '📅 Continue booking', buttonValue: 'continue_booking' },
        { buttonText: '🛍️ View services', buttonValue: 'show_services' }
      );
    } else {
      // User is browsing - encourage service exploration and booking
      // Check if answer was about a specific service
      const isServiceSpecific = knowledgeMatches.some(match => match.type === 'service');
      
      if (isServiceSpecific) {
        buttons.push(
          { buttonText: '📅 Book this service', buttonValue: 'book_service' },
          { buttonText: '💰 Check pricing', buttonValue: 'view_pricing' },
          { buttonText: '🛍️ Browse all services', buttonValue: 'show_services' }
        );
      } else {
        buttons.push(
          { buttonText: '🛍️ View our services', buttonValue: 'show_services' },
          { buttonText: '📅 Check availability', buttonValue: 'check_availability' }
        );
      }
    }
    
    // Limit to 3 buttons max for WhatsApp constraints
    return buttons.slice(0, 3);
  }
  
  /**
   * Formats raw content for display
   */
  private static formatRawContent(content: string, maxLength: number = 300): string {
    let formatted = content.trim();
    
    // Remove excessive whitespace
    formatted = formatted.replace(/\s+/g, ' ');
    
    // Truncate if too long
    if (formatted.length > maxLength) {
      formatted = formatted.substring(0, maxLength).trim();
      // Find last complete sentence or word
      const lastPeriod = formatted.lastIndexOf('.');
      const lastSpace = formatted.lastIndexOf(' ');
      
      if (lastPeriod > maxLength - 50) {
        formatted = formatted.substring(0, lastPeriod + 1);
      } else if (lastSpace > maxLength - 20) {
        formatted = formatted.substring(0, lastSpace) + '...';
      } else {
        formatted += '...';
      }
    }
    
    return formatted;
  }
  
  /**
   * Creates error response
   */
  private static createErrorResponse(message: string): TaskHandlerResult {
    return {
      response: message,
      shouldUpdateContext: false,
      buttons: [
        { buttonText: '🔄 Try again', buttonValue: 'retry' },
        { buttonText: '🛍️ View services', buttonValue: 'show_services' }
      ]
    };
  }
} 