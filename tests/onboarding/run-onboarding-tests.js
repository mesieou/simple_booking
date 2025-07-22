#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Running Onboarding Flow Integration Tests');
console.log('==========================================');

// Change to tests/onboarding directory
process.chdir(__dirname);

// Run Jest with custom config
const jest = spawn('npx', ['jest', '--config', 'jest.config.js', '--verbose', '--runInBand'], {
  stdio: 'inherit',
  cwd: __dirname
});

jest.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ All onboarding tests passed!');
  } else {
    console.log('\n❌ Some onboarding tests failed.');
    process.exit(code);
  }
});

jest.on('error', (error) => {
  console.error('❌ Error running tests:', error);
  process.exit(1);
});