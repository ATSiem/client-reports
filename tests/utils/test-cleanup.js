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
    
    // For SQLite compatibility, we'll execute separate delete statements
    // rather than using IN with multiple parameters, which can be problematic
    let totalDeleted = 0;
    
    for (const clientName of testClientNames) {
      try {
        const stmt = db.connection.prepare('DELETE FROM clients WHERE name = ?');
        const result = stmt.run(clientName);
        totalDeleted += result.changes || 0;
      } catch (deleteError) {
        console.error(`Error deleting client ${clientName}:`, deleteError);
      }
    }
    
    // Force a commit to ensure changes are persisted
    try {
      db.connection.prepare('COMMIT').run();
    } catch (commitError) {
      // Ignore if not in transaction
    }
    
    console.log(`Deleted ${totalDeleted} test client(s)`);
    
    return {
      success: true,
      deleted: totalDeleted
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