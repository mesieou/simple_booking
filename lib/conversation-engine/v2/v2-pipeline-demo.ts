/**
 * V2 Pipeline Demo - Complete Integration Example
 * 
 * This demo shows how all V2 components work together:
 * 1. MultiIntentClassifier - Detects multiple intents per message
 * 2. Task Handlers (BookingManager, FAQHandler, ChitchatHandler) - Process each intent
 * 3. ConversationOrchestrator - Merges responses into unified output
 * 
 * The pipeline creates an intelligent human-like assistant that:
 * - Understands multiple intents per message
 * - Resumes interrupted tasks smoothly  
 * - Prevents booking conflicts
 * - Uses context to drive decisions
 * - Responds naturally and completely
 */

import { 
  DetectedIntent, 
  DialogueState, 
  TaskHandlerResult, 
  ButtonConfig, 
  MultiIntentResult,
  BookingIntent,
  FAQIntent,
  ChitchatIntent
} from './nlu/types';
import { UserContext } from '@/lib/database/models/user-context';

// Mock implementations for demo purposes
class MockMultiIntentClassifier {
  static async analyzeMessage(userMessage: string): Promise<MultiIntentResult> {
    const lowerMessage = userMessage.toLowerCase();
    const intents: DetectedIntent[] = [];
    
    // Detect chitchat
    if (lowerMessage.includes('hi') || lowerMessage.includes('hello')) {
      intents.push({
        type: 'chitchat',
        data: { greeting: true } as ChitchatIntent,
        priority: intents.length + 1,
        handlerName: 'ChitchatHandler'
      });
    }
    
    // Detect FAQ
    if (lowerMessage.includes('cost') || lowerMessage.includes('price') || lowerMessage.includes('gel manicure')) {
      intents.push({
        type: 'faq',
        data: { questions: ['How much do gel manicures cost?'], category: 'pricing' } as FAQIntent,
        priority: intents.length + 1,
        handlerName: 'FAQHandler'
      });
    }
    
    // Detect booking
    if (lowerMessage.includes('book') || lowerMessage.includes('appointment') || lowerMessage.includes('tomorrow')) {
      intents.push({
        type: 'booking',
        data: { 
          serviceInquiry: 'gel manicure',
          date: 'tomorrow',
          checkingAvailability: lowerMessage.includes('available') || lowerMessage.includes('time')
        } as BookingIntent,
        priority: intents.length + 1,
        handlerName: 'BookingManager'
      });
    }
    
    return {
      intents,
      bookingContext: {
        hasActiveBooking: false,
        shouldUpdateBooking: false,
        shouldCreateNewBooking: intents.some(i => i.type === 'booking'),
        slotsDetected: intents.some(i => i.type === 'booking') ? ['service', 'date'] : []
      }
    };
  }
}

class MockTaskHandlers {
  
  static async processChitchatIntent(): Promise<TaskHandlerResult> {
    return {
      response: 'Hi there! How can I help you today? 😊',
      shouldUpdateContext: false,
      buttons: [
        { buttonText: '📅 Check Availability', buttonValue: 'check_availability' },
        { buttonText: '🛍️ View Services', buttonValue: 'view_services' }
      ]
    };
  }
  
  static async processFAQIntent(): Promise<TaskHandlerResult> {
    return {
      response: 'Gel manicures start at $45 and last 2-3 weeks! Our gel polish comes in over 100 colors. 💅',
      shouldUpdateContext: false,
      buttons: [
        { buttonText: '📅 Book gel manicure', buttonValue: 'book_service_gel_manicure' },
        { buttonText: '💰 Check pricing', buttonValue: 'view_pricing' }
      ]
    };
  }
  
  static async processBookingIntent(): Promise<TaskHandlerResult> {
    return {
      response: '✅ Yes! I have availability tomorrow at 2pm for a gel manicure. Would you like to book it?',
      shouldUpdateContext: true,
      contextUpdates: {
        activeBooking: {
          serviceName: 'gel manicure',
          date: '2024-01-16',
          time: '14:00',
          status: 'collecting_info' as const,
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        }
      },
      buttons: [
        { buttonText: '✅ Yes, book it', buttonValue: 'book_2024-01-16_14:00' },
        { buttonText: '📅 See other times', buttonValue: 'browse_times_2024-01-16' }
      ]
    };
  }
}

