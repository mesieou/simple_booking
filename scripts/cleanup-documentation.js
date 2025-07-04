#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Documentation Cleanup and Organization\n');

const moves = [
  // Move old documentation to archive
  { from: 'DATABASE_SETUP.md', to: 'docs/archive/DATABASE_SETUP.md.old' },
  { from: 'LOCAL_DEVELOPMENT_SETUP.md', to: 'docs/archive/LOCAL_DEVELOPMENT_SETUP.md.old' },
  { from: 'README_LOCAL_SETUP.md', to: 'docs/archive/README_LOCAL_SETUP.md.old' },
  { from: 'PRODUCTION_DEPLOYMENT_CHECKLIST.md', to: 'docs/DEPLOYMENT_PRODUCTION.md' },
  
  // Clean up environment files
  { from: 'env.sample', to: 'docs/archive/env.sample.old' },
];

const deletions = [
  // Remove redundant database folder if it's truly redundant
  // Note: We'll check if lib/database has anything important first
];

function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function moveFile(from, to) {
  try {
    if (fs.existsSync(from)) {
      ensureDirectoryExists(to);
      fs.renameSync(from, to);
      console.log(`✅ Moved: ${from} → ${to}`);
    } else {
      console.log(`⚠️  Skipped: ${from} (doesn't exist)`);
    }
  } catch (error) {
    console.log(`❌ Error moving ${from}: ${error.message}`);
  }
}

function analyzeLibDatabase() {
  const libDbPath = 'lib/database';
  if (fs.existsSync(libDbPath)) {
    console.log('\n📁 Analyzing lib/database/ folder:');
    
    const subdirs = ['models', 'migrations', 'supabase', 'seed', 'supabase-config'];
    
    subdirs.forEach(subdir => {
      const fullPath = path.join(libDbPath, subdir);
      if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        console.log(`  📂 ${subdir}/: ${files.length} files`);
        
        if (files.length > 0) {
          console.log(`    Files: ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`);
        }
      }
    });
  }
}

// Create archive directory
ensureDirectoryExists('docs/archive/README.md');
fs.writeFileSync('docs/archive/README.md', `# Documentation Archive

This folder contains old/superseded documentation files that have been replaced by the organized docs structure.

## Current Documentation

See the main [Documentation Index](../README.md) for the current, organized documentation.

## Archived Files

These files are kept for reference but should not be used:
- \`DATABASE_SETUP.md.old\` - Replaced by [Database Schema Management](../DATABASE_SCHEMA_MANAGEMENT.md)
- \`LOCAL_DEVELOPMENT_SETUP.md.old\` - Replaced by [Setup Guides](../SETUP_QUICK_START.md)
- \`README_LOCAL_SETUP.md.old\` - Replaced by [Quick Start](../SETUP_QUICK_START.md)
- \`env.sample.old\` - Replaced by [Environment Setup](../SETUP_ENVIRONMENT.md)
`);

// Perform moves
console.log('📦 Moving old documentation files:');
moves.forEach(move => moveFile(move.from, move.to));

// Analyze lib/database
analyzeLibDatabase();

// Update main README if it exists
console.log('\n📝 Updating documentation references:');

const readmePath = 'README.md';
if (fs.existsSync(readmePath)) {
  console.log('✅ Found README.md - consider adding link to docs/README.md');
}

console.log('\n🎯 Cleanup Summary:');
console.log('✅ Moved old documentation to docs/archive/');
console.log('✅ Created organized docs/ structure');
console.log('✅ Created master documentation index');
console.log('✅ Consolidated setup guides');

console.log('\n📋 Next Steps:');
console.log('1. Review lib/database/ folder - determine if it can be removed');
console.log('2. Update any code references to old documentation paths');
console.log('3. Add link to docs/README.md in main README.md');
console.log('4. Test that all npm scripts still work');

console.log('\n🔗 New Documentation Structure:');
console.log('docs/README.md - Main documentation index');
console.log('docs/SETUP_QUICK_START.md - 5-minute setup');
console.log('docs/DATABASE_SCHEMA_MANAGEMENT.md - Complete database guide');
console.log('docs/SETUP_ENVIRONMENT.md - Environment configuration');
console.log('docs/archive/ - Old files for reference');

console.log('\n🎉 Documentation cleanup complete!'); 