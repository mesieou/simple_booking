 import { FAQHandler } from './handlers/faq-handler';
import { DetectedIntent, FAQIntent, DialogueState } from './nlu/types';
import { UserContext } from '../../database/models/user-context';
import { VectorSearchResult } from '../llm-actions/chat-interactions/functions/vector-search';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Business ID for Luisa's nail salon
const BUSINESS_ID = '228c7e8e-ec15-4eeb-a766-d1ebee07104f';

// Mock user context
const mockUserContext = {
  businessId: BUSINESS_ID,
  conversationId: 'test-conv-123',
  platform: 'whatsapp',
  phoneNumber: '+1234567890'
} as UserContext;

// Actual business documents extracted from the crawl output
const BUSINESS_DOCUMENTS: VectorSearchResult[] = [
  {
    content: "Notes: ● Polygel is not offered ● Custom nail designs can be sent in advance as images",
    source: "pdf:luisa_business_document.pdf#page=3",
    type: "service",
    confidenceScore: 0.85
  },
  {
    content: "If late or absent, please notify Luisa so she isn't waiting unnecessarily.",
    source: "pdf:luisa_business_document.pdf#page=6",
    type: "policy",
    confidenceScore: 0.8
  },
  {
    content: "Can I edit my booking before confirming? Yes, use \"Edit Quote\" to change: ● Service ● Date/time",
    source: "pdf:luisa_business_document.pdf#page=2",
    type: "booking",
    confidenceScore: 0.9
  },
  {
    content: "Do you offer mobile services? Yes. ● Mobile service: Client address is required first. ● In-store service: Address is 9 Dryburgh Street, West Melbourne, Apt 111.",
    source: "pdf:luisa_business_document.pdf#page=3",
    type: "service",
    confidenceScore: 0.9
  },
  {
    content: "How do I select a service? You'll be shown a list with: ● Service Name ● Icon: ○ = mobile service ○ = in-store service ● Price (fixed or estimated) ● Duration Choose one by tapping the button.",
    source: "pdf:luisa_business_document.pdf#page=1",
    type: "service",
    confidenceScore: 0.9
  },
  {
    content: "How is my info used? To: ● Manage bookings ● Contact you Internally, a temporary system email like wa_YOUR_NUMBER@skedy.ai is created.",
    source: "pdf:luisa_business_document.pdf#page=5",
    type: "privacy",
    confidenceScore: 0.8
  },
  {
    content: "What happens after I select a time? ● Bot checks if you're a returning customer. ● If new, asks for name. ● Then shows you a full booking summary and quote.",
    source: "pdf:luisa_business_document.pdf#page=2",
    type: "booking",
    confidenceScore: 0.95
  },
  {
    content: "Cancellations & No-shows ● Cancel or reschedule at least 24 hours in advance to keep deposit. ● Frequent late cancellations may lead to stricter policies.",
    source: "pdf:luisa_business_document.pdf#page=5",
    type: "policy",
    confidenceScore: 0.85
  },
  {
    content: "How do I know my booking is confirmed? You'll receive a final confirmation with: ● Booking ID ● Service ● Date & Time ● Location",
    source: "pdf:luisa_business_document.pdf#page=2",
    type: "booking",
    confidenceScore: 0.95
  },
  {
    content: "What information do I need to provide to book? ● If mobile service: your full address (street number, name, suburb, postcode) for travel cost calculation and service area validation. ● If new customer: just your first name.",
    source: "pdf:luisa_business_document.pdf#page=1",
    type: "booking",
    confidenceScore: 0.95
  },
  {
    content: "Account & Customer Info Do I need an account? Yes, a basic account is created automatically using: ● Your WhatsApp number ● Your first name What if I'm a returning customer? The system will recognize your WhatsApp and greet you by name. No need to re-enter details.",
    source: "pdf:luisa_business_document.pdf#page=4",
    type: "account",
    confidenceScore: 0.9
  }
];

