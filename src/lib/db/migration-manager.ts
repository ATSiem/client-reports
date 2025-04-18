import { db } from './index';
import { addCcBccColumns } from './migrations/add_cc_bcc_columns';
import { addExamplePromptColumn } from './migrations/add_example_prompt_column';
import { addProcessedForVectorColumn } from './migrations/add_processed_for_vector_column';
import { addUserIdToMessages } from './migrations/add_user_id_to_messages';
import * as schema from './schema';

// Function to initialize database tables from schema
async function initializeTables() {
  console.log('Checking database tables...');
  
  try {
    // First, check if messages table exists (as a sample to check if schema is initialized)
    const tablesResult = await db.connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const existingTables = tablesResult.rows.map(row => row.table_name);
    console.log('Existing tables:', existingTables);
    
    // If messages table doesn't exist, create all tables from schema
    if (!existingTables.includes('messages')) {
      console.log('Creating database tables from schema...');
      
      // Create messages table
      console.log('Creating messages table...');
      await db.connection.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          subject TEXT NOT NULL,
          "from" TEXT NOT NULL,
          "to" TEXT NOT NULL,
          date TEXT NOT NULL,
          body TEXT NOT NULL,
          attachments TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          summary TEXT NOT NULL,
          labels JSONB NOT NULL,
          cc TEXT DEFAULT '',
          bcc TEXT DEFAULT '',
          processed_for_vector BOOLEAN DEFAULT FALSE
        )
      `);
      
      // Create clients table
      console.log('Creating clients table...');
      await db.connection.query(`
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          domains JSONB NOT NULL,
          emails JSONB NOT NULL,
          user_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      
      // Create report_templates table
      console.log('Creating report_templates table...');
      await db.connection.query(`
        CREATE TABLE IF NOT EXISTS report_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          format TEXT NOT NULL,
          client_id TEXT REFERENCES clients(id),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          example_prompt TEXT
        )
      `);
      
      // Create report_feedback table
      console.log('Creating report_feedback table...');
      await db.connection.query(`
        CREATE TABLE IF NOT EXISTS report_feedback (
          id TEXT PRIMARY KEY,
          report_id TEXT NOT NULL,
          client_id TEXT REFERENCES clients(id),
          rating INTEGER,
          feedback_text TEXT,
          actions_taken JSONB,
          start_date TEXT,
          end_date TEXT,
          vector_search_used BOOLEAN DEFAULT FALSE,
          search_query TEXT,
          email_count INTEGER,
          copied_to_clipboard BOOLEAN DEFAULT FALSE,
          generation_time_ms INTEGER,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          user_agent TEXT,
          ip_address TEXT
        )
      `);
      
      // Create pgvector extension
      try {
        console.log('Creating pgvector extension...');
        await db.connection.query('CREATE EXTENSION IF NOT EXISTS vector');
        
        // Add embedding column to messages
        console.log('Adding embedding column to messages table...');
        await db.connection.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS embedding vector(1536)');
      } catch (vectorErr) {
        console.error('Error creating vector extension or column:', vectorErr);
        console.log('Continuing with initialization, vector search may not work');
      }
      
      console.log('All tables created successfully');
    } else {
      console.log('Database tables already exist, skipping initialization');
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing database tables:', error);
    return false;
  }
}

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
    
    // First, initialize tables
    const tablesInitialized = await initializeTables();
    if (!tablesInitialized) {
      console.error('Failed to initialize tables, aborting migrations');
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
      { name: 'add_processed_for_vector_column', fn: addProcessedForVectorColumn },
      { name: 'add_user_id_to_messages', fn: addUserIdToMessages },
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