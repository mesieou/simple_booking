// Mock environment variables at the top
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'This is a mocked response.' } }]
        })
      }
    }
  }));
});

import { MainOrchestrator } from './main-orchestrator';
import { UserContext } from '@/lib/database/models/user-context';
import { DetectedIntent, DialogueState, TaskHandlerResult, ButtonConfig, MultiIntentResult, BookingIntent, FAQIntent, ChitchatIntent } from './nlu/types';

/**
 * End-to-End V2 Pipeline Test
 * 
 * This test simulates a full conversation flow through the V2 pipeline:
 * 1. User sends a multi-intent message
 * 2. MainOrchestrator processes the message
 * 3. MultiIntentClassifier detects intents
 * 4. Task Handlers process each intent
 * 5. ConversationOrchestrator generates a unified response
 * 
 * This verifies that all components work together seamlessly.
 */

// Mock UserContext
const mockUserContext: UserContext = {
  id: 'test-user-id',
  channelUserId: '+1234567890',
  businessId: '228c7e8e-ec15-4eeb-a766-d1ebee07104f',
  currentGoal: null,
  previousGoal: null,
  participantPreferences: null,
  frequentlyDiscussedTopics: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Mock handler implementations
jest.mock('./handlers/booking-manager', () => ({
  BookingManager: {
    processIntent: jest.fn().mockResolvedValue({
      response: '✅ Yes, I have availability tomorrow at 2pm for a gel manicure. Would you like to book it?',
      shouldUpdateContext: true,
      contextUpdates: { activeBooking: { serviceName: 'gel manicure', date: 'tomorrow', time: '2pm', status: 'collecting_info' } },
      buttons: [{ buttonText: '✅ Yes, book it', buttonValue: 'book_tomorrow_2pm' }]
    })
  }
}));

jest.mock('./handlers/faq-handler', () => ({
  FAQHandler: {
    processIntent: jest.fn().mockResolvedValue({
      response: 'A gel manicure costs $45 and lasts for 2-3 weeks. 💅',
      shouldUpdateContext: false,
      buttons: [{ buttonText: '💰 View all pricing', buttonValue: 'view_pricing' }]
    })
  }
}));

jest.mock('./handlers/chitchat-handler', () => ({
  ChitchatHandler: {
    processIntent: jest.fn().mockResolvedValue({
      response: 'Hello there! 👋',
      shouldUpdateContext: false,
      buttons: [{ buttonText: '🛍️ View services', buttonValue: 'view_services' }]
    })
  }
}));

async function runEndToEndTest() {
  console.log('🚀 Running End-to-End V2 Pipeline Test...\n');
  
  const userMessage = 'Hi! How much does a gel manicure cost? I want to book one for tomorrow at 2pm.';
  
  // Step 1: Simulate input creation (as done in the webhook)
  const conversationInput = {
    userMessage,
    userContext: mockUserContext,
    currentDialogueState: null,
    chatHistory: [],
    sessionId: 'test-session-id'
  };

  // Step 2: Run the main orchestrator
  const output = await MainOrchestrator.processConversation(conversationInput);

  // Step 3: Verify the output
  console.log(`📝 User Message: "${userMessage}"\n`);
  console.log(`🤖 Unified Response: "${output.response}"\n`);
  console.log('🔘 Buttons:');
  output.buttons.forEach(btn => console.log(`   - ${btn.buttonText} (${btn.buttonValue})`));
  console.log('\n');
  console.log('📊 Context Updates:', output.updatedDialogueState);

  // Assertions
  if (!output.response.includes('$45') || !output.response.includes('tomorrow at 2pm')) {
    throw new Error('Response should contain both FAQ and booking information');
  }
  
  if (output.buttons.length !== 3) {
    throw new Error('Should have exactly 3 buttons after prioritization');
  }
  
  if (!output.buttons[0]?.buttonValue.includes('book')) {
    throw new Error('Booking button should be prioritized first');
  }
  
  if (!output.updatedDialogueState.activeBooking) {
    throw new Error('Context should be updated with active booking');
  }

  console.log('\n🎉 End-to-End Test Passed! The V2 pipeline is fully integrated and working as expected.');
  return true;
}

export { runEndToEndTest };

if (require.main === module) {
  runEndToEndTest().catch(console.error);
} 