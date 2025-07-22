import type { IndividualStepHandler } from '@/lib/bot-engine/types';
import { getLocalizedText, getLocalizedTextWithVars, AddressValidator } from './booking-utils';

export const askAddressHandler: IndividualStepHandler = {
  
  validateUserInput: async (userInput, currentGoalData, chatContext) => {
    // Simple pattern - check goal data, then session, then fallback
    const customerName = currentGoalData.customerName || 
                        chatContext?.currentConversationSession?.userData?.customerName || 
                        'there';
    
    console.log('[AskAddress] DEBUG - Customer name resolution (validation):', {
      fromGoalData: currentGoalData.customerName,
      fromSession: chatContext?.currentConversationSession?.userData?.customerName,
      finalName: customerName,
      hasGoalData: !!currentGoalData.customerName,
      hasSessionData: !!chatContext?.currentConversationSession?.userData?.customerName
    });
    
    const validationErrorMessage = getLocalizedTextWithVars(chatContext, 'MESSAGES.INVALID_ADDRESS', { name: customerName });
    return AddressValidator.validateAddress(userInput, chatContext);
  },
  
  processAndExtractData: async (validatedInput, currentGoalData, chatContext) => {
    // Simple pattern - check goal data, then session, then fallback
    const customerName = currentGoalData.customerName || 
                        chatContext?.currentConversationSession?.userData?.customerName || 
                        'there';
    
    console.log('[AskAddress] DEBUG - Customer name resolution (processing):', {
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
        customerAddress: validatedInput,
        validationErrorMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.INVALID_ADDRESS', { name: customerName }),
        confirmationMessage: getLocalizedTextWithVars(chatContext, 'MESSAGES.PROVIDE_ADDRESS', { name: customerName })
      };
    }
    
    // Handle initial display (empty input)
    return {
      ...currentGoalData,
      customerName, // Store the resolved name in goal data
      confirmationMessage: '📍 To show you accurate pricing and availability, I need your address first.'
    };
  }
};
