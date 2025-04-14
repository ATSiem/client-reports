// Script to verify client updates in the database
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

// Get database connection string
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/email_agent';

async function runVerification() {
  try {
    console.log('Starting client verification...');
    console.log(`Using database URL: ${DATABASE_URL.replace(/(:.*@)/, ':****@')}`);
    
    // Create PostgreSQL connection
    const pool = new Pool({
      connectionString: DATABASE_URL,
    });
    
    console.log('Connected to PostgreSQL database');
    
    // Check if clients table exists
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'clients'
      )
    `);
    
    const tableExists = tableCheckResult.rows[0].exists;
    
    if (!tableExists) {
      console.error('Error: clients table does not exist in the database');
      await pool.end();
      process.exit(1);
    }
    
    // Check if user_id column exists
    const columnCheckResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'user_id'
    `);
    
    const hasUserIdColumn = columnCheckResult.rows.length > 0;
    
    if (!hasUserIdColumn) {
      console.error('Error: user_id column does not exist in the clients table');
      await pool.end();
      process.exit(1);
    }
    
    // Count total clients
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM clients');
    const totalClients = parseInt(totalResult.rows[0].count);
    console.log(`Total clients in database: ${totalClients}`);
    
    // Count clients with user_id
    const withUserIdResult = await pool.query('SELECT COUNT(*) as count FROM clients WHERE user_id IS NOT NULL');
    const clientsWithUserId = parseInt(withUserIdResult.rows[0].count);
    console.log(`Clients with user_id: ${clientsWithUserId}`);
    
    // Count clients without user_id
    const withoutUserIdResult = await pool.query('SELECT COUNT(*) as count FROM clients WHERE user_id IS NULL');
    const clientsWithoutUserId = parseInt(withoutUserIdResult.rows[0].count);
    console.log(`Clients without user_id: ${clientsWithoutUserId}`);
    
    // Get user_id distribution
    const userIdDistributionResult = await pool.query(`
      SELECT user_id, COUNT(*) as count 
      FROM clients 
      WHERE user_id IS NOT NULL 
      GROUP BY user_id 
      ORDER BY count DESC
    `);
    
    console.log('\nUser ID distribution:');
    userIdDistributionResult.rows.forEach(row => {
      console.log(`  ${row.user_id}: ${row.count} clients`);
    });
    
    // List clients without user_id
    if (clientsWithoutUserId > 0) {
      console.log('\nClients without user_id:');
      const clientsWithoutUserIdResult = await pool.query('SELECT id, name FROM clients WHERE user_id IS NULL');
      
      clientsWithoutUserIdResult.rows.forEach(row => {
        console.log(`  ${row.id}: ${row.name}`);
      });
    }
    
    // Close the database connection
    await pool.end();
    
    console.log('\nVerification completed successfully');
  } catch (error) {
    console.error('Error during verification:', error);
    process.exit(1);
  }
}

// Run the verification
runVerification(); 