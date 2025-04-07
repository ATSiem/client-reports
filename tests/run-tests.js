#!/usr/bin/env node

/**
 * Simple test runner for the email agent tests
 * This script will run all tests in the tests directory
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const TEST_DIR = path.join(__dirname);
const TEST_FILE_PATTERN = /\.test\.js$/;
const JEST_BIN = path.join(__dirname, '..', 'node_modules', '.bin', 'jest');
const JEST_CONFIG = path.join(__dirname, 'jest.config.js');
const SERVER_URL = 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Print header
console.log(`\n${colors.bright}${colors.blue}=== Email Agent Test Runner ===${colors.reset}\n`);

// Check if Jest is installed
if (!fs.existsSync(JEST_BIN)) {
  console.error(`${colors.red}Error: Jest not found. Please install it with:${colors.reset}`);
  console.error(`  npm install --save-dev jest`);
  process.exit(1);
}

// Check if Jest config exists
if (!fs.existsSync(JEST_CONFIG)) {
  console.error(`${colors.red}Error: Jest configuration not found at ${JEST_CONFIG}${colors.reset}`);
  process.exit(1);
}

// Check if server is running
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(SERVER_URL, (res) => {
      resolve(true);
    }).on('error', (err) => {
      resolve(false);
    });
    
    // Set a timeout to avoid hanging
    req.setTimeout(2000, () => {
      req.abort();
      resolve(false);
    });
  });
}

// Get all test files
const testFiles = fs.readdirSync(TEST_DIR)
  .filter(file => TEST_FILE_PATTERN.test(file))
  .map(file => path.join(TEST_DIR, file));

if (testFiles.length === 0) {
  console.error(`${colors.yellow}No test files found in ${TEST_DIR}${colors.reset}`);
  process.exit(0);
}

console.log(`${colors.cyan}Found ${testFiles.length} test files:${colors.reset}`);
testFiles.forEach(file => {
  console.log(`  - ${path.basename(file)}`);
});
console.log('');

// Function to start the server
async function startServer() {
  console.log(`${colors.yellow}Starting local server...${colors.reset}`);
  
  const serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe', // Capture output to avoid cluttering the test output
    detached: true, // Run in background
    shell: true
  });
  
  // Collect server output to know when it's ready
  let serverOutput = '';
  serverProcess.stdout.on('data', (data) => {
    serverOutput += data.toString();
  });
  
  // Wait for server to start (maximum 30 seconds)
  let serverStarted = false;
  const startTime = Date.now();
  
  while (!serverStarted && (Date.now() - startTime < 30000)) {
    // Check if server is running every second
    await new Promise(resolve => setTimeout(resolve, 1000));
    serverStarted = await checkServerRunning();
    
    // Also check server output for ready message
    if (serverOutput.includes('ready') || serverOutput.includes('started')) {
      serverStarted = true;
    }
  }
  
  if (serverStarted) {
    console.log(`${colors.green}✓ Local server started at ${SERVER_URL}${colors.reset}\n`);
    return { process: serverProcess, started: true };
  } else {
    console.error(`${colors.red}Failed to start local server${colors.reset}\n`);
    try {
      // Kill the server process if it didn't start correctly
      process.kill(-serverProcess.pid);
    } catch (e) {
      // Ignore errors when killing the process
    }
    return { process: null, started: false };
  }
}

// Check server status and run tests
(async () => {
  let serverRunning = await checkServerRunning();
  let serverProcess = null;
  let startedServerForTests = false;
  
  if (!serverRunning) {
    console.log(`${colors.yellow}${colors.bright}⚠️ Server not running at ${SERVER_URL}${colors.reset}`);
    console.log(`${colors.yellow}Automatically starting server for tests...${colors.reset}`);
    
    // Auto-start the server
    const result = await startServer();
    serverProcess = result.process;
    serverRunning = result.started;
    startedServerForTests = result.started;
    
    if (!serverRunning) {
      console.error(`${colors.red}Failed to start the server. Continuing with partial test coverage.${colors.reset}\n`);
    }
  } else {
    console.log(`${colors.green}✓ Local server is running at ${SERVER_URL}${colors.reset}\n`);
  }

  // Run tests with real-time output
  console.log(`${colors.bright}${colors.magenta}Running tests with config: ${JEST_CONFIG}${colors.reset}\n`);
  
  // Use spawn instead of execSync to get real-time output
  const jestProcess = spawn(JEST_BIN, ['--config', JEST_CONFIG, '--verbose'], {
    stdio: 'inherit', // Use inherit to preserve interactive features like progress bar
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SERVER_RUNNING: serverRunning ? 'true' : 'false'
    }
  });
  
  // Handle test completion
  jestProcess.on('close', (code) => {
    if (code === 0) {
      if (!serverRunning) {
        // If server wasn't running, we know process-summaries-api.test.js was skipped
        console.warn(`\n${colors.yellow}${colors.bright}⚠️ PARTIAL COVERAGE: Some tests were skipped because the server was not running.${colors.reset}`);
        console.warn(`${colors.yellow}For complete test coverage, please start the server and run tests again.${colors.reset}\n`);
      } else {
        console.log(`\n${colors.green}${colors.bright}All tests completed successfully with full coverage!${colors.reset}`);
      }
    } else {
      console.error(`\n${colors.red}${colors.bright}Tests failed with errors.${colors.reset}`);
    }
    
    // If we started the server, shut it down
    if (startedServerForTests && serverProcess) {
      console.log(`${colors.yellow}Shutting down test server...${colors.reset}`);
      try {
        // Kill the entire process group
        process.kill(-serverProcess.pid);
      } catch (e) {
        // Ignore errors when killing the server
      }
    }
    
    process.exit(code);
  });
})(); 