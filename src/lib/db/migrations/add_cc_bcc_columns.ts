import { db } from '../index';

/**
 * Migration to add cc and bcc columns to the messages table
 */
export async function addCcBccColumns() {
  try {
    console.log('Starting migration: Adding cc and bcc columns to messages table');
    
    // Check if columns already exist
    const tableInfoResult = await db.connection.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND table_schema = 'public'
    `);
    
    const columnNames = tableInfoResult.rows.map(row => row.column_name);
    console.log('Current columns in messages table:', columnNames);
    
    // Add cc column if it doesn't exist
    if (!columnNames.includes('cc')) {
      console.log('Adding cc column to messages table');
      await db.connection.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS cc TEXT DEFAULT ''`);
    } else {
      console.log('cc column already exists in messages table');
    }
    
    // Add bcc column if it doesn't exist
    if (!columnNames.includes('bcc')) {
      console.log('Adding bcc column to messages table');
      await db.connection.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS bcc TEXT DEFAULT ''`);
    } else {
      console.log('bcc column already exists in messages table');
    }
    
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
} 