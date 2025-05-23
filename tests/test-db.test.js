// TODO: This test must be updated to use a dedicated test database.
// It is currently unsafe to run against production or shared dev databases.

// IMPORTANT: Load environment variables before any imports that use them
require('dotenv').config({ path: '.env' });

// PostgreSQL database connection tests
const { Pool } = require('pg');
const { getConnectionString } = require('../src/lib/db/index');

// Function to check if database is accessible
async function isDatabaseAccessible() {
  let connectionString = getConnectionString();
  if (!connectionString) return false;
  
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

describe('Database Connection Tests', () => {
  let pool;
  let connectionString = getConnectionString();
  
  beforeAll(async () => {
    console.log('Testing PostgreSQL database connection...');
    // Always attempt to connect to the database
    // Get database connection string (for diagnostic purposes only)
    const sanitizedConnectionString = connectionString?.replace(/:[^:]*@/, ':****@');
    console.log('Using Database URL:', sanitizedConnectionString);
    // Create a connection pool
    pool = new Pool({ connectionString });
  });
  
  afterAll(async () => {
    if (pool) {
      await pool.end();
      console.log('Database connection pool closed');
    }
  });

  test('can connect to database', async () => {
    // Basic connection test
    const result = await pool.query('SELECT 1 as connected');
    expect(result.rows[0].connected).toBe(1);
  });
  
  test('database has required tables', async () => {
    // Check if required tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('clients', 'messages', 'report_templates', 'report_feedback')
    `);
    const tableNames = result.rows.map(row => row.table_name);
    // Check for required tables
    expect(tableNames).toContain('clients');
    expect(tableNames).toContain('messages');
    expect(tableNames).toContain('report_templates');
    expect(tableNames).toContain('report_feedback');
  });
  
  test('can query clients table', async () => {
    // Test query on clients table
    const result = await pool.query('SELECT COUNT(*) as count FROM clients');
    // Convert PostgreSQL count string to number
    const count = parseInt(result.rows[0].count, 10);
    // Just verify we can query the table
    expect(count).toBeGreaterThanOrEqual(0);
  });
  
  test('client schema includes user_id column', async () => {
    // Check if user_id column exists in clients table
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'user_id'
    `);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].column_name).toBe('user_id');
  });
}); 