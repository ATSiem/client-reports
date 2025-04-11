import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/lib/db';
import { z } from 'zod';

// Schema for skipped feedback validation
const skipFeedbackSchema = z.object({
  reportId: z.string(),
  clientId: z.string().nullable(),
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
    const validatedData = skipFeedbackSchema.parse(data);
    
    // Extract client metadata
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '0.0.0.0';
    
    // Store skip event in database
    const feedbackId = crypto.randomUUID();
    
    await db.connection.query(`
      INSERT INTO report_feedback (
        id, report_id, client_id, rating, 
        start_date, end_date, 
        vector_search_used, search_query, email_count,
        created_at, user_agent, ip_address
      ) VALUES (
        $1, $2, $3, NULL, 
        $4, $5, 
        $6, $7, $8,
        NOW(), $9, $10
      )
    `, [
      feedbackId,
      validatedData.reportId,
      validatedData.clientId,
      validatedData.reportParameters.startDate,
      validatedData.reportParameters.endDate,
      validatedData.reportParameters.vectorSearchUsed ? 1 : 0,
      validatedData.reportParameters.searchQuery || '',
      validatedData.reportParameters.emailCount,
      userAgent,
      ipAddress
    ]);
    
    // Return success
    return NextResponse.json({
      success: true,
      message: 'Skip recorded',
      id: feedbackId
    });
  } catch (error) {
    console.error('Error recording skip:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to record skip',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}