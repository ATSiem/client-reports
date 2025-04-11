import { NextResponse } from 'next/server';
import { db } from '~/lib/db';

export async function GET(request: Request) {
  try {
    console.log('Feedback API: Starting database query');
    
    // Get all feedback from database with better error handling
    let feedbackRows;
    try {
      const result = await db.connection.query(`
        SELECT 
          f.*,
          c.name as client_name
        FROM report_feedback f
        LEFT JOIN clients c ON f.client_id = c.id
        ORDER BY f.created_at DESC
      `);
      feedbackRows = result.rows;
      console.log(`Feedback API: Retrieved ${feedbackRows?.length || 0} feedback rows`);
    } catch (dbError) {
      console.error('Feedback API: Error querying feedback table:', dbError);
      return NextResponse.json(
        { error: 'Database error: ' + (dbError.message || 'Failed to query feedback') },
        { status: 500 }
      );
    }
    
    // Get summary statistics with better error handling
    let statsResult;
    try {
      statsResult = await db.connection.query(`
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
          ROUND(AVG(CASE WHEN vector_search_used = false THEN rating END), 2) as regular_search_avg_rating,
          AVG(generation_time_ms) as avg_generation_time,
          COUNT(CASE WHEN copied_to_clipboard = true THEN 1 END) as clipboard_copied_count
        FROM report_feedback
      `);
      console.log('Feedback API: Retrieved stats data');
    } catch (statsError) {
      console.error('Feedback API: Error querying statistics:', statsError);
      return NextResponse.json(
        { error: 'Database error: ' + (statsError.message || 'Failed to query statistics') },
        { status: 500 }
      );
    }
    
    // Get actions taken with better error handling
    let actionsResult;
    try {
      actionsResult = await db.connection.query(`
        SELECT 
          jsonb_array_elements_text(actions_taken) as action,
          COUNT(*) as count
        FROM report_feedback
        WHERE actions_taken IS NOT NULL AND jsonb_array_length(actions_taken) > 0
        GROUP BY action
        ORDER BY count DESC
      `);
      console.log('Feedback API: Retrieved actions data');
    } catch (actionsError) {
      console.error('Feedback API: Error querying actions:', actionsError);
      
      // Try alternative approach if the first one fails
      try {
        actionsResult = await db.connection.query(`
          SELECT 
            actions_taken as action,
            COUNT(*) as count
          FROM report_feedback
          WHERE actions_taken IS NOT NULL
          GROUP BY actions_taken
          ORDER BY count DESC
        `);
        console.log('Feedback API: Retrieved actions data with alternative query');
      } catch (fallbackError) {
        console.error('Feedback API: Error with alternative actions query:', fallbackError);
        // Provide empty result rather than failing the whole request
        actionsResult = { rows: [] };
      }
    }
    
    // Process the data with safer access
    const feedback = feedbackRows.map(row => {
      try {
        // Properly format the createdAt timestamp
        let createdAtTimestamp = null;
        if (row.created_at) {
          if (typeof row.created_at === 'string') {
            // Try parsing as ISO date string
            const date = new Date(row.created_at);
            createdAtTimestamp = Math.floor(date.getTime() / 1000);
          } else if (row.created_at instanceof Date) {
            // Handle Date object
            createdAtTimestamp = Math.floor(row.created_at.getTime() / 1000);
          } else if (typeof row.created_at === 'number') {
            // Already a timestamp
            createdAtTimestamp = row.created_at;
          }
        }
        
        // Process actions_taken according to its actual type
        let actionsTaken = [];
        if (row.actions_taken) {
          if (Array.isArray(row.actions_taken)) {
            // Already an array
            actionsTaken = row.actions_taken;
          } else if (typeof row.actions_taken === 'string') {
            // Try parsing JSON string
            try {
              const parsed = JSON.parse(row.actions_taken);
              actionsTaken = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              // If not valid JSON, split by comma as fallback
              actionsTaken = row.actions_taken.split(',').map(a => a.trim());
            }
          }
        }
        
        return {
          id: row.id,
          reportId: row.report_id,
          clientId: row.client_id,
          clientName: row.client_name || 'Unknown',
          rating: row.rating !== null ? Number(row.rating) : null,
          feedbackText: row.feedback_text || null,
          actionsTaken: actionsTaken,
          startDate: row.start_date || '',
          endDate: row.end_date || '',
          vectorSearchUsed: !!row.vector_search_used,
          searchQuery: row.search_query || null,
          emailCount: row.email_count !== null ? Number(row.email_count) : 0,
          copiedToClipboard: !!row.copied_to_clipboard,
          generationTimeMs: row.generation_time_ms !== null ? Number(row.generation_time_ms) : null,
          createdAt: createdAtTimestamp || Math.floor(Date.now() / 1000),
          userAgent: row.user_agent || null
        };
      } catch (parseError) {
        console.error('Error processing row:', parseError, row);
        // Return a safe version of the row
        return {
          id: row.id || 'unknown-id',
          reportId: row.report_id || 'unknown-report',
          clientId: row.client_id || null,
          clientName: row.client_name || 'Unknown',
          rating: null,
          feedbackText: null,
          actionsTaken: [],
          startDate: '',
          endDate: '',
          vectorSearchUsed: false,
          searchQuery: null,
          emailCount: 0,
          copiedToClipboard: false,
          generationTimeMs: null,
          createdAt: Math.floor(Date.now() / 1000),
          userAgent: null,
          _parseError: true
        };
      }
    });
    
    // Generate statistics with safer access
    const total = parseInt(statsResult.rows[0]?.total) || 0;
    const vectorSearchCount = parseInt(statsResult.rows[0]?.vector_search_count) || 0;
    const clipboardCopiedCount = parseInt(statsResult.rows[0]?.clipboard_copied_count) || 0;
    
    const stats = {
      totalReports: total,
      averageRating: parseFloat(statsResult.rows[0]?.avg_rating) || 0,
      vectorSearchPercentage: total > 0 ? vectorSearchCount / total : 0,
      averageGenerationTime: parseFloat(statsResult.rows[0]?.avg_generation_time) || 1000,
      clipboardCopyRate: total > 0 ? clipboardCopiedCount / total : 0,
      feedbackSubmissionRate: total > 0 ? total / total : 0,
      mostCommonActions: (actionsResult.rows || []).map(row => ({
        action: typeof row.action === 'string' ? row.action : JSON.stringify(row.action),
        count: parseInt(row.count) || 0,
      })).slice(0, 10) // Limit to top 10 actions
    };
    
    console.log('Feedback API: Successfully processed data, returning response');
    
    return NextResponse.json({
      feedback,
      stats,
    });
  } catch (error) {
    console.error('Error fetching feedback data:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch feedback data: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}