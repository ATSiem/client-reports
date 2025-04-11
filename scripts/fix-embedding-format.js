#!/usr/bin/env node

/**
 * Script to reset processed_for_vector flag on all messages
 * This forces the system to regenerate embeddings with the correct format
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

console.log('Embedding Format Fix Script - Starting');
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

async function fixEmbeddingFormat() {
  console.log('Starting embedding format fix script...');
  console.log('Database URL:', process.env.DATABASE_URL?.replace(/(:.*@)/, ':****@'));

  // Create PostgreSQL connection
  console.log('Creating database connection pool...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connected to PostgreSQL');

    // Count emails that have embeddings
    const countResult = await pool.query(`
      SELECT COUNT(*) AS count
      FROM messages
      WHERE embedding IS NOT NULL
    `);
    
    const emailsWithEmbeddings = parseInt(countResult.rows[0]?.count || '0');
    console.log(`Found ${emailsWithEmbeddings} emails with existing embeddings`);
    
    if (emailsWithEmbeddings === 0) {
      console.log('No emails with embeddings to reset');
      return;
    }
    
    // Mark all embeddings as needing reprocessing
    console.log('Marking all embeddings for reprocessing...');
    const updateResult = await pool.query(`
      UPDATE messages
      SET processed_for_vector = false
      WHERE embedding IS NOT NULL
      RETURNING id
    `);
    
    console.log(`Reset processed_for_vector flag for ${updateResult.rowCount} emails`);
    console.log('The background processor will regenerate these embeddings with the correct format');
    
    console.log('Embedding format fix completed successfully');
  } catch (error) {
    console.error('Error fixing embedding format:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    console.log('Closing database connection...');
    await pool.end();
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  console.log('Running embedding format fix script...');
  fixEmbeddingFormat()
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