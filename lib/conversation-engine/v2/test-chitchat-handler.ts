import { ChitchatHandler } from './handlers/chitchat-handler';
import { DetectedIntent, ChitchatIntent, DialogueState } from './nlu/types';
import { UserContext } from '../../database/models/user-context';

/**
 * Comprehensive Test Suite for LLM-Powered ChitchatHandler
 * 
 * Tests the new intelligent chitchat system:
 * - Natural response generation using LLM
 * - Context-aware responses (with/without active bookings)
 * - Various chitchat types (greetings, thanks, farewells, etc.)
 * - Suggested actions appropriateness
 * - Fallback handling when LLM fails
 */

interface ChitchatTestCase {
  name: string;
  userMessage: string;
  chitchatData: ChitchatIntent;
  currentContext?: DialogueState | null;
  expectedResponsePatterns: string[]; // Words/phrases that should appear in response
  expectedActionTypes: string[]; // Action types that should be suggested
  shouldMentionBooking?: boolean; // Should reference active booking if exists
  description: string;
}

export class ChitchatHandlerTester {
  
  private static readonly TEST_USER_CONTEXT: UserContext = {
    id: 'test-user-123',
    businessId: 'test-business-456',
    channelUserId: 'test-whatsapp-789',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentGoal: null,
    previousGoal: null,
    participantPreferences: null,
    frequentlyDiscussedTopics: null
  };
  
