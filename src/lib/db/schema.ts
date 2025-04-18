import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  from: text("from").notNull(),
  to: text("to").notNull(),
  date: text("date").notNull(),
  body: text("body").notNull(),
  attachments: text("attachments").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  summary: text("summary").notNull(),
  labels: text("labels").notNull(), // SQLite doesn't support arrays, we'll store JSON string
  // For vector search
  embedding: text("embedding"), // JSON string of vector representation
  processedForVector: integer("processed_for_vector").default(0), // Flag to track embedding generation
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domains: text("domains").notNull(), // JSON string with domains
  emails: text("emails").notNull(),   // JSON string with specific emails
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const reportTemplates = sqliteTable("report_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  format: text("format").notNull(),
  clientId: text("client_id").references(() => clients.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  // Track examples provided for this template
  examplePrompt: text("example_prompt"),
});

// Feedback and evaluation data
export const reportFeedback = sqliteTable("report_feedback", {
  id: text("id").primaryKey(),
  reportId: text("report_id").notNull(),
  clientId: text("client_id").references(() => clients.id),
  rating: integer("rating"), // 1-5 rating
  feedbackText: text("feedback_text"),
  actionsTaken: text("actions_taken"), // JSON array of actions
  // Report generation parameters
  startDate: text("start_date"),
  endDate: text("end_date"),
  vectorSearchUsed: integer("vector_search_used"), // Boolean as integer
  searchQuery: text("search_query"),
  emailCount: integer("email_count"),
  // User interaction telemetry
  copiedToClipboard: integer("copied_to_clipboard"), // Boolean as integer
  generationTimeMs: integer("generation_time_ms"),
  // Tracking
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  // Analytics
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});
