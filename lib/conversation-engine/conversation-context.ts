// lib/conversation-engine/conversation.context.ts

import { OpenAIChatMessage } from "@/lib/conversation-engine/llm-actions/chat-interactions/openai-config/openai-core"; // Corrected import path
// Import the actual ClientNeedResult type
import { ClientNeedResult } from "./llm-actions/chat-interactions/functions/intention-detector"; 
// Import specific state types as they are defined, e.g.:
// import { BookingProcessState } from './modes/booking/booking.state'; 
// import { AccountManagementState } from './modes/account/account.state';
import { BookingState } from './modes/booking/booking-sub-modes/booking.state'; // Added import

/**
 * Defines the possible top-level conversational modes the chatbot can be in.
 */
export type ConversationMode =
  | 'IdleMode'       
  | 'BookingMode'    
  | 'FAQMode'         
  | 'AccountMode'     
  | 'EscalationMode'; 

/**
 * Represents the overall context of a single user's conversation session.
 * This object should be loaded at the start of an interaction and saved at the end.
 */
export interface ConversationContext {
  userId: string;                 // Unique identifier for the user (e.g., WhatsApp ID, session ID).
  currentMode: ConversationMode;    // The current top-level mode of the conversation.
  
  // Full conversation history. Consider a more abstract ChatTurn interface if OpenAIChatMessage is too OpenAI-specific for general history.
  chatHistory: OpenAIChatMessage[]; 
  
  lastUserIntent?: ClientNeedResult; // Use the imported ClientNeedResult type

  // Mode-specific states - add more as new modes are developed.
  // These would typically be instances of interfaces defined within each mode's .state.ts file.
  bookingState?: BookingState; // Changed from any to BookingState
  accountState?: any; // Replace 'any' with specific AccountManagementState later
  // faqState?: any; // If FAQ mode becomes stateful
  // escalationState?: any; // If escalation mode becomes stateful

  // You might also include other session-specific data:
  // userProfile?: UserProfile; // Information about the logged-in user
  // channelType?: 'whatsapp' | 'web' | 'messenger'; // If context needs to be aware of the channel for some reason
  // lastInteractionTimestamp?: number;
} 