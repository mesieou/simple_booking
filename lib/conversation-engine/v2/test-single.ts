import { MultiIntentClassifier } from './nlu/multi-intent-classifier';
import { DialogueState } from './nlu/types';

// Mock context for testing context-aware scenarios
const mockActiveBookingContext: DialogueState = {
  activeBooking: {
    userName: 'Sarah',
    serviceName: 'gel manicure',
    date: 'Tuesday',
    time: '15:00',
    status: 'collecting_info',
    createdAt: '2024-01-15T10:00:00Z',
    lastUpdatedAt: '2024-01-15T10:00:00Z'
  },
  userEmail: 'sarah@example.com',
  lastActivityAt: '2024-01-15T10:00:00Z'
};

// Helper function to test a message
async function testMessage(
  testName: string,
  userMessage: string,
  expectedIntents: string[],
  currentContext: DialogueState | null = null
) {
  console.log(`\n=== ${testName} ===`);
  console.log(`User: "${userMessage}"`);
  console.log(`Expected: ${expectedIntents.join(', ')}`);
  
  try {
    const result = await MultiIntentClassifier.analyzeMessage(userMessage, currentContext);
    
    console.log('\nDetected Intents:');
    result.intents.forEach((intent, index) => {
      console.log(`${index + 1}. ${intent.type}: ${JSON.stringify(intent.data)}`);
    });
    
    // Check if we got the expected intents
    const actualTypes = result.intents.map(i => i.type);
    const success = expectedIntents.every(expected => actualTypes.includes(expected as any)) && 
                   actualTypes.length === expectedIntents.length;
    
    console.log(`\n✅ Expected: [${expectedIntents.join(', ')}]`);
    console.log(`${success ? '✅' : '❌'} Actual: [${actualTypes.join(', ')}]`);
    console.log(`${success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (result.bookingContext.shouldCreateNewBooking || result.bookingContext.shouldUpdateBooking) {
      console.log(`📝 Booking Action: ${result.bookingContext.shouldCreateNewBooking ? 'CREATE' : 'UPDATE'}`);
      console.log(`🎯 Slots Detected: [${result.bookingContext.slotsDetected.join(', ')}]`);
    }
    
    return success;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

// Test all scenarios
async function runComprehensiveTests() {
  console.log('🧪 COMPREHENSIVE MULTI-INTENT CLASSIFIER TESTS\n');
  console.log('Testing all possible intent combinations, merge logic, and edge cases...\n');
  
  const results: { test: string; passed: boolean; category: string }[] = [];
  
  const testCases = [
    // Single intent tests
    { 
      message: "Hi there!", 
      expected: ['chitchat'],
      description: "Simple Greeting"
    },
    { 
      message: "Thank you so much!", 
      expected: ['chitchat'],
      description: "Simple Thanks"
    },
    { 
      message: "What are your opening hours?", 
      expected: ['faq'],
      description: "Simple FAQ"
    },
    { 
      message: "Do you do gel manicures?", 
      expected: ['faq'],
      description: "Service Question"
    },
    { 
      message: "How much does a pedicure cost?", 
      expected: ['faq'],
      description: "Pricing Question"
    },
    { 
      message: "Do you have time Thursday at 8pm?", 
      expected: ['booking'],
      description: "Simple Availability Check"
    },
    { 
      message: "I want to book a manicure", 
      expected: ['booking'],
      description: "Basic Booking Intent"
    },

    // Dual intent tests
    { 
      message: "Hi! What services do you offer?", 
      expected: ['chitchat', 'faq'],
      description: "Greeting + FAQ"
    },
    { 
      message: "Hello! I'd like to book an appointment", 
      expected: ['chitchat', 'booking'],
      description: "Greeting + Booking"
    },
    { 
      message: "Do you do eyebrow threading? I'd like to book one", 
      expected: ['faq', 'booking'],
      description: "FAQ + Booking"
    },
    { 
      message: "Thanks! Also, what's your cancellation policy?", 
      expected: ['chitchat', 'faq'],
      description: "Thanks + FAQ"
    },

    // MERGE LOGIC TESTS - Critical cases that should produce single booking intent
    { 
      message: "Do you have time Friday at 2pm? I want to book it", 
      expected: ['booking'],
      description: "Availability + Booking (Primary Merge Test)"
    },
    { 
      message: "Are you available tomorrow at 3pm? I'd like to make an appointment", 
      expected: ['booking'],
      description: "Availability + Appointment Request"
    },
    { 
      message: "Can you fit me in Monday morning? I need to book", 
      expected: ['booking'],
      description: "Availability Check + Booking Need"
    },
    { 
      message: "Do you have any slots Thursday? I want to schedule something", 
      expected: ['booking'],
      description: "Slot Inquiry + Schedule Request"
    },
    { 
      message: "Is there availability this weekend? I'd love to book", 
      expected: ['booking'],
      description: "Weekend Availability + Booking Desire"
    },

    // Triple intent tests
    { 
      message: "Hi! I'm Sarah. Do you do gel manicures? Can I book Tuesday at 3pm?", 
      expected: ['chitchat', 'faq', 'booking'],
      description: "Greeting + FAQ + Booking"
    },
    { 
      message: "Thanks! Do you do eyebrow threading? Can we make it 4pm instead?", 
      expected: ['chitchat', 'faq', 'booking'],
      description: "Thanks + FAQ + Booking"
    },
    { 
      message: "Hi! Do you have time this Thursday? I want to book a pedicure", 
      expected: ['chitchat', 'booking'],
      description: "Greeting + Availability + Booking"
    },
    { 
      message: "Hello! What services do you offer? I need an appointment today", 
      expected: ['chitchat', 'faq', 'booking'],
      description: "Greeting + Service Inquiry + Urgent Booking"
    },

    // Booking slot detection tests
    { 
      message: "Hi, I'm Jessica", 
      expected: ['chitchat'],
      description: "Name Only"
    },
    { 
      message: "I want a manicure", 
      expected: ['booking'],
      description: "Service Only"
    },
    { 
      message: "Can I book something for tomorrow?", 
      expected: ['booking'],
      description: "Date Only"
    },
    { 
      message: "Is 3pm available?", 
      expected: ['booking'],
      description: "Time Only"
    },
    { 
      message: "Hi! I'm Maria. I want a gel manicure on Friday at 2pm", 
      expected: ['chitchat', 'booking'],
      description: "Complete Booking Info"
    },

    // Edge cases
    { 
      message: "Maybe tomorrow?", 
      expected: ['booking'],
      description: "Ambiguous Date Reference"
    },
    { 
      message: "Possibly next week?", 
      expected: ['booking'],
      description: "Tentative Future Date"
    },
    { 
      message: "Perhaps Monday morning?", 
      expected: ['booking'],
      description: "Uncertain Time Reference"
    },
    { 
      message: "Hmm, not sure", 
      expected: ['chitchat'],
      description: "Pure Uncertainty (No Time Reference)"
    },
    { 
      message: "What services do you offer? How much do they cost? Are you open weekends?", 
      expected: ['faq'],
      description: "Multiple Questions"
    },
    { 
      message: "Hey! Can u do nails? Need appointment asap", 
      expected: ['chitchat', 'faq', 'booking'],
      description: "Mixed Language/Casual"
    },
    { 
      message: "If you're available", 
      expected: ['booking'],
      description: "Conditional Availability"
    },
    { 
      message: "Depends on the time", 
      expected: ['booking'],
      description: "Time-Dependent Response"
    },
    { 
      message: "Maybe tomorrow?", 
      expected: ['booking'],
      description: "Ambiguous Response in Booking Context",
      context: mockActiveBookingContext
    }
  ];
  
  // Define test categories for better organization
  const testCategories = [
    { start: 0, end: 6, name: "🔹 SINGLE INTENT TESTS" },
    { start: 7, end: 10, name: "🔹 DUAL INTENT TESTS" },
    { start: 11, end: 15, name: "🔹 MERGE LOGIC TESTS (Critical)" },
    { start: 16, end: 19, name: "🔹 TRIPLE INTENT TESTS" },
    { start: 20, end: 24, name: "🔹 BOOKING SLOT DETECTION" },
    { start: 25, end: 32, name: "🔹 EDGE CASES & AMBIGUOUS REFERENCES" }
  ];
  
  let currentIndex = 0;
  
  for (const category of testCategories) {
    console.log(`\n${category.name}\n`);
    
    for (let i = category.start; i <= category.end && i < testCases.length; i++) {
      const testCase = testCases[i];
      const passed = await testMessage(
        testCase.description,
        testCase.message,
        testCase.expected,
        (testCase as any).context || null
      );
      results.push({
        test: testCase.description,
        passed,
        category: category.name
      });
      currentIndex++;
    }
  }
  
  // Process any remaining test cases
  for (let i = currentIndex; i < testCases.length; i++) {
    const testCase = testCases[i];
    const passed = await testMessage(
      testCase.description,
      testCase.message,
      testCase.expected,
      (testCase as any).context || null
    );
    results.push({
      test: testCase.description,
      passed,
      category: "🔹 ADDITIONAL TESTS"
    });
  }
  
  // SUMMARY
  console.log('\n' + '='.repeat(70));
  console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('='.repeat(70));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);
  
  console.log(`\n🎯 Overall Success Rate: ${passed}/${total} (${percentage}%)`);
  
  // Category breakdown
  console.log('\n📋 Results by Category:');
  for (const category of testCategories) {
    const categoryResults = results.filter(r => r.category === category.name);
    const categoryPassed = categoryResults.filter(r => r.passed).length;
    const categoryTotal = categoryResults.length;
    const categoryPercentage = categoryTotal > 0 ? Math.round((categoryPassed / categoryTotal) * 100) : 0;
    
    if (categoryTotal > 0) {
      console.log(`   ${category.name}: ${categoryPassed}/${categoryTotal} (${categoryPercentage}%)`);
    }
  }
  
  // Highlight critical merge logic results
  const mergeResults = results.filter(r => r.category === "🔹 MERGE LOGIC TESTS (Critical)");
  const mergePassed = mergeResults.filter(r => r.passed).length;
  const mergeTotal = mergeResults.length;
  console.log(`\n🔄 MERGE LOGIC SUCCESS RATE: ${mergePassed}/${mergeTotal} (${Math.round((mergePassed / mergeTotal) * 100)}%)`);
  
  if (passed === total) {
    console.log('\n🎉 ALL TESTS PASSED! The classifier is working perfectly.');
  } else {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.test} (${r.category})`);
    });
    
    // Highlight failed merge logic tests
    const failedMergeTests = mergeResults.filter(r => !r.passed);
    if (failedMergeTests.length > 0) {
      console.log('\n🚨 CRITICAL: Failed Merge Logic Tests:');
      failedMergeTests.forEach(r => {
        console.log(`   - ${r.test}`);
      });
    }
  }
  
  console.log('\n' + '='.repeat(70));
}

// Run all tests
runComprehensiveTests(); 