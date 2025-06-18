// Multi-Intent Classifier Types for V2 System

// Import ButtonConfig from the working system
export interface ButtonConfig {
  buttonText: string;
  buttonValue: string;
  buttonDescription?: string;
  buttonType?: 'postback' | 'link';
}

export interface MultiIntentResult {
  intents: DetectedIntent[];
  bookingContext: BookingContextAnalysis;
  contextUpdates?: Partial<DialogueState>;
}

export interface DetectedIntent {
  type: 'chitchat' | 'faq' | 'booking';
  data: Record<string, any>;
  priority: number; // 1 = highest priority
  handlerName: string; // Which handler should process this
}

export interface BookingContextAnalysis {
  hasActiveBooking: boolean;
  shouldUpdateBooking: boolean;
  shouldCreateNewBooking: boolean;
  conflictResolution?: 'continue_existing' | 'replace_existing' | 'ask_user';
  slotsDetected: string[]; // Which booking slots were found in the message
}

// Task Handler Result interface - Updated to use ButtonConfig[]
export interface TaskHandlerResult {
  response: string;
  shouldUpdateContext: boolean;
  contextUpdates?: Partial<DialogueState>;
  buttons?: ButtonConfig[]; // Changed from suggestedActions to actual button configs
}

// Specific intent data interfaces
export interface ChitchatIntent {
  greeting?: boolean;
  pleasantries?: string;
  farewell?: boolean;
  thanks?: boolean;
}

export interface FAQIntent {
  questions: string[];
  category?: 'service_info' | 'pricing' | 'availability' | 'policies' | 'general';
}

export interface BookingIntent {
  userName?: string;
  serviceInquiry?: string; // "gel manicures", "eyebrow threading"
  serviceId?: string; // If specific service selected
  date?: string; // "Tuesday", "next week", "January 15"
  time?: string; // "3pm", "morning", "after 2"
  location?: string;
  numberOfPeople?: number;
  specialRequests?: string;
  checkingAvailability?: boolean; // "Do you have time Thursday?" vs "I want to book Thursday"
}

// Dialogue State interface (moved here for consistency)
export interface DialogueState {
  // ACTIVE BOOKING STATE (Core booking prevention & progress tracking)
  activeBooking?: {
    // Required booking slots (filled as information is gathered)
    userName?: string;           // Always needed first
    serviceId?: string;
    serviceName?: string;
    date?: string;              // "2024-01-15"
    time?: string;              // "14:30"
    
    // Additional booking context
    locationAddress?: string;    // For mobile services
    quoteId?: string;           // When quote is created
    
    // Status and timing
    status?: 'collecting_info' | 'ready_for_quote' | 'quote_confirmed' | 'completed';
    createdAt: string;          // For "days ago" detection
    lastUpdatedAt: string;
  };
  
  // BOOKING CONFLICT RESOLUTION
  bookingConflict?: {
    hasExistingBooking: boolean;
    existingBookingData: {
      service?: string;
      date?: string;
      time?: string;
      name?: string;
    };
    needsModification: boolean;
  };
  
  // USER CONTEXT (Minimal persistent info)
  userEmail?: string;          // user@skedy.io format
  
  // SYSTEM METADATA
  lastActivityAt: string;
} 