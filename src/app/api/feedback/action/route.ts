import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/lib/db';
import { z } from 'zod';

// Schema for action tracking
const actionSchema = z.object({
  reportId: z.string(),
  action: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { feedbackId, action, value } = await request.json();
    
    // Validate inputs
    if (!feedbackId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Update feedback record based on action
    if (action === 'copied_to_clipboard') {
      // Check if feedback exists
      const { rows } = await db.connection.query(`
        SELECT id FROM report_feedback 
        WHERE id = $1
      `, [feedbackId]);
      
      if (rows.length === 0) {
        return NextResponse.json(
          { error: 'Feedback not found' },
          { status: 404 }
        );
      }
      
      // Update the copy to clipboard status
      await db.connection.query(`
        UPDATE report_feedback 
        SET copied_to_clipboard = $1 
        WHERE id = $2
      `, [value ? true : false, feedbackId]);
    } else if (action === 'generation_time') {
      // For recording generation time
      if (typeof value !== 'number') {
        return NextResponse.json(
          { error: 'Value must be a number for generation_time action' },
          { status: 400 }
        );
      }
      
      // Update the generation time
      await db.connection.query(`
        UPDATE report_feedback 
        SET generation_time_ms = $1 
        WHERE id = $2
      `, [value, feedbackId]);
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
    
    // Return success
    return NextResponse.json({
      success: true,
      message: `Feedback action ${action} recorded`
    });
  } catch (error) {
    console.error('Error recording feedback action:', error);
    
    return NextResponse.json(
      { error: 'Failed to record feedback action' },
      { status: 500 }
    );
  }
}