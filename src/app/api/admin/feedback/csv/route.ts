import { NextResponse } from 'next/server';
import { db } from '~/lib/db';

export async function GET(request: Request) {
  try {
    // Fetch feedback data
    const { rows } = await db.connection.query(`
      SELECT 
        rf.id, 
        rf.report_id as "reportId",
        rf.client_id as "clientId",
        c.name as "clientName",
        rf.rating,
        rf.feedback_text as "feedbackText",
        rf.actions_taken as "actionsTaken",
        rf.start_date as "startDate",
        rf.end_date as "endDate",
        rf.vector_search_used as "vectorSearchUsed",
        rf.search_query as "searchQuery",
        rf.email_count as "emailCount",
        rf.copied_to_clipboard as "copiedToClipboard",
        rf.generation_time_ms as "generationTimeMs",
        rf.created_at as "createdAt",
        rf.user_agent as "userAgent"
      FROM report_feedback rf
      LEFT JOIN clients c ON rf.client_id = c.id
      ORDER BY rf.created_at DESC
    `);
    
    // Process the data
    const feedback = rows.map(row => {
      let formattedCreatedAt = ''; // Default to empty string
      const timestamp = Number(row.createdAt);
      if (!isNaN(timestamp)) { // Check if conversion to Number resulted in a valid number
        try {
          formattedCreatedAt = new Date(timestamp * 1000).toISOString();
        } catch (dateError) {
          console.error(`Failed to format date for timestamp: ${row.createdAt}`, dateError);
          // Keep formattedCreatedAt as empty string if toISOString fails
        }
      }

      let parsedActionsTaken = ''; // Default to empty string
      if (row.actionsTaken) {
        try {
          const actions = JSON.parse(row.actionsTaken);
          if (Array.isArray(actions)) { // Ensure it's an array before joining
             parsedActionsTaken = actions.join(', ');
          }
        } catch (jsonError) {
          console.error(`Failed to parse actionsTaken JSON for row ID ${row.id}: ${row.actionsTaken}`, jsonError);
          // Keep parsedActionsTaken as empty string if JSON is invalid
        }
      }

      return {
        ...row,
        vectorSearchUsed: !!row.vectorSearchUsed ? 'Yes' : 'No',
        copiedToClipboard: row.copiedToClipboard === 1 ? 'Yes' : 'No',
        actionsTaken: parsedActionsTaken, // Use the safely parsed actions
        createdAt: formattedCreatedAt, // Use the safely formatted date
        feedbackText: row.feedbackText || ''
      };
    });
    
    // Define CSV headers
    const headers = [
      'ID',
      'Report ID',
      'Client ID',
      'Client Name',
      'Rating',
      'Feedback',
      'Actions Taken',
      'Start Date',
      'End Date',
      'Vector Search Used',
      'Search Query',
      'Email Count',
      'Copied To Clipboard',
      'Generation Time (ms)',
      'Created At',
      'User Agent'
    ];
    
    // Convert to CSV
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const item of feedback) {
      const values = [
        item.id,
        item.reportId,
        item.clientId || '',
        `"${(item.clientName || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        item.rating || '',
        `"${(item.feedbackText || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        `"${(item.actionsTaken || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        item.startDate,
        item.endDate,
        item.vectorSearchUsed,
        `"${(item.searchQuery || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        item.emailCount,
        item.copiedToClipboard,
        item.generationTimeMs || '',
        item.createdAt,
        `"${(item.userAgent || '').replace(/"/g, '""')}"` // Escape quotes in CSV
      ];
      
      csvRows.push(values.join(','));
    }
    
    const csvContent = csvRows.join('\n');
    
    // Set headers for CSV download
    const headers_response = new Headers();
    headers_response.set('Content-Type', 'text/csv');
    headers_response.set('Content-Disposition', 'attachment; filename="feedback_export.csv"');
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: headers_response,
    });
  } catch (error) {
    console.error('Error exporting feedback data to CSV:', error);
    
    return NextResponse.json(
      { error: 'Failed to export feedback data' },
      { status: 500 }
    );
  }
} 