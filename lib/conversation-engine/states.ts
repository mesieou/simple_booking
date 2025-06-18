interface DialogueState {
    version: '2.0'; // not needed
    sessionId: string; // not needed
    userId: string; // not needed, already as a column in the user_context table called channelUserId which will be the user whatsapp number
    businessId: string; // not needed, already as a column in the user_context table called businessId which references the number the user is interacting with
    
    // Core conversation management
    conversationFlow: ConversationFlow; // Im not sure for what is this used for
    
    // Task-specific states
    bookingState: BookingState; 
    faqState: FAQState;
    chitchatState: ChitchatState;
    // not sure all of for what are these used for
    
    // System metadata
    systemState: SystemState; // not sure for what is this used for
  }


  interface ConversationFlow {
    // What the user is actively working on (ordered by priority)
    activeGoals: Goal[]; // not sure for what is this used for
    
    // Current conversation focus
    primaryFocus: 'booking' | 'faq' | 'chitchat' | 'mixed';
    
    // Conversation state
    turnState: 'awaiting_user_input' | 'processing_user_request' | 'awaiting_clarification' | 'task_completed';
    
    // Interruption handling
    interruptionContext?: InterruptionContext;
  }
  
  interface Goal {
    type: 'booking' | 'faq' | 'chitchat';
    priority: number; // 1 = highest priority
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    createdAt: string; // ISO timestamp
    completedAt?: string;
  }
  
  interface InterruptionContext {
    previousGoal: Goal;
    interruptedAt: string;
    resumeAfterCurrentTask: boolean;
  }



  interface BookingState {
    // Current booking being built
    currentBooking: BookingSlots;
    
    // Booking completion tracking
    completionStatus: BookingCompletionStatus;
    
    // Required vs optional slots (dynamic based on service type)
    requiredSlots: (keyof BookingSlots)[];
    optionalSlots: (keyof BookingSlots)[];
    
    // Validation and constraints
    constraints: BookingConstraints;
    
    // Edit history (for handling "change the time" requests)
    editHistory: BookingEdit[];
    
    // Confirmation state
    confirmationState: ConfirmationState;
  }
  
  interface BookingSlots {
    // Service information
    serviceId?: string;
    serviceName?: string;
    serviceCategory?: string;
    
    // Scheduling
    date?: string; // ISO date
    time?: string; // ISO time
    duration?: number; // minutes
    
    // Location
    locationId?: string;
    locationName?: string;
    locationAddress?: string;
    
    // Customer details
    numberOfPeople?: number;
    specialRequests?: string;
    
    // Pricing (calculated)
    estimatedPrice?: number;
    currency?: string;
  }
  
  interface BookingCompletionStatus {
    isComplete: boolean;
    missingSlots: (keyof BookingSlots)[];
    nextSlotToFill?: keyof BookingSlots;
    completionPercentage: number; // 0-100
  }
  
  interface BookingConstraints {
    // Service-specific constraints
    serviceConstraints?: {
      minDuration?: number;
      maxDuration?: number;
      availableDays?: string[]; // ['monday', 'tuesday', ...]
      timeSlots?: string[]; // ['09:00', '10:00', ...]
    };
    
    // Location constraints
    locationConstraints?: {
      serviceRadius?: number; // km
      availableLocations?: string[];
    };
  }
  
  interface BookingEdit {
    timestamp: string;
    field: keyof BookingSlots;
    oldValue: any;
    newValue: any;
    reason: string; // "user_correction" | "system_validation" | "availability_conflict"
  }
  
  interface ConfirmationState {
    status: 'not_ready' | 'ready_for_confirmation' | 'pending_confirmation' | 'confirmed' | 'rejected';
    confirmationAttempts: number;
    lastConfirmationPrompt?: string;
    rejectionReason?: string;
  }



  interface FAQState {
    // Questions in queue
    pendingQuestions: FAQQuestion[];
    
    // Recently answered (to avoid repetition)
    recentlyAnswered: AnsweredFAQ[];
    
    // Context for follow-up questions
    conversationContext: FAQContext[];
  }
  
  interface FAQQuestion {
    id: string;
    originalQuestion: string;
    normalizedQuestion: string; // processed for search
    priority: number;
    category?: string; // 'service_info' | 'pricing' | 'availability' | 'general'
    addedAt: string;
  }
  
  interface AnsweredFAQ {
    questionId: string;
    question: string;
    answer: string;
    sourceType: 'services_table' | 'documents_table' | 'generated';
    sourceId?: string;
    answeredAt: string;
    userSatisfaction?: 'satisfied' | 'needs_clarification' | 'unsatisfied';
  }
  
  interface FAQContext {
    topic: string;
    relatedQuestions: string[];
    depth: number; // how deep into a topic we are
  }


  interface ChitchatState {
    // Conversation tone and personality
    conversationTone: 'formal' | 'casual' | 'friendly' | 'professional';
    
    // Social context
    greetingExchanged: boolean;
    userName?: string;
    userPreferences?: {
      preferredLanguage?: string;
      communicationStyle?: 'brief' | 'detailed';
    };
    
    // Relationship building
    previousInteractions: number;
    relationshipLevel: 'new' | 'returning' | 'regular' | 'vip';
  }




  interface SystemState {
    // Timestamps
    conversationStartedAt: string;
    lastActivityAt: string;
    lastUpdatedAt: string;
    
    // Performance tracking
    messageCount: number;
    intentClassificationHistory: IntentClassification[];
    
    // Error handling
    lastError?: SystemError;
    recoveryAttempts: number;
    
    // Feature flags and configuration
    enabledFeatures: string[];
    experimentalFlags: Record<string, boolean>;
    
    // Integration status
    integrationStatus: {
      whatsapp: 'connected' | 'disconnected' | 'error';
      database: 'connected' | 'disconnected' | 'error';
      llm: 'connected' | 'disconnected' | 'rate_limited' | 'error';
    };
  }
  
  interface IntentClassification {
    timestamp: string;
    userMessage: string;
    detectedIntents: string[];
    confidence: number;
    processingTime: number; // milliseconds
  }
  
  interface SystemError {
    timestamp: string;
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    recovered: boolean;
  }