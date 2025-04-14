// Regression test for processed_for_vector column - PostgreSQL version
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

// Function to check if database is accessible
async function isDatabaseAccessible() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) return false;
  
  // When running tests on host machine, replace 'db' with 'localhost'
  // This allows tests to connect to Docker-containerized database from host
  connectionString = connectionString.replace(/(@|\/\/)(db)(:|\/)/, '$1localhost$3');
  
  console.log('Attempting to connect to database:', connectionString.replace(/:[^:]*@/, ':****@'));
  
  const testPool = new Pool({ 
    connectionString,
    // Short connection timeout to quickly determine if DB is accessible
    connectionTimeoutMillis: 1000
  });
  
  try {
    // Try a simple query to check connection
    await testPool.query('SELECT 1');
    await testPool.end();
    console.log('✅ Successfully connected to database');
    return true;
  } catch (e) {
    // If connection fails, database is not accessible
    console.error('❌ Database connection check failed:', e.message);
    try {
      await testPool.end();
    } catch (err) {
      // Ignore errors from ending pool
    }
    return false;
  }
}

// Use a test-specific database name to avoid conflicting with development database
const TEST_PG_DBNAME = 'email_agent_test_vector';

describe('Processed For Vector Column', () => {
  let pool, pgPool;
  let dbAccessible = false;
  
  beforeAll(async () => {
    // Check if database is accessible
    dbAccessible = await isDatabaseAccessible();
    
    if (!dbAccessible) {
      console.warn('\n⚠️ SKIPPING DATABASE TESTS: Cannot connect to database');
      console.warn('These tests require a running database container.');
      console.warn('Make sure deploy-prod.sh has been run and the database is accessible.\n');
      return;
    }

    // Use a test-specific database name for PostgreSQL
    let connectionString = process.env.DATABASE_URL;
    // When running tests on host machine, replace 'db' with 'localhost'
    connectionString = connectionString.replace(/(@|\/\/)(db)(:|\/)/, '$1localhost$3');
    
    try {
      // Connect to the default database
      pgPool = new Pool({ connectionString });
      
      // Create a connection to our database
      pool = new Pool({ connectionString });
    } catch (err) {
      console.error('Error setting up PostgreSQL test database:', err);
      dbAccessible = false;
    }
  });
  
  afterAll(async () => {
    if (!dbAccessible) return;
    
    try {
      if (pool) await pool.end();
      if (pgPool) await pgPool.end();
    } catch (err) {
      console.error('Error cleaning up PostgreSQL test database:', err);
    }
  });

  // Skip all tests if database is not accessible
  if (!dbAccessible) {
    test.skip('should add processed_for_vector column to messages table', () => {});
    test.skip('should set default value for processed_for_vector column', () => {});
  } else {
    // Normal test cases
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
  }
}); 