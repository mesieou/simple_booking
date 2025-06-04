import { createClient } from '../lib/database/supabase/server';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    console.log('Starting database migration...');
    const supabase = await createClient();

    // Read and execute the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '002_create_crawl_sessions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    if (error) {
      throw new Error(`Failed to execute migration: ${error.message}`);
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

main(); 