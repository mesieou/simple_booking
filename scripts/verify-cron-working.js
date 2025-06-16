#!/usr/bin/env node

/**
 * Simple script to verify cron job is working by checking availability
 * Usage: node scripts/verify-cron-working.js [baseUrl]
 */

const https = require('https');
const http = require('http');
const url = require('url');

const baseUrl = process.argv[2] || process.env.NEXTAUTH_URL || 'https://skedy.io';
const providerId = '17302676-0dd3-43b0-b835-84c64f2f7b5c'; // Luisa

console.log(`🔍 Checking availability for Luisa Bernal...`);
console.log(`🌐 Base URL: ${baseUrl}\n`);

async function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${baseUrl}${endpoint}`;
    const parsedUrl = url.parse(fullUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function checkAvailability() {
  try {
    console.log('📊 Checking current availability...');
    
    // Get current date info
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📅 Today: ${today}`);
    console.log(`📅 Tomorrow: ${tomorrow}`);
    console.log(`📅 Next week: ${nextWeek}\n`);
    
    // Simple availability check - we don't have the debug endpoint anymore
    // So we'll just provide instructions for manual verification
    
    console.log('🔍 To verify the cron job is working:');
    console.log('');
    console.log('1. Check your database availabilitySlots table');
    console.log(`2. Look for providerId: ${providerId}`);
    console.log('3. Check the latest date entries');
    console.log('4. After running cron, you should see new dates added');
    console.log('');
    console.log('📋 Manual verification queries:');
    console.log(`   SELECT date, slots FROM "availabilitySlots" `);
    console.log(`   WHERE "providerId" = '${providerId}'`);
    console.log(`   ORDER BY date DESC LIMIT 5;`);
    console.log('');
    console.log('🎯 Expected behavior:');
    console.log('- Before cron: Latest date should be around July 15-16');
    console.log('- After cron: New date should be added (July 17+)');
    console.log('- Each run adds 1 day to maintain 30-day window');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error checking availability:', error.message);
    return false;
  }
}

async function testCronEndpoints() {
  console.log('\n🚀 Testing cron endpoints...\n');
  
  try {
    // Test status endpoint
    console.log('1️⃣ Testing status endpoint...');
    const statusResult = await makeRequest('/api/cron/status');
    
    if (statusResult.status === 200) {
      console.log('✅ Status endpoint working');
      if (statusResult.data.environment?.hasCronSecret) {
        console.log('✅ CRON_SECRET is configured');
      } else {
        console.log('❌ CRON_SECRET not found');
      }
    } else {
      console.log(`❌ Status endpoint failed: ${statusResult.status}`);
    }
    
  } catch (error) {
    console.log(`❌ Could not test endpoints: ${error.message}`);
    console.log('💡 This might be due to network issues or the app not being deployed yet');
  }
  
  console.log('\n📝 Manual test commands:');
  console.log('');
  console.log('# Test status:');
  console.log(`curl ${baseUrl}/api/cron/status`);
  console.log('');
  console.log('# Test single batch:');
  console.log(`curl -H "Authorization: Bearer $CRON_SECRET" \\`);
  console.log(`"${baseUrl}/api/cron/daily-roll-availability-batch?batchSize=3&batchIndex=0"`);
  console.log('');
  console.log('# Test full coordinator:');
  console.log(`curl -H "Authorization: Bearer $CRON_SECRET" \\`);
  console.log(`${baseUrl}/api/cron/roll-availability-coordinator`);
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node scripts/verify-cron-working.js [baseUrl]

Examples:
  node scripts/verify-cron-working.js
  node scripts/verify-cron-working.js https://skedy.io
  node scripts/verify-cron-working.js http://localhost:3000

This script helps verify that the cron job system is working correctly.
`);
  process.exit(0);
}

// Run the verification
async function main() {
  await checkAvailability();
  await testCronEndpoints();
  
  console.log('\n🎯 Next steps:');
  console.log('1. Run one of the manual test commands above');
  console.log('2. Check your database for new availability entries');
  console.log('3. Wait for tomorrow\'s automatic cron at midnight UTC');
  console.log('4. Verify new dates are added automatically');
}

main(); 