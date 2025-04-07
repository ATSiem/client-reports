/**
 * Test client utilities for creating and managing test clients
 */

const { db } = require('../../src/lib/db');
const { cleanupTestClients } = require('./test-cleanup');
const { setupTestClientCleanup } = require('./test-setup');

/**
 * Ensure the clients table exists in the database
 * This is especially important when using in-memory databases during tests
 */
function ensureClientsTableExists() {
  try {
    // Create the clients table if it doesn't exist
    db.connection.prepare(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domains TEXT NOT NULL,
        emails TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        user_id TEXT
      )
    `).run();
    console.log('Ensured clients table exists for tests');
    return true;
  } catch (error) {
    console.error('Error ensuring clients table exists:', error);
    return false;
  }
}

/**
 * Create test clients for testing purposes with automatic cleanup
 * 
 * @param {object} options - Options for client creation
 * @param {boolean} options.cleanupAfterEach - Whether to clean up after each test (default: false, uses afterAll instead)
 * @param {boolean} options.skipCleanup - Skip setting up cleanup hooks (for manual cleanup)
 * @returns {Array<{id: string, name: string, domains: string, emails: string}>} The created test clients
 */
function createTestClients(options = {}) {
  const cleanupAfterEach = options.cleanupAfterEach || false;
  const skipCleanup = options.skipCleanup || false;
  
  // First ensure the clients table exists
  if (!ensureClientsTableExists()) {
    throw new Error('Failed to create clients table for tests');
  }
  
  // The test client configurations
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
  
  try {
    // Clean up any existing test clients first
    const cleanupStmt = db.connection.prepare(`
      DELETE FROM clients WHERE name IN ('Test Client', 'Test Domain Normalization')
    `);
    cleanupStmt.run();
    
    // Insert test clients
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
    
    console.log('Created test clients for testing');
    
    // Set up cleanup unless skipped
    if (!skipCleanup) {
      setupTestClientCleanup({
        when: cleanupAfterEach ? 'afterEach' : 'afterAll',
        clientNames: testClients.map(c => c.name)
      });
    }
    
    return testClients;
  } catch (error) {
    console.error('Error creating test clients:', error);
    throw error;
  }
}

/**
 * Manually clean up test clients
 * 
 * @param {string[]} clientNames - Names of clients to clean up
 * @returns {Promise<{success: boolean, deleted: number, error?: Error}>}
 */
async function deleteTestClients(clientNames = ['Test Client', 'Test Domain Normalization']) {
  // Ensure the table exists before trying to delete
  ensureClientsTableExists();
  return cleanupTestClients(clientNames);
}

module.exports = {
  createTestClients,
  deleteTestClients,
  ensureClientsTableExists
}; 