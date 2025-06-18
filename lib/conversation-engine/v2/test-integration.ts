import { ConversationOrchestrator } from './orchestrator';
import { MultiIntentClassifier } from './nlu/multi-intent-classifier';
import { DialogueState } from './nlu/types';
import { UserContext } from '../../database/models/user-context';

/**
 * Integration Test Suite for V2 Conversation System
 * 
 * Tests the complete flow from user message to response:
 * - Multi-intent classification
 * - Task handler coordination
 * - Response generation and formatting
 * - Context state management
 */

interface TestCase {
  name: string;
  userMessage: string;
  currentContext?: DialogueState | null;
  expectedIntentTypes: string[];
  expectedResponseContains?: string[];
  expectedActionsContain?: string[];
  description: string;
}

export class V2IntegrationTester {
  
  private static readonly TEST_USER_CONTEXT: UserContext = {
    id: 'test-user-123',
    businessId: 'test-business-456',
    channelUserId: 'test-channel-789',
    businessWhatsappNumber: '+1234567890',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  /**
   * Main test runner
   */
  static async runAllTests(): Promise<void> {
    console.log('🧪 Starting V2 Integration Tests...\n');
    
    const testCases = this.getTestCases();
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
      try {
        const result = await this.runSingleTest(testCase);
        if (result.success) {
          console.log(`✅ ${testCase.name}: PASSED`);
          passed++;
        } else {
          console.log(`❌ ${testCase.name}: FAILED`);
          console.log(`   Reason: ${result.reason}`);
          failed++;
        }
      } catch (error) {
        console.log(`💥 ${testCase.name}: ERROR`);
        console.log(`   Error: ${error}`);
        failed++;
      }
    }
    
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  }
  
  /**
   * Runs a single test case
   */
  private static async runSingleTest(testCase: TestCase): Promise<{success: boolean, reason?: string}> {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`   Message: "${testCase.userMessage}"`);
    console.log(`   Expected: ${testCase.expectedIntentTypes.join(', ')}`);
    
    // Step 1: Test multi-intent classification
    const analysisResult = await MultiIntentClassifier.analyzeMessage(
      testCase.userMessage,
      testCase.currentContext || null
    );
    
    const actualIntentTypes = analysisResult.intents.map(i => i.type);
    console.log(`   Detected: ${actualIntentTypes.join(', ')}`);
    
    // Verify intent types match
    if (!this.arrayEquals(actualIntentTypes, testCase.expectedIntentTypes)) {
      return {
        success: false,
        reason: `Intent mismatch. Expected: [${testCase.expectedIntentTypes.join(', ')}], Got: [${actualIntentTypes.join(', ')}]`
      };
    }
    
    // Step 2: Test full orchestration
    const orchestrationResult = await ConversationOrchestrator.processConversation(
      testCase.userMessage,
      this.TEST_USER_CONTEXT,
      testCase.currentContext
    );
    
    const response = orchestrationResult.response;
    console.log(`   Response: "${response.text?.substring(0, 100)}${response.text && response.text.length > 100 ? '...' : ''}"`);
    
    // Verify response contains expected text
    if (testCase.expectedResponseContains) {
      for (const expectedText of testCase.expectedResponseContains) {
        if (!response.text?.toLowerCase().includes(expectedText.toLowerCase())) {
          return {
            success: false,
            reason: `Response missing expected text: "${expectedText}"`
          };
        }
      }
    }
    
    // Verify actions contain expected actions
    if (testCase.expectedActionsContain) {
      const actions = response.buttons?.map(b => b.value) || [];
      for (const expectedAction of testCase.expectedActionsContain) {
        if (!actions.some(action => action.includes(expectedAction))) {
          return {
            success: false,
            reason: `Actions missing expected action: "${expectedAction}"`
          };
        }
      }
    }
    
