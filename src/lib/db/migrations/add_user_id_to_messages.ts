import { db } from '../index';

/**
 * Migration to add user_id column to the messages table
 */
export async function addUserIdToMessages() {
  try {
    console.log('Starting migration: Adding user_id column to messages table');
    
    // Check if column already exists
    const tableInfoResult = await db.connection.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND table_schema = 'public'
    `);
    
    const columnNames = tableInfoResult.rows.map(row => row.column_name);
    console.log('Current columns in messages table:', columnNames);
    
    // Add user_id column if it doesn't exist
    if (!columnNames.includes('user_id')) {
      console.log('Adding user_id column to messages table');
      await db.connection.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id TEXT`);
    } else {
      console.log('user_id column already exists in messages table');
    }
    
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
} 