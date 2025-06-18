import { ChitchatHandler } from './handlers/chitchat-handler';
import { DetectedIntent, ChitchatIntent, DialogueState } from './nlu/types';
import { runChitchatTests } from './test-chitchat-handler';

/**
 * Demo for the new LLM-Powered ChitchatHandler
 * 
 * Shows how the new intelligent chitchat system works:
 * - Natural conversation responses
 * - Context-aware behavior
 * - Business-focused suggested actions
 */

// Mock user context for demos
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

export class ChitchatDemo {
  
  /**
   * Main demo runner
   */
  static async runDemo(): Promise<void> {
    console.log('🎯 LLM-Powered ChitchatHandler Demo\n');
    console.log('=' .repeat(50));
    
    // Demo 1: Basic greetings
    await ChitchatDemo.demoBasicChitchat();
    
    // Demo 2: Context-aware responses
    await ChitchatDemo.demoContextAwareness();
    
    // Demo 3: Various chitchat types
    await ChitchatDemo.demoChitchatTypes();
    
    // Demo 4: Response quality comparison
    await ChitchatDemo.demoResponseQuality();
    
    console.log('\n🎉 Demo complete! Key improvements:');
    console.log('   ✅ Natural, LLM-generated responses');
    console.log('   ✅ Context-aware conversation flow');
    console.log('   ✅ No rigid templates or subcategories');
    console.log('   ✅ Business-focused suggested actions');
    console.log('   ✅ Automatic fallback handling');
  }
  
  /**
   * Demo basic chitchat scenarios
   */
  private static async demoBasicChitchat(): Promise<void> {
    console.log('\n💬 Basic Chitchat Scenarios');
    console.log('─'.repeat(30));
    
    const scenarios = [
      { message: 'Hi!', type: 'greeting' },
      { message: 'Thank you so much!', type: 'thanks' },
      { message: 'How are you doing today?', type: 'pleasantries' },
      { message: 'See you later!', type: 'farewell' }
    ];
    
    for (const scenario of scenarios) {
      await ChitchatDemo.demonstrateChitchat(scenario.message, { [scenario.type]: true });
    }
  }
  
  /**
   * Demo context-aware behavior
   */
  private static async demoContextAwareness(): Promise<void> {
    console.log('\n🧠 Context-Aware Responses');
    console.log('─'.repeat(30));
    
    // Without booking context
    console.log('\n📱 Scenario: New customer greeting');
    await ChitchatDemo.demonstrateChitchat('Hi there!', { greeting: true }, null);
    
    // With active booking context
    console.log('\n📱 Scenario: Returning customer with active booking');
    const activeBookingContext: DialogueState = {
      activeBooking: {
        serviceName: 'Gel Manicure',
        date: '2024-01-20',
        status: 'collecting_info',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
      },
      lastActivityAt: new Date().toISOString()
    };
    
    await ChitchatDemo.demonstrateChitchat('Hi again!', { greeting: true }, activeBookingContext);
    
    // With completed booking
    console.log('\n📱 Scenario: Customer with ready booking');
    const readyBookingContext: DialogueState = {
      activeBooking: {
        serviceName: 'Facial Treatment',
        date: '2024-01-22',
        time: '14:00',
        userName: 'Sarah',
        status: 'ready_for_quote',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
      },
      lastActivityAt: new Date().toISOString()
    };
    
    await ChitchatDemo.demonstrateChitchat('Thanks!', { thanks: true }, readyBookingContext);
  }
  
  /**
   * Demo various chitchat types and energy levels
   */
  private static async demoChitchatTypes(): Promise<void> {
    console.log('\n🎭 Various Chitchat Types & Energy Levels');
    console.log('─'.repeat(40));
    
    const scenarios = [
      { message: 'OMG hiiii! So excited!!!', type: 'greeting', description: 'High-energy greeting' },
      { message: 'Good morning, hope you\'re well', type: 'pleasantries', description: 'Polite morning greeting' },
      { message: 'Thanks a million for your help!', type: 'thanks', description: 'Enthusiastic thanks' },
      { message: 'hey what\'s up', type: 'greeting', description: 'Casual greeting' }
    ];
    
    for (const scenario of scenarios) {
      console.log(`\n📱 ${scenario.description}:`);
      await ChitchatDemo.demonstrateChitchat(scenario.message, { [scenario.type]: true });
    }
  }
  