class MockConversationOrchestrator {
  
  static async generateUnifiedResponse(
    handlerResults: TaskHandlerResult[],
    detectedIntents: DetectedIntent[],
    userMessage: string
  ): Promise<{
    response: string;
    buttons: ButtonConfig[];
    contextUpdates: Partial<DialogueState>;
  }> {
    
    // Apply priority: Booking > FAQ > Chitchat
    const priorityOrder = ['BookingManager', 'FAQHandler', 'ChitchatHandler'];
    const prioritized = handlerResults.sort((a, b) => {
      const intentA = detectedIntents.find((intent, index) => index === handlerResults.indexOf(a));
      const intentB = detectedIntents.find((intent, index) => index === handlerResults.indexOf(b));
      
      const priorityA = priorityOrder.indexOf(intentA?.handlerName || 'Unknown');
      const priorityB = priorityOrder.indexOf(intentB?.handlerName || 'Unknown');
      
      return (priorityA === -1 ? 999 : priorityA) - (priorityB === -1 ? 999 : priorityB);
    });
    
    // For demo, merge responses naturally
    let unifiedResponse = '';
    let contextUpdates: Partial<DialogueState> = {
      lastActivityAt: new Date().toISOString()
    };
    
    if (prioritized.length === 1) {
      unifiedResponse = prioritized[0].response;
      if (prioritized[0].contextUpdates) {
        contextUpdates = { ...contextUpdates, ...prioritized[0].contextUpdates };
      }
    } else if (prioritized.length > 1) {
      // Multi-intent: Start with highest priority, then weave in others
      const primary = prioritized[0];
      const secondary = prioritized[1];
      
      if (primary.response.includes('availability') && secondary.response.includes('$45')) {
        // Booking + FAQ fusion
        unifiedResponse = `${secondary.response.split('!')[0]}! ${primary.response}`;
      } else if (primary.response.includes('Hi') && secondary.response.includes('book')) {
        // Chitchat + Booking fusion  
        unifiedResponse = `Hi there! ${secondary.response}`;
      } else {
        // Default fusion
        unifiedResponse = `${primary.response} ${secondary.response}`;
      }
      
      // Merge context updates (booking takes priority)
      for (const result of prioritized) {
        if (result.shouldUpdateContext && result.contextUpdates) {
          contextUpdates = { ...contextUpdates, ...result.contextUpdates };
        }
      }
    }
    
    // Prioritize buttons: booking first, then others, max 3
    const allButtons: ButtonConfig[] = [];
    prioritized.forEach(result => {
      if (result.buttons) allButtons.push(...result.buttons);
    });
    
    const uniqueButtons = allButtons.filter((button, index, arr) => 
      arr.findIndex(b => b.buttonValue === button.buttonValue) === index
    );
    
    const bookingButtons = uniqueButtons.filter(btn => 
      btn.buttonValue.includes('book') || btn.buttonValue.includes('availability')
    );
    const otherButtons = uniqueButtons.filter(btn => 
      !btn.buttonValue.includes('book') && !btn.buttonValue.includes('availability')
    );
    
    const finalButtons = [...bookingButtons, ...otherButtons].slice(0, 3);
    
    return {
      response: unifiedResponse,
      buttons: finalButtons,
      contextUpdates
    };
  }
}

