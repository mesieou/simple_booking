const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSuperAdmin() {
  try {
    console.log('Creating superadmin user...');
    
    // Create a business for the superadmin (required by the schema)
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        name: 'System Administration',
        description: 'System administration business for superadmin',
        contactPhone: '+1234567890',
        contactEmail: 'admin@system.com',
        address: 'System Address',
        city: 'System City',
        state: 'System State',
        country: 'System Country',
        postalCode: '00000',
        timezone: 'UTC',
        isActive: true
      })
      .select()
      .single();

    if (businessError) {
      console.error('Error creating business:', businessError);
      return;
    }

    console.log('Business created:', business.id);

    // Create the superadmin user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'superadmin@example.com',
      password: 'superadmin123',
      email_confirm: true,
      user_metadata: {
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin'
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }

    console.log('Auth user created:', authUser.user.id);

    // Create the user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin',
        businessId: business.id,
        email: 'superadmin@example.com'
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      return;
    }

    console.log('✅ Superadmin created successfully!');
    console.log('Email: superadmin@example.com');
    console.log('Password: superadmin123');
    console.log('User ID:', authUser.user.id);
    console.log('Business ID:', business.id);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createSuperAdmin(); 