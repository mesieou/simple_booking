/**
 * Test script to simulate WhatsApp webhooks locally for development
 * Usage: node scripts/test-webhook-locally.js
 */

const testWebhookMessage = async (phoneNumberId, message, isDevNumber = false) => {
  const payload = {
    entry: [{
      changes: [{
        value: {
          metadata: {
            phone_number_id: phoneNumberId
          },
          messages: [{
            from: "1234567890",
            id: `test_msg_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: {
              body: message
            },
            type: "text"
          }],
          contacts: [{
            profile: {
              name: "Test User"
            },
            wa_id: "1234567890"
          }]
        }
      }]
    }]
  };

  const webhookUrl = process.env.NODE_ENV === 'production' 
  ? 'https://skedy.io/api/whatsapp-webhook'
  : 'http://localhost:3000/api/whatsapp-webhook';

  console.log(`🧪 Testing ${isDevNumber ? 'DEV' : 'PRODUCTION'} number: ${phoneNumberId}`);
  console.log(`📨 Message: "${message}"`);
  console.log(`🎯 Webhook: ${webhookUrl}`);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp Test Script'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.text();
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📝 Response: ${result}`);
    
    if (response.status === 200) {
      console.log(`🎉 ${isDevNumber ? 'Dev number test' : 'Production test'} successful!`);
    } else {
      console.log(`❌ Test failed with status ${response.status}`);
    }
    
  } catch (error) {
    console.error(`💥 Error testing webhook:`, error.message);
  }
  
  console.log('─'.repeat(60));
};

// Test scenarios
const runTests = async () => {
  console.log('🚀 Starting webhook tests...\n');
  
  // Test dev number (should be bypassed)
  await testWebhookMessage("123456789", "Test dev message", true);
  
  // Test production number (should be processed)
  await testWebhookMessage("108123456789", "Test production message", false);
  
  // Test unknown number (should return 404)
  await testWebhookMessage("999999999", "Test unknown number", false);
  
  console.log('✨ All tests completed!');
};

// Run the tests
runTests().catch(console.error); 