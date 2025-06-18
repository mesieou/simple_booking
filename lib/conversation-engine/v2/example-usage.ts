import { MultiIntentClassifier } from './nlu/multi-intent-classifier';
import { DialogueState } from './nlu/types';

/**
 * Example usage of the Multi-Intent Classifier
 * 
 * This file demonstrates how the classifier handles various user inputs
 * and provides intelligent booking context analysis.
 */

// Example 1: Simple greeting (no active booking)
async function exampleSimpleGreeting() {
  console.log('\n=== Example 1: Simple Greeting ===');
  
  const userMessage = "Hi there!";
  const currentContext: DialogueState | null = null;
  
  const result = await MultiIntentClassifier.analyzeMessage(userMessage, currentContext);
  
  console.log('User:', userMessage);
  console.log('Detected Intents:', result.intents);
  console.log('Booking Context:', result.bookingContext);
  console.log('Context Updates:', result.contextUpdates);
  
  // Expected output:
  // - 1 chitchat intent (greeting)
  // - No booking context
  // - No context updates
}

// Example 2: Multi-intent message with booking info
async function exampleMultiIntent() {
  console.log('\n=== Example 2: Multi-Intent Message ===');
  
  const userMessage = "Hi! I'm Sarah. Do you do gel manicures? Can I book Tuesday at 3pm?";
  const currentContext: DialogueState | null = null;
  
  const result = await MultiIntentClassifier.analyzeMessage(userMessage, currentContext);
  
  console.log('User:', userMessage);
  console.log('Detected Intents:', result.intents);
  console.log('Booking Context:', result.bookingContext);
  console.log('Context Updates:', result.contextUpdates);
  
  // Expected output:
  // - 3 intents: chitchat (greeting), faq (gel manicures), booking (Sarah, Tuesday, 3pm)
  // - shouldCreateNewBooking: true
  // - slotsDetected: ['userName', 'service', 'date', 'time']
  // - Context updates with new activeBooking
}

// Example 3: Availability check
async function exampleAvailabilityCheck() {
  console.log('\n=== Example 3: Availability Check ===');
  
  const userMessage = "Do you have time this Thursday at 8pm?";
  const currentContext: DialogueState | null = null;
  
  const result = await MultiIntentClassifier.analyzeMessage(userMessage, currentContext);
  
  console.log('User:', userMessage);
  console.log('Detected Intents:', result.intents);
  console.log('Booking Context:', result.bookingContext);
  
  // Expected output:
  // - 1 availability_check intent
  // - shouldCreateNewBooking: true (availability check can lead to booking)
  // - Handler: AvailabilityHandler
}

// Example 4: Update existing booking
async function exampleBookingUpdate() {
  console.log('\n=== Example 4: Update Existing Booking ===');
  
  const userMessage = "Actually, can we change it to Friday instead?";
  const currentContext: DialogueState = {
    activeBooking: {
      userName: 'Sarah',
      serviceName: 'gel manicure',
      date: 'Tuesday',
      time: '15:00',
      status: 'collecting_info',
      createdAt: '2024-01-15T10:00:00Z',
      lastUpdatedAt: '2024-01-15T10:05:00Z'
    },
    lastActivityAt: '2024-01-15T10:05:00Z'
  };
  
  const result = await MultiIntentClassifier.analyzeMessage(userMessage, currentContext);
  
  console.log('User:', userMessage);
  console.log('Current Context:', currentContext);
  console.log('Detected Intents:', result.intents);
  console.log('Booking Context:', result.bookingContext);
  console.log('Context Updates:', result.contextUpdates);
  
  // Expected output:
  // - 1 booking intent (date change to Friday)
  // - shouldUpdateBooking: true
  // - Context updates with date changed to Friday
}

// Example 5: FAQ during active booking
async function exampleFAQDuringBooking() {
  console.log('\n=== Example 5: FAQ During Active Booking ===');
  
  const userMessage = "What's your cancellation policy?";
  const currentContext: DialogueState = {
    activeBooking: {
      userName: 'Sarah',
      serviceName: 'gel manicure',
      date: 'Tuesday',
      time: '15:00',
      status: 'collecting_info',
      createdAt: '2024-01-15T10:00:00Z',
      lastUpdatedAt: '2024-01-15T10:05:00Z'
    },
    lastActivityAt: '2024-01-15T10:05:00Z'
  };
  
  const result = await MultiIntentClassifier.analyzeMessage(userMessage, currentContext);
  
  console.log('User:', userMessage);
  console.log('Current Context:', currentContext);
  console.log('Detected Intents:', result.intents);
  console.log('Booking Context:', result.bookingContext);
  
  // Expected output:
  // - 1 faq intent (cancellation policy)
  // - hasActiveBooking: true
  // - shouldUpdateBooking: false (just asking question)
  // - No context updates (booking unchanged)
}

// Example 6: Complex multi-intent with existing booking
async function exampleComplexWithExistingBooking() {
  console.log('\n=== Example 6: Complex Multi-Intent with Existing Booking ===');
  
  const userMessage = "Thanks! Also, do you do eyebrow threading? And can we make it 4pm instead?";
  const currentContext: DialogueState = {
    activeBooking: {
      userName: 'Sarah',
      serviceName: 'gel manicure',
      date: 'Tuesday',
      time: '15:00',
      status: 'collecting_info',
      createdAt: '2024-01-15T10:00:00Z',
      lastUpdatedAt: '2024-01-15T10:05:00Z'
    },
    lastActivityAt: '2024-01-15T10:05:00Z'
  };
  
  const result = await MultiIntentClassifier.analyzeMessage(userMessage, currentContext);
  
  console.log('User:', userMessage);
  console.log('Current Context:', currentContext);
  console.log('Detected Intents:', result.intents);
  console.log('Booking Context:', result.bookingContext);
  console.log('Context Updates:', result.contextUpdates);
  
  // Expected output:
  // - 3 intents: chitchat (thanks), faq (eyebrow threading), booking (time change to 4pm)
  // - shouldUpdateBooking: true
  // - slotsDetected: ['time']
  // - Context updates with time changed to 16:00
}

// Run all examples
export async function runAllExamples() {
  console.log('🤖 Multi-Intent Classifier Examples\n');
  
  try {
    await exampleSimpleGreeting();
    await exampleMultiIntent();
    await exampleAvailabilityCheck();
    await exampleBookingUpdate();
    await exampleFAQDuringBooking();
    await exampleComplexWithExistingBooking();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Uncomment to run examples
runAllExamples(); 