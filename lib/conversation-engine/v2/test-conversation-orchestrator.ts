import { ConversationOrchestrator } from './conversation-orchestrator';
import { 
  DetectedIntent, 
  DialogueState, 
  TaskHandlerResult, 
  ButtonConfig, 
  MultiIntentResult, 
  ChitchatIntent, 
  FAQIntent, 
  BookingIntent 
} from './nlu/types';
import { UserContext } from '@/lib/database/models/user-context';

/**
 * Comprehensive test suite for ConversationOrchestrator
 * Tests multi-intent fusion, booking conflicts, priority handling, and unified response generation
 */

// Mock UserContext for testing
const mockUserContext: UserContext = {
  id: 'test-id',
  channelUserId: '+1234567890',
  businessId: '228c7e8e-ec15-4eeb-a766-d1ebee07104f',
  currentGoal: null,
  previousGoal: null,
  participantPreferences: null,
  frequentlyDiscussedTopics: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
} as UserContext;

async function runConversationOrchestratorTests() {
  console.log('🎭 Starting ConversationOrchestrator Tests...\n');
  
  const tests = [
    testSingleBookingIntent,
    testMultiIntentBookingChitchat,
    testBookingConflictResolution,
    testButtonPrioritization,
    testFallbackHandling
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`🧪 Running ${test.name}...`);
      await test();
      console.log(`✅ ${test.name} PASSED\n`);
      passed++;
    } catch (error) {
      console.error(`❌ ${test.name} FAILED:`, error);
      console.error('');
      failed++;
    }
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All ConversationOrchestrator tests passed!');
  }
  
  return failed === 0;
}

// TEST 1: Single Booking Intent
async function testSingleBookingIntent() {
  const handlerResults: TaskHandlerResult[] = [{
    response: '✅ Yes! I have availability on Friday at 2pm. Would you like to book it?',
    shouldUpdateContext: true,
    contextUpdates: {
      activeBooking: {
        date: '2024-01-15',
        time: '14:00',
        serviceName: 'gel manicure',
        status: 'collecting_info' as const,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
      }
    },
    buttons: [
      { buttonText: '✅ Yes, book it', buttonValue: 'book_2024-01-15_14:00' },
      { buttonText: '📅 See other times', buttonValue: 'browse_times_2024-01-15' }
    ]
  }];
  
  const detectedIntents: DetectedIntent[] = [{
    type: 'booking',
    data: { date: 'Friday', time: '2pm', serviceInquiry: 'gel manicure', checkingAvailability: true },
    priority: 1,
    handlerName: 'BookingManager'
  }];
  
  const classificationResult: MultiIntentResult = {
    intents: detectedIntents,
    bookingContext: {
      hasActiveBooking: false,
      shouldUpdateBooking: false,
      shouldCreateNewBooking: true,
      slotsDetected: ['date', 'time', 'service']
    }
  };
  
  const result = await ConversationOrchestrator.generateUnifiedResponse(
    handlerResults,
    detectedIntents,
    classificationResult,
    null,
    mockUserContext,
    'Do you have time Friday at 2pm for a gel manicure?'
  );
  
  // Assertions
  if (!result.response.includes('Friday') && !result.response.includes('2pm')) {
    throw new Error('Response should include booking details');
  }
  
  if (!result.buttons || result.buttons.length === 0) {
    throw new Error('Should have booking buttons');
  }
  
  if (!result.contextUpdates?.activeBooking) {
    throw new Error('Should update booking context');
  }
}

// TEST 2: Multi-Intent Booking + Chitchat
async function testMultiIntentBookingChitchat() {
  const handlerResults: TaskHandlerResult[] = [
    {
      response: '✅ Yes! I have availability tomorrow at 3pm. Would you like to book it?',
      shouldUpdateContext: true,
      contextUpdates: {
        activeBooking: {
          date: '2024-01-16',
          time: '15:00',
          serviceName: 'manicure',
          status: 'collecting_info' as const,
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        }
      },
      buttons: [
        { buttonText: '✅ Yes, book it', buttonValue: 'book_2024-01-16_15:00' }
      ]
    },
    {
      response: 'Hi there! 😊',
      shouldUpdateContext: false,
      buttons: [
        { buttonText: '🛍️ View Services', buttonValue: 'view_services' }
      ]
    }
  ];
  
  const detectedIntents: DetectedIntent[] = [
    {
      type: 'booking',
      data: { date: 'tomorrow', time: '3pm', serviceInquiry: 'manicure', checkingAvailability: true },
      priority: 1,
      handlerName: 'BookingManager'
    },
    {
      type: 'chitchat',
      data: { greeting: true },
      priority: 2,
      handlerName: 'ChitchatHandler'
    }
  ];
  
  const classificationResult: MultiIntentResult = {
    intents: detectedIntents,
    bookingContext: {
      hasActiveBooking: false,
      shouldUpdateBooking: false,
      shouldCreateNewBooking: true,
      slotsDetected: ['date', 'time', 'service']
    }
  };
  
  const result = await ConversationOrchestrator.generateUnifiedResponse(
    handlerResults,
    detectedIntents,
    classificationResult,
    null,
    mockUserContext,
    'Hi! Do you have time tomorrow at 3pm for a manicure?'
  );
  
  // Assertions
  if (!result.response.includes('tomorrow') && !result.response.includes('3pm')) {
    throw new Error('Response should prioritize booking over greeting');
  }
  
  if (!result.buttons?.some(btn => btn.buttonValue.includes('book'))) {
    throw new Error('Should prioritize booking buttons');
  }
  
  if (!result.contextUpdates?.activeBooking) {
    throw new Error('Should update booking context');
  }
}

