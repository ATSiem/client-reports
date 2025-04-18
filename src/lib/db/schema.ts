import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  from: text("from").notNull(),
  to: text("to").notNull(),
  date: text("date").notNull(),
  body: text("body").notNull(),
  attachments: text("attachments").notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow(),
  summary: text("summary").notNull(),
  labels: jsonb("labels").notNull().$type<string[]>(), // Use native JSON array
  cc: text("cc").default(""),
  bcc: text("bcc").default(""),
  processedForVector: boolean("processed_for_vector").default(false),
  userId: text("user_id"), // Associate messages with specific users
});

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domains: jsonb("domains").notNull().$type<string[]>(), // JSON array with domains
  emails: jsonb("emails").notNull().$type<string[]>(),   // JSON array with specific emails
  userId: text("user_id"),            // Associate clients with specific users
  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow(),
});

export const reportTemplates = pgTable("report_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  format: text("format").notNull(),
  clientId: text("client_id").references(() => clients.id),
  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow(),
  // Track examples provided for this template
  examplePrompt: text("example_prompt"),
});

// Feedback and evaluation data
export const reportFeedback = pgTable("report_feedback", {
  id: text("id").primaryKey(),
  reportId: text("report_id").notNull(),
  clientId: text("client_id").references(() => clients.id),
  rating: integer("rating"), // 1-5 rating
  feedbackText: text("feedback_text"),
  actionsTaken: jsonb("actions_taken").$type<string[]>(), // JSON array of actions
  // Report generation parameters
  startDate: text("start_date"),
  endDate: text("end_date"),
  vectorSearchUsed: boolean("vector_search_used").default(false),
  searchQuery: text("search_query"),
  emailCount: integer("email_count"),
  // User interaction telemetry
  copiedToClipboard: boolean("copied_to_clipboard").default(false),
  generationTimeMs: integer("generation_time_ms"),
  // Tracking
  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),
  // Analytics
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});
