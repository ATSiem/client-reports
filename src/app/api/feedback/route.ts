import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/lib/db';
import { reportFeedback } from '~/lib/db/schema';
import { z } from 'zod';

// Schema for feedback validation
const feedbackSchema = z.object({
  reportId: z.string(),
  clientId: z.string().nullable(),
  rating: z.number().min(1).max(5),
  feedbackText: z.string().optional(),
  actionsTaken: z.array(z.string()).optional(),
  reportParameters: z.object({
    startDate: z.string(),
    endDate: z.string(),
    vectorSearchUsed: z.boolean(),
    searchQuery: z.string().optional(),
    emailCount: z.number(),
  }),
  timestamp: z.string().datetime(),
});

export async function POST(request: NextRequest) {
  try {
    // Get request data
    const data = await request.json();
    
    // Validate data
    const validatedData = feedbackSchema.parse(data);
    
    // Extract client metadata
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '0.0.0.0';
    
    // Store feedback in database
    const feedbackId = crypto.randomUUID();
    
    // Convert PostgreSQL to use query method instead of prepare
    await db.connection.query(`
      INSERT INTO report_feedback (
        id, report_id, client_id, rating, feedback_text, 
        actions_taken, start_date, end_date, 
        vector_search_used, search_query, email_count,
        copied_to_clipboard, generation_time_ms,
        created_at, user_agent, ip_address
      ) VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, 
        $9, $10, $11,
        $12, $13,
        NOW(), $14, $15
      )
    `, [
      feedbackId, validatedData.reportId, validatedData.clientId, validatedData.rating, validatedData.feedbackText || '',
      JSON.stringify(validatedData.actionsTaken || []), validatedData.reportParameters.startDate, validatedData.reportParameters.endDate,
      validatedData.reportParameters.vectorSearchUsed ? 1 : 0, validatedData.reportParameters.searchQuery || '', validatedData.reportParameters.emailCount,
      false, 0,
      userAgent, ipAddress
    ]);
    
    // Return success
    return NextResponse.json({
      success: true,
      message: 'Feedback recorded',
      id: feedbackId
    });
  } catch (error) {
    console.error('Error saving feedback:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to save feedback',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}