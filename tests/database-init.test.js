// TODO: This test must be updated to use a dedicated test database.
// It is currently unsafe to run against production or shared dev databases.

// IMPORTANT: Load environment variables before any imports that use them
require('dotenv').config({ path: '.env' });

// Database initialization tests for PostgreSQL

const { execSync } = require('child_process');
const path = require('path');
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

// Use a test-specific database name for PostgreSQL to avoid conflicting with development database
const TEST_PG_DBNAME = 'email_agent_test';

function getRobustConnectionString() {
  let connectionString = getConnectionString();
  if (!connectionString) return null;
  // If the host is 'db', try to connect; if it fails, swap to 'localhost' and try again
  const url = new URL(connectionString);
  if (url.hostname === 'db') {
    // Try original first
    return [connectionString, connectionString.replace('//db:', '//localhost:')];
  }
  return [connectionString];
}

describe('Database Initialization', () => {
  let pool, pgPool;
  
  beforeAll(async () => {
    // Try all possible connection strings until one works
    let lastErr;
    for (const connStr of getRobustConnectionString()) {
      try {
        pgPool = new Pool({ connectionString: connStr });
        pool = new Pool({ connectionString: connStr });
        // Test connection
        await pool.query('SELECT 1');
        return;
      } catch (err) {
        lastErr = err;
        if (pool) await pool.end().catch(() => {});
        if (pgPool) await pgPool.end().catch(() => {});
        pool = undefined;
        pgPool = undefined;
      }
    }
    console.error('Error setting up PostgreSQL test database:', lastErr);
    throw lastErr;
  });
  
  afterAll(async () => {
    try {
      if (pool) await pool.end();
      if (pgPool) await pgPool.end();
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
    // Check that messages table has user_id column
    const result3 = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'user_id'
    `);
    expect(result3.rows.length).toBe(1);
    expect(result3.rows[0].column_name).toBe('user_id');
  });
  
  test('should handle existing database with missing user_id column', async () => {
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
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0].column_name).toBe('user_id');
  });

  test('should add user_id column to messages table if missing (regression)', async () => {
    // Drop and recreate messages table without user_id
    await pool.query('DROP TABLE IF EXISTS messages CASCADE');
    await pool.query(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        "from" TEXT NOT NULL,
        "to" TEXT NOT NULL,
        date TEXT NOT NULL,
        body TEXT NOT NULL,
        attachments TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        summary TEXT NOT NULL,
        labels JSONB NOT NULL,
        cc TEXT DEFAULT '',
        bcc TEXT DEFAULT '',
        processed_for_vector BOOLEAN DEFAULT FALSE
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
      WHERE table_name = 'messages' AND column_name = 'user_id'
    `);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0].column_name).toBe('user_id');
  });
}); 