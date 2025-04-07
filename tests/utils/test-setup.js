/**
 * Test setup and teardown helpers
 */

const { cleanupTestClients } = require('./test-cleanup');

/**
 * Register a cleanup function to run after tests
 * 
 * @param {Function} cleanupFn - The cleanup function to call
 * @param {string} when - When to run cleanup ('afterEach' or 'afterAll', default: 'afterAll')
 */
let registeredCleanupFunctions = [];

// Register the global afterAll handler once
if (global.afterAll) {
  afterAll(async () => {
    console.log('Running registered cleanup functions');
    for (const cleanupFn of registeredCleanupFunctions) {
      await cleanupFn();
    }
  });
}

/**
 * Set up afterEach or afterAll hook to clean up test clients
 * @param {object} options - Options
 * @param {string} options.when - When to run cleanup ('afterEach' or 'afterAll', default: 'afterAll')
 * @param {string[]} options.clientNames - Client names to clean up (default: ['Test Client', 'Test Domain Normalization'])
 */
function setupTestClientCleanup(options = {}) {
  const when = options.when || 'afterAll';
  const clientNames = options.clientNames || ['Test Client', 'Test Domain Normalization'];
  
  const cleanup = async () => {
    console.log(`Running test client cleanup: ${clientNames.join(', ')}`);
    await cleanupTestClients(clientNames);
  };
  
  if (when === 'afterEach') {
    // Register for immediate cleanup after each test if possible
    if (global.afterEach) {
      afterEach(cleanup);
    } else {
      // Fallback to afterAll
      registeredCleanupFunctions.push(cleanup);
    }
  } else {
    // Register for cleanup after all tests
    registeredCleanupFunctions.push(cleanup);
  }
}

module.exports = {
  setupTestClientCleanup
}; 