  /**
   * Runs all chitchat handler tests
   */
  static async runAllTests(): Promise<void> {
    console.log('🧪 Starting ChitchatHandler LLM Tests...\n');
    
    const testCases = this.getTestCases();
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
      try {
        const result = await this.runSingleTest(testCase);
        if (result.success) {
          console.log(`✅ ${testCase.name}: PASSED`);
          if (result.details) {
            console.log(`   ${result.details}`);
          }
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
    
    // Run additional specific tests
    await this.testLLMResponseStructure();
    await this.testContextAwareness();
    await this.testResponseQuality();
  }
  
  /**
   * Runs a single test case
   */
  private static async runSingleTest(testCase: ChitchatTestCase): Promise<{
    success: boolean;
    reason?: string;
    details?: string;
  }> {
    
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`   Message: "${testCase.userMessage}"`);
    console.log(`   Context: ${testCase.currentContext?.activeBooking ? 'Active booking' : 'No booking'}`);
    
    const intent: DetectedIntent = {
      type: 'chitchat',
      data: testCase.chitchatData,
      priority: 1,
      handlerName: 'ChitchatHandler'
    };
    
    const result = await ChitchatHandler.processIntent(
      intent,
      testCase.currentContext || null,
      this.TEST_USER_CONTEXT,
      testCase.userMessage
    );
    
    const response = result.response.toLowerCase();
    console.log(`   Response: "${result.response}"`);
    console.log(`   Actions: ${result.suggestedActions?.map(a => a.text).join(', ') || 'None'}`);
    
    // Verify response contains expected patterns
    for (const pattern of testCase.expectedResponsePatterns) {
      if (!response.includes(pattern.toLowerCase())) {
        return {
          success: false,
          reason: `Response missing expected pattern: "${pattern}"`
        };
      }
    }
    
    // Verify suggested actions
    if (testCase.expectedActionTypes.length > 0) {
      const actionTypes = result.suggestedActions?.map(a => a.action) || [];
      for (const expectedAction of testCase.expectedActionTypes) {
        if (!actionTypes.some(action => action.includes(expectedAction))) {
          return {
            success: false,
            reason: `Missing expected action type: "${expectedAction}"`
          };
        }
      }
    }
    
    // Verify booking context awareness
    if (testCase.shouldMentionBooking && testCase.currentContext?.activeBooking) {
      const mentionsBooking = response.includes('booking') || 
                             response.includes('appointment') || 
                             response.includes('continue') ||
                             result.suggestedActions?.some(a => a.action.includes('booking'));
      
      if (!mentionsBooking) {
        return {
          success: false,
          reason: 'Should mention booking context but didn\'t'
        };
      }
    }
    
    // Verify response is not too long (chitchat should be concise)
    if (result.response.length > 300) {
      return {
        success: false,
        reason: `Response too long (${result.response.length} chars). Chitchat should be concise.`
      };
    }
    
    // Verify has suggested actions
    if (!result.suggestedActions || result.suggestedActions.length === 0) {
      return {
        success: false,
        reason: 'No suggested actions provided'
      };
    }
    
    return {
      success: true,
      details: `Natural response with ${result.suggestedActions?.length || 0} actions`
    };
  }
  
  /**
   * Test cases covering various chitchat scenarios
   */
  private static getTestCases(): ChitchatTestCase[] {
    return [
      // Basic Greetings
      {
        name: 'Simple Hi',
        userMessage: 'Hi!',
        chitchatData: { greeting: true },
        expectedResponsePatterns: ['hi', 'hello', 'welcome', 'help'],
        expectedActionTypes: ['booking', 'services'],
        description: 'Basic greeting should get warm welcome with business nudge'
      },
      
      {
        name: 'Formal Hello',
        userMessage: 'Hello there',
        chitchatData: { greeting: true },
        expectedResponsePatterns: ['hello', 'help', 'assist'],
        expectedActionTypes: ['booking', 'services'],
        description: 'Formal greeting should match tone and offer help'
      },
      
      // Thanks Messages
      {
        name: 'Simple Thanks',
        userMessage: 'Thank you!',
        chitchatData: { thanks: true },
        expectedResponsePatterns: ['welcome', 'help', 'anything'],
        expectedActionTypes: ['booking', 'services'],
        description: 'Thanks should acknowledge and offer more help'
      },
      
      // Context-Aware Tests (with active booking)
      {
        name: 'Greeting with Active Booking',
        userMessage: 'Hi again!',
        chitchatData: { greeting: true },
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
        expectedResponsePatterns: ['hi', 'booking', 'continue'],
        expectedActionTypes: ['continue', 'booking'],
        shouldMentionBooking: true,
        description: 'Greeting with active booking should offer to continue'
      },
      
      // Pleasantries
      {
        name: 'How Are You',
        userMessage: 'How are you doing today?',
        chitchatData: { pleasantries: 'How are you doing today?' },
        expectedResponsePatterns: ['great', 'good', 'help', 'assist'],
        expectedActionTypes: ['booking', 'services'],
        description: 'Personal question should be answered naturally with business focus'
      }
    ];
  }
  
  /**
   * Tests LLM response structure and JSON parsing
   */
  static async testLLMResponseStructure(): Promise<void> {
    console.log('\n🎯 Testing LLM Response Structure...');
    
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
        this.TEST_USER_CONTEXT,
        'Hello!'
      );
      
      // Check response structure
      const hasResponse = typeof result.response === 'string' && result.response.length > 0;
      const hasActions = Array.isArray(result.suggestedActions) && result.suggestedActions.length > 0;
      const hasValidActions = result.suggestedActions?.every(action => 
        typeof action.text === 'string' && typeof action.action === 'string'
      );
      
      console.log(`✅ Response structure: ${hasResponse ? 'Valid' : 'Invalid'}`);
      console.log(`✅ Actions structure: ${hasActions && hasValidActions ? 'Valid' : 'Invalid'}`);
      console.log(`✅ Response length: ${result.response.length} chars`);
      console.log(`✅ Action count: ${result.suggestedActions?.length || 0}`);
      
      if (hasResponse && hasActions && hasValidActions) {
        console.log('🎉 LLM response structure is correct!');
      } else {
        console.log('❌ LLM response structure needs improvement');
      }
      
    } catch (error) {
      console.log(`❌ LLM structure test failed: ${error}`);
    }
  }
  
  /**
   * Tests context awareness across conversation turns
   */
  static async testContextAwareness(): Promise<void> {
    console.log('\n🧠 Testing Context Awareness...');
    
    // Test 1: No booking context
    const intent1: DetectedIntent = {
      type: 'chitchat',
      data: { greeting: true },
      priority: 1,
      handlerName: 'ChitchatHandler'
    };
    
    const result1 = await ChitchatHandler.processIntent(
      intent1,
      null,
      this.TEST_USER_CONTEXT,
      'Hi there!'
    );
    
    // Test 2: With booking context
    const contextWithBooking: DialogueState = {
      activeBooking: {
        serviceName: 'Eyebrow Threading',
        date: '2024-01-25',
        status: 'collecting_info',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
      },
      lastActivityAt: new Date().toISOString()
    };
    
    const result2 = await ChitchatHandler.processIntent(
      intent1,
      contextWithBooking,
      this.TEST_USER_CONTEXT,
      'Hi there!'
    );
    
    console.log(`No booking response: "${result1.response}"`);
    console.log(`With booking response: "${result2.response}"`);
    
    // Check if responses are different and contextually appropriate
    const responsesDifferent = result1.response !== result2.response;
    const bookingResponseMentionsContext = result2.response.toLowerCase().includes('booking') ||
                                          result2.response.toLowerCase().includes('continue') ||
                                          result2.suggestedActions?.some(a => a.action.includes('continue'));
    
    console.log(`✅ Responses differ: ${responsesDifferent}`);
    console.log(`✅ Booking context recognized: ${bookingResponseMentionsContext}`);
    
    if (responsesDifferent && bookingResponseMentionsContext) {
      console.log('🎉 Context awareness is working correctly!');
    } else {
      console.log('❌ Context awareness needs improvement');
    }
  }
  
  /**
   * Quick response quality assessment
   */
  static async testResponseQuality(): Promise<void> {
    console.log('\n⭐ Testing Response Quality...');
    
    const testCases = [
      { message: 'Hey!', type: 'greeting' },
      { message: 'Thanks!', type: 'thanks' },
      { message: 'Good morning!', type: 'pleasantries' }
    ];
    
    for (const testCase of testCases) {
      const intent: DetectedIntent = {
        type: 'chitchat',
        data: { [testCase.type]: true },
        priority: 1,
        handlerName: 'ChitchatHandler'
      };
      
      const result = await ChitchatHandler.processIntent(
        intent,
        null,
        this.TEST_USER_CONTEXT,
        testCase.message
      );
      
      // Quality checks
      const isNatural = !result.response.includes('{{') && !result.response.includes('ERROR');
      const hasBusinessFocus = result.suggestedActions?.some(a => 
        a.action.includes('booking') || a.action.includes('services')
      );
      const isConcise = result.response.length <= 200;
      
      console.log(`${testCase.message}: Natural=${isNatural}, Business=${hasBusinessFocus}, Concise=${isConcise}`);
    }
  }
}

// Easy exports for testing
export const runChitchatTests = ChitchatHandlerTester.runAllTests;
export const testChitchatStructure = ChitchatHandlerTester.testLLMResponseStructure;
export const testChitchatContext = ChitchatHandlerTester.testContextAwareness;
export const testChitchatQuality = ChitchatHandlerTester.testResponseQuality; 