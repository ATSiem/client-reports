#!/usr/bin/env node

// Development-only PostgreSQL management script
// Will only run when NODE_ENV=development

const { execSync, spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Log the NODE_ENV for debugging
console.log('PostgreSQL Script - NODE_ENV:', process.env.NODE_ENV);

// Set NODE_ENV if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('Setting NODE_ENV to development');
}

// Only run on macOS and in development mode
if (process.env.NODE_ENV === 'development' && os.platform() === 'darwin') {
  try {
    // Load environment variables from .env
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
    
    // Extract database name from DATABASE_URL
    const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/email_agent';
    const dbName = dbUrl.split('/').pop();
    
    // Check if PostgreSQL 14 is installed via Homebrew
    try {
      execSync('brew list postgresql@14 &> /dev/null');
    } catch (e) {
      console.log('PostgreSQL 14 not installed via Homebrew, skipping service management');
      process.exit(0);
    }
    
    console.log('Starting PostgreSQL 14 service for development...');
    execSync('brew services start postgresql@14', { stdio: 'inherit' });
    
    // Check if pgvector is installed, install it if not
    try {
      // Try to check if pgvector is already installed
      execSync('brew list pgvector &> /dev/null');
      console.log('pgvector already installed via Homebrew');
    } catch (e) {
      console.log('pgvector not installed, installing now...');
      try {
        execSync('brew install pgvector', { stdio: 'inherit' });
        console.log('pgvector installed successfully');
      } catch (installErr) {
        console.error('Error installing pgvector:', installErr.message);
        console.log('Please install pgvector manually: brew install pgvector');
      }
    }
    
    // Wait for PostgreSQL to be ready
    console.log('Waiting for PostgreSQL to be ready...');
    let attempts = 0;
    const maxAttempts = 10;
    
    function checkPostgresReady() {
      return new Promise((resolve) => {
        const check = () => {
          attempts++;
          try {
            execSync('pg_isready -h localhost -p 5432', { stdio: 'ignore' });
            console.log('PostgreSQL is ready!');
            
            // Check if the database exists, create it if it doesn't
            try {
              console.log(`Checking if database "${dbName}" exists...`);
              execSync(`psql -h localhost -p 5432 -U postgres -lqt | cut -d \\| -f 1 | grep -qw ${dbName}`);
              console.log(`Database "${dbName}" exists`);
              resolve(true);
            } catch (e) {
              console.log(`Database "${dbName}" does not exist, creating...`);
              try {
                execSync(`createdb -h localhost -p 5432 -U postgres ${dbName}`, { stdio: 'inherit' });
                console.log(`Database "${dbName}" created successfully`);
                resolve(true);
              } catch (createErr) {
                console.error(`Error creating database "${dbName}":`, createErr.message);
                resolve(false);
              }
            }
          } catch (e) {
            if (attempts < maxAttempts) {
              console.log(`Waiting for PostgreSQL to start... (${attempts}/${maxAttempts})`);
              setTimeout(check, 1000);
            } else {
              console.log('Warning: PostgreSQL might not be fully started yet');
              resolve(false);
            }
          }
        };
        
        check();
      });
    }
    
    // Wait for Postgres to be ready and create database if needed
    checkPostgresReady().then(success => {
      if (success) {
        console.log('PostgreSQL 14 service started for development');
        
        // Create the pgvector extension in the database
        try {
          console.log('Creating pgvector extension in the database...');
          execSync(`psql -h localhost -p 5432 -U postgres -d ${dbName} -c "CREATE EXTENSION IF NOT EXISTS vector;"`, { stdio: 'inherit' });
          console.log('pgvector extension created successfully');
        } catch (extErr) {
          console.error('Error creating pgvector extension:', extErr.message);
        }
        
        // Run database initialization after PostgreSQL is ready
        console.log('Running database initialization scripts...');
        try {
          // Run the Drizzle migrations script to create tables
          const migrationScriptPath = path.join(__dirname, 'run-drizzle-migrations.js');
          require(migrationScriptPath);
        } catch (migrationError) {
          console.error('Error running schema migrations:', migrationError);
        }
      } else {
        console.warn('Warning: PostgreSQL setup may not be complete');
      }
    });
    
    // Don't stop PostgreSQL when script exits for development
    // Only register cleanup for specific termination signals
    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
      process.on(signal, () => {
        console.log(`\nReceived ${signal}, but keeping PostgreSQL running for development.`);
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Error managing PostgreSQL service:', error.message);
  }
} else {
  // Not on macOS or not in development mode, do nothing
  if (process.env.NODE_ENV !== 'development') {
    console.log('Not in development mode, skipping PostgreSQL management');
  } else if (os.platform() !== 'darwin') {
    console.log('Not on macOS, skipping PostgreSQL management');
  }
} 