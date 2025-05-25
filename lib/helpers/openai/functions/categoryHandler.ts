import { Category, CATEGORY_DISPLAY_NAMES } from "@/lib/bot/content-crawler/config";

/**
 * Category Handler
 * 
 * This module provides functionality to handle user messages based on their category.
 * It customizes responses, clarification prompts, and behavior based on the message category.
 */

/**
 * Configuration for category-specific handling
 */
export interface CategoryConfig {
  priorityLevel: number;           // Higher number = higher priority
  clarificationThreshold: number;  // Confidence threshold below which to ask for clarification
  followUpQuestions: string[];     // Follow-up questions to ask when appropriate
  keyPhrases: string[];            // Key phrases that indicate this category
  customPromptAddition?: string;   // Additional context to add to the system prompt
}

/**
 * Category-specific configurations
 */
export const CATEGORY_CONFIGS: Record<Category, CategoryConfig> = {
  [Category.BOOKING_SCHEDULING]: {
    priorityLevel: 5,
    clarificationThreshold: 0.7,
    followUpQuestions: [
      "When would you like to schedule your move?",
      "How many items do you need to move?",
      "What's your preferred time frame for the move?"
    ],
    keyPhrases: ["book", "schedule", "appointment", "when can you", "availability"],
    customPromptAddition: "This user is interested in booking a service. Focus on collecting essential information like date, time, location, and service type."
  },
  [Category.PRICING_QUOTES]: {
    priorityLevel: 4,
    clarificationThreshold: 0.65,
    followUpQuestions: [
      "What items do you need to move?",
      "What's the distance of your move?",
      "Do you need any additional services like packing or storage?"
    ],
    keyPhrases: ["cost", "price", "quote", "estimate", "how much", "pricing"],
    customPromptAddition: "This user is interested in pricing. Be transparent about costs and explain what factors affect the price."
  },
  [Category.SERVICES_OFFERED]: {
    priorityLevel: 3,
    clarificationThreshold: 0.6,
    followUpQuestions: [
      "Are you looking for a specific service?",
      "What type of items do you need help with?",
      "Is this for a home or business move?"
    ],
    keyPhrases: ["service", "offer", "provide", "do you", "can you", "help with"],
    customPromptAddition: "This user is inquiring about our services. Highlight our main services and what makes them unique."
  },
  [Category.CONTACT]: {
    priorityLevel: 3,
    clarificationThreshold: 0.55,
    followUpQuestions: [
      "Would you like to speak with a representative?",
      "What's the best way to reach you?",
      "What's your question or concern about?"
    ],
    keyPhrases: ["contact", "reach", "phone", "email", "talk to", "representative"],
    customPromptAddition: "This user wants to make contact. Provide contact information and offer to connect them with the right person."
  },
  [Category.ABOUT_TRUST_BUILDING]: {
    priorityLevel: 2,
    clarificationThreshold: 0.5,
    followUpQuestions: [
      "What aspects of our company are you interested in learning about?",
      "Are you concerned about any specific aspect of our service?",
      "Would you like to hear about our experience in the industry?"
    ],
    keyPhrases: ["about", "company", "experience", "history", "background", "trust"],
    customPromptAddition: "This user is seeking information about our company. Emphasize our experience, values, and customer satisfaction."
  },
  [Category.FAQ]: {
    priorityLevel: 2,
    clarificationThreshold: 0.5,
    followUpQuestions: [
      "Is there a specific question you have?",
      "Would you like to know more about any particular aspect of our service?",
      "Is there anything else you'd like to know?"
    ],
    keyPhrases: ["question", "faq", "frequently", "ask", "wonder", "curious"],
    customPromptAddition: "This user has general questions. Provide clear, concise answers and anticipate follow-up questions."
  },
  [Category.TERMS_CONDITIONS]: {
    priorityLevel: 1,
    clarificationThreshold: 0.75, // Higher threshold for legal matters
    followUpQuestions: [
      "Which specific policy are you inquiring about?",
      "Are you concerned about a particular aspect of our terms?",
      "Would you like me to explain any specific clause in more detail?"
    ],
    keyPhrases: ["terms", "conditions", "policy", "legal", "agreement", "contract"],
    customPromptAddition: "This user is asking about legal matters. Be precise and accurate, and suggest contacting legal support for complex issues."
  }
};

/**
 * Get the appropriate follow-up question for a category
 * 
 * @param category The message category
 * @returns A follow-up question appropriate for the category
 */
export function getCategoryFollowUp(category: Category): string {
  const config = CATEGORY_CONFIGS[category];
  if (!config || !config.followUpQuestions.length) {
    return "Is there anything specific you'd like to know about our services?";
  }
  
  // Randomly select a follow-up question from the category's list
  const randomIndex = Math.floor(Math.random() * config.followUpQuestions.length);
  return config.followUpQuestions[randomIndex];
}

/**
 * Enhance the system prompt based on the message category
 * 
 * @param basePrompt The base system prompt
 * @param category The message category
 * @returns Enhanced system prompt with category-specific guidance
 */
export function enhancePromptForCategory(basePrompt: string, category: Category): string {
  const config = CATEGORY_CONFIGS[category];
  if (!config || !config.customPromptAddition) {
    return basePrompt;
  }
  
  return `${basePrompt}\n\nCategory-specific guidance: ${config.customPromptAddition}`;
}

/**
 * Get the clarification threshold for a specific category
 * 
 * @param category The message category
 * @returns The confidence threshold below which to ask for clarification
 */
export function getClarificationThreshold(category: Category): number {
  return CATEGORY_CONFIGS[category]?.clarificationThreshold || 0.6; // Default threshold
}

/**
 * Detect if a message contains key phrases for a specific category
 * 
 * @param message The user message
 * @param category The category to check for
 * @returns True if the message contains key phrases for the category
 */
export function containsCategoryKeyPhrases(message: string, category: Category): boolean {
  const config = CATEGORY_CONFIGS[category];
  if (!config || !config.keyPhrases.length) {
    return false;
  }
  
  const lowerMessage = message.toLowerCase();
  return config.keyPhrases.some(phrase => lowerMessage.includes(phrase.toLowerCase()));
} 