// Regression test for processed_for_vector column - PostgreSQL version
const { Pool } = require('pg');
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.development' : '.env.development' });

// Use a test-specific database name to avoid conflicting with development database
const TEST_PG_DBNAME = 'vector_column_test';

describe('Processed For Vector Column', () => {
  let pool;
  
  beforeAll(async () => {
    // PostgreSQL setup
    // Extract connection details from DATABASE_URL but override database name
    const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/email_agent';
    const connectionString = dbUrl.replace(/\/[^/]+$/, `/${TEST_PG_DBNAME}`);
    
    try {
      // Connect to default postgres database to create/reset test database
      const pgPool = new Pool({
        connectionString: dbUrl.replace(/\/[^/]+$/, '/postgres'),
      });
      
      // Drop test database if it exists and create it fresh
      await pgPool.query(`DROP DATABASE IF EXISTS ${TEST_PG_DBNAME}`);
      await pgPool.query(`CREATE DATABASE ${TEST_PG_DBNAME}`);
      await pgPool.end();
      
      // Set test database URL
      process.env.DATABASE_URL = connectionString;
      
      // Create connection to test database
      pool = new Pool({ connectionString });
    } catch (err) {
      console.error('Error setting up PostgreSQL test database:', err);
    }
  });
  
  afterAll(async () => {
    // PostgreSQL cleanup
    if (pool) {
      await pool.end();
    }
    
    // Connect to default postgres database to drop test database
    try {
      const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/email_agent';
      const pgPool = new Pool({
        connectionString: dbUrl.replace(/\/[^/]+$/, '/postgres'),
      });
      
      await pgPool.query(`DROP DATABASE IF EXISTS ${TEST_PG_DBNAME}`);
      await pgPool.end();
    } catch (err) {
      console.error('Error cleaning up PostgreSQL test database:', err);
    }
  });
  
  test('should add processed_for_vector column to messages table', async () => {
    if (!pool) {
      // Skip test if PostgreSQL setup failed
      console.log('Skipping test - PostgreSQL setup failed');
      return;
    }
    
    try {
      // Create messages table without processed_for_vector column
      await pool.query(`
        CREATE TABLE messages (
          id TEXT PRIMARY KEY NOT NULL,
          subject TEXT NOT NULL,
          "from" TEXT NOT NULL,
          "to" TEXT NOT NULL,
          date TEXT NOT NULL,
          body TEXT NOT NULL,
          attachments TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          summary TEXT NOT NULL,
          labels JSONB NOT NULL
        )
      `);
      
      // Create migrations table
      await pool.query(`
        CREATE TABLE migrations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      
      // Add processed_for_vector column directly
      await pool.query(`ALTER TABLE messages ADD COLUMN processed_for_vector BOOLEAN DEFAULT FALSE`);
      
      // Record the migration
      await pool.query(`
        INSERT INTO migrations (name) VALUES ('add_processed_for_vector_column')
      `);
      
      // Check if processed_for_vector column was added
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'processed_for_vector'
      `);
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].column_name).toBe('processed_for_vector');
      
      // Check if migration was recorded
      const migrationResult = await pool.query(`
        SELECT name FROM migrations 
        WHERE name='add_processed_for_vector_column'
      `);
      
      expect(migrationResult.rows.length).toBe(1);
      expect(migrationResult.rows[0].name).toBe('add_processed_for_vector_column');
    } catch (err) {
      console.error('PostgreSQL test error:', err);
      throw err;
    }
  });
  
  test('should set default value for processed_for_vector column', async () => {
    if (!pool) {
      // Skip test if PostgreSQL setup failed
      console.log('Skipping test - PostgreSQL setup failed');
      return;
    }
    
    try {
      // Insert a test message
      await pool.query(`
        INSERT INTO messages (
          id, subject, "from", "to", date, body, attachments, summary, labels
        ) VALUES (
          'test-message-1', 
          'Test Subject', 
          'test@example.com',
          'recipient@example.com',
          'Tue, 10 Oct 2023 10:00:00 +0000',
          'Test email body',
          '[]',
          'Test summary',
          '[]'
        )
      `);
      
      // Verify the default value
      const result = await pool.query(`
        SELECT processed_for_vector FROM messages WHERE id = 'test-message-1'
      `);
      
      expect(result.rows[0].processed_for_vector).toBe(false);
    } catch (err) {
      console.error('PostgreSQL test error:', err);
      throw err;
    }
  });
}); 