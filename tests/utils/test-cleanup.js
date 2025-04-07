/**
 * Test cleanup utilities
 * 
 * This file contains utility functions to clean up test data after tests
 */

const { db } = require('../../src/lib/db');

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
    return true;
  } catch (error) {
    console.error('Error ensuring clients table exists:', error);
    return false;
  }
}

/**
 * Clean up test clients from the database
 * Removes clients with names matching the provided test patterns
 * 
 * @param {string[]} testClientNames - Array of client names to delete (exact matches)
 * @returns {Promise<{ success: boolean, deleted: number, error?: Error }>}
 */
async function cleanupTestClients(testClientNames = ['Test Client', 'Test Domain Normalization']) {
  try {
    console.log(`Cleaning up test clients: ${testClientNames.join(', ')}`);
    
    // First ensure the clients table exists
    if (!ensureClientsTableExists()) {
      return {
        success: false,
        deleted: 0,
        error: new Error('Failed to ensure clients table exists')
      };
    }
    
    // Prepare a parameterized query
    const placeholders = testClientNames.map(() => '?').join(', ');
    const query = `DELETE FROM clients WHERE name IN (${placeholders})`;
    
    // Execute the query
    const stmt = db.connection.prepare(query);
    const result = stmt.run(...testClientNames);
    
    console.log(`Deleted ${result.changes} test client(s)`);
    
    return {
      success: true,
      deleted: result.changes || 0
    };
  } catch (error) {
    console.error('Error cleaning up test clients:', error);
    return {
      success: false,
      deleted: 0,
      error
    };
  }
}

module.exports = {
  cleanupTestClients,
  ensureClientsTableExists
}; 