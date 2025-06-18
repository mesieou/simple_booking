import { MultiIntentClassifier } from './nlu/multi-intent-classifier';
import { DetectedIntent, BookingIntent } from './nlu/types';

/**
 * Offline test for merge logic without requiring OpenAI API
 */
async function testMergeLogicOffline() {
  console.log('🧪 TESTING MERGE LOGIC (OFFLINE)\n');
  
  // Test case: Simulate the problematic scenario
  console.log('Scenario: "Do you have time Friday at 2pm? I want to book it"');
  console.log('Expected: Single booking intent with merged data\n');
  
  // Simulate what the LLM might return (the problematic case)
  const mockDuplicateIntents: DetectedIntent[] = [
    {
      type: 'booking',
      data: { 
        date: 'Friday', 
        time: '2pm', 
        checkingAvailability: true 
      } as BookingIntent,
      priority: 1,
      handlerName: 'BookingManager'
    },
    {
      type: 'booking',
      data: { 
        date: 'Friday', 
        time: '2pm', 
        checkingAvailability: false 
      } as BookingIntent,
      priority: 2,
      handlerName: 'BookingManager'
    }
  ];
  
  console.log('BEFORE MERGE:');
  mockDuplicateIntents.forEach((intent, i) => {
    console.log(`${i + 1}. ${intent.type}: ${JSON.stringify(intent.data)}`);
  });
  
  // Test our merge logic
  const mergedIntents = (MultiIntentClassifier as any).mergeDuplicateBookingIntents(mockDuplicateIntents);
  
  console.log('\nAFTER MERGE:');
  mergedIntents.forEach((intent: DetectedIntent, i: number) => {
    console.log(`${i + 1}. ${intent.type}: ${JSON.stringify(intent.data)}`);
  });
  
  // Verify results
  const success = mergedIntents.length === 1 && 
                 mergedIntents[0].type === 'booking' &&
                 (mergedIntents[0].data as BookingIntent).date === 'Friday' &&
                 (mergedIntents[0].data as BookingIntent).time === '2pm' &&
                 (mergedIntents[0].data as BookingIntent).checkingAvailability === true;
  
  console.log('\n' + '='.repeat(50));
  console.log(`Result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log('Expected: 1 booking intent with checkingAvailability=true');
  console.log(`Actual: ${mergedIntents.length} intent(s)`);
  
  if (success) {
    console.log('🎉 Merge logic is working correctly!');
  } else {
    console.log('❌ Merge logic needs debugging');
  }
  
  console.log('='.repeat(50));
  
  return success;
}

// Run the test
testMergeLogicOffline(); 