import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "~/lib/db";
import { messages } from "~/lib/db/schema";

const emailSchema = z.object({
  id: z.string(),
  subject: z.string(),
  from: z.string(),
  to: z.string(),
  date: z.string(),
  body: z.string(),
  attachments: z.array(
    z.object({ name: z.string(), type: z.string(), size: z.number() }),
  ),
});

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("X-Webhook-Secret");

    if (!secret) {
      return NextResponse.json(
        { error: "Missing signature header" },
        { status: 401 },
      );
    }

    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (secret !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const validatedData = emailSchema.parse(body);

    const result = await generateObject({
      model: openai("gpt-4o-2024-08-06", { structuredOutputs: true }),
      schemaName: "email",
      schemaDescription: "An email summary.",
      schema: z.object({ summary: z.string(), labels: z.array(z.string()) }),
      prompt: `Generate a summary and labels for the following email: ${JSON.stringify(
        validatedData,
      )}. The summary should be a 1-2 sentences and only generate 1-2 labels that are relevant to the email.`,
    });

    // Store the webhook data in the database
    try {
      // Set variables
      const id = result.object.message_id;
      const subject = result.object.subject || "(No Subject)";
      const from = result.object.from_email || "";
      const to = result.object.to_email || "";
      const date = new Date().toISOString(); // Use current date if not provided
      const body = result.object.body || "";
      const attachments = JSON.stringify(result.object.attachments || []);
      const summary = result.object.summary || "";
      const labels = JSON.stringify(result.object.labels || []);
      const cc = result.object.cc || "";
      const bcc = result.object.bcc || "";
      const user_id = result.object.user_id || null; // Set user_id from result or context
      
      // Insert into database
      await db.connection.query(`
        INSERT INTO messages (
          id, subject, "from", "to", date, body, attachments, 
          created_at, updated_at, summary, labels, cc, bcc, user_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 
          NOW(), NOW(), $8, $9, $10, $11, $12
        )
        ON CONFLICT (id) DO UPDATE SET
          subject = $2,
          "from" = $3,
          "to" = $4,
          date = $5,
          body = $6,
          attachments = $7,
          updated_at = NOW(),
          summary = $8,
          labels = $9,
          cc = $10,
          bcc = $11,
          user_id = $12
      `, [
        id, subject, from, to, date, body, attachments,
        summary, labels, cc, bcc, user_id
      ]);

      return NextResponse.json({
        status: "success",
        data: {
          email: validatedData,
          summary: result.object.summary,
          labels: result.object.labels,
        },
      });
    } catch (error) {
      console.error("Database insertion error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
