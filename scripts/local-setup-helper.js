#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 Local Development Environment Checker\n');

const checks = [
  {
    name: 'Node.js',
    command: 'node --version',
    required: true
  },
  {
    name: 'npm',
    command: 'npm --version',
    required: true
  },
  {
    name: 'Docker',
    command: 'docker --version',
    required: true
  },
  {
    name: 'Colima',
    command: 'colima status',
    required: true
  },
  {
    name: 'Supabase CLI',
    command: 'supabase --version',
    required: true
  },
  {
    name: 'PostgreSQL Client',
    command: 'psql --version',
    required: true
  }
];

const fileChecks = [
  {
    name: '.env.local',
    path: '.env.local',
    required: true
  },
  {
    name: 'node_modules',
    path: 'node_modules',
    required: true
  },
  {
    name: 'Schema backup',
    path: 'supabase/migrations_backup/20250702024633_remote_schema.sql',
    required: true
  }
];

function runCheck(check) {
  try {
    const result = execSync(check.command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${check.name}: ${result.trim()}`);
    return true;
  } catch (error) {
    console.log(`❌ ${check.name}: Not installed or not working`);
    return false;
  }
}

function checkFile(check) {
  try {
    if (fs.existsSync(check.path)) {
      console.log(`✅ ${check.name}: Found`);
      return true;
    } else {
      console.log(`❌ ${check.name}: Missing`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${check.name}: Error checking`);
    return false;
  }
}

// Run command checks
console.log('📦 Software Dependencies:');
const commandResults = checks.map(runCheck);

console.log('\n📁 File Dependencies:');
const fileResults = fileChecks.map(checkFile);

// Check Supabase status
console.log('\n🗄️ Supabase Status:');
try {
  const supabaseStatus = execSync('supabase status', { encoding: 'utf8', stdio: 'pipe' });
  if (supabaseStatus.includes('API URL') && supabaseStatus.includes('54321')) {
    console.log('✅ Supabase: Running');
  } else {
    console.log('⚠️  Supabase: Not started (run: supabase start)');
  }
} catch (error) {
  console.log('❌ Supabase: Not running (run: supabase start)');
}

// Check database connection
console.log('\n🔗 Database Connection:');
try {
  const dbCheck = execSync('psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT 1" 2>/dev/null', { encoding: 'utf8', stdio: 'pipe' });
  console.log('✅ Database: Connected');
  
  // Check for tables
  try {
    const tableCheck = execSync('psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\\dt" 2>/dev/null', { encoding: 'utf8', stdio: 'pipe' });
    if (tableCheck.includes('businesses') && tableCheck.includes('users')) {
      console.log('✅ Schema: Loaded');
    } else {
      console.log('⚠️  Schema: Not loaded (run schema loading command)');
    }
  } catch (error) {
    console.log('❌ Schema: Not loaded');
  }
  
  // Check vector extension
  try {
    const vectorCheck = execSync('psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT extname, extversion FROM pg_extension WHERE extname = \'vector\';" 2>/dev/null', { encoding: 'utf8', stdio: 'pipe' });
    if (vectorCheck.includes('vector')) {
      console.log('✅ Vector Extension: Installed');
    } else {
      console.log('❌ Vector Extension: Not installed');
    }
  } catch (error) {
    console.log('❌ Vector Extension: Cannot check');
  }
} catch (error) {
  console.log('❌ Database: Cannot connect');
}

// Summary
const allPassed = [...commandResults, ...fileResults].every(result => result);
console.log('\n📊 Summary:');
if (allPassed) {
  console.log('🎉 All checks passed! You\'re ready to start development.');
  console.log('\nNext steps:');
  console.log('1. Start Supabase: supabase start');
  console.log('2. Load schema (if not done): psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/migrations_backup/20250702024633_remote_schema.sql');
  console.log('3. Start development: npm run dev');
} else {
  console.log('⚠️  Some checks failed. Please review the setup guide: LOCAL_DEVELOPMENT_SETUP.md');
}

console.log('\n🔗 Useful Commands:');
console.log('npm run setup:check     - Run this checker again');
console.log('npm run db:help         - Show database commands');
console.log('supabase start          - Start local Supabase');
console.log('npm run dev             - Start development server');
console.log('supabase status         - Check Supabase status'); 