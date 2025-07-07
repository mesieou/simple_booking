/**
 * Import this file to enable clean, focused logging for development
 * This reduces the noise from legacy logging while keeping our new structured logs
 */

import { enableLogFiltering } from './log-filter';

// Enable the log filtering immediately
enableLogFiltering();

console.log('\n🚀 Clean logging enabled! Now you\'ll see:');
console.log('   🚀 JOURNEY logs - Major milestones');
console.log('   → FLOW logs - Step transitions'); 
console.log('   ℹ️  INFO logs - Important events');
console.log('   ⚠️  WARN logs - Issues to watch');
console.log('   ❌ ERROR logs - Problems that need fixing');
console.log('   💾 Simplified state updates');
console.log('   👤 User context events');
console.log('   🔄 Session management\n');

console.log('📝 Legacy noise (Environment, User lookups, DEBUG info) is now filtered out');
console.log('🔊 To restore full verbosity: import { disableLogFiltering } from "./log-filter"\n');

export { enableLogFiltering, disableLogFiltering } from './log-filter'; 