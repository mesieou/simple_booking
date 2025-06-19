// Mock environment variables at the top
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Mock the dependencies at the top level
jest.mock('./nlu/multi-intent-classifier', () => ({
  MultiIntentClassifier: {
    analyzeMessage: jest.fn()
  }
}));

jest.mock('./handlers/booking-manager', () => ({
  BookingManager: {
    processIntent: jest.fn()
  }
}));

jest.mock('./handlers/faq-handler', () => ({
  FAQHandler: {
    processIntent: jest.fn()
  }
}));

jest.mock('./handlers/chitchat-handler', () => ({
  ChitchatHandler: {
    processIntent: jest.fn()
  }
}));

jest.mock('./conversation-orchestrator', () => ({
  ConversationOrchestrator: {
    generateUnifiedResponse: jest.fn()
  }
}));

import { MainOrchestrator } from './main-orchestrator';
import { UserContext } from '@/lib/database/models/user-context';
import { 
  MultiIntentResult, 
  DetectedIntent, 
  DialogueState, 
  TaskHandlerResult, 
  ButtonConfig, 
  BookingIntent,
  FAQIntent,
  ChitchatIntent
} from './nlu/types';

const { MultiIntentClassifier } = require('./nlu/multi-intent-classifier');
const { BookingManager } = require('./handlers/booking-manager');
const { FAQHandler } = require('./handlers/faq-handler');
const { ChitchatHandler } = require('./handlers/chitchat-handler');
const { ConversationOrchestrator } = require('./conversation-orchestrator');

async function runV2PipelineDemo() {
  console.log('🚀 V2 Pipeline End-to-End Demo\n');
  
  // Mock UserContext for testing
  const mockUserContext: any = {
    id: 'demo-user',
    channelUserId: '+1234567890',
    businessId: '228c7e8e-ec15-4eeb-a766-d1ebee07104f',
    currentGoal: null,
    previousGoal: null,
    participantPreferences: null,
    frequentlyDiscussedTopics: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const userMessage = 'Hi there! I want to book a gel manicure for tomorrow. How much does it cost?';
  
  // --- Step 1: Mock Intent Classification ---
  const mockClassification: MultiIntentResult = {
    intents: [
      { type: 'chitchat', data: { greeting: true }, priority: 1, handlerName: 'ChitchatHandler' },
      { type: 'booking', data: { serviceInquiry: 'gel manicure', date: 'tomorrow' }, priority: 2, handlerName: 'BookingManager' },
      { type: 'faq', data: { questions: ['How much does it cost?'] }, priority: 3, handlerName: 'FAQHandler' }
    ],
    bookingContext: { hasActiveBooking: false, shouldUpdateBooking: false, shouldCreateNewBooking: true, slotsDetected: ['service', 'date'] }
  };
  (MultiIntentClassifier.analyzeMessage as jest.Mock).mockResolvedValue(mockClassification);

  // --- Step 2: Mock Handler Responses ---
  (ChitchatHandler.processIntent as jest.Mock).mockResolvedValue({
    response: 'Hi there! 👋',
    shouldUpdateContext: false,
    buttons: [{ buttonText: 'View Services', buttonValue: 'view_services' }]
  });
  
  (BookingManager.processIntent as jest.Mock).mockResolvedValue({
    response: 'I can help with booking your gel manicure for tomorrow. What time works for you?',
    shouldUpdateContext: true,
    contextUpdates: { activeBooking: { serviceName: 'gel manicure', date: 'tomorrow', status: 'collecting_info' } },
    buttons: [{ buttonText: 'See Times', buttonValue: 'browse_times' }]
  });
  
  (FAQHandler.processIntent as jest.Mock).mockResolvedValue({
    response: 'A gel manicure is $45 and lasts for 2-3 weeks.',
    shouldUpdateContext: false,
    buttons: [{ buttonText: 'View Pricing', buttonValue: 'view_pricing' }]
  });

  // --- Step 3: Mock Orchestrator Response ---
  (ConversationOrchestrator.generateUnifiedResponse as jest.Mock).mockImplementation(
    (handlerResults, intents) => {
      // Simulate merging logic
      const bookingResponse = handlerResults.find((r: TaskHandlerResult) => r.response.includes('booking'))?.response || '';
      const faqResponse = handlerResults.find((r: TaskHandlerResult) => r.response.includes('$45'))?.response || '';
      const chitchatResponse = handlerResults.find((r: TaskHandlerResult) => r.response.includes('Hi'))?.response || '';

      const finalResponse = `${chitchatResponse} ${faqResponse} ${bookingResponse}`;
      
      const allButtons = handlerResults.flatMap((r: TaskHandlerResult) => r.buttons || []);
      const bookingButtons = allButtons.filter((b: ButtonConfig) => b.buttonValue.includes('book') || b.buttonValue.includes('browse'));
      const otherButtons = allButtons.filter((b: ButtonConfig) => !bookingButtons.includes(b));
      
      const finalButtons = [...bookingButtons, ...otherButtons].slice(0, 3);
      
      return Promise.resolve({
        response: finalResponse,
        buttons: finalButtons,
        contextUpdates: handlerResults.find((r: TaskHandlerResult) => r.shouldUpdateContext)?.contextUpdates || {}
      });
    }
  );

  // --- Run the Main Orchestrator ---
  const conversationInput = {
    userMessage,
    userContext: mockUserContext,
    currentDialogueState: null,
    chatHistory: [],
    sessionId: 'demo-session-123'
  };

  const output = await MainOrchestrator.processConversation(conversationInput);

  // --- Display Results ---
  console.log('📝 User Message:', userMessage);
  console.log('\n🧠 Detected Intents:');
  mockClassification.intents.forEach(intent => console.log(` - ${intent.type}`));
  
  console.log('\n⚙️ Handler Responses:');
  console.log(' - Chitchat: "Hi there! 👋"');
  console.log(' - Booking: "I can help with booking..."');
  console.log(' - FAQ: "A gel manicure is $45..."');
  
  console.log('\n🎭 Orchestrated Response:');
  console.log(`💬: "${output.response}"`);
  
  console.log('\n🔘 Final Buttons:');
  output.buttons.forEach(btn => console.log(` - [${btn.buttonText}]`));
  
  console.log('\n📊 Final Context:');
  console.log(JSON.stringify(output.updatedDialogueState, null, 2));
}

if (require.main === module) {
  runV2PipelineDemo();
} 