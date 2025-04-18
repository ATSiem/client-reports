import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "~/lib/env";
export * from "drizzle-orm";

// Simple database connection class to avoid circular dependencies
class DbConnection {
  pool: Pool | null = null;
  drizzle: any = null;
  connection: Pool | null = null;
  
  initialize() {
    if (this.pool !== null) {
      return; // Already initialized
    }
    
    try {
      console.log('Initializing database connection...');
      console.log('Database URL:', env.DATABASE_URL?.replace(/(:.*@)/, ':****@'));
      
      // Helper to get the correct database connection string
      function getConnectionString() {
        let connectionString = env.DATABASE_URL;
        // Replace 'db' with 'localhost' for local development (outside Docker)
        if (process.env.NODE_ENV !== 'production' && typeof window === 'undefined') {
          connectionString = connectionString.replace(/(@|\/\/)(db)(:|\/)/, '$1localhost$3');
        }
        return connectionString;
      }
      
      // Create PostgreSQL connection pool
      this.pool = new Pool({
        connectionString: getConnectionString(),
      });
      
      // Create Drizzle instance with schema
      this.drizzle = drizzle(this.pool, { schema });
      
      // Add the connection property for raw SQL access
      this.connection = this.pool;
      
      // Initialize pgvector extension for AI search
      console.log('Enabling pgvector extension...');
      this.pool.query('CREATE EXTENSION IF NOT EXISTS vector;')
        .then(() => {
          console.log('pgvector extension enabled successfully');
        })
        .catch(err => {
          console.error("Error creating pgvector extension:", err.message);
          console.log("Please ensure pgvector is installed in your PostgreSQL instance");
        });
        
      console.log('Database connection initialized successfully');
      return true;
    } catch (error) {
      console.error("Database initialization error:", error);
      return false;
    }
  }
  
  // Helper method to handle query errors consistently
  async query(text: string, params?: any[]) {
    if (!this.connection) {
      throw new Error('Database connection not initialized');
    }
    
    try {
      return await this.connection.query(text, params);
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const dbInstance = new DbConnection();

// This initialization will only run on the server
if (typeof window === 'undefined') {
  dbInstance.initialize();
}

// Export the db object
export const db = dbInstance;
