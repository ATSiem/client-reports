import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";
import { env } from "~/lib/env";
import { compatDb as postgresDb } from "./postgres";
export * from "drizzle-orm";

// For server-side database connection
let db: any;

// Only use Postgres when explicitly configured
const usePostgres = process.env.DATABASE_TYPE === 'postgres';

// This initialization will only run on the server
if (typeof window === 'undefined') {
  try {
    if (usePostgres) {
      console.log('Using Postgres database');
      db = postgresDb;
    } else {
      console.log('Using SQLite database');
      
      // Ensure directory exists with better error handling
      const dbDir = dirname(env.SQLITE_DB_PATH);
      try {
        if (!existsSync(dbDir)) {
          console.log(`Creating database directory: ${dbDir}`);
          mkdirSync(dbDir, { recursive: true });
        }
      } catch (dirError) {
        console.warn(`Failed to create directory ${dbDir}, will try alternative path:`, dirError);
        
        // In Vercel environment, try using /tmp directory as fallback
        if (process.env.VERCEL) {
          env.SQLITE_DB_PATH = '/tmp/data/email_agent.db';
          
          // Ensure /tmp/data exists
          try {
            if (!existsSync('/tmp/data')) {
              console.log('Creating /tmp/data directory');
              mkdirSync('/tmp/data', { recursive: true });
            }
          } catch (tmpDirError) {
            console.error('Failed to create /tmp/data directory:', tmpDirError);
          }
        }
      }

      // Log the database path for debugging
      console.log('Database path:', env.SQLITE_DB_PATH);
      
      // Create SQLite connection
      const sqlite = new Database(env.SQLITE_DB_PATH);
      
      // Create tables if they don't exist
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          subject TEXT NOT NULL,
          "from" TEXT NOT NULL,
          "to" TEXT NOT NULL,
          date TEXT NOT NULL,
          body TEXT NOT NULL,
          attachments TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          summary TEXT NOT NULL,
          labels TEXT NOT NULL,
          cc TEXT DEFAULT '',
          bcc TEXT DEFAULT ''
        );
        
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          domains TEXT NOT NULL,
          emails TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        
        CREATE TABLE IF NOT EXISTS report_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          format TEXT NOT NULL,
          client_id TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          example_prompt TEXT,
          FOREIGN KEY (client_id) REFERENCES clients(id)
        );
        
        CREATE TABLE IF NOT EXISTS report_feedback (
          id TEXT PRIMARY KEY,
          report_id TEXT NOT NULL,
          client_id TEXT,
          rating INTEGER,
          feedback_text TEXT,
          actions_taken TEXT,
          start_date TEXT,
          end_date TEXT,
          vector_search_used INTEGER,
          search_query TEXT,
          email_count INTEGER,
          copied_to_clipboard INTEGER,
          generation_time_ms INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          user_agent TEXT,
          ip_address TEXT,
          FOREIGN KEY (client_id) REFERENCES clients(id)
        );
      `);
      
      // Add SQLite functions for vector operations
      try {
        // Use type assertion to access the create_function method
        // which might exist on the specific better-sqlite3 implementation
        const sqliteWithExtensions = sqlite as any;
        if (typeof sqliteWithExtensions.create_function === 'function') {
          sqliteWithExtensions.create_function("cosine_similarity", (vec1Str: string, vec2Str: string) => {
            try {
              // Parse the JSON strings to arrays
              const vec1 = JSON.parse(vec1Str);
              const vec2 = JSON.parse(vec2Str);
              
              if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
                console.error('Invalid vectors for cosine similarity', { 
                  vec1Length: Array.isArray(vec1) ? vec1.length : 'not array', 
                  vec2Length: Array.isArray(vec2) ? vec2.length : 'not array' 
                });
                return 0;
              }
              
              // Calculate dot product
              let dotProduct = 0;
              let mag1 = 0;
              let mag2 = 0;
              
              for (let i = 0; i < vec1.length; i++) {
                dotProduct += vec1[i] * vec2[i];
                mag1 += vec1[i] * vec1[i];
                mag2 += vec2[i] * vec2[i];
              }
              
              mag1 = Math.sqrt(mag1);
              mag2 = Math.sqrt(mag2);
              
              if (mag1 === 0 || mag2 === 0) return 0;
              
              return dotProduct / (mag1 * mag2);
            } catch (error) {
              console.error('Error calculating cosine similarity:', error);
              return 0;
            }
          });
        } else {
          console.warn('SQLite create_function method not available - vector search functionality will be limited');
        }
      } catch (functionError) {
        console.warn('Error setting up SQLite function:', functionError);
      }
      
      // Initialize the drizzle ORM
      db = drizzle(sqlite, { schema });
      // @ts-ignore - adding the connection property for raw SQL access
      db.connection = sqlite;
      
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
    }
  } catch (error) {
    console.error("Database initialization error:", error);
    
    // Try to create a fallback database in /tmp for Vercel
    if (process.env.VERCEL && !usePostgres) {
      try {
        console.log('Attempting to create fallback database in /tmp');
        
        // Ensure /tmp/data exists
        if (!existsSync('/tmp/data')) {
          mkdirSync('/tmp/data', { recursive: true });
        }
        
        const fallbackPath = '/tmp/data/email_agent.db';
        console.log('Using fallback database path:', fallbackPath);
        
        const sqlite = new Database(fallbackPath);
        db = drizzle(sqlite, { schema });
        // @ts-ignore - adding the connection property for raw SQL access
        db.connection = sqlite;
        
        // Create minimal tables
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domains TEXT NOT NULL,
            emails TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch())
          );
        `);
        
        console.log('Fallback database initialized successfully');
      } catch (fallbackError) {
        console.error('Failed to create fallback database:', fallbackError);
      }
    } else if (usePostgres) {
      // If Postgres failed, try to use it anyway
      console.log('Using Postgres database despite initialization error');
      db = postgresDb;
    }
    
    // Last resort: in-memory database (only for SQLite mode)
    if (!db && !usePostgres) {
      console.log('Using in-memory database as last resort');
      const sqlite = new Database(':memory:');
      db = drizzle(sqlite, { schema });
      // @ts-ignore - adding the connection property for raw SQL access
      db.connection = sqlite;
    }
  }
} else {
  // Client-side fallback (this code won't actually run, but is needed for type checking)
  // @ts-ignore - This is to prevent client-side errors
  db = {} as ReturnType<typeof drizzle>;
}

export { db };
