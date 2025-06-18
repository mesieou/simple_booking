import { BookingManager } from './handlers/booking-manager';
import { DetectedIntent, BookingIntent } from './nlu/types';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Mock dependencies
jest.mock('@/lib/database/models/availability-slots');
jest.mock('@/lib/database/models/service');
jest.mock('@/lib/database/models/user');
jest.mock('../llm-actions/chat-interactions/functions/vector-search');

const { AvailabilitySlots } = require('@/lib/database/models/availability-slots');
const { Service } = require('@/lib/database/models/service');
const { User } = require('@/lib/database/models/user');

async function testFailingScenarios() {
  console.log('🧪 Testing Failing BookingManager Scenarios\n');

  const mockUserContext = { businessId: 'test-business-123' } as any;

  // Setup mocks
  (User.findUserByBusinessId as jest.Mock).mockResolvedValue({ id: 'user-owner-123' });
  (Service.getByBusiness as jest.Mock).mockResolvedValue([
    {
      getData: () => ({
        id: 'service-1',
        name: 'Manicure',
        fixedPrice: 50,
        durationEstimate: 60
      })
    }
  ]);

  console.log('='.repeat(70));
  console.log('1. 🚫 COMPLETELY UNAVAILABLE DATE TEST');
  console.log('='.repeat(70));

  // Test 1: Completely unavailable date
  (AvailabilitySlots.getAvailableHoursForDate as jest.Mock).mockResolvedValue([]);
  (AvailabilitySlots.getNext3AvailableSlots as jest.Mock).mockResolvedValue([]);

  const intent1: DetectedIntent = {
    type: 'booking',
    priority: 1,
    handlerName: 'BookingManager',
    data: {
      checkingAvailability: true,
      date: '2024-01-15',
      serviceInquiry: 'manicure'
    } as BookingIntent
  };

  const result1 = await BookingManager.processIntent(intent1, null, mockUserContext, 'Do you have time Monday?');
  
  console.log('Expected: "❌ Sorry, no availability"');
  console.log('Actual  :', `"${result1.response}"`);
  console.log('Contains expected text:', result1.response.includes('❌ Sorry, no availability'));
  console.log('');

  console.log('='.repeat(70));
  console.log('2. 💥 DATABASE ERROR HANDLING TEST');
  console.log('='.repeat(70));

  // Test 2: Database error handling
  (User.findUserByBusinessId as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

  const intent2: DetectedIntent = {
    type: 'booking',
    priority: 1,
    handlerName: 'BookingManager',
    data: {
      checkingAvailability: true,
      date: '2024-01-15',
      serviceInquiry: 'manicure'
    } as BookingIntent
  };

  const result2 = await BookingManager.processIntent(intent2, null, mockUserContext, 'Do you have time Monday?');
  
  console.log('Expected: "having trouble checking availability"');
  console.log('Actual  :', `"${result2.response}"`);
  console.log('Contains expected text:', result2.response.includes('having trouble checking availability'));
  console.log('');

  console.log('='.repeat(70));
  console.log('3. 🛡️ XSS SECURITY TEST');
  console.log('='.repeat(70));

  // Reset mocks for normal operation
  (User.findUserByBusinessId as jest.Mock).mockResolvedValue({ id: 'user-owner-123' });

  const intent3: DetectedIntent = {
    type: 'booking',
    priority: 1,
    handlerName: 'BookingManager',
    data: {
      checkingAvailability: false,
      userName: '<script>alert("xss")</script>John Doe',
      serviceInquiry: 'manicure',
      date: '2024-01-15',
      time: '10:00'
    } as BookingIntent
  };

  const result3 = await BookingManager.processIntent(intent3, null, mockUserContext, 'Book for John Doe');

  console.log('Response contains <script>:', result3.response.includes('<script>'));
  console.log('Response:', result3.response);
  console.log('Should NOT contain <script> for security');
  console.log('');

  console.log('='.repeat(70));
  console.log('4. 🤖 GPT EVALUATION SCENARIOS');
  console.log('='.repeat(70));

  const testScenarios = [
    {
      userMessage: "I want to book a manicure for tomorrow at 2pm",
      expectedIntent: { checkingAvailability: false, serviceInquiry: 'manicure', date: 'tomorrow', time: '2pm' }
    },
    {
      userMessage: "Do you have availability this Friday morning?",
      expectedIntent: { checkingAvailability: true, date: 'Friday', time: 'morning' }
    },
    {
      userMessage: "Can I change my appointment to 3pm instead?",
      expectedIntent: { checkingAvailability: false, time: '3pm' }
    }
  ];

  for (const scenario of testScenarios) {
    const intent: DetectedIntent = {
      type: 'booking',
      priority: 1,
      handlerName: 'BookingManager',
      data: scenario.expectedIntent as BookingIntent
    };

    const result = await BookingManager.processIntent(intent, null, mockUserContext, scenario.userMessage);
    
    // GPT-4 evaluation criteria
    const evaluation = {
      relevance: result.response.includes(scenario.expectedIntent.serviceInquiry || '') ? 1 : 0,
      clarity: result.response.length > 10 && result.response.length < 300 ? 1 : 0,
      actionability: result.buttons && result.buttons.length > 0 ? 1 : 0,
      helpfulness: result.response.includes('✅') || result.response.includes('📅') ? 1 : 0,
      naturalness: !result.response.includes('ERROR') && !result.response.includes('undefined') ? 1 : 0
    };

    const score = Object.values(evaluation).reduce((sum, val) => sum + val, 0);
    
    console.log(`Scenario: "${scenario.userMessage}"`);
    console.log(`Response: "${result.response}"`);
    console.log(`Score: ${score}/5`);
    console.log(`Evaluation:`, evaluation);
    console.log('---');
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testFailingScenarios().catch(console.error);
}

export { testFailingScenarios }; 