// Mock vector search function
const { findBestVectorResult } = require('../llm-actions/chat-interactions/functions/vector-search');
findBestVectorResult.mockImplementation((embedding: number[], businessId: string) => {
  return Promise.resolve(BUSINESS_DOCUMENTS);
});

// Mock embedding generation
const { generateEmbedding } = require('../llm-actions/chat-interactions/functions/embeddings');
generateEmbedding.mockImplementation(() => Promise.resolve(new Array(1536).fill(0.1)));

// Mock OpenAI completion
const { executeChatCompletion } = require('../llm-actions/chat-interactions/openai-config/openai-core');
executeChatCompletion.mockImplementation((messages: any[], model: string, temperature: number, maxTokens: number) => {
  const userMessage = messages.find(m => m.role === 'user')?.content || '';
  
  // Simulate LLM response based on the question type
  let response = '';
  
  if (userMessage.includes('mobile service')) {
    response = 'Yes, I offer mobile services! I can come to your location, just provide your full address. I also have an in-store location at 9 Dryburgh Street, West Melbourne, Apt 111.';
  } else if (userMessage.includes('polygel')) {
    response = 'I don\'t offer polygel services, but I do offer many other nail services! I can also create custom nail designs if you send me images in advance.';
  } else if (userMessage.includes('cancel')) {
    response = 'You can cancel or reschedule your booking at least 24 hours in advance to keep your deposit. Frequent late cancellations may lead to stricter policies.';
  } else if (userMessage.includes('booking') && userMessage.includes('confirmed')) {
    response = 'You\'ll know your booking is confirmed when you receive a final confirmation with your Booking ID, Service details, Date & Time, and Location.';
  } else if (userMessage.includes('account')) {
    response = 'Yes, a basic account is created automatically using your WhatsApp number and first name. If you\'re a returning customer, the system will recognize you!';
  } else if (userMessage.includes('information') && userMessage.includes('book')) {
    response = 'For mobile services, I need your full address. For new customers, just your first name is needed. Returning customers don\'t need to re-enter details!';
  } else if (userMessage.includes('pizza') || userMessage.includes('weather') || userMessage.includes('unrelated')) {
    response = 'I don\'t have specific information about that. Let me help you with our nail services instead!';
  } else {
    response = 'I can help you with that! Let me find the best information for you.';
  }
  
  return Promise.resolve({
    choices: [{ message: { content: response } }]
  });
});

// Test scenarios
interface TestScenario {
  name: string;
  userMessage: string;
  questions: string[];
  category?: string;
  hasActiveBooking?: boolean;
  expectedResponseIncludes?: string[];
  expectedButtonCount?: number;
  expectedButtonTypes?: string[];
}

