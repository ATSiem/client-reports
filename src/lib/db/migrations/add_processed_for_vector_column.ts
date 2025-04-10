import { db } from '../index';

/**
 * Migration to add processed_for_vector column to the messages table
 */
export async function addProcessedForVectorColumn() {
  try {
    console.log('Starting migration: Adding processed_for_vector column to messages table');
    
    // Check if column already exists
    const tableInfoResult = await db.connection.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND table_schema = 'public'
    `);
    
    const columnNames = tableInfoResult.rows.map(row => row.column_name);
    console.log('Current columns in messages table:', columnNames);
    
    // Add processed_for_vector column if it doesn't exist
    if (!columnNames.includes('processed_for_vector')) {
      console.log('Adding processed_for_vector column to messages table');
      await db.connection.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS processed_for_vector BOOLEAN DEFAULT FALSE`);
      console.log('processed_for_vector column added successfully');
      
      // Add embedding column for pgvector if it doesn't exist
      if (!columnNames.includes('embedding')) {
        console.log('Adding embedding column for pgvector');
        // First ensure the vector extension exists
        await db.connection.query(`CREATE EXTENSION IF NOT EXISTS vector`);
        // Then add the column with pgvector
        await db.connection.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS embedding vector(1536)`);
        console.log('embedding column added successfully');
      }
    } else {
      console.log('processed_for_vector column already exists in messages table');
    }
    
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  addProcessedForVectorColumn()
    .then(result => {
      if (result) {
        console.log('Migration completed successfully');
        process.exit(0);
      } else {
        console.error('Migration failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Migration failed with error:', error);
      process.exit(1);
    });
} 