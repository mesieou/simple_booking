#!/usr/bin/env node

/**
 * Script to check Supabase authentication configuration
 * This helps verify that redirect URLs are properly configured
 */

const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuthConfig() {
  console.log('🔍 Checking Supabase authentication configuration...\n');
  
  console.log('📋 Current Configuration:');
  console.log(`   Supabase URL: ${supabaseUrl}`);
  console.log(`   Site URL: ${siteUrl}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
  
  console.log('⚠️  IMPORTANT: Manual Configuration Required');
  console.log('You need to configure the following in your Supabase Dashboard:\n');
  
  console.log('1. Go to: https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to: Authentication → URL Configuration');
  console.log('4. Set Site URL to:', siteUrl);
  console.log('5. Add these Redirect URLs:');
  console.log(`   - ${siteUrl}/auth/callback`);
  console.log(`   - ${siteUrl}/api/auth/callback`);
  console.log(`   - ${siteUrl}/protected/reset-password`);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   - http://localhost:3000/auth/callback`);
    console.log(`   - http://localhost:3000/api/auth/callback`);
    console.log(`   - http://localhost:3000/protected/reset-password`);
  }
  
  console.log('\n6. Save the configuration');
  console.log('\n✅ After configuring, your auth redirects should work properly!');
}

checkAuthConfig().catch(console.error); 