// TEST 3: Booking Conflict Resolution
async function testBookingConflictResolution() {
  const existingContext: DialogueState = {
    activeBooking: {
      userName: 'Sarah',
      serviceName: 'Basic Manicure',
      date: '2024-01-15',
      time: '10:00',
      status: 'collecting_info',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString()
    },
    lastActivityAt: new Date().toISOString()
  };
  
  const handlerResults: TaskHandlerResult[] = [{
    response: '✅ Yes! I have availability Friday at 3pm. Would you like to book it?',
    shouldUpdateContext: true,
    contextUpdates: {
      activeBooking: {
        date: '2024-01-18',
        time: '15:00',
        serviceName: 'gel manicure',
        status: 'collecting_info' as const,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
      }
    },
    buttons: [
      { buttonText: '✅ Yes, book it', buttonValue: 'book_2024-01-18_15:00' }
    ]
  }];
  
  const detectedIntents: DetectedIntent[] = [{
    type: 'booking',
    data: { date: 'Friday', time: '3pm', serviceInquiry: 'gel manicure', checkingAvailability: true },
    priority: 1,
    handlerName: 'BookingManager'
  }];
  
  const classificationResult: MultiIntentResult = {
    intents: detectedIntents,
    bookingContext: {
      hasActiveBooking: true,
      shouldUpdateBooking: false,
      shouldCreateNewBooking: false,
      slotsDetected: ['date', 'time', 'service']
    }
  };
  
  const result = await ConversationOrchestrator.generateUnifiedResponse(
    handlerResults,
    detectedIntents,
    classificationResult,
    existingContext,
    mockUserContext,
    'Do you have time Friday at 3pm for a gel manicure?'
  );
  
  // Assertions
  if (!result.response.includes('existing booking') && !result.response.includes('Basic Manicure')) {
    throw new Error('Response should mention existing booking conflict');
  }
  
  if (!result.buttons?.some(btn => btn.buttonValue.includes('modify'))) {
    throw new Error('Should provide booking conflict resolution buttons');
  }
  
  if (!result.contextUpdates?.bookingConflict) {
    throw new Error('Should set booking conflict context');
  }
}

// TEST 4: Button Prioritization
async function testButtonPrioritization() {
  const handlerResults: TaskHandlerResult[] = [
    {
      response: 'Booking response',
      shouldUpdateContext: true,
      buttons: [
        { buttonText: '✅ Book it', buttonValue: 'book_service' },
        { buttonText: '📅 Check availability', buttonValue: 'check_availability' }
      ]
    },
    {
      response: 'FAQ response',
      shouldUpdateContext: false,
      buttons: [
        { buttonText: '💰 Check pricing', buttonValue: 'view_pricing' },
        { buttonText: '🛍️ View services', buttonValue: 'view_services' }
      ]
    }
  ];
  
  const detectedIntents: DetectedIntent[] = [
    { type: 'booking', data: {}, priority: 1, handlerName: 'BookingManager' },
    { type: 'faq', data: {}, priority: 2, handlerName: 'FAQHandler' }
  ];
  
  const classificationResult: MultiIntentResult = {
    intents: detectedIntents,
    bookingContext: {
      hasActiveBooking: false,
      shouldUpdateBooking: false,
      shouldCreateNewBooking: false,
      slotsDetected: []
    }
  };
  
  const result = await ConversationOrchestrator.generateUnifiedResponse(
    handlerResults,
    detectedIntents,
    classificationResult,
    null,
    mockUserContext,
    'Complex message with multiple intents'
  );
  
  // Assertions
  if (!result.buttons) {
    throw new Error('Should have buttons');
  }
  
  // Should prioritize booking buttons first
  const bookingButtons = result.buttons.filter(btn => 
    btn.buttonValue.includes('book') || btn.buttonValue.includes('availability')
  );
  
  if (bookingButtons.length === 0) {
    throw new Error('Should prioritize booking buttons');
  }
  
  if (result.buttons.length > 3) {
    throw new Error('Should limit to 3 buttons for WhatsApp');
  }
}

// TEST 5: Fallback Handling
async function testFallbackHandling() {
  // Test with empty handler results
  const result = await ConversationOrchestrator.generateUnifiedResponse(
    [],
    [],
    {
      intents: [],
      bookingContext: {
        hasActiveBooking: false,
        shouldUpdateBooking: false,
        shouldCreateNewBooking: false,
        slotsDetected: []
      }
    },
    null,
    mockUserContext,
    'Some message'
  );
  
  // Assertions
  if (!result.response) {
    throw new Error('Should provide fallback response');
  }
  
  if (!result.buttons || result.buttons.length === 0) {
    throw new Error('Should provide fallback buttons');
  }
  
  if (!result.contextUpdates?.lastActivityAt) {
    throw new Error('Should update lastActivityAt even in fallback');
  }
}

// Export for use in other test files or direct execution
export { runConversationOrchestratorTests };

// Auto-run if this file is executed directly
if (require.main === module) {
  runConversationOrchestratorTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
} 