/**
 * Tests for client cleanup utilities
 */

const { cleanupTestClients } = require('./utils/test-cleanup');
const { db } = require('../src/lib/db');
const path = require('path');
const fs = require('fs');

// Set the database path explicitly
const DB_PATH = path.resolve('./data/email_agent.db');

describe('Test Client Cleanup', () => {
  beforeAll(() => {
    console.log('Testing database connection...');
    console.log('Database path:', DB_PATH);
    
    // Ensure the directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Create clients table if it doesn't exist
    db.connection.prepare(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domains TEXT NOT NULL,
        emails TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run();
  });
  
  // Insert test clients before tests
  beforeEach(() => {
    // Clean up any existing test clients first
    const cleanupStmt = db.connection.prepare(`
      DELETE FROM clients WHERE name IN ('Test Client', 'Test Domain Normalization')
    `);
    cleanupStmt.run();
    
    // Insert test clients for testing
    const testClients = [
      {
        id: 'test-client-id-1',
        name: 'Test Client',
        domains: JSON.stringify(['test.com']),
        emails: JSON.stringify(['test@test.com'])
      },
      {
        id: 'test-client-id-2',
        name: 'Test Domain Normalization',
        domains: JSON.stringify(['normalization.com']),
        emails: JSON.stringify(['test@normalization.com'])
      }
    ];
    
    const insertStmt = db.connection.prepare(`
      INSERT INTO clients (id, name, domains, emails, created_at, updated_at)
      VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
    `);
    
    testClients.forEach(client => {
      insertStmt.run(
        client.id,
        client.name,
        client.domains,
        client.emails
      );
    });
    
    console.log('Inserted test clients for cleanup testing');
  });
  
  test('should clean up test clients', async () => {
    // Verify test clients exist before cleanup
    const beforeCleanupStmt = db.connection.prepare(`
      SELECT COUNT(*) as count FROM clients WHERE name IN ('Test Client', 'Test Domain Normalization')
    `);
    const beforeCount = beforeCleanupStmt.get().count;
    expect(beforeCount).toBe(2);
    
    // Run cleanup
    const result = await cleanupTestClients();
    
    // Verify cleanup was successful
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(2);
    
    // Verify test clients no longer exist
    const afterCleanupStmt = db.connection.prepare(`
      SELECT COUNT(*) as count FROM clients WHERE name IN ('Test Client', 'Test Domain Normalization')
    `);
    const afterCount = afterCleanupStmt.get().count;
    expect(afterCount).toBe(0);
  });
  
  test('should handle empty database', async () => {
    // Clean all clients first
    const cleanupStmt = db.connection.prepare(`
      DELETE FROM clients WHERE name IN ('Test Client', 'Test Domain Normalization')
    `);
    cleanupStmt.run();
    
    // Run cleanup on empty database
    const result = await cleanupTestClients();
    
    // Verify cleanup ran without errors
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(0);
  });
}); 