  /**
   * Demo response quality and consistency
   */
  private static async demoResponseQuality(): Promise<void> {
    console.log('\n⭐ Response Quality Assessment');
    console.log('─'.repeat(35));
    
    console.log('\n🔄 Testing same message multiple times for consistency:');
    
    for (let i = 1; i <= 3; i++) {
      console.log(`\n   Run ${i}:`);
      await ChitchatDemo.demonstrateChitchat('Hi there!', { greeting: true });
    }
    
    console.log('\n📊 Quality metrics to observe:');
    console.log('   ✓ Responses are natural and varied');
    console.log('   ✓ Consistent business focus');
    console.log('   ✓ Appropriate suggested actions');
    console.log('   ✓ Concise length (< 200 chars typically)');
  }
  
  /**
   * Helper to demonstrate a single chitchat interaction
   */
  private static async demonstrateChitchat(
    userMessage: string,
    chitchatData: ChitchatIntent,
    context: DialogueState | null = null
  ): Promise<void> {
    
    const intent: DetectedIntent = {
      type: 'chitchat',
      data: chitchatData,
      priority: 1,
      handlerName: 'ChitchatHandler'
    };
    
    try {
      const result = await ChitchatHandler.processIntent(
        intent,
        context,
        DEMO_USER_CONTEXT,
        userMessage
      );
      
      console.log(`User: "${userMessage}"`);
      console.log(`🤖 Bot: "${result.response}"`);
      
      if (result.suggestedActions && result.suggestedActions.length > 0) {
        console.log(`📋 Actions: ${result.suggestedActions.map(a => a.text).join(' | ')}`);
      }
      
      // Quality indicators
      const indicators = [];
      if (result.response.length <= 200) indicators.push('Concise');
      if (result.suggestedActions?.some(a => a.action.includes('booking'))) indicators.push('Business-focused');
      if (!result.response.includes('{{') && !result.response.includes('ERROR')) indicators.push('Natural');
      
      if (indicators.length > 0) {
        console.log(`✨ Quality: ${indicators.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error}`);
    }
  }
  
  /**
   * Quick comparison: Old vs New approach
   */
  static async compareApproaches(): Promise<void> {
    console.log('\n⚖️  Old Template vs New LLM Approach');
    console.log('─'.repeat(40));
    
    console.log('\n📜 Old Template Approach:');
    console.log('   - Fixed responses: "Hi there! 👋 Welcome!"');
    console.log('   - Rigid subcategories (greeting, thanks, etc.)');
    console.log('   - Same response every time');
    console.log('   - Limited personalization');
    
    console.log('\n🧠 New LLM Approach:');
    console.log('   - Dynamic, contextual responses');
    console.log('   - Natural language generation');
    console.log('   - Context-aware (active bookings, etc.)');
    console.log('   - Varied, engaging responses');
    
    console.log('\n🎯 Testing same input with new approach:');
    await ChitchatDemo.demonstrateChitchat('Hi!', { greeting: true });
    
    console.log('\n📈 Benefits of LLM approach:');
    console.log('   ✅ More engaging user experience');
    console.log('   ✅ Better conversion potential');
    console.log('   ✅ Scales without code changes');
    console.log('   ✅ Handles edge cases naturally');
  }
}

/**
 * Easy test runners
 */
export const runChitchatDemo = ChitchatDemo.runDemo;
export const compareChitchatApproaches = ChitchatDemo.compareApproaches;

/**
 * Run full test suite
 */
export const runFullChitchatTests = runChitchatTests;

/**
 * Quick demo for immediate testing
 */
export const quickChitchatTest = async () => {
  console.log('🚀 Quick ChitchatHandler Test\n');
  
  const intent: DetectedIntent = {
    type: 'chitchat',
    data: { greeting: true },
    priority: 1,
    handlerName: 'ChitchatHandler'
  };
  
  try {
    const result = await ChitchatHandler.processIntent(
      intent,
      null,
      DEMO_USER_CONTEXT,
      'Hey there!'
    );
    
    console.log('User: "Hey there!"');
    console.log(`🤖 Bot: "${result.response}"`);
    console.log(`📋 Actions: ${result.suggestedActions?.map(a => a.text).join(' | ') || 'None'}`);
    console.log('\n✅ ChitchatHandler is working!');
    
  } catch (error) {
    console.log(`❌ Error: ${error}`);
  }
}; 

runChitchatDemo();