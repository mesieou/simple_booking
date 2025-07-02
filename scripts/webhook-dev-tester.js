#!/usr/bin/env node

/**
 * Interactive WhatsApp Webhook Development Tester
 * Usage: node scripts/webhook-dev-tester.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Test configurations
const TEST_CONFIGS = {
  dev: {
    phoneNumberId: "15551890570", // This matches your DEV_PHONE_NUMBER_IDS environment variable
    description: "DEV number (bypassed)",
    color: "\x1b[33m" // Yellow
  },
  production: {
    phoneNumberId: "108123456789",  // Replace with your actual business phone_number_id from Beauty Asiul
    description: "PRODUCTION number (full processing)",
    color: "\x1b[32m" // Green
  },
  realBusiness: {
    phoneNumberId: "108123456789",  // Same as production - your Beauty Asiul business
    description: "REAL BUSINESS (full detailed processing)",
    color: "\x1b[36m" // Cyan
  },
  unknown: {
    phoneNumberId: "999999999",
    description: "UNKNOWN number (404 expected)",
    color: "\x1b[31m" // Red
  }
};

const RESET_COLOR = "\x1b[0m";

const sendWebhookTest = async (phoneNumberId, message, testType) => {
  const config = TEST_CONFIGS[testType];
  
  const payload = {
    entry: [{
      changes: [{
        value: {
          metadata: {
            phone_number_id: phoneNumberId,
            display_phone_number: "+1234567890"
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
        },
        field: "messages"
      }]
    }],
    object: "whatsapp_business_account"
  };

  // Determine webhook URL based on environment
  const webhookUrl = process.env.NODE_ENV === 'production' 
    ? 'https://skedy.io/api/webhook2'  // Your custom domain
    : 'http://localhost:3000/api/webhook2';

  console.log(`\n${config.color}🧪 Testing: ${config.description}${RESET_COLOR}`);
  console.log(`📞 Phone Number ID: ${phoneNumberId}`);
  console.log(`💬 Message: "${message}"`);
  console.log(`🎯 Target: ${webhookUrl}`);
  console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
  console.log('─'.repeat(60));

  try {
    const startTime = Date.now();
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-Webhook-Tester/1.0',
        'X-Test-Source': 'webhook-dev-tester'
      },
      body: JSON.stringify(payload)
    });

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const result = await response.text();
    
    // Color code the response
    const statusColor = response.status === 200 ? "\x1b[32m" : "\x1b[31m";
    
    console.log(`${statusColor}✅ Status: ${response.status}${RESET_COLOR}`);
    console.log(`⚡ Duration: ${duration}ms`);
    console.log(`📝 Response: ${result}`);
    
    if (response.status === 200) {
      console.log(`${config.color}🎉 Test successful!${RESET_COLOR}`);
    } else {
      console.log(`\x1b[31m❌ Test failed${RESET_COLOR}`);
    }
    
  } catch (error) {
    console.error(`\x1b[31m💥 Error: ${error.message}${RESET_COLOR}`);
  }
  
  console.log('═'.repeat(60));
};

const showMenu = () => {
  console.log('\n🚀 WhatsApp Webhook Development Tester');
  console.log('═'.repeat(50));
  console.log('1. Test DEV number (bypassed)');
  console.log('2. Test PRODUCTION number (full processing)');  
  console.log('3. Test REAL BUSINESS (detailed logs)');
  console.log('4. Test UNKNOWN number (404 expected)');
  console.log('5. Custom test');
  console.log('6. Run all tests');
  console.log('7. Check webhook status');
  console.log('0. Exit');
  console.log('═'.repeat(50));
};

const checkWebhookStatus = async () => {
  const statusUrl = process.env.NODE_ENV === 'production'
    ? 'https://skedy.io/api/webhook-status'  // Your custom domain
    : 'http://localhost:3000/api/webhook-status';
    
  try {
    console.log(`\n🔍 Checking webhook status...`);
    const response = await fetch(statusUrl);
    const status = await response.json();
    
    console.log('\n📊 Webhook Status:');
    console.log('─'.repeat(30));
    console.log(`Environment: ${status.environment?.NODE_ENV || 'Not set'}`);
    console.log(`Webhook Enabled: ${status.environment?.USE_WABA_WEBHOOK}`);
    console.log(`Timestamp: ${status.timestamp}`);
    console.log(`Endpoint: ${status.endpoint}`);
    
  } catch (error) {
    console.error(`❌ Error checking status: ${error.message}`);
  }
};

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

const runAllTests = async () => {
  console.log('\n🎯 Running all test scenarios...\n');
  
  await sendWebhookTest("15551890570", "Test dev message", "dev");
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
  await sendWebhookTest("108123456789", "Test production message", "production");
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
  await sendWebhookTest("999999999", "Test unknown number", "unknown");
  
  console.log('\n✨ All tests completed!');
};

const main = async () => {
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  while (true) {
    showMenu();
    const choice = await askQuestion('\nSelect an option: ');
    
    switch (choice) {
      case '1':
        const devMessage = await askQuestion('Enter test message for DEV number: ');
        await sendWebhookTest("15551890570", devMessage, "dev");
        break;
        
      case '2':
        const prodMessage = await askQuestion('Enter test message for PRODUCTION number: ');
        await sendWebhookTest("108123456789", prodMessage, "production");
        break;
        
      case '3':
        const realMessage = await askQuestion('Enter test message for REAL BUSINESS: ');
        await sendWebhookTest(TEST_CONFIGS.realBusiness.phoneNumberId, realMessage, "realBusiness");
        break;
        
      case '4':
        const unknownMessage = await askQuestion('Enter test message for UNKNOWN number: ');
        await sendWebhookTest("999999999", unknownMessage, "unknown");
        break;
        
      case '5':
        const customPhoneId = await askQuestion('Enter phone_number_id: ');
        const customMessage = await askQuestion('Enter message: ');
        await sendWebhookTest(customPhoneId, customMessage, "unknown");
        break;
        
      case '6':
        await runAllTests();
        break;
        
      case '7':
        await checkWebhookStatus();
        break;
        
      case '0':
        console.log('👋 Goodbye!');
        rl.close();
        process.exit(0);
        
      default:
        console.log('❌ Invalid option. Please try again.');
    }
  }
};

// Start the interactive tester
main().catch(console.error); 