const TEST_SCENARIOS: TestScenario[] = [
  // SINGLE QUESTION SCENARIOS
  {
    name: "Service Availability - Mobile Services",
    userMessage: "Do you offer mobile services?",
    questions: ["Do you offer mobile services?"],
    category: "service_info",
    expectedResponseIncludes: ["mobile", "address", "Dryburgh Street"],
    expectedButtonCount: 3,
    expectedButtonTypes: ["book_service", "view_pricing", "show_services"]
  },
  
  {
    name: "Service Limitation - Polygel",
    userMessage: "Do you do polygel nails?",
    questions: ["Do you do polygel nails?"],
    category: "service_info",
    expectedResponseIncludes: ["polygel", "not offered", "custom designs"],
    expectedButtonCount: 3,
    expectedButtonTypes: ["book_service", "view_pricing", "show_services"]
  },
  
  {
    name: "Cancellation Policy",
    userMessage: "Can I cancel my booking?",
    questions: ["Can I cancel my booking?"],
    category: "policies",
    expectedResponseIncludes: ["cancel", "24 hours", "deposit"],
    expectedButtonCount: 2,
    expectedButtonTypes: ["start_booking", "show_services"]
  },
  
  {
    name: "Booking Confirmation Process",
    userMessage: "How do I know my booking is confirmed?",
    questions: ["How do I know my booking is confirmed?"],
    category: "booking",
    expectedResponseIncludes: ["confirmation", "Booking ID", "Service"],
    expectedButtonCount: 3,
    expectedButtonTypes: ["book_service", "view_pricing", "show_services"]
  },
  
  {
    name: "Account Creation",
    userMessage: "Do I need to create an account?",
    questions: ["Do I need to create an account?"],
    category: "general",
    expectedResponseIncludes: ["account", "automatically", "WhatsApp"],
    expectedButtonCount: 2,
    expectedButtonTypes: ["show_services", "check_availability"]
  },
  
  {
    name: "Required Information for Booking",
    userMessage: "What information do I need to provide to book?",
    questions: ["What information do I need to provide to book?"],
    category: "booking",
    expectedResponseIncludes: ["address", "first name", "mobile service"],
    expectedButtonCount: 3,
    expectedButtonTypes: ["book_service", "view_pricing", "show_services"]
  },
  
  // MULTIPLE QUESTION SCENARIOS
  {
    name: "Multiple Questions - Services & Policy",
    userMessage: "Do you offer mobile services and what's your cancellation policy?",
    questions: ["Do you offer mobile services?", "What's your cancellation policy?"],
    category: "general",
    expectedResponseIncludes: ["mobile", "cancel", "24 hours"],
    expectedButtonCount: 2,
    expectedButtonTypes: ["show_services", "check_availability"]
  },
  
  {
    name: "Multiple Questions - Account & Booking Info",
    userMessage: "Do I need an account and what info do I need to book?",
    questions: ["Do I need an account?", "What info do I need to book?"],
    category: "booking",
    expectedResponseIncludes: ["account", "automatically", "address", "first name"],
    expectedButtonCount: 3,
    expectedButtonTypes: ["book_service", "view_pricing", "show_services"]
  },
  
  // ACTIVE BOOKING CONTEXT SCENARIOS
  {
    name: "Service Question with Active Booking",
    userMessage: "Do you offer mobile services?",
    questions: ["Do you offer mobile services?"],
    category: "service_info",
    hasActiveBooking: true,
    expectedResponseIncludes: ["mobile", "address"],
    expectedButtonCount: 2,
    expectedButtonTypes: ["continue_booking", "show_services"]
  },
  
  {
    name: "Policy Question with Active Booking",
    userMessage: "What's your cancellation policy?",
    questions: ["What's your cancellation policy?"],
    category: "policies",
    hasActiveBooking: true,
    expectedResponseIncludes: ["cancel", "24 hours"],
    expectedButtonCount: 2,
    expectedButtonTypes: ["continue_booking", "show_services"]
  },
  
  // OFF-TOPIC / EDGE CASE SCENARIOS
  {
    name: "Completely Off-Topic - Food",
    userMessage: "Do you sell pizza?",
    questions: ["Do you sell pizza?"],
    category: "general",
    expectedResponseIncludes: ["don't have specific information", "nail services"],
    expectedButtonCount: 2,
    expectedButtonTypes: ["show_services", "check_availability"]
  },
  
  {
    name: "Off-Topic - Weather",
    userMessage: "What's the weather like today?",
    questions: ["What's the weather like today?"],
    category: "general",
    expectedResponseIncludes: ["don't have specific information", "services"],
    expectedButtonCount: 2,
    expectedButtonTypes: ["show_services", "check_availability"]
  },
  
  {
    name: "Vague/Unclear Question",
    userMessage: "How does this work?",
    questions: ["How does this work?"],
    category: "general",
    expectedButtonCount: 2,
    expectedButtonTypes: ["show_services", "check_availability"]
  }
];

