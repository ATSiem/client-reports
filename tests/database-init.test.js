// Database initialization tests for PostgreSQL

const { execSync } = require('child_process');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });

// Use a test-specific database name for PostgreSQL to avoid conflicting with development database
const TEST_PG_DBNAME = 'email_agent_test';

describe('Database Initialization', () => {
  let pool;
  
  beforeAll(async () => {
    // PostgreSQL setup
    // Extract connection details from DATABASE_URL but override database name
    const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/email_agent';
    const connectionString = dbUrl.replace(/\/[^/]+$/, `/${TEST_PG_DBNAME}`);
    
    // Connect to default postgres database to create/reset test database
    const pgPool = new Pool({
      connectionString: dbUrl.replace(/\/[^/]+$/, '/postgres'),
    });
    
    try {
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
  
  test('should create database with correct schema', async () => {
    // Drop tables if they exist to simulate a fresh start
    await pool.query("DROP TABLE IF EXISTS clients, messages, report_templates, report_feedback CASCADE");

    // Run the initialization script to create tables
    execSync('node scripts/init-database.js', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });

    // Query for expected tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('clients', 'messages', 'report_templates', 'report_feedback')
    `);

    const tableNames = result.rows.map(row => row.table_name);
    expect(tableNames).toContain('clients');
    expect(tableNames).toContain('messages');
    expect(tableNames).toContain('report_templates');
    expect(tableNames).toContain('report_feedback');

    // Check that clients table has user_id column
    const result2 = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'user_id'
    `);
    expect(result2.rows.length).toBe(1);
    expect(result2.rows[0].column_name).toBe('user_id');
  });
  
  test('should handle existing database with missing user_id column', async () => {
    if (!pool) {
      // Skip test if PostgreSQL setup failed
      console.log('Skipping test - PostgreSQL setup failed');
      return;
    }
    
    try {
      // Create clients table without user_id column
      await pool.query(`
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          domains JSONB NOT NULL,
          emails JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )
      `);
      
      // Run the initialization script which should add the user_id column
      execSync('node scripts/init-database.js', {
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      });
      
      // Check if user_id column was added
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'user_id'
      `);
      
      // Verify column exists
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].column_name).toBe('user_id');
    } catch (err) {
      console.error('PostgreSQL test error:', err);
      throw err;
    }
  });
}); 