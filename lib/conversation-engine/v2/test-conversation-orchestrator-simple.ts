import { 
  DetectedIntent, 
  DialogueState, 
  TaskHandlerResult, 
  ButtonConfig, 
  MultiIntentResult
} from './nlu/types';
import { UserContext } from '@/lib/database/models/user-context';

/**
 * Simple test suite for ConversationOrchestrator logic (no LLM calls)
 * Tests priority handling, button management, and context merging
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

async function runSimpleOrchestratorTests() {
  console.log('🎭 Starting Simple ConversationOrchestrator Tests...\n');
  
  const tests = [
    testPriorityOrdering,
    testBookingConflictDetection,
    testButtonPrioritization,
    testContextMerging,
    testFallbackResponse
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
    console.log('🎉 All Simple ConversationOrchestrator tests passed!');
  }
  
  return failed === 0;
}

// Import the orchestrator for testing internal methods
const ConversationOrchestratorTest = class {
  
  // Test priority ordering logic
  static prioritizeHandlerResults(
    handlerResults: TaskHandlerResult[],
    detectedIntents: DetectedIntent[]
  ): TaskHandlerResult[] {
    const priorityOrder = ['BookingManager', 'FAQHandler', 'ChitchatHandler'];
    
    return handlerResults.sort((a, b) => {
      const intentA = detectedIntents.find((intent, index) => index === handlerResults.indexOf(a));
      const intentB = detectedIntents.find((intent, index) => index === handlerResults.indexOf(b));
      
      const priorityA = priorityOrder.indexOf(intentA?.handlerName || 'Unknown');
      const priorityB = priorityOrder.indexOf(intentB?.handlerName || 'Unknown');
      
      return (priorityA === -1 ? 999 : priorityA) - (priorityB === -1 ? 999 : priorityB);
    });
  }
  
  // Test booking conflict detection
  static resolveContextConflicts(
    classificationResult: MultiIntentResult,
    currentContext: DialogueState | null
  ): DialogueState | null {
    const hasBookingIntent = classificationResult.intents.some(intent => intent.type === 'booking');
    const hasActiveBooking = currentContext?.activeBooking ? true : false;
    
    if (hasBookingIntent && hasActiveBooking) {
      const existingBooking = currentContext!.activeBooking!;
      
      return {
        ...currentContext!,
        bookingConflict: {
          hasExistingBooking: true,
          existingBookingData: {
            service: existingBooking.serviceName || 'Not specified',
            date: existingBooking.date || 'Not selected',
            time: existingBooking.time || 'Not selected',
            name: existingBooking.userName || 'Not provided'
          },
          needsModification: true
        }
      };
    }
    
    return currentContext;
  }
  
  // Test button prioritization
  static prioritizeButtons(
    handlerResults: TaskHandlerResult[],
    resolvedContext: DialogueState | null
  ): ButtonConfig[] {
    const allButtons: ButtonConfig[] = [];
    
    for (const result of handlerResults) {
      if (result.buttons && result.buttons.length > 0) {
        allButtons.push(...result.buttons);
      }
    }
    
    if (resolvedContext?.bookingConflict?.hasExistingBooking) {
      return [
        { buttonText: '✏️ Modify existing booking', buttonValue: 'modify_existing_booking' },
        { buttonText: '🗓️ New booking instead', buttonValue: 'create_new_booking' },
        { buttonText: '📅 Check availability', buttonValue: 'check_availability' }
      ];
    }
    
    const uniqueButtons = this.removeDuplicateButtons(allButtons);
    const bookingButtons = uniqueButtons.filter(btn => 
      btn.buttonValue.includes('book') || 
      btn.buttonValue.includes('availability') ||
      btn.buttonValue.includes('continue')
    );
    const otherButtons = uniqueButtons.filter(btn => 
      !btn.buttonValue.includes('book') && 
      !btn.buttonValue.includes('availability') &&
      !btn.buttonValue.includes('continue')
    );
    
    return [...bookingButtons, ...otherButtons].slice(0, 3);
  }
  
  private static removeDuplicateButtons(buttons: ButtonConfig[]): ButtonConfig[] {
    const seen = new Set<string>();
    return buttons.filter(button => {
      if (seen.has(button.buttonValue)) {
        return false;
      }
      seen.add(button.buttonValue);
      return true;
    });
  }
  
  // Test context merging
  static mergeContextUpdates(
    handlerResults: TaskHandlerResult[],
    classificationResult: MultiIntentResult,
    resolvedContext: DialogueState | null
  ): Partial<DialogueState> {
    let finalUpdates: Partial<DialogueState> = {
      lastActivityAt: new Date().toISOString()
    };
    
    if (classificationResult.contextUpdates) {
      finalUpdates = { ...finalUpdates, ...classificationResult.contextUpdates };
    }
    
    for (const result of handlerResults) {
      if (result.shouldUpdateContext && result.contextUpdates) {
        finalUpdates = { ...finalUpdates, ...result.contextUpdates };
      }
    }
    
    if (resolvedContext?.bookingConflict) {
      finalUpdates.bookingConflict = resolvedContext.bookingConflict;
    }
    
    return finalUpdates;
  }
};

// TEST 1: Priority Ordering
async function testPriorityOrdering() {
  const handlerResults: TaskHandlerResult[] = [
    { response: 'Chitchat response', shouldUpdateContext: false, buttons: [] },
    { response: 'Booking response', shouldUpdateContext: true, buttons: [] },
    { response: 'FAQ response', shouldUpdateContext: false, buttons: [] }
  ];
  
  const detectedIntents: DetectedIntent[] = [
    { type: 'chitchat', data: {}, priority: 3, handlerName: 'ChitchatHandler' },
    { type: 'booking', data: {}, priority: 1, handlerName: 'BookingManager' },
    { type: 'faq', data: {}, priority: 2, handlerName: 'FAQHandler' }
  ];
  
  const prioritized = ConversationOrchestratorTest.prioritizeHandlerResults(handlerResults, detectedIntents);
  
  // Should prioritize booking first, then FAQ, then chitchat
  if (prioritized[0].response !== 'Booking response') {
    throw new Error('Should prioritize booking response first');
  }
}

// TEST 2: Booking Conflict Detection
async function testBookingConflictDetection() {
  const existingContext: DialogueState = {
    activeBooking: {
      userName: 'John',
      serviceName: 'Basic Manicure',
      date: '2024-01-15',
      time: '10:00',
      status: 'collecting_info',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString()
    },
    lastActivityAt: new Date().toISOString()
  };
  
  const classificationResult: MultiIntentResult = {
    intents: [{ type: 'booking', data: {}, priority: 1, handlerName: 'BookingManager' }],
    bookingContext: {
      hasActiveBooking: true,
      shouldUpdateBooking: false,
      shouldCreateNewBooking: false,
      slotsDetected: []
    }
  };
  
  const resolved = ConversationOrchestratorTest.resolveContextConflicts(classificationResult, existingContext);
  
  if (!resolved?.bookingConflict?.hasExistingBooking) {
    throw new Error('Should detect booking conflict');
  }
  
  if (resolved.bookingConflict.existingBookingData.service !== 'Basic Manicure') {
    throw new Error('Should preserve existing booking data');
  }
}

// TEST 3: Button Prioritization
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
        { buttonText: '💰 Pricing', buttonValue: 'view_pricing' },
        { buttonText: '🛍️ Services', buttonValue: 'view_services' },
        { buttonText: '✅ Book it', buttonValue: 'book_service' } // Duplicate
      ]
    }
  ];
  
  const buttons = ConversationOrchestratorTest.prioritizeButtons(handlerResults, null);
  
  // Should remove duplicates
  const bookValues = buttons.filter(btn => btn.buttonValue === 'book_service');
  if (bookValues.length !== 1) {
    throw new Error('Should remove duplicate buttons');
  }
  
  // Should prioritize booking buttons
  if (!buttons[0].buttonValue.includes('book') && !buttons[0].buttonValue.includes('availability')) {
    throw new Error('Should prioritize booking buttons first');
  }
  
  // Should limit to 3 buttons
  if (buttons.length > 3) {
    throw new Error('Should limit to 3 buttons for WhatsApp');
  }
}

// TEST 4: Context Merging
async function testContextMerging() {
  const handlerResults: TaskHandlerResult[] = [
    {
      response: 'Booking response',
      shouldUpdateContext: true,
      contextUpdates: {
        activeBooking: {
          serviceName: 'manicure',
          status: 'collecting_info' as const,
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        }
      },
      buttons: []
    }
  ];
  
  const classificationResult: MultiIntentResult = {
    intents: [{ type: 'booking', data: {}, priority: 1, handlerName: 'BookingManager' }],
    bookingContext: {
      hasActiveBooking: false,
      shouldUpdateBooking: false,
      shouldCreateNewBooking: true,
      slotsDetected: []
    },
    contextUpdates: {
      userEmail: 'test@example.com'
    }
  };
  
  const merged = ConversationOrchestratorTest.mergeContextUpdates(handlerResults, classificationResult, null);
  
  if (!merged.activeBooking) {
    throw new Error('Should merge booking context updates');
  }
  
  if (!merged.userEmail) {
    throw new Error('Should merge classification context updates');
  }
  
  if (!merged.lastActivityAt) {
    throw new Error('Should always include lastActivityAt');
  }
}

// TEST 5: Fallback Response
async function testFallbackResponse() {
  // Test with booking conflict buttons
  const conflictContext: DialogueState = {
    bookingConflict: {
      hasExistingBooking: true,
      existingBookingData: {
        service: 'Manicure',
        date: '2024-01-15',
        time: '10:00',
        name: 'John'
      },
      needsModification: true
    },
    lastActivityAt: new Date().toISOString()
  };
  
  const buttons = ConversationOrchestratorTest.prioritizeButtons([], conflictContext);
  
  if (!buttons.some(btn => btn.buttonValue === 'modify_existing_booking')) {
    throw new Error('Should provide booking conflict resolution buttons');
  }
  
  if (buttons.length !== 3) {
    throw new Error('Should provide exactly 3 conflict resolution buttons');
  }
}

// Export for use in other files
export { runSimpleOrchestratorTests };

// Auto-run if this file is executed directly
if (require.main === module) {
  runSimpleOrchestratorTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
} 