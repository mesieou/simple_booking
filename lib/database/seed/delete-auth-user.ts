// delete-auth-user.ts
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const NEXT_PUBLIC_SUPABASE_URL= 'https://yxavypxuzpjejkezwzjl.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YXZ5cHh1enBqZWprZXp3empsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTI3NjMzMSwiZXhwIjoyMDYwODUyMzMxfQ.HuMNu6S4y7qr8ePp4cFSW4-Kq5VpXooTidvV0JFZdAA';

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