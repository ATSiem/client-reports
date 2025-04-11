// PostgreSQL database connection tests
const { Pool } = require('pg');
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });

// Get database connection string (for diagnostic purposes only)
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/email_agent';

describe('Database Connection Tests', () => {
  let pool;
  
  beforeAll(async () => {
    console.log('Testing PostgreSQL database connection...');
    console.log('Database URL:', DATABASE_URL.replace(/(:.*@)/, ':****@'));
    
    // Create a connection pool
    pool = new Pool({
      connectionString: DATABASE_URL,
    });
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