// Main V2 Pipeline Demo
async function runV2PipelineDemo() {
  console.log('🤖 V2 Pipeline Demo - Complete Integration\n');
  console.log('=' * 50);
  
  const testCases = [
    {
      name: 'Single Intent - Greeting',
      message: 'Hi there!'
    },
    {
      name: 'Single Intent - FAQ',
      message: 'How much do gel manicures cost?'
    },
    {
      name: 'Single Intent - Booking',
      message: 'Do you have availability tomorrow?'
    },
    {
      name: 'Multi-Intent - Greeting + FAQ',
      message: 'Hi! How much do gel manicures cost?'
    },
    {
      name: 'Multi-Intent - FAQ + Booking',
      message: 'How much do gel manicures cost? I want to book one for tomorrow.'
    },
    {
      name: 'Complex Multi-Intent',
      message: 'Hello! I love gel manicures. How much do they cost? Do you have time tomorrow?'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🎯 Test Case: ${testCase.name}`);
    console.log(`📝 User Message: "${testCase.message}"`);
    console.log(`\n🔍 STEP 1: Multi-Intent Classification`);
    
    // Step 1: Analyze message for multiple intents
    const classificationResult = await MockMultiIntentClassifier.analyzeMessage(testCase.message);
    
    console.log(`   Detected ${classificationResult.intents.length} intents:`);
    classificationResult.intents.forEach((intent, i) => {
      console.log(`   ${i + 1}. ${intent.type} (${intent.handlerName}) - Priority ${intent.priority}`);
    });
    
    console.log(`\n⚙️  STEP 2: Task Handler Processing`);
    
    // Step 2: Process each intent with appropriate handler
    const handlerResults: TaskHandlerResult[] = [];
    
    for (const intent of classificationResult.intents) {
      let result: TaskHandlerResult;
      
      console.log(`   Processing ${intent.type} intent...`);
      
      switch (intent.handlerName) {
        case 'ChitchatHandler':
          result = await MockTaskHandlers.processChitchatIntent();
          break;
        case 'FAQHandler':
          result = await MockTaskHandlers.processFAQIntent();
          break;
        case 'BookingManager':
          result = await MockTaskHandlers.processBookingIntent();
          break;
        default:
          result = { response: 'Unknown intent', shouldUpdateContext: false, buttons: [] };
      }
      
      handlerResults.push(result);
      console.log(`   ✓ ${intent.handlerName}: "${result.response.substring(0, 50)}..."`);
    }
    
    console.log(`\n🎭 STEP 3: Response Orchestration`);
    
    // Step 3: Generate unified response
    const finalResult = await MockConversationOrchestrator.generateUnifiedResponse(
      handlerResults,
      classificationResult.intents,
      testCase.message
    );
    
    console.log(`   Priority Applied: Booking > FAQ > Chitchat`);
    console.log(`   Buttons Merged: ${finalResult.buttons.length} unique buttons`);
    console.log(`   Context Updated: ${Object.keys(finalResult.contextUpdates).length} fields`);
    
    console.log(`\n💬 FINAL RESPONSE:`);
    console.log(`   "${finalResult.response}"`);
    
    if (finalResult.buttons.length > 0) {
      console.log(`\n🔘 BUTTONS:`);
      finalResult.buttons.forEach((btn, i) => {
        console.log(`   ${i + 1}. ${btn.buttonText} (${btn.buttonValue})`);
      });
    }
    
    if (Object.keys(finalResult.contextUpdates).length > 1) { // More than just lastActivityAt
      console.log(`\n📊 CONTEXT UPDATES:`);
      Object.entries(finalResult.contextUpdates).forEach(([key, value]) => {
        if (key !== 'lastActivityAt') {
          console.log(`   ${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`);
        }
      });
    }
    
    console.log(`\n` + '─'.repeat(50));
  }
  
  console.log(`\n🎉 Demo Complete! The V2 Pipeline demonstrates:`);
  console.log(`   ✅ Multi-intent detection and processing`);
  console.log(`   ✅ Priority-based response ordering (Booking > FAQ > Chitchat)`);
  console.log(`   ✅ Natural response fusion for multiple intents`);
  console.log(`   ✅ Smart button prioritization and deduplication`);
  console.log(`   ✅ Context-aware state management`);
  console.log(`   ✅ Human-like conversation flow`);
  
  return true;
}

// Export for use in other files
export { runV2PipelineDemo };

// Auto-run if this file is executed directly
if (require.main === module) {
  runV2PipelineDemo()
    .then(() => {
      console.log('\n✨ V2 Pipeline Demo completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Demo execution failed:', error);
      process.exit(1);
    });
} 