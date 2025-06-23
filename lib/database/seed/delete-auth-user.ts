// delete-auth-user.ts
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SERVICE_ROLE_KEY);

const deleteAuthUser = async (userId: string) => {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error('Error deleting user from auth.users:', error);
  } else {
    console.log('User deleted from auth.users:', userId);
  }
};

const userId = process.argv[2];
if (!userId) {
  console.error('Please provide a user id as the first argument');
  process.exit(1);
}

deleteAuthUser(userId);