// Set up test environment variables

// Set DB_PATH to a valid path in tests
const path = require('path');
const fs = require('fs');

// Create a test database directory if it doesn't exist
const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Use a file-based database for tests rather than in-memory
// This helps with troubleshooting and ensures all code paths are tested
const dbPath = path.join(dbDir, 'test-email-agent.db');

// Set environment variables
process.env.SQLITE_DB_PATH = dbPath;
process.env.NODE_ENV = 'test';

// Don't overwrite OPENAI_API_KEY if it already exists in the environment
if (!process.env.OPENAI_API_KEY) {
  try {
    // Try to load it from .env file using dotenv
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch (error) {
    // If dotenv loading fails, set a dummy key (tests will be skipped)
    console.log('Could not load .env file for OpenAI API key, some tests may be skipped');
    process.env.OPENAI_API_KEY = 'test-api-key';
  }
}

process.env.NEXT_PUBLIC_AZURE_CLIENT_ID = 'test-client-id';
process.env.NEXT_PUBLIC_AZURE_TENANT_ID = 'test-tenant-id';
process.env.NEXT_PUBLIC_AZURE_REDIRECT_URI = 'http://localhost:3000';
process.env.CLIENT_ID = 'test-client-id';
process.env.TENANT_ID = 'test-tenant-id';
process.env.REDIRECT_URI = 'http://localhost:3000'; 