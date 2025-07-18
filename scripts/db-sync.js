#!/usr/bin/env node

/**
 * Database Schema Synchronization Script
 * 
 * This script helps manage schema synchronization between development and production
 * Supabase databases using the Supabase CLI.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Configuration
const PROJECTS = {
  dev: {
    ref: 'yxavypxuzpjejkezwzjl',
    name: 'skedy-dev'
  },
  prod: {
    ref: 'itjtaeggupasvrepfkcw', 
    name: 'skedy-prod'
  }
};

function execCommand(command, description, environment = 'dev') {
  console.log(`\n🔄 ${description}`);
  console.log(`Command: ${command}`);
  
  // Set up environment variables for database authentication
  const env = { ...process.env };
  
  if (environment === 'dev') {
    env.PGPASSWORD = process.env.DB_PASSWORD;
  } else if (environment === 'prod') {
    env.PGPASSWORD = process.env.SUPABASE_PROD_PASSWORD || process.env.DB_PASSWORD;
  }
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'inherit',
      env: env
    });
    console.log(`✅ ${description} completed successfully`);
    return output;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function checkEnvironmentSetup() {
  console.log('🔍 Checking environment setup...');
  
  // Check if .env.local exists
  if (!fs.existsSync('.env.local')) {
    console.log('⚠️  .env.local not found. Please create it using the env.sample file.');
    console.log('cp env.sample .env.local');
    console.log('Then update it with your actual Supabase credentials.');
    process.exit(1);
  }
  
  console.log('✅ Environment files found');
  
  // Check critical environment variables
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'DB_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log('⚠️  Missing required environment variables:');
    missing.forEach(key => console.log(`   - ${key}`));
    console.log('Please update your .env.local file with the missing values.');
    process.exit(1);
  }
  
  console.log('✅ Required environment variables found');
}

function linkToProject(environment) {
  const project = PROJECTS[environment];
  if (!project) {
    console.error(`❌ Invalid environment: ${environment}`);
    process.exit(1);
  }
  
  // Get the password for this environment
  const password = environment === 'dev' ? process.env.DB_PASSWORD : process.env.SUPABASE_PROD_PASSWORD;
  
  if (!password) {
    console.error(`❌ Database password not found for ${environment} environment`);
    console.error(`Please set ${environment === 'dev' ? 'DB_PASSWORD' : 'SUPABASE_PROD_PASSWORD'} in your .env.local`);
    process.exit(1);
  }
  
  // Pass password using the --password flag to avoid interactive prompt
  execCommand(
    `supabase link --project-ref ${project.ref} --password "${password}"`,
    `Linking to ${project.name} (${environment})`,
    environment
  );
}

function pullSchema(environment) {
  const project = PROJECTS[environment];
  execCommand(
    `supabase db pull --linked`,
    `Pulling schema from ${project.name} (${environment})`,
    environment
  );
}

function pushSchema(environment) {
  const project = PROJECTS[environment];
  execCommand(
    `supabase db push --linked --include-all`,
    `Pushing schema to ${project.name} (${environment})`,
    environment
  );
}

function generateMigration(name) {
  execCommand(
    `supabase migration new ${name}`,
    `Creating new migration: ${name}`
  );
}

function showDiff() {
  execCommand(
    `supabase db diff`,
    'Showing schema differences'
  );
}

function resetLocal() {
  execCommand(
    `supabase db reset`,
    'Resetting local database'
  );
}

function generateMigrationFromSchema(environment) {
  const project = PROJECTS[environment];
  execCommand(
    `supabase db diff --schema supabase/schema.sql`,
    `Generating migration from schema changes (${environment})`,
    environment
  );
}

function showHelp() {
  console.log(`
🗄️  Database Schema Synchronization Tool

Available commands:

Environment Management:
  check-env              Check environment setup
  link-dev              Link to development database
  link-prod             Link to production database

Schema Operations (Dashboard-Based):
  pull-dev              Pull schema from development
  pull-prod             Pull schema from production  
  push-dev              Push migrations to development
  push-prod             Push migrations to production

Schema-First Operations (File-Based):
  schema-diff-dev       Generate migration from supabase/schema.sql vs dev
  schema-diff-prod      Generate migration from supabase/schema.sql vs prod
  schema-apply-dev      Apply schema changes to development
  schema-apply-prod     Apply schema changes to production

Migration Management:
  new-migration <name>  Create new migration
  diff                  Show schema differences
  reset                 Reset local database

Workflow Examples:

🎯 SCHEMA-FIRST WORKFLOW (Recommended):
1. Edit supabase/schema.sql file directly
2. npm run db:schema-diff-dev     # Generate migration
3. npm run db:schema-apply-dev    # Apply to development
4. npm run db:schema-apply-prod   # Deploy to production

📊 DASHBOARD WORKFLOW:
1. Make changes in Supabase Dashboard
2. npm run db:pull-dev           # Pull changes
3. npm run db:push-prod          # Deploy to production

🛠️ MANUAL WORKFLOW:
1. npm run db:new-migration "description"
2. Edit migration file manually
3. npm run db:push-dev
4. npm run db:push-prod
`);
}

// Main command handler
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'check-env':
    checkEnvironmentSetup();
    break;
  case 'link-dev':
    linkToProject('dev');
    break;
  case 'link-prod':
    linkToProject('prod');
    break;
  case 'pull-dev':
    linkToProject('dev');
    pullSchema('dev');
    break;
  case 'pull-prod':
    linkToProject('prod');
    pullSchema('prod');
    break;
  case 'push-dev':
    linkToProject('dev');
    pushSchema('dev');
    break;
  case 'push-prod':
    linkToProject('prod');
    pushSchema('prod');
    break;
  case 'schema-diff-dev':
    linkToProject('dev');
    generateMigrationFromSchema('dev');
    break;
  case 'schema-diff-prod':
    linkToProject('prod');
    generateMigrationFromSchema('prod');
    break;
  case 'schema-apply-dev':
    linkToProject('dev');
    pushSchema('dev');
    break;
  case 'schema-apply-prod':
    linkToProject('prod');
    pushSchema('prod');
    break;
  case 'new-migration':
    if (!arg) {
      console.error('❌ Migration name required');
      process.exit(1);
    }
    generateMigration(arg);
    break;
  case 'diff':
    showDiff();
    break;
  case 'reset':
    resetLocal();
    break;
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  default:
    console.error('❌ Unknown command:', command);
    showHelp();
    process.exit(1);
} 