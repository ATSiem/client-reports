import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "~/lib/env";
export * from "drizzle-orm";

// For server-side database connection
// We can't properly type this with TypeScript because we're adding a custom property
// @ts-ignore
let db: any;

// This initialization will only run on the server
if (typeof window === 'undefined') {
  try {
    // Create PostgreSQL connection pool
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
    });

    // Create Drizzle instance with schema
    db = drizzle(pool, { schema });
    
    // Add the connection property for raw SQL access
    db.connection = pool;
    
    // Initialize pgvector extension for AI search
    console.log('Enabling pgvector extension...');
    pool.query('CREATE EXTENSION IF NOT EXISTS vector;')
      .then(() => {
        console.log('pgvector extension enabled successfully');
      })
      .catch(err => {
        console.error("Error creating pgvector extension:", err.message);
        console.log("Please ensure pgvector is installed in your PostgreSQL instance");
      });
    
    // Export the db object BEFORE importing migration-manager
    // This avoids the circular dependency issue
    module.exports = { db };
    
    // Run migrations after db is fully exported
    setTimeout(() => {
      try {
        // Use dynamic import to break circular dependency
        import('./migration-manager').then(({ runMigrations }) => {
          runMigrations().catch(err => {
            console.error('Failed to run database migrations:', err);
          });
        });
      } catch (error) {
        console.error('Error importing migration manager:', error);
      }
    }, 100);
  } catch (error) {
    console.error("Database initialization error:", error);
    // Provide a fallback empty db object for error cases
    db = {};
  }
} else {
  // Client-side fallback (this code won't actually run, but is needed for type checking)
  db = {};
}

export { db };
