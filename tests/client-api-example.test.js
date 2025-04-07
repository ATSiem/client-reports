/**
 * Example of using test client utilities in API tests
 */

const { createTestClients, deleteTestClients } = require('./utils/test-clients');
const { db } = require('../src/lib/db');

describe('Client API Example Test', () => {
  // Create test clients before all tests with automatic cleanup after all tests
  let testClients;
  
  beforeAll(() => {
    // Create test clients with automatic cleanup after all tests
    testClients = createTestClients();
    
    // You can also use options:
    // - cleanupAfterEach: true to clean up after each test
    // - skipCleanup: true to manage cleanup manually
    // Example: createTestClients({ cleanupAfterEach: true });
  });
  
  test('test clients exist in database', () => {
    // Query the clients table
    const stmt = db.connection.prepare(`
      SELECT * FROM clients WHERE name IN ('Test Client', 'Test Domain Normalization')
    `);
    
    const clients = stmt.all();
    
    // Expect to find our test clients
    expect(clients).toBeDefined();
    expect(clients.length).toBe(2);
    
    // Find the Test Client
    const testClient = clients.find(c => c.name === 'Test Client');
    expect(testClient).toBeDefined();
    expect(testClient.domains).toBe(JSON.stringify(['test.com']));
    
    // Find the Test Domain Normalization client
    const testDomainClient = clients.find(c => c.name === 'Test Domain Normalization');
    expect(testDomainClient).toBeDefined();
    expect(testDomainClient.domains).toBe(JSON.stringify(['normalization.com']));
  });
  
  test('can filter clients by name', () => {
    // Query a specific test client
    const stmt = db.connection.prepare(`
      SELECT * FROM clients WHERE name = ?
    `);
    
    const testClient = stmt.get('Test Client');
    
    // Expect to find the client
    expect(testClient).toBeDefined();
    expect(testClient.name).toBe('Test Client');
  });
  
  // For manual cleanup example (not needed since we use automatic cleanup)
  // afterAll(async () => {
  //   // Manually clean up test clients if you created them with { skipCleanup: true }
  //   await deleteTestClients();
  // });
}); 