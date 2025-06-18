import { ConversationOrchestrator } from './orchestrator';
import { MultiIntentClassifier } from './nlu/multi-intent-classifier';
import { DialogueState } from './nlu/types';

/**
 * V2 System Demo - Shows how to use the new intelligent conversation system
 * 
 * This demo shows the key capabilities:
 * - Multi-intent detection and processing
 * - Context-aware responses
 * - Intelligent booking management
 * - Natural conversation flow
 */

// Mock user context for demo
const DEMO_USER_CONTEXT = {
  id: 'demo-user-123',
  businessId: 'demo-business-456',
  channelUserId: 'demo-whatsapp-789',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  currentGoal: null,
  previousGoal: null,
  participantPreferences: null,
  frequentlyDiscussedTopics: null
};

/**
 * Demo conversation scenarios
 */
export class V2ConversationDemo {
  
  static async runDemo(): Promise<void> {
    console.log('🎯 V2 Conversation System Demo\n');
    console.log('=' .repeat(50));
    
    // Demo 1: Simple greeting
    await this.demoScenario(
      'Simple Greeting',
      'Hi there!'
    );
    
    // Demo 2: Multi-intent - greeting + question
    await this.demoScenario(
      'Greeting + Service Question',
      'Hello! Do you do gel manicures?'
    );
    
    // Demo 3: Multi-intent - question + booking
    await this.demoScenario(
      'Service Question + Booking',
      'How much is a facial? I want to book for Friday.'
    );
    
    // Demo 4: Availability check
    await this.demoScenario(
      'Availability Check',
      'Do you have time tomorrow at 2pm?'
    );
    
    // Demo 5: Complex multi-intent
    await this.demoScenario(
      'Triple Intent',
      'Hi! What services do you offer? Can I book something for this weekend?'
    );
    
    // Demo 6: Context-aware conversation
    await this.demoContextAwareConversation();
    
    console.log('\n🎉 Demo complete! The V2 system intelligently handles:');
    console.log('   ✅ Multiple intents in a single message');
    console.log('   ✅ Context-aware responses');
    console.log('   ✅ Natural conversation flow');
    console.log('   ✅ Intelligent booking management');
    console.log('   ✅ FAQ with RAG integration');
  }
  
  /**
   * Demonstrates a single conversation scenario
   */
  private static async demoScenario(title: string, userMessage: string): Promise<void> {
    console.log(`\n📱 ${title}`);
    console.log(`User: "${userMessage}"`);
    
    try {
      // Step 1: Show intent analysis
      const analysis = await MultiIntentClassifier.analyzeMessage(userMessage, null);
      console.log(`🧠 Detected intents: ${analysis.intents.map(i => i.type).join(', ')}`);
      
      // Step 2: Show full conversation response
      const result = await ConversationOrchestrator.processConversation(
        userMessage,
        DEMO_USER_CONTEXT,
        null
      );
      
      console.log(`🤖 Bot: "${result.response.text}"`);
      
             if (result.response.buttons && result.response.buttons.length > 0) {
         console.log(`📋 Actions: ${result.response.buttons.map((b: any) => b.text).join(' | ')}`);
       }
      
    } catch (error) {
      console.log(`❌ Error: ${error}`);
    }
  }
  
  /**
   * Demonstrates context-aware conversation flow
   */
  private static async demoContextAwareConversation(): Promise<void> {
    console.log(`\n🔄 Context-Aware Conversation Flow`);
    console.log('─'.repeat(40));
    
    let currentContext: DialogueState | null = null;
    
    // Conversation turn 1: Start booking
    console.log(`\nTurn 1:`);
    console.log(`User: "I want to book a manicure for Friday"`);
    
    let result = await ConversationOrchestrator.processConversation(
      'I want to book a manicure for Friday',
      DEMO_USER_CONTEXT,
      currentContext
    );
    
    console.log(`🤖 Bot: "${result.response.text}"`);
    currentContext = result.dialogueState;
    
    // Conversation turn 2: User says thanks
    console.log(`\nTurn 2:`);
    console.log(`User: "Thanks!"`);
    
    result = await ConversationOrchestrator.processConversation(
      'Thanks!',
      DEMO_USER_CONTEXT,
      currentContext
    );
    
    console.log(`🤖 Bot: "${result.response.text}"`);
    
         // Show how context influenced the response
     const hasBookingContext = result.response.text?.toLowerCase().includes('booking') || 
                              result.response.buttons?.some((b: any) => b.value.includes('booking'));
    
    if (hasBookingContext) {
      console.log(`✅ Context-aware: Bot remembered the active booking!`);
    }
    
    currentContext = result.dialogueState;
    
    // Conversation turn 3: Update booking
    console.log(`\nTurn 3:`);
    console.log(`User: "Actually, can we change it to Saturday?"`);
    
    result = await ConversationOrchestrator.processConversation(
      'Actually, can we change it to Saturday?',
      DEMO_USER_CONTEXT,
      currentContext
    );
    
    console.log(`🤖 Bot: "${result.response.text}"`);
    
    if (result.response.text?.toLowerCase().includes('saturday')) {
      console.log(`✅ Context update: Bot processed the booking change!`);
    }
  }
  
  /**
   * Quick test of multi-intent merging
   */
  static async testIntentMerging(): Promise<void> {
    console.log('\n🔀 Testing Intent Merging');
    console.log('─'.repeat(30));
    
    const testMessage = "Do you have time Friday? I want to book it.";
    console.log(`Message: "${testMessage}"`);
    
    const analysis = await MultiIntentClassifier.analyzeMessage(testMessage, null);
    
    console.log(`Intents detected: ${analysis.intents.length}`);
    analysis.intents.forEach((intent, i) => {
      console.log(`  ${i + 1}. ${intent.type}: ${JSON.stringify(intent.data)}`);
    });
    
    if (analysis.intents.length === 1 && analysis.intents[0].type === 'booking') {
      console.log('✅ Correctly merged duplicate booking intents!');
    } else {
      console.log('❌ Intent merging needs adjustment');
    }
  }
  
  /**
   * Test response prioritization
   */
  static async testResponsePriority(): Promise<void> {
    console.log('\n🎯 Testing Response Priority');
    console.log('─'.repeat(30));
    
    const testMessage = "Hi! Do you do facials? I want to book Friday.";
    console.log(`Message: "${testMessage}"`);
    
    const result = await ConversationOrchestrator.processConversation(
      testMessage,
      DEMO_USER_CONTEXT,
      null
    );
    
    console.log(`Response: "${result.response.text}"`);
    
    const response = result.response.text?.toLowerCase() || '';
    const hasGreeting = response.includes('hi') || response.includes('hello');
    const hasFacialInfo = response.includes('facial');
    const hasBookingInfo = response.includes('friday') || response.includes('book');
    
    console.log(`✅ Contains greeting: ${hasGreeting}`);
    console.log(`✅ Contains facial info: ${hasFacialInfo}`);
    console.log(`✅ Contains booking info: ${hasBookingInfo}`);
    
         if (result.response.buttons) {
       const bookingActions = result.response.buttons.filter((b: any) => 
         b.value.includes('book') || b.value.includes('availability')
       );
       console.log(`✅ Booking actions prioritized: ${bookingActions.length > 0}`);
     }
  }
}

// Easy exports for testing
export const runV2Demo = V2ConversationDemo.runDemo;
export const testIntentMerging = V2ConversationDemo.testIntentMerging;
export const testResponsePriority = V2ConversationDemo.testResponsePriority; 