import { defineConfig } from "drizzle-kit";
import { env } from "~/lib/env";

export default defineConfig({
  dialect: "pg",
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dbCredentials: { 
    url: env.DATABASE_URL || "postgres://postgres:postgres@db:5432/email_agent",
  },
});
