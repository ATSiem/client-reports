import { NextRequest, NextResponse } from "next/server";
import { queueBackgroundTask } from "~/lib/client-reports/background-processor";

/**
 * POST /api/system/process-summaries
 * 
 * Process pending email summaries
 * This endpoint is used to trigger the background processing of email summaries
 */
export async function POST(request: NextRequest) {
  try {
    // Get optional limit parameter
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    
    // Extract userId from headers
    const userId = request.headers.get('x-user-email');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId in X-User-Email header' }, { status: 401 });
    }
    // Queue a task to process pending summaries with userId
    const taskId = queueBackgroundTask('summarize_emails', { userId, limit });
    
    return NextResponse.json({
      success: true,
      message: "Email summary processing started",
      taskId
    });
  } catch (error) {
    console.error("Error processing email summaries:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to process email summaries",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 