// Test execution function
async function runComprehensiveTests() {
  console.log('🧪 Starting Comprehensive FAQ Handler Tests\n');
  console.log(`📋 Testing ${TEST_SCENARIOS.length} scenarios\n`);
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n🔍 Testing: ${scenario.name}`);
    console.log(`❓ Question: "${scenario.userMessage}"`);
    
    try {
      // Create intent
      const intent: DetectedIntent = {
        type: 'faq',
        data: {
          questions: scenario.questions,
          category: scenario.category || 'general'
        } as FAQIntent,
        priority: 1,
        handlerName: 'FAQHandler'
      };
      
      // Create context
      const context: DialogueState | null = scenario.hasActiveBooking ? {
        activeBooking: {
          userName: 'Test User',
          serviceName: 'Manicure',
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        },
        lastActivityAt: new Date().toISOString()
      } : null;
      
      // Process intent
      const result = await FAQHandler.processIntent(
        intent,
        context,
        mockUserContext,
        scenario.userMessage
      );
      
      console.log(`💬 Response: "${result.response}"`);
      console.log(`🔘 Buttons (${result.buttons?.length || 0}):`, 
        result.buttons?.map(b => `"${b.buttonText}"`).join(', ') || 'None');
      
      // Validate expectations
      let testPassed = true;
      const errors: string[] = [];
      
      // Check response content
      if (scenario.expectedResponseIncludes) {
        for (const expectedText of scenario.expectedResponseIncludes) {
          if (!result.response.toLowerCase().includes(expectedText.toLowerCase())) {
            errors.push(`Missing expected text: "${expectedText}"`);
            testPassed = false;
          }
        }
      }
      
      // Check button count
      if (scenario.expectedButtonCount && result.buttons?.length !== scenario.expectedButtonCount) {
        errors.push(`Expected ${scenario.expectedButtonCount} buttons, got ${result.buttons?.length || 0}`);
        testPassed = false;
      }
      
      // Check button types
      if (scenario.expectedButtonTypes && result.buttons) {
        for (const expectedType of scenario.expectedButtonTypes) {
          const hasButton = result.buttons.some(b => b.buttonValue.includes(expectedType.replace('_', '')) || 
                                                      b.buttonValue === expectedType);
          if (!hasButton) {
            errors.push(`Missing expected button type: "${expectedType}"`);
            testPassed = false;
          }
        }
      }
      
      if (testPassed) {
        console.log(`✅ PASSED`);
        passedTests++;
      } else {
        console.log(`❌ FAILED:`);
        errors.forEach(error => console.log(`   - ${error}`));
        failedTests++;
      }
      
    } catch (error) {
      console.log(`💥 ERROR: ${error.message}`);
      failedTests++;
    }
    
    console.log('─'.repeat(80));
  }
  
  // Final summary
  console.log(`\n📊 TEST SUMMARY:`);
  console.log(`✅ Passed: ${passedTests}/${TEST_SCENARIOS.length}`);
  console.log(`❌ Failed: ${failedTests}/${TEST_SCENARIOS.length}`);
  console.log(`📈 Success Rate: ${Math.round((passedTests / TEST_SCENARIOS.length) * 100)}%`);
  
  // Analysis of confidence passing to LLM
  console.log(`\n🤔 CONFIDENCE ANALYSIS:`);
  console.log(`Current Implementation: Confidence scores ARE passed to LLM in the prompt`);
  console.log(`Each option shows: "Option X (Confidence: XX%): content"`);
  console.log(`\n💭 RECOMMENDATION:`);
  console.log(`Keep confidence scores - they help LLM make better decisions when:`);
  console.log(`- Multiple answers have similar relevance`);
  console.log(`- LLM needs to judge reliability of sources`);
  console.log(`- Explaining uncertainty to users when all confidence is low`);
  
  return {
    totalTests: TEST_SCENARIOS.length,
    passed: passedTests,
    failed: failedTests,
    successRate: Math.round((passedTests / TEST_SCENARIOS.length) * 100)
  };
}

// Export for testing
export { runComprehensiveTests, TEST_SCENARIOS, BUSINESS_DOCUMENTS };

// Run if called directly
if (require.main === module) {
  runComprehensiveTests().catch(console.error);
} 