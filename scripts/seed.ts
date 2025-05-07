import { createClient } from '../lib/supabase/server';

async function main() {
  try {
    console.log('Starting database seeding...');
    const supabase = createClient();
    // Add your seeding logic here using the admin client
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

main(); 