#!/usr/bin/env node

/**
 * Simple script to test the availability cron job debug endpoint
 */

const http = require('http');
const https = require('https');
const url = require('url');

// Configuration
const DEBUG_ENDPOINT = '/api/debug/test-availability-roll';
const CRON_ENDPOINT = '/api/cron/daily-roll-availability';

// Get the base URL from command line arguments or environment
const baseUrl = process.argv[2] || process.env.NEXTAUTH_URL || 'http://localhost:3000';

console.log(`🔍 Testing availability cron job debug at: ${baseUrl}`);

async function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const fullUrl = baseUrl + endpoint;
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

    // Add authorization for cron endpoint
    if (endpoint === CRON_ENDPOINT && process.env.CRON_SECRET) {
      options.headers['authorization'] = `Bearer ${process.env.CRON_SECRET}`;
    }

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

async function runTests() {
  console.log('\n📊 Running debug endpoint test...');
  
  try {
    const debugResult = await makeRequest(DEBUG_ENDPOINT);
    
    console.log(`\n✅ Debug endpoint response (${debugResult.status}):`);
    console.log(JSON.stringify(debugResult.data, null, 2));

    if (debugResult.data.providers) {
      console.log(`\n📈 Summary:`);
      console.log(`- Found ${debugResult.data.providers.length} providers`);
      console.log(`- Errors: ${debugResult.data.errors.length}`);
      console.log(`- Success: ${debugResult.data.success ? '✅' : '❌'}`);
      
      if (debugResult.data.errors.length > 0) {
        console.log(`\n🚨 Errors found:`);
        debugResult.data.errors.forEach((error, index) => {
          console.log(`${index + 1}. ${error.error} (Provider: ${error.providerId || 'N/A'})`);
        });
      }

      console.log(`\n👥 Provider details:`);
      debugResult.data.providers.forEach((provider, index) => {
        console.log(`${index + 1}. ${provider.name} (${provider.role})`);
        console.log(`   - Business: ${provider.business?.name || 'N/A'}`);
        console.log(`   - Calendar Settings: ${provider.calendarSettings ? '✅' : '❌'}`);
        console.log(`   - Current Availability: ${provider.currentAvailability} days`);
        if (provider.error) {
          console.log(`   - Error: ${provider.error}`);
        }
      });
    }

    // If debug was successful and we have CRON_SECRET, test the actual cron endpoint
    if (debugResult.data.success && process.env.CRON_SECRET) {
      console.log('\n🤖 Testing actual cron endpoint...');
      const cronResult = await makeRequest(CRON_ENDPOINT);
      console.log(`\n✅ Cron endpoint response (${cronResult.status}):`);
      console.log(JSON.stringify(cronResult.data, null, 2));
    } else if (!process.env.CRON_SECRET) {
      console.log('\n⚠️  Skipping cron endpoint test (CRON_SECRET not set)');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Usage instructions
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node scripts/test-cron-debug.js [BASE_URL]

Examples:
  node scripts/test-cron-debug.js
  node scripts/test-cron-debug.js http://localhost:3000
  node scripts/test-cron-debug.js https://yourdomain.com

Environment variables:
  CRON_SECRET - Required to test the actual cron endpoint
  NEXTAUTH_URL - Default base URL if not provided as argument
`);
  process.exit(0);
}

// Run the tests
runTests(); 