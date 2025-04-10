import { db } from './index';
import { addCcBccColumns } from './migrations/add_cc_bcc_columns';
import { addExamplePromptColumn } from './migrations/add_example_prompt_column';
import { addProcessedForVectorColumn } from './migrations/add_processed_for_vector_column';

/**
 * This function sets up and runs all database migrations
 */
export async function runMigrations() {
  console.log('Starting database migrations...');
  
  try {
    // Check if db is properly initialized
    if (!db || !db.connection) {
      console.error('Database not properly initialized for migrations');
      return false;
    }
    
    // Create migrations table if it doesn't exist
    await db.connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    
    // Check if migrations have been run
    const migrationsResult = await db.connection.query('SELECT name FROM migrations');
    const appliedMigrations = new Set(migrationsResult.rows.map(m => m.name));
    
    console.log('Already applied migrations:', Array.from(appliedMigrations));
    
    // Define migrations
    const migrations = [
      { name: 'add_cc_bcc_columns', fn: addCcBccColumns },
      { name: 'add_example_prompt_column', fn: addExamplePromptColumn },
      { name: 'add_processed_for_vector_column', fn: addProcessedForVectorColumn }
    ];
    
    // Run migrations that haven't been applied yet
    for (const migration of migrations) {
      if (!appliedMigrations.has(migration.name)) {
        console.log(`Running migration: ${migration.name}`);
        const success = await migration.fn();
        
        if (success) {
          // Record the migration as applied
          await db.connection.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [migration.name]
          );
          
          console.log(`Migration ${migration.name} completed and recorded`);
        } else {
          console.error(`Migration ${migration.name} failed`);
          throw new Error(`Migration ${migration.name} failed`);
        }
      } else {
        console.log(`Skipping already applied migration: ${migration.name}`);
      }
    }
    
    console.log('All migrations completed');
    return true;
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error; // Re-throw to ensure calling code knows migrations failed
  }
} 