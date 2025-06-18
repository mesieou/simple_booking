import { executeChatCompletion, OpenAIChatMessage } from "../../llm-actions/chat-interactions/openai-config/openai-core";
import { 
  MultiIntentResult, 
  DetectedIntent, 
  BookingContextAnalysis, 
  DialogueState,
  ChitchatIntent,
  FAQIntent,
  BookingIntent
} from "./types";

/**
 * Multi-Intent Classifier using OpenAI Function Calling
 * 
 * This classifier can detect multiple intents in a single message and provides
 * intelligent booking context analysis to prevent conflicts and guide responses.
 */
export class MultiIntentClassifier {
  
  /**
   * Analyzes a user message and detects multiple intents
   * 
   * @param userMessage - The user's message to analyze
   * @param currentContext - Current dialogue state for context-aware analysis
   * @returns MultiIntentResult with detected intents and booking analysis
   */
  static async analyzeMessage(
    userMessage: string,
    currentContext: DialogueState | null
  ): Promise<MultiIntentResult> {
    
    const systemPrompt = this.buildStructuredSystemPrompt(currentContext);
    const userPrompt = this.buildUserPrompt(userMessage, currentContext);
    
    try {
      const response = await executeChatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        "gpt-4o",
        0.1, // Low temperature for consistent analysis
        500
      );
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.getFallbackResult(currentContext);
      }
      
