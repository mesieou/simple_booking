import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars } from './booking-utils';

export const askEmailHandler: IndividualStepHandler = {
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(userInput)) {
      return { isValidInput: true };
    }
    
    // Simple pattern - check goal data, then session, then fallback
    const customerName = currentGoalData.customerName || 
                        chatContext?.currentConversationSession?.userData?.customerName || 
                        'there';
    
    console.log('[AskEmail] DEBUG - Customer name resolution:', {
      fromGoalData: currentGoalData.customerName,
      fromSession: chatContext?.currentConversationSession?.userData?.customerName,
      finalName: customerName,
      hasGoalData: !!currentGoalData.customerName,
      hasSessionData: !!chatContext?.currentConversationSession?.userData?.customerName
    });
    
    return {
      isValidInput: false,
      validationErrorMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.EMAIL_VALIDATION', { name: customerName })
    };
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    // Simple pattern - check goal data, then session, then fallback
    const customerName = currentGoalData.customerName || 
                        chatContext?.currentConversationSession?.userData?.customerName || 
                        'there';
    
    console.log('[AskEmail] DEBUG - Customer name resolution:', {
      fromGoalData: currentGoalData.customerName,
      fromSession: chatContext?.currentConversationSession?.userData?.customerName,
      finalName: customerName,
      hasGoalData: !!currentGoalData.customerName,
      hasSessionData: !!chatContext?.currentConversationSession?.userData?.customerName
    });
    
    if (validatedInput) {
      return {
        ...currentGoalData,
        customerName, // Store the resolved name in goal data
        customerEmail: validatedInput,
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.EMAIL_PROMPT', { name: customerName })
      };
    }
    
    // Handle initial display (empty input)
    return {
      ...currentGoalData,
      customerName, // Store the resolved name in goal data
      confirmationMessage: 'Please provide your email address for booking confirmation:'
    };
  }
};
