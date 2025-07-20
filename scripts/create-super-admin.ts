import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createSuperAdmin() {
  try {
    console.log('🔄 Creating super admin user...');
    
    // Use PRODUCTION database
    const supabaseUrl = process.env.SUPABASE_PROD_URL || 'https://itjtaeggupasvrepfkcw.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY;
    
    if (!supabaseServiceKey) {
      console.error('❌ Missing SUPABASE_PROD_SERVICE_ROLE_KEY in .env.local');
      console.log('Please add your PRODUCTION service role key to .env.local');
      return;
    }
    
    console.log('🔥 TARGETING PRODUCTION DATABASE:', supabaseUrl);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Generate a unique ID for the super admin
    const superAdminId = uuidv4();
    const email = 'admin@gmail.com'; // Changed from @skedy.io to work with Supabase
    const password = 'skedy1010';
    
    // Step 1: Check if user already exists
    console.log('Checking for existing user...');
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(user => user.email === email);
    
    let authData;
    if (existingUser) {
      console.log('✅ Auth user already exists:', existingUser.email);
      authData = { user: existingUser };
    } else {
      // Create the auth user
      console.log('Creating auth user...');
      const { data: newAuthData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          firstName: 'Super',
          lastName: 'Admin',
          role: 'super_admin'
        }
      });

      if (authError) {
        console.error('❌ Error creating auth user:', authError);
        return;
      }
      
      authData = newAuthData;
      console.log('✅ Auth user created:', authData.user?.email);
    }

    // Step 2: Check if profile exists, create or update
    console.log('Checking for existing user profile...');
    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user?.id)
      .single();

    let userData;
    if (existingProfile) {
      console.log('✅ User profile already exists, updating role...');
      const { data: updatedData, error: updateError } = await supabase
        .from('users')
        .update({
          role: 'super_admin',
          firstName: 'Super',
          lastName: 'Admin'
        })
        .eq('id', authData.user?.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating user profile:', updateError);
        return;
      }
      userData = updatedData;
    } else {
      console.log('Creating user profile...');
      const { data: newUserData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user?.id,
          firstName: 'Super',
          lastName: 'Admin',
          email: email,
          role: 'super_admin',
          businessId: null // Super admin doesn't belong to a specific business
        })
        .select()
        .single();

      if (userError) {
        console.error('❌ Error creating user profile:', userError);
        return;
      }
      userData = newUserData;
    }

    console.log('✅ Super admin created successfully!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 User ID: ${authData.user?.id}`);
    console.log('\n⚠️  Please change the password after first login!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
createSuperAdmin(); 