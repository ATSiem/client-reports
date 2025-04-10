import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "~/lib/env";
export * from "drizzle-orm";

// For server-side database connection
let db: ReturnType<typeof drizzle>;

// This initialization will only run on the server
if (typeof window === 'undefined') {
  try {
    // Create PostgreSQL connection pool
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
    });

    // Create Drizzle instance with schema
    db = drizzle(pool, { schema });
    // @ts-ignore - adding the connection property for raw SQL access
    db.connection = pool;

    // Initialize pgvector extension for AI search
    pool.query('CREATE EXTENSION IF NOT EXISTS vector;').catch(err => {
      console.error("Error creating pgvector extension:", err);
    });
    
    // Run migrations synchronously during initialization
    try {
      // Export the db object first before importing migration-manager
      // This ensures db is fully initialized before migrations try to use it
      module.exports = { db };
      
      // Now import and run migrations
      const { runMigrations } = require('./migration-manager');
      runMigrations().catch(err => {
        console.error('Failed to run database migrations:', err);
      });
    } catch (error) {
      console.error('Error importing migration manager:', error);
    }
  } catch (error) {
    console.error("Database initialization error:", error);
    // Provide a fallback empty db object for error cases
    // @ts-ignore - This is to prevent server-side errors
    db = {} as ReturnType<typeof drizzle>;
  }
} else {
  // Client-side fallback (this code won't actually run, but is needed for type checking)
  // @ts-ignore - This is to prevent client-side errors
  db = {} as ReturnType<typeof drizzle>;
}

export { db };
