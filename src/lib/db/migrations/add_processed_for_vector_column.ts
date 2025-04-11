import { db } from '../index';

/**
 * Migration to add processed_for_vector column to messages table and fix embedding column type
 */
export async function addProcessedForVectorColumn() {
  try {
    console.log('Starting migration: Adding processed_for_vector column to messages table');
    
    // Check if column already exists
    const tableInfoResult = await db.connection.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND table_schema = 'public'
    `);
    
    const columns = tableInfoResult.rows.reduce((acc, row) => {
      acc[row.column_name] = row.data_type;
      return acc;
    }, {});
    
    console.log('Current columns in messages table:', Object.keys(columns));
    
    // Add processed_for_vector column if it doesn't exist
    if (!columns['processed_for_vector']) {
      console.log('Adding processed_for_vector column to messages table');
      await db.connection.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS processed_for_vector BOOLEAN DEFAULT FALSE`);
      console.log('processed_for_vector column added successfully');
    } else {
      console.log('processed_for_vector column already exists in messages table');
    }
    
    // Check if embedding column exists and has the right type
    if (!columns['embedding']) {
      console.log('Adding embedding column for pgvector');
      // First ensure the vector extension exists
      await db.connection.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      // Then add the column with pgvector
      await db.connection.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS embedding vector(1536)`);
      console.log('embedding column added successfully');
    } else if (columns['embedding'] === 'text') {
      console.log('Converting embedding column from TEXT to VECTOR type');
      // First ensure the vector extension exists
      await db.connection.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      
      // Create a temporary column with the correct type
      await db.connection.query(`ALTER TABLE messages ADD COLUMN embedding_new vector(1536)`);
      
      // For any existing data, mark it as needing reprocessing
      await db.connection.query(`UPDATE messages SET processed_for_vector = false WHERE embedding IS NOT NULL`);
      
      // Drop the old column and rename the new one
      await db.connection.query(`ALTER TABLE messages DROP COLUMN embedding`);
      await db.connection.query(`ALTER TABLE messages RENAME COLUMN embedding_new TO embedding`);
      
      console.log('embedding column converted to VECTOR type successfully');
    } else {
      console.log('embedding column already exists with the correct type');
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