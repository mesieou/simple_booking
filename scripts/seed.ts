import { createClient } from '../lib/supabase/server';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    console.log('Starting database migrations...');
    const supabase = createClient();

    // Get all migration files and sort them
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Execute each migration in order
    for (const migrationFile of migrationFiles) {
      console.log(`Running migration: ${migrationFile}`);
      const migrationPath = path.join(migrationsDir, migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
      if (error) {
        throw new Error(`Failed to execute migration ${migrationFile}: ${error.message}`);
      }
      console.log(`Completed migration: ${migrationFile}`);
    }

    console.log('All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

main(); 