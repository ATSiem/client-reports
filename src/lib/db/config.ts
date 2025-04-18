import { defineConfig } from "drizzle-kit";
import { getConnectionString } from "./index";

export default defineConfig({
  dialect: "pg",
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dbCredentials: { 
    url: getConnectionString(),
  },
});