    return { success: true };
  }
  
  /**
   * Test cases covering various scenarios
   */
  private static getTestCases(): TestCase[] {
    return [
      // Single Intent Tests
      {
        name: 'Simple Greeting',
        userMessage: 'Hi there!',
        expectedIntentTypes: ['chitchat'],
        expectedResponseContains: ['hi', 'hello', 'welcome'],
        expectedActionsContain: ['availability', 'services'],
        description: 'Basic greeting should be detected as chitchat with appropriate response'
      },
      
      {
        name: 'Service Question',
        userMessage: 'Do you do gel manicures?',
        expectedIntentTypes: ['faq'],
        expectedResponseContains: [],
        description: 'Service inquiry should be detected as FAQ intent'
      },
      
      {
        name: 'Availability Check',
        userMessage: 'Do you have time Friday at 2pm?',
        expectedIntentTypes: ['booking'],
        expectedResponseContains: ['friday', '2pm'],
        description: 'Availability check should be detected as booking intent with checkingAvailability flag'
      },
      
      {
        name: 'Booking Request',
        userMessage: 'I want to book a manicure for tomorrow',
        expectedIntentTypes: ['booking'],
        expectedResponseContains: ['book', 'manicure'],
        description: 'Direct booking request should be detected as booking intent'
      },
      
      // Multi-Intent Tests
      {
        name: 'Greeting + Service Question',
        userMessage: 'Hi! Do you offer eyebrow threading?',
        expectedIntentTypes: ['chitchat', 'faq'],
        expectedResponseContains: ['hi', 'eyebrow'],
        description: 'Greeting combined with service question should detect both intents'
      },
      
      {
        name: 'Greeting + Booking',
        userMessage: 'Hello! Can I book an appointment for Monday?',
        expectedIntentTypes: ['chitchat', 'booking'],
        expectedResponseContains: ['hello', 'monday'],
        description: 'Greeting with booking request should detect both intents'
      },
      
      {
        name: 'Question + Booking',
        userMessage: 'How much is a facial? I want to book for this weekend.',
        expectedIntentTypes: ['faq', 'booking'],
        expectedResponseContains: ['facial', 'weekend'],
        description: 'Price question combined with booking should detect both intents'
      },
      
      {
        name: 'Triple Intent Complex',
        userMessage: 'Hi! What services do you offer? I want to book something for Friday.',
        expectedIntentTypes: ['chitchat', 'faq', 'booking'],
        expectedResponseContains: ['services', 'friday'],
        description: 'Complex message with greeting, question, and booking should detect all three intents'
      },
      
      // Context-Aware Tests
      {
        name: 'Greeting with Active Booking',
        userMessage: 'Hi again!',
        currentContext: {
          activeBooking: {
            serviceName: 'Manicure',
            date: '2024-01-15',
            status: 'collecting_info',
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString()
          },
          lastActivityAt: new Date().toISOString()
        },
        expectedIntentTypes: ['chitchat'],
        expectedResponseContains: ['booking', 'continue'],
        expectedActionsContain: ['continue'],
        description: 'Greeting with active booking should offer to continue'
      },
      
      {
        name: 'Update Existing Booking',
        userMessage: 'Actually, can we change it to Wednesday?',
        currentContext: {
          activeBooking: {
            serviceName: 'Manicure',
            date: '2024-01-15',
            time: '14:00',
            status: 'collecting_info',
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString()
          },
          lastActivityAt: new Date().toISOString()
        },
        expectedIntentTypes: ['booking'],
        expectedResponseContains: ['wednesday'],
        description: 'Booking update with existing context should modify active booking'
      },
      
      // Edge Cases
      {
        name: 'Ambiguous Time Reference',
        userMessage: 'Maybe tomorrow?',
        expectedIntentTypes: ['booking'],
        expectedResponseContains: ['tomorrow'],
        description: 'Tentative time reference should still be treated as booking intent'
      },
      
      {
        name: 'Thanks Only',
        userMessage: 'Thank you!',
        expectedIntentTypes: ['chitchat'],
        expectedResponseContains: ['welcome', 'help'],
        description: 'Simple thanks should be chitchat with offer to help'
      },
      
      {
        name: 'Booking with Merged Intents',
        userMessage: 'Do you have time Friday? I want to book it.',
        expectedIntentTypes: ['booking'],
        expectedResponseContains: ['friday'],
        description: 'Should merge duplicate booking intents into single intent'
      }
    ];
  }
  
  /**
   * Utility to compare arrays regardless of order
   */
  private static arrayEquals(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every(item => b.includes(item)) && b.every(item => a.includes(item));
  }
  
  /**
   * Quick test for specific functionality
   */
  static async testMultiIntentMerging(): Promise<void> {
    console.log('\n🔄 Testing Multi-Intent Merging...');
    
    const userMessage = "Do you have time Friday at 2pm? I want to book it";
    const result = await MultiIntentClassifier.analyzeMessage(userMessage, null);
    
    console.log(`Message: "${userMessage}"`);
    console.log(`Intents detected: ${result.intents.length}`);
    result.intents.forEach((intent, i) => {
      console.log(`  ${i + 1}. Type: ${intent.type}, Data:`, intent.data);
    });
    
    if (result.intents.length === 1 && result.intents[0].type === 'booking') {
      console.log('✅ Intent merging working correctly');
    } else {
      console.log('❌ Intent merging failed - should have merged to single booking intent');
    }
  }
  
  /**
   * Test orchestrator response combination
   */
  static async testResponseCombination(): Promise<void> {
    console.log('\n🎯 Testing Response Combination...');
    
    const userMessage = "Hi! Do you do gel manicures? Can I book Tuesday?";
    const result = await ConversationOrchestrator.processConversation(
      userMessage,
      this.TEST_USER_CONTEXT,
      null
    );
    
    console.log(`Message: "${userMessage}"`);
    console.log(`Response: "${result.response.text}"`);
    console.log(`Actions: ${result.response.buttons?.map(b => b.text).join(', ') || 'none'}`);
    
    const response = result.response.text?.toLowerCase() || '';
    const hasGreeting = response.includes('hi') || response.includes('hello');
    const hasServiceInfo = response.includes('gel') || response.includes('manicure');
    const hasBookingInfo = response.includes('tuesday') || response.includes('book');
    
    if (hasGreeting && (hasServiceInfo || hasBookingInfo)) {
      console.log('✅ Response combination working correctly');
    } else {
      console.log('❌ Response combination failed - missing expected content');
    }
  }
}

// Example usage and quick tests
export const runV2Tests = async () => {
  await V2IntegrationTester.runAllTests();
  await V2IntegrationTester.testMultiIntentMerging();
  await V2IntegrationTester.testResponseCombination();
};

// Export for easy testing
export { V2IntegrationTester }; 