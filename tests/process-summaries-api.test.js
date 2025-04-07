// Test for the process-summaries API endpoint
const fetch = require('node-fetch');

// Remove the mock since we're using a real server
jest.unmock('node-fetch');

describe('Process Summaries API', () => {
  const API_URL = 'http://localhost:3000/api/system/process-summaries';
  
  // We'll use the server that npm test automatically starts
  beforeAll(async () => {
    // Wait a moment to ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to connect once to verify
    try {
      const response = await fetch('http://localhost:3000');
      if (!response.ok) {
        console.warn('\x1b[33m\x1b[1m⚠️ WARNING: Server may have issues. Tests will continue but might fail.\x1b[0m');
      }
    } catch (error) {
      console.warn('\x1b[31m\x1b[1m❌ WARNING: Could not connect to server at http://localhost:3000.\x1b[0m');
      console.warn('\x1b[31m\x1b[1m   Tests will continue but might fail if server is not available.\x1b[0m');
    }
  });
  
  // No conditional tests - run all tests
  test('API should accept POST requests and return a task ID', async () => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token' // Add a test token for authentication
        },
        body: JSON.stringify({}) // Empty body for default processing
      });
      
      // If the server returns an error, log it but don't fail the test
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Server returned error: ${response.status} - ${errorText}`);
        // We still want to fail the test if the server is running but returns an error
        expect(response.ok).toBe(true);
        return;
      }
      
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('success');
      if (data.success) {
        expect(data).toHaveProperty('taskId');
        expect(typeof data.taskId).toBe('string');
      }
    } catch (error) {
      console.error('Error during API test:', error);
      throw error;
    }
  }, 10000); // Increase timeout for API call
  
  test('API should accept limit parameter', async () => {
    try {
      const response = await fetch(`${API_URL}?limit=5`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token' // Add a test token for authentication
        },
        body: JSON.stringify({}) // Empty body for default processing
      });
      
      // If the server returns an error, log it but don't fail the test
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Server returned error: ${response.status} - ${errorText}`);
        // We still want to fail the test if the server is running but returns an error
        expect(response.ok).toBe(true);
        return;
      }
      
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('success');
      if (data.success) {
        expect(data).toHaveProperty('taskId');
      }
    } catch (error) {
      console.error('Error during API test:', error);
      throw error;
    }
  }, 10000); // Increase timeout for API call
}); 