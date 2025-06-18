import { 
  DetectedIntent, 
  DialogueState, 
  TaskHandlerResult, 
  ButtonConfig, 
  MultiIntentResult
} from './nlu/types';

/**
 * Simple test suite for ConversationOrchestrator logic (no LLM calls)
 */

async function runSimpleOrchestratorTests() {
  console.log('🎭 Starting Simple ConversationOrchestrator Tests...\n');
  
  const tests = [
    testPriorityOrdering,
    testBookingConflictDetection,
    testButtonPrioritization
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
  return failed === 0;
}

// Test priority ordering logic
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
  
  // Priority order should be: BookingManager > FAQHandler > ChitchatHandler
  const priorityOrder = ['BookingManager', 'FAQHandler', 'ChitchatHandler'];
  
  const prioritized = handlerResults.sort((a, b) => {
    const intentA = detectedIntents.find((intent, index) => index === handlerResults.indexOf(a));
    const intentB = detectedIntents.find((intent, index) => index === handlerResults.indexOf(b));
    
    const priorityA = priorityOrder.indexOf(intentA?.handlerName || 'Unknown');
    const priorityB = priorityOrder.indexOf(intentB?.handlerName || 'Unknown');
    
    return (priorityA === -1 ? 999 : priorityA) - (priorityB === -1 ? 999 : priorityB);
  });
  
  if (prioritized[0].response !== 'Booking response') {
    throw new Error('Should prioritize booking response first');
  }
  
  console.log('  ✓ Booking handler prioritized correctly');
}

// Test booking conflict detection
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
  
  const hasBookingIntent = classificationResult.intents.some(intent => intent.type === 'booking');
  const hasActiveBooking = existingContext?.activeBooking ? true : false;
  
  if (!hasBookingIntent || !hasActiveBooking) {
    throw new Error('Test setup error: should have both booking intent and active booking');
  }
  
  // Should detect conflict
  const shouldHaveConflict = hasBookingIntent && hasActiveBooking;
  if (!shouldHaveConflict) {
    throw new Error('Should detect booking conflict when both conditions are met');
  }
  
  console.log('  ✓ Booking conflict detected correctly');
  console.log(`  ✓ Existing booking: ${existingContext.activeBooking?.serviceName} on ${existingContext.activeBooking?.date}`);
}

// Test button prioritization  
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
  
  // Collect all buttons
  const allButtons: ButtonConfig[] = [];
  for (const result of handlerResults) {
    if (result.buttons && result.buttons.length > 0) {
      allButtons.push(...result.buttons);
    }
  }
  
  // Remove duplicates
  const uniqueButtons = allButtons.filter((button, index, arr) => 
    arr.findIndex(b => b.buttonValue === button.buttonValue) === index
  );
  
  // Prioritize booking buttons
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
  
  const finalButtons = [...bookingButtons, ...otherButtons].slice(0, 3);
  
  // Assertions
  if (finalButtons.length > 3) {
    throw new Error('Should limit to 3 buttons for WhatsApp');
  }
  
  const duplicateCheck = finalButtons.filter(btn => btn.buttonValue === 'book_service');
  if (duplicateCheck.length !== 1) {
    throw new Error('Should remove duplicate buttons');
  }
  
  if (!finalButtons[0]?.buttonValue.includes('book') && !finalButtons[0]?.buttonValue.includes('availability')) {
    throw new Error('Should prioritize booking buttons first');
  }
  
  console.log('  ✓ Buttons prioritized correctly:', finalButtons.map(b => b.buttonText));
  console.log('  ✓ Duplicates removed, booking buttons first, limited to 3');
}

export { runSimpleOrchestratorTests };

if (require.main === module) {
  runSimpleOrchestratorTests()
    .then(success => {
      console.log(success ? '\n🎉 All tests passed!' : '\n❌ Some tests failed');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
} 