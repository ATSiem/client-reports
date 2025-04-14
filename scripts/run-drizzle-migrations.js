// Run Drizzle schema migrations to create database tables
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

async function runDrizzleMigrations() {
  console.log('Running Drizzle schema migrations...');
  console.log('Database URL:', process.env.DATABASE_URL?.replace(/(:.*@)/, ':****@'));

  try {
    // Create PostgreSQL connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    console.log('Connected to PostgreSQL for schema migrations');

    // Check for vector extension in development mode
    let vectorExtensionAvailable = true;
    if (process.env.NODE_ENV === 'development') {
      try {
        // Try to check if the vector extension is available
        await pool.query(`SELECT 'vector'::regtype;`);
        console.log('Vector extension is available');
      } catch (e) {
        console.log('Vector extension is not available in development mode, will use TEXT for the embedding column');
        vectorExtensionAvailable = false;
      }
    }

    // Read schema.sql file which contains the table definitions
    const schemaDir = path.join(__dirname, '../src/lib/db/migrations');
    let schemaPath = path.join(schemaDir, 'schema.sql');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(schemaDir)) {
      console.log('Creating migrations directory:', schemaDir);
      fs.mkdirSync(schemaDir, { recursive: true });
    }
    
    // If the schema file doesn't exist, create it from our schema definitions
    if (!fs.existsSync(schemaPath)) {
      console.log('Schema file not found, creating from scripts/schema.sql');
      
      // Here's the SQL for creating the database tables - copied from the schema.ts
      let schemaSQL = `
-- Create tables for the application

-- Messages table for storing email data
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  date TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  summary TEXT NOT NULL,
  labels JSONB DEFAULT '[]' NOT NULL,
  cc TEXT DEFAULT '',
  bcc TEXT DEFAULT '',
  embedding ${vectorExtensionAvailable ? 'VECTOR(1536)' : 'TEXT'},
  processed_for_vector BOOLEAN DEFAULT FALSE
);

-- Clients table for storing client information
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domains JSONB NOT NULL,
  emails JSONB NOT NULL,
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Report templates table for storing report formats
CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  example_prompt TEXT
);

-- Report feedback table for storing user feedback on reports
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  user_agent TEXT,
  ip_address TEXT
);
      `;
      
      // Write the schema SQL to a file
      fs.writeFileSync(schemaPath, schemaSQL, 'utf8');
      console.log('Created schema.sql file');
    } else {
      // If schema file exists but we need to modify it for development
      if (!vectorExtensionAvailable && process.env.NODE_ENV === 'development') {
        let schemaSql = fs.readFileSync(schemaPath, 'utf8');
        // Replace VECTOR type with TEXT type for development
        schemaSql = schemaSql.replace(/embedding VECTOR\(1536\)/g, 'embedding TEXT');
        // Use the modified schema
        const devSchemaPath = schemaPath + '.dev';
        fs.writeFileSync(devSchemaPath, schemaSql, 'utf8');
        console.log('Created development-compatible schema.sql file');
        schemaPath = devSchemaPath;
      }
    }
    
    // Read the schema SQL
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Run the schema SQL to create tables
    await pool.query(schemaSql);
    console.log('Schema migrations executed successfully');
    
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Migrations table created');
    
    // Close the pool
    await pool.end();
    
    console.log('Drizzle schema migrations completed successfully!');
    return true;
  } catch (error) {
    console.error('Drizzle schema migrations failed:', error);
    throw error;
  }
}

// Run the migrations
runDrizzleMigrations().catch(error => {
  console.error('Error running Drizzle schema migrations:', error);
  process.exit(1);
});