      return this.parseStructuredResponse(content, currentContext);
      
    } catch (error) {
      console.error('[MultiIntentClassifier] Error during analysis:', error);
      return this.getFallbackResult(currentContext);
    }
  }
  
  /**
   * Builds the structured system prompt for JSON output
   */
  private static buildStructuredSystemPrompt(currentContext: DialogueState | null): string {
    const hasActiveBooking = currentContext?.activeBooking ? true : false;
    const bookingStatus = currentContext?.activeBooking?.status || 'none';
    
    return `You are an intelligent conversation analyst for a service booking assistant. Analyze user messages and return a JSON response with ALL detected intents.

CURRENT CONTEXT:
- Active Booking: ${hasActiveBooking ? 'YES' : 'NO'}
- Booking Status: ${bookingStatus}
- User Email: ${currentContext?.userEmail || 'unknown'}

ANALYSIS RULES:
1. **Multiple Intents**: A single message can contain multiple intents. Detect ALL of them.
2. **Intent Types**: chitchat, faq, booking
3. **Context Awareness**: Consider the current booking state when analyzing intent.
4. **Natural Language**: Handle casual, natural language inputs intelligently.
5. **Availability vs Booking**: "Do you have time X?" is a booking intent with checkingAvailability=true
6. **MERGE RELATED BOOKING INFO**: If multiple parts of a message refer to the same booking (like "Do you have time Friday? I want to book it"), create ONE booking intent with all information combined.
7. **NO DUPLICATE BOOKING INTENTS**: Never create multiple booking intents for the same request. Combine all booking-related information into a single intent.
8. **AMBIGUOUS DATE/TIME REFERENCES**: Phrases like "Maybe tomorrow?", "Possibly next week?", "Perhaps Monday?" should be treated as booking intents since they likely refer to scheduling, even if tentative.

RESPONSE FORMAT (JSON):
{
  "intents": [
    {
      "type": "chitchat",
      "data": { "greeting": true, "thanks": false, "farewell": false },
      "confidence": 0.9
    },
    {
      "type": "faq", 
      "data": { "questions": ["Do you do gel manicures?"], "category": "service_info" },
      "confidence": 0.8
    },
    {
      "type": "booking",
      "data": { "date": "Friday", "time": "2pm", "checkingAvailability": true },
      "confidence": 0.95
    }
  ]
}

IMPORTANT: 
- For messages like "Do you have time Friday at 2pm? I want to book it", create ONE booking intent combining both the availability check and booking desire, NOT two separate booking intents.
- Ambiguous time references like "Maybe tomorrow?" are likely booking-related in a service booking context, so classify as booking intent.

Analyze the user's message and return JSON with ALL detected intents.`;
  }

  /**
   * Builds the system prompt based on current context (legacy - keeping for reference)
   */
  private static buildSystemPrompt(currentContext: DialogueState | null): string {
    const hasActiveBooking = currentContext?.activeBooking ? true : false;
    const bookingStatus = currentContext?.activeBooking?.status || 'none';
    
    return `You are an intelligent conversation analyst for a service booking assistant. Your job is to analyze user messages and call the appropriate functions to handle their intents.

CURRENT CONTEXT:
- Active Booking: ${hasActiveBooking ? 'YES' : 'NO'}
- Booking Status: ${bookingStatus}
- User Email: ${currentContext?.userEmail || 'unknown'}

ANALYSIS RULES:
1. **Multiple Intents**: A single message can contain multiple intents. You MUST call ALL relevant functions for each intent you detect.
2. **Call Multiple Functions**: If you detect a greeting AND a question AND booking info, call handle_greeting AND answer_question AND update_booking.
3. **Booking Priority**: Always prioritize booking-related information when detected.
4. **Context Awareness**: Consider the current booking state when analyzing intent.
5. **Natural Language**: Handle casual, natural language inputs intelligently.

BOOKING CONFLICT RULES:
- If there's an active booking and user provides new booking info, this is an UPDATE
- If user explicitly wants to "start over" or "new booking", this is a REPLACEMENT
- If unclear, mark for user clarification

IMPORTANT: You can and should call multiple functions for a single message. Analyze the entire message and call every relevant function.`;
  }
  
  /**
   * Builds the user prompt with message and context
   */
  private static buildUserPrompt(userMessage: string, currentContext: DialogueState | null): string {
    let contextInfo = '';
    
    if (currentContext?.activeBooking) {
      const booking = currentContext.activeBooking;
      contextInfo = `\nCurrent booking in progress:
- Name: ${booking.userName || 'not provided'}
- Service: ${booking.serviceName || 'not selected'}
- Date: ${booking.date || 'not selected'}
- Time: ${booking.time || 'not selected'}
- Status: ${booking.status}`;
    }
    
    return `User message: "${userMessage}"${contextInfo}

Analyze this message and call the appropriate functions to handle the user's intents.`;
  }
  
  /**
   * Defines the functions available for the LLM to call
   */
  private static getFunctionDefinitions() {
    return [
      {
        name: "handle_greeting",
        description: "Process greetings, pleasantries, thanks, or farewell messages",
        parameters: {
          type: "object",
          properties: {
            greeting: { type: "boolean", description: "True if this is a greeting" },
            pleasantries: { type: "string", description: "The specific pleasantry or small talk" },
            farewell: { type: "boolean", description: "True if this is a goodbye" },
            thanks: { type: "boolean", description: "True if expressing gratitude" }
          }
        }
      },
      {
        name: "answer_question",
        description: "Handle questions about services, pricing, policies, or general information",
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: { type: "string" },
              description: "Array of questions found in the message"
            },
            category: {
              type: "string",
              enum: ["service_info", "pricing", "availability", "policies", "general"],
              description: "Category of the questions"
            }
          },
          required: ["questions"]
        }
      },
      {
        name: "update_booking",
        description: "Update or create booking with provided information",
        parameters: {
          type: "object",
          properties: {
            userName: { type: "string", description: "User's name if provided" },
            serviceInquiry: { type: "string", description: "Service they're asking about or want" },
            serviceId: { type: "string", description: "Specific service ID if mentioned" },
            date: { type: "string", description: "Date mentioned (keep original format)" },
            time: { type: "string", description: "Time mentioned (keep original format)" },
            location: { type: "string", description: "Location or address mentioned" },
            numberOfPeople: { type: "number", description: "Number of people for the service" },
            specialRequests: { type: "string", description: "Any special requests or notes" }
          }
        }
      },
      {
        name: "check_availability",
        description: "Check availability for specific dates/times (when user asks 'do you have time on...')",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "Date to check availability for" },
            time: { type: "string", description: "Specific time to check" },
            service: { type: "string", description: "Service they want to check availability for" },
            duration: { type: "number", description: "Expected duration in minutes" }
          },
          required: ["date"]
        }
      }
    ];
  }
  
  /**
   * Parses the structured JSON response from the LLM
   */
  private static parseStructuredResponse(
    content: string,
    currentContext: DialogueState | null
  ): MultiIntentResult {
    try {
      // Extract JSON from response
      let jsonStr = content.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      const rawIntents = parsed.intents || [];
      
      // Convert to our DetectedIntent format
      let intents: DetectedIntent[] = rawIntents.map((intent: any, index: number) => ({
        type: intent.type,
        data: intent.data,
        priority: index + 1,
        handlerName: this.getHandlerName(intent.type)
      }));
      
      // Post-process: Merge duplicate booking intents
      intents = this.mergeDuplicateBookingIntents(intents);
      
      // If no intents detected, default to chitchat
      if (intents.length === 0) {
        intents.push({
          type: 'chitchat',
          data: { greeting: true },
          priority: 1,
          handlerName: 'ChitchatHandler'
        });
      }
      
      // Analyze booking context
      const bookingContext = this.analyzeBookingContext(intents, currentContext);
      
      // Generate context updates
      const contextUpdates = this.generateContextUpdates(intents, currentContext, bookingContext);
      
      return {
        intents,
        bookingContext,
        contextUpdates
      };
      
    } catch (error) {
      console.error('[MultiIntentClassifier] Error parsing structured response:', error);
      console.error('Raw content:', content);
      return this.getFallbackResult(currentContext);
    }
  }
  
  /**
   * Merges duplicate booking intents into a single unified intent
   */
  private static mergeDuplicateBookingIntents(intents: DetectedIntent[]): DetectedIntent[] {
    const bookingIntents = intents.filter(intent => intent.type === 'booking');
    const nonBookingIntents = intents.filter(intent => intent.type !== 'booking');
    
    if (bookingIntents.length <= 1) {
      return intents; // No duplicates to merge
    }
    
    // Merge all booking intents into one
    const mergedBookingData: BookingIntent = {};
    let hasAvailabilityCheck = false;
    let hasBookingRequest = false;
    
    for (const intent of bookingIntents) {
      const data = intent.data as BookingIntent;
      
      // Merge all booking fields
      if (data.userName) mergedBookingData.userName = data.userName;
      if (data.serviceInquiry) mergedBookingData.serviceInquiry = data.serviceInquiry;
      if (data.serviceId) mergedBookingData.serviceId = data.serviceId;
      if (data.date) mergedBookingData.date = data.date;
      if (data.time) mergedBookingData.time = data.time;
      if (data.location) mergedBookingData.location = data.location;
      if (data.numberOfPeople) mergedBookingData.numberOfPeople = data.numberOfPeople;
      if (data.specialRequests) mergedBookingData.specialRequests = data.specialRequests;
      
      // Track if we have both availability checking and booking request
      if (data.checkingAvailability === true) hasAvailabilityCheck = true;
      if (data.checkingAvailability === false) hasBookingRequest = true;
    }
    
    // If we have both availability check and booking request, treat as availability check
    // since "Do you have time X? I want to book it" is primarily checking availability
    mergedBookingData.checkingAvailability = hasAvailabilityCheck;
    
    const mergedIntent: DetectedIntent = {
      type: 'booking',
      data: mergedBookingData,
      priority: bookingIntents[0].priority, // Keep original priority
      handlerName: 'BookingManager'
    };
    
    // Return non-booking intents + merged booking intent
    return [...nonBookingIntents, mergedIntent].sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Gets the handler name for an intent type
   */
  private static getHandlerName(intentType: string): string {
    switch (intentType) {
      case 'chitchat': return 'ChitchatHandler';
      case 'faq': return 'FAQHandler';
      case 'booking': return 'BookingManager';
      default: return 'UnknownHandler';
    }
  }

  /**
   * Processes the function calls returned by the LLM (legacy)
   */
  private static processFunctionCalls(
    functionCalls: any[],
    currentContext: DialogueState | null
  ): MultiIntentResult {
    
    const intents: DetectedIntent[] = [];
    let priority = 1;
    
    // Process each function call
    for (const call of functionCalls) {
      const intent = this.convertFunctionCallToIntent(call, priority);
      if (intent) {
        intents.push(intent);
        priority++;
      }
    }
    
    // If no intents detected, default to chitchat
    if (intents.length === 0) {
      intents.push({
        type: 'chitchat',
        data: { greeting: true },
        priority: 1,
        handlerName: 'ChitchatHandler'
      });
    }
    
    // Analyze booking context
    const bookingContext = this.analyzeBookingContext(intents, currentContext);
    
    // Generate context updates if needed
    const contextUpdates = this.generateContextUpdates(intents, currentContext, bookingContext);
    
    return {
      intents,
      bookingContext,
      contextUpdates
    };
  }
  
  /**
   * Converts a function call to a DetectedIntent
   */
  private static convertFunctionCallToIntent(call: any, priority: number): DetectedIntent | null {
    const { name, arguments: args } = call;
    let parsedArgs: any;
    
    try {
      parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    } catch (error) {
      console.error('[MultiIntentClassifier] Error parsing function arguments:', error);
      return null;
    }
    
    switch (name) {
      case 'handle_greeting':
        return {
          type: 'chitchat',
          data: parsedArgs as ChitchatIntent,
          priority,
          handlerName: 'ChitchatHandler'
        };
        
      case 'answer_question':
        return {
          type: 'faq',
          data: parsedArgs as FAQIntent,
          priority,
          handlerName: 'FAQHandler'
        };
        
      case 'update_booking':
        return {
          type: 'booking',
          data: parsedArgs as BookingIntent,
          priority,
          handlerName: 'BookingManager'
        };
        
      case 'check_availability':
        // Convert availability check to booking intent with checkingAvailability flag
        return {
          type: 'booking',
          data: { 
            ...parsedArgs,
            checkingAvailability: true 
          } as BookingIntent,
          priority,
          handlerName: 'BookingManager'
        };
        
      default:
        console.warn('[MultiIntentClassifier] Unknown function call:', name);
        return null;
    }
  }
  
  /**
   * Analyzes booking context to prevent conflicts and guide responses
   */
  private static analyzeBookingContext(
    intents: DetectedIntent[],
    currentContext: DialogueState | null
  ): BookingContextAnalysis {
    
    const hasActiveBooking = currentContext?.activeBooking ? true : false;
    const bookingIntents = intents.filter(intent => intent.type === 'booking');
    
    // Detect what booking slots were mentioned
    const slotsDetected: string[] = [];
    for (const intent of bookingIntents) {
      const data = intent.data as BookingIntent;
      if (data.userName) slotsDetected.push('userName');
      if (data.serviceInquiry || data.serviceId) slotsDetected.push('service');
      if (data.date) slotsDetected.push('date');
      if (data.time) slotsDetected.push('time');
      if (data.location) slotsDetected.push('location');
    }
    
    // Determine booking actions
    const shouldUpdateBooking = hasActiveBooking && bookingIntents.length > 0;
    const shouldCreateNewBooking = !hasActiveBooking && bookingIntents.length > 0;
    
    return {
      hasActiveBooking,
      shouldUpdateBooking,
      shouldCreateNewBooking,
      slotsDetected
    };
  }
  
  /**
   * Generates context updates based on detected intents
   */
  private static generateContextUpdates(
    intents: DetectedIntent[],
    currentContext: DialogueState | null,
    bookingContext: BookingContextAnalysis
  ): Partial<DialogueState> | undefined {
    
    const updates: Partial<DialogueState> = {
      lastActivityAt: new Date().toISOString()
    };
    
    // Update booking state if needed
    if (bookingContext.shouldCreateNewBooking || bookingContext.shouldUpdateBooking) {
      const bookingIntents = intents.filter(intent => intent.type === 'booking');
      
      if (bookingIntents.length > 0) {
        const bookingData = bookingIntents[0].data as BookingIntent;
        
        // Create or update active booking
        const activeBooking = currentContext?.activeBooking || {
          status: 'collecting_info' as const,
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        };
        
        // Update booking slots with new information
        if (bookingData.userName) activeBooking.userName = bookingData.userName;
        if (bookingData.serviceId) activeBooking.serviceId = bookingData.serviceId;
        if (bookingData.serviceInquiry && !activeBooking.serviceName) {
          // Store service inquiry for later matching
          activeBooking.serviceName = bookingData.serviceInquiry;
        }
        if (bookingData.date) activeBooking.date = this.normalizeDateString(bookingData.date);
        if (bookingData.time) activeBooking.time = this.normalizeTimeString(bookingData.time);
        if (bookingData.location) activeBooking.locationAddress = bookingData.location;
        
        activeBooking.lastUpdatedAt = new Date().toISOString();
        
        updates.activeBooking = activeBooking;
      }
    }
    
    return Object.keys(updates).length > 1 ? updates : undefined; // Only return if there are actual updates beyond timestamp
  }
  
  /**
   * Normalizes date strings to ISO format when possible
   */
  private static normalizeDateString(dateStr: string): string {
    // For now, return as-is. This could be enhanced with date parsing logic
    // to convert "Tuesday", "next week", etc. to actual dates
    return dateStr;
  }
  
  /**
   * Normalizes time strings to 24-hour format when possible
   */
  private static normalizeTimeString(timeStr: string): string {
    // Simple time normalization
    const lowerTime = timeStr.toLowerCase();
    
    if (lowerTime.includes('pm') || lowerTime.includes('am')) {
      // Try to parse 12-hour format
      const match = lowerTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2] ? parseInt(match[2]) : 0;
        const period = match[3];
        
        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
    
    // Return as-is if can't parse
    return timeStr;
  }
  
  /**
   * Provides fallback result when analysis fails
   */
  private static getFallbackResult(currentContext: DialogueState | null): MultiIntentResult {
    return {
      intents: [{
        type: 'chitchat',
        data: { greeting: true },
        priority: 1,
        handlerName: 'ChitchatHandler'
      }],
      bookingContext: {
        hasActiveBooking: currentContext?.activeBooking ? true : false,
        shouldUpdateBooking: false,
        shouldCreateNewBooking: false,
        slotsDetected: []
      }
    };
  }
}

