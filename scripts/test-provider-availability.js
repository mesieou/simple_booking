#!/usr/bin/env node

/**
 * Test script to debug specific provider availability rolling
 * Usage: node scripts/test-provider-availability.js [providerId] [baseUrl]
 */

const https = require('https');
const http = require('http');
const url = require('url');

// Get arguments
const providerId = process.argv[2] || '17302676-0dd3-43b0-b835-84c64f2f7b5c';
const baseUrl = process.argv[3] || process.env.NEXTAUTH_URL || 'http://localhost:3000';

console.log(`🔍 Testing availability for provider: ${providerId}`);
console.log(`🌐 Base URL: ${baseUrl}\n`);

async function makeRequest(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
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

async function testProvider() {
  try {
    console.log('🔍 Step 1: Checking provider information...');
    
    // Test debug endpoint for specific provider
    const result = await makeRequest('/api/debug/test-availability-roll', { providerId });
    
    console.log(`📊 Response Status: ${result.status}`);
    console.log(`📋 Response:`, JSON.stringify(result.data, null, 2));
    
    if (result.data.providers && result.data.providers.length > 0) {
      const provider = result.data.providers[0];
      
      console.log(`\n📈 Provider Summary:`);
      console.log(`   - Name: ${provider.name}`);
      console.log(`   - Role: ${provider.role}`);
      console.log(`   - Business: ${provider.business?.name || 'N/A'}`);
      console.log(`   - Business Timezone: ${provider.business?.timezone || 'N/A'}`);
      console.log(`   - Provider Timezone: ${provider.calendarSettings?.timezone || 'N/A'}`);
      console.log(`   - Buffer Time: ${provider.calendarSettings?.bufferTime || 0} minutes`);
      console.log(`   - Working Days: ${provider.calendarSettings?.workingDays?.join(', ') || 'N/A'}`);
      console.log(`   - Current Availability Days: ${provider.currentAvailability}`);
      
      if (provider.error) {
        console.log(`   - ❌ Error: ${provider.error}`);
      } else {
        console.log(`   - ✅ Status: OK`);
      }
    }
    
    if (result.data.errors && result.data.errors.length > 0) {
      console.log(`\n🚨 Errors Found:`);
      result.data.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.error}`);
      });
    }
    
    console.log(`\n🎯 Overall Success: ${result.data.success ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Error testing provider:', error.message);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node scripts/test-provider-availability.js [providerId] [baseUrl]

Examples:
  node scripts/test-provider-availability.js
  node scripts/test-provider-availability.js 17302676-0dd3-43b0-b835-84c64f2f7b5c
  node scripts/test-provider-availability.js 17302676-0dd3-43b0-b835-84c64f2f7b5c http://localhost:3000
  node scripts/test-provider-availability.js 17302676-0dd3-43b0-b835-84c64f2f7b5c https://yourdomain.vercel.app

Environment variables:
  NEXTAUTH_URL - Default base URL if not provided as argument

This script will:
1. Check if the provider exists and has proper configuration
2. Test the availability rolling for that specific provider
3. Show detailed information about any issues found
`);
  process.exit(0);
}

// Run the test
testProvider(); 