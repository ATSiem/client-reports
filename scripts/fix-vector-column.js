#!/usr/bin/env node

/**
 * Script to fix the embedding column type in PostgreSQL
 * This converts the column from TEXT to VECTOR type
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

console.log('Vector Column Fix Script - Starting');
console.log('Current working directory:', process.cwd());

// Load environment variables with more debug output
console.log('Loading environment variables...');
let loaded = false;
try {
  loaded = dotenv.config({ path: '.env.development' });
  console.log('Dotenv loaded:', loaded);
} catch (e) {
  console.error('Error loading .env.development:', e);
}

// Make sure we have DATABASE_URL
console.log('Database URL available:', !!process.env.DATABASE_URL);
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  console.log('Checking for other env files...');
  try {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/email_agent';
    console.log('Using fallback connection string:', process.env.DATABASE_URL.replace(/(:.*@)/, ':****@'));
  } catch (e) {
    console.error('Error setting fallback DATABASE_URL:', e);
  }
}

async function fixVectorColumn() {
  console.log('Starting vector column fix script...');
  console.log('Database URL:', process.env.DATABASE_URL?.replace(/(:.*@)/, ':****@'));

  // Create PostgreSQL connection
  console.log('Creating database connection pool...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connected to PostgreSQL');

    // Check current column type
    console.log('Checking current column type...');
    const columnTypeResult = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'embedding'
    `);

    console.log('Column type query result rows:', columnTypeResult.rows.length);

    if (columnTypeResult.rows.length === 0) {
      console.log('No embedding column found in messages table');
      return;
    }

    const currentType = columnTypeResult.rows[0].data_type;
    const udtName = columnTypeResult.rows[0].udt_name;
    console.log(`Current embedding column type: ${currentType}, UDT: ${udtName}`);

    if (currentType !== 'text' && udtName !== 'text') {
      console.log('Embedding column is not TEXT type, no conversion needed');
      return;
    }

    // Ensure vector extension exists
    console.log('Ensuring pgvector extension exists...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    console.log('Creating new vector column...');
    
    // Create a temporary column with the correct type
    await pool.query(`ALTER TABLE messages ADD COLUMN embedding_new vector(1536)`);
    
    // Mark all records as needing reprocessing for vector embeddings
    console.log('Marking records for reprocessing...');
    await pool.query(`UPDATE messages SET processed_for_vector = false WHERE embedding IS NOT NULL`);
    
    // Drop the old column and rename the new one
    console.log('Dropping old column and renaming new one...');
    await pool.query(`ALTER TABLE messages DROP COLUMN embedding`);
    await pool.query(`ALTER TABLE messages RENAME COLUMN embedding_new TO embedding`);
    
    console.log('Embedding column successfully converted to VECTOR type');
    
    // Verify the change
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'embedding'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('Verification - New column type:', 
        verifyResult.rows[0].data_type, 
        verifyResult.rows[0].udt_name);
    }

    console.log('Vector column fix completed successfully');
  } catch (error) {
    console.error('Error fixing vector column:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    console.log('Closing database connection...');
    await pool.end();
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  console.log('Running vector column fix script...');
  fixVectorColumn()
    .then(() => {
      console.log('Script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed with error:', error);
      process.exit(1);
    });
} else {
  console.log('Module imported, not running directly');
} 