import { db } from '../index';

/**
 * Migration to add example_prompt column to the report_templates table
 */
export async function addExamplePromptColumn() {
  try {
    console.log('Starting migration: Adding example_prompt column to report_templates table');
    
    // Check if column already exists
    const tableInfoResult = await db.connection.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'report_templates' AND table_schema = 'public'
    `);
    
    const columnNames = tableInfoResult.rows.map(row => row.column_name);
    console.log('Current columns in report_templates table:', columnNames);
    
    // Add example_prompt column if it doesn't exist
    if (!columnNames.includes('example_prompt')) {
      console.log('Adding example_prompt column to report_templates table');
      await db.connection.query(`ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS example_prompt TEXT`);
      console.log('example_prompt column added successfully');
    } else {
      console.log('example_prompt column already exists in report_templates table');
    }
    
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
} 