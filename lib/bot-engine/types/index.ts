export type ConversationalParticipantType = 'business' | 'customer';
export type UserGoalType = 'accountManagement' | 'serviceBooking' | 'frequentlyAskedQuestion' | 'humanAgentEscalation';
export type GoalActionType = 'create' | 'delete' | 'update';

// Configuration constants - now business-aware for timezone
export const getBotConfig = async (businessId: string) => {
  // Import here to avoid circular dependencies
  const { Business } = await import('@/lib/database/models/business');
  const business = await Business.getById(businessId);
  
  return {
    DEFAULT_TIMEZONE: business.timeZone,  // 🎯 Now business-specific!
    DEFAULT_LANGUAGE: 'en',              // Keep simple - language detection handles this
    SESSION_TIMEOUT_HOURS: 24            // Keep simple - same for all businesses
  };
};

export interface ConversationalParticipant {
  id: string;
  type: ConversationalParticipantType;
  associatedBusinessId?: string;
  businessWhatsappNumber?: string;
  customerWhatsappNumber?: string;
  creationTimestamp: Date;
  lastUpdatedTimestamp: Date;
}

export interface ChatConversationSession {
  id: string;
  participantId: string;
  participantType: ConversationalParticipantType;
  activeGoals: UserGoal[];
  sessionStartTimestamp: Date;
  lastMessageTimestamp: Date;
  sessionStatus: 'active' | 'completed' | 'expired' | 'escalated';
  communicationChannel: 'whatsapp' | 'web' | 'messenger';
  sessionMetadata?: {
    deviceInformation?: string;
    locationInformation?: string;
    languagePreference?: string;
  };
  userData?: {
    userId?: string;
    customerName?: string;
    existingUserFound?: boolean;
    awaitingName?: boolean;
    originalQuestion?: string;
  };
}

export interface UserGoal {
  goalType: UserGoalType;
  goalAction?: GoalActionType;
  goalStatus: 'inProgress' | 'completed' | 'failed';
  currentStepIndex: number;
  collectedData: Record<string, any>;
  messageHistory: Array<{
    speakerRole: 'user' | 'chatbot';
    content: string;
    messageTimestamp: Date;
  }>;
  flowKey: string;
}

export interface LLMProcessingResult {
  detectedUserGoalType?: UserGoalType;
  detectedGoalAction?: GoalActionType;
  extractedInformation?: Record<string, any>;
  confidenceScore?: number;
  generatedTextContent?: string;
  isValidInput?: boolean;
  validationErrorMessage?: string;
  errorMessageDetails?: string;
  transformedInput?: string;
}

export interface ChatContext {
  currentConversationSession?: ChatConversationSession;
  previousConversationSession?: ChatConversationSession;
  currentParticipant: ConversationalParticipant;
  lastCompletedGoal?: UserGoal;
  frequentlyDiscussedTopics: string[];
  participantPreferences: {
    language: string;
    timezone: string;
    notificationSettings: Record<string, boolean>;
  };
}

export type ButtonConfig = {
  buttonText: string;
  buttonValue: string;
  buttonDescription?: string;
  buttonType?: 'postback' | 'link';
};

export interface IndividualStepHandler {
  validateUserInput: (userInput: string, currentGoalData: Record<string, any>, chatContext: ChatContext) => Promise<boolean | LLMProcessingResult>;
  processAndExtractData: (validatedInput: string, currentGoalData: Record<string, any>, chatContext: ChatContext) => Promise<Record<string, any> | LLMProcessingResult>;
  fixedUiButtons?: (currentGoalData: Record<string, any>, chatContext: ChatContext) => Promise<ButtonConfig[]> | ButtonConfig[];
  autoAdvance?: boolean;
} 

// Audio Transcription Types
export interface AudioTranscriptionResult {
  wasProcessed: boolean;
  transcribedMessage: string;
  originalMessage: string;
  error?: string;
}

export interface AudioMetadata {
  duration?: number; // in seconds
  format?: string;
  size?: number; // in bytes
}

export interface AudioFile {
  url: string;
  metadata?: AudioMetadata;
} 