import { NextResponse } from 'next/server';
import { db } from '~/lib/db';

export async function GET(request: Request) {
  try {
    // Check for authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'Please sign in with your Microsoft account to access this feature' },
        { status: 401 }
      );
    }
    
    // Token validation would typically happen here
    // For now, we're just checking if a token exists
    
    // Get all feedback from database
    const { rows } = await db.connection.query(`
      SELECT * FROM report_feedback
      ORDER BY created_at DESC
    `);
    
    // Get summary statistics
    const statsResult = await db.connection.query(`
      SELECT 
        COUNT(*) as total,
        AVG(rating) as avg_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1,
        COUNT(CASE WHEN vector_search_used = true THEN 1 END) as vector_search_count,
        ROUND(AVG(CASE WHEN vector_search_used = true THEN rating END), 2) as vector_search_avg_rating,
        ROUND(AVG(CASE WHEN vector_search_used = false THEN rating END), 2) as regular_search_avg_rating
      FROM report_feedback
    `);
    
    // Get actions taken
    const actionsResult = await db.connection.query(`
      SELECT 
        actions_taken::text as action,
        COUNT(*) as count
      FROM report_feedback
      WHERE actions_taken IS NOT NULL AND actions_taken::text != '[]'
      GROUP BY actions_taken
      ORDER BY count DESC
    `);
    
    // Process the data
    const feedback = rows.map(row => ({
      ...row,
      vectorSearchUsed: row.vector_search_used === 1,
      copiedToClipboard: row.copied_to_clipboard === 1,
      actionsTaken: row.actions_taken ? JSON.parse(row.actions_taken) : [],
    }));
    
    // Generate statistics
    const stats = {
      totalReports: statsResult.rows[0].total || 0,
      averageRating: statsResult.rows[0].avg_rating || 0,
      vectorSearchPercentage: statsResult.rows[0].vector_search_count / statsResult.rows[0].total || 0,
      averageGenerationTime: statsResult.rows[0].avg_rating || 0,
      clipboardCopyRate: statsResult.rows[0].total - statsResult.rows[0].vector_search_count / statsResult.rows[0].total || 0,
      feedbackSubmissionRate: statsResult.rows[0].total / statsResult.rows[0].total || 0,
      mostCommonActions: actionsResult.rows.map(row => ({
        action: row.action,
        count: row.count,
      })),
    };
    
    return NextResponse.json({
      feedback,
      stats,
    });
  } catch (error) {
    console.error('Error fetching feedback data:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch feedback data' },
      { status: 500 }
    );
  }
}