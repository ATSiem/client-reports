// Database initialization script
const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });

console.log('Initializing PostgreSQL database...');
console.log('Database URL:', process.env.DATABASE_URL?.replace(/(:.*@)/, ':****@'));

async function initializeDatabase() {
  try {
    // Create PostgreSQL connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    console.log('Connected to PostgreSQL database');

    // Enable pgvector extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Enabled pgvector extension for AI search');
    
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Migrations table verified');

    // Check if tables exist and create them if they don't
    const tablesExistResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('clients', 'messages', 'report_templates', 'report_feedback');
    `);
    
    const existingTables = tablesExistResult.rows.map(row => row.table_name);
    console.log('Existing tables:', existingTables);

    // Run Drizzle migrations to create missing tables
    if (existingTables.length < 4) {
      console.log('Tables missing, running Drizzle schema migrations...');
      try {
        // Run the migration script
        const migrationScriptPath = path.join(__dirname, 'run-drizzle-migrations.js');
        require(migrationScriptPath);
        console.log('Schema migrations initiated');
      } catch (migrationError) {
        console.error('Error running schema migrations:', migrationError);
      }
    } else {
      console.log('All tables exist, skipping schema migrations');
    }
    
    // Check if the clients table exists before attempting to add the user_id column
    const clientsTableResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'clients';
    `);

    if (clientsTableResult.rows.length > 0) {
      const userIdColumnCheck = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'clients' AND column_name = 'user_id';
      `);
      
      if (userIdColumnCheck.rows.length === 0) {
        console.log('Adding user_id column to clients table...');
        try {
          await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id TEXT;`);
          
          // Record this migration
          await pool.query(`
            INSERT INTO migrations (name)
            VALUES ('add_user_id_column')
            ON CONFLICT (name) DO NOTHING;
          `);
          console.log('Successfully added user_id column to clients table');
        } catch (err) {
          console.error('Error adding user_id column:', err);
        }
      } else {
        console.log('user_id column already exists in clients table');
      }
    } else {
      console.log('clients table does not exist; cannot add user_id column');
    }
    
    // Close the pool
    await pool.end();
    
    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeDatabase();