import type { IndividualStepHandler, LLMProcessingResult, ChatContext, ButtonConfig } from '@/lib/conversation-engine/juan-bot-engine-v2/bot-manager';

// Configuration constants for business account management
const BUSINESS_ACCOUNT_CONFIG = {
  PROMPTS: {
    EMAIL_REQUEST: 'Please enter your business email address.'
  },
  ERROR_MESSAGES: {
    INVALID_EMAIL: 'Please provide a valid business email address (must contain @ and be at least 6 characters).'
  },
  VALIDATION: {
    MIN_EMAIL_LENGTH: 5,
    REQUIRED_EMAIL_SYMBOL: '@'
  },
  BUTTON_OPTIONS: {
    USE_EXISTING: 'My existing email',
    NO_EMAIL: 'No email at the moment'
  }
} as const;

// Business validation utilities
class BusinessValidator {
  
  // Validates business email format and requirements
  static validateBusinessEmail(email: string): boolean {
    return email.includes(BUSINESS_ACCOUNT_CONFIG.VALIDATION.REQUIRED_EMAIL_SYMBOL) && 
           email.length > BUSINESS_ACCOUNT_CONFIG.VALIDATION.MIN_EMAIL_LENGTH;
  }

  // Creates validation result for email input
  static createEmailValidationResult(email: string): boolean | LLMProcessingResult {
    if (BusinessValidator.validateBusinessEmail(email)) {
      return true;
    }
    
    return {
      isValidInput: false,
      validationErrorMessage: BUSINESS_ACCOUNT_CONFIG.ERROR_MESSAGES.INVALID_EMAIL
    };
  }
}

// Business data processing utilities
class BusinessDataProcessor {
  
  // Processes and stores business email data
  static processBusinessEmail(email: string, currentData: Record<string, any>): Record<string, any> {
    return { 
      ...currentData, 
      businessEmail: email.trim().toLowerCase() // Normalize email format
    };
  }
}

// Business UI utilities
class BusinessUIGenerator {
  
  // Creates standard email input options
  static createEmailInputButtons(): ButtonConfig[] {
    return [
      { 
        buttonText: BUSINESS_ACCOUNT_CONFIG.BUTTON_OPTIONS.USE_EXISTING, 
        buttonValue: 'use_registered_email' 
      },
      { 
        buttonText: BUSINESS_ACCOUNT_CONFIG.BUTTON_OPTIONS.NO_EMAIL, 
        buttonValue: 'no_email_available' 
      }
    ];
  }
}

// --- Step Handler Implementations ---

// Collects business email address for account setup
export const getBusinessEmailHandler: IndividualStepHandler = {
  defaultChatbotPrompt: BUSINESS_ACCOUNT_CONFIG.PROMPTS.EMAIL_REQUEST,
  
  // Validates email format and requirements
  validateUserInput: async (input) => {
    return BusinessValidator.createEmailValidationResult(input);
  },
  
  // Processes and stores the business email
  processAndExtractData: async (input, data) => {
    return BusinessDataProcessor.processBusinessEmail(input, data);
  },
  
  // Provides alternative email options
  fixedUiButtons: () => BusinessUIGenerator.createEmailInputButtons()
}; 