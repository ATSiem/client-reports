// Database initialization script
const { Pool } = require('pg');
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

    // Tables will be created by Drizzle migrations, so we don't need to create them here
    
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