// Add this at the end of the file for quick testing
export const testAvailabilityBookingCase = async () => {
  const userMessage = "Do you have time Friday at 2pm? I want to book it";
  console.log('Testing:', userMessage);
  
  // Mock the LLM response that was causing the problem
  const mockLLMResponse = {
    intents: [
      {
        type: "booking",
        data: { "date": "Friday", "time": "2pm", "checkingAvailability": true }
      },
      {
        type: "booking", 
        data: { "date": "Friday", "time": "2pm", "checkingAvailability": false }
      }
    ]
  };
  
  // Convert to DetectedIntent format
  let intents: DetectedIntent[] = mockLLMResponse.intents.map((intent: any, index: number) => ({
    type: intent.type,
    data: intent.data,
    priority: index + 1,
    handlerName: MultiIntentClassifier['getHandlerName'](intent.type)
  }));
  
  console.log('Before merge:', intents.length, 'intents');
  intents.forEach((intent, i) => {
    console.log(`${i + 1}. ${intent.type}:`, intent.data);
  });
  
  // Apply our merge logic
  intents = MultiIntentClassifier['mergeDuplicateBookingIntents'](intents);
  
  console.log('\nAfter merge:', intents.length, 'intents');
  intents.forEach((intent, i) => {
    console.log(`${i + 1}. ${intent.type}:`, intent.data);
  });
  
  return intents.length === 1 && intents[0].type === 'booking';
}; 