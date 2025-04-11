import { NextResponse } from "next/server";
import { env } from "~/lib/env";
import { db } from "~/lib/db";

// Only enable in development for security
const isDevelopment = process.env.NODE_ENV !== 'production';

export async function GET(request: Request) {
  // Block this in production
  if (!isDevelopment) {
    return NextResponse.json({ error: "Debug endpoints are disabled in production" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const testEmail = url.searchParams.get('email');
    const checkType = url.searchParams.get('check');
    
    // Database check if requested
    if (checkType === 'db') {
      try {
        console.log('Debug: Running database check');
        
        // Check database connection
        const dbCheck = await db.connection.query('SELECT version()');
        const pgVersion = dbCheck.rows[0]?.version || 'Unknown';
        
        // Check if the report_feedback table exists
        const tableCheck = await db.connection.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);
        
        // Get report_feedback table structure if it exists
        let tableStructure = null;
        const tables = tableCheck.rows.map(row => row.table_name);
        
        if (tables.includes('report_feedback')) {
          const columnCheck = await db.connection.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'report_feedback'
            ORDER BY ordinal_position
          `);
          
          tableStructure = columnCheck.rows;
          
          // Count rows in feedback table
          const countCheck = await db.connection.query('SELECT COUNT(*) FROM report_feedback');
          const rowCount = parseInt(countCheck.rows[0]?.count) || 0;
          
          return NextResponse.json({
            database: {
              connected: true,
              version: pgVersion,
              tables: tables,
              reportFeedbackExists: true,
              reportFeedbackColumns: tableStructure,
              reportFeedbackRowCount: rowCount
            }
          });
        }
        
        return NextResponse.json({
          database: {
            connected: true,
            version: pgVersion,
            tables: tables,
            reportFeedbackExists: tables.includes('report_feedback')
          }
        });
      } catch (dbError) {
        console.error('Debug: Database check error:', dbError);
        return NextResponse.json({
          database: {
            connected: false,
            error: dbError.message
          }
        });
      }
    }
    
    // Get admin emails - redact them slightly for security but keep enough info to debug
    const adminEmails = env.ADMIN_EMAILS 
      ? env.ADMIN_EMAILS.split(',').map(e => {
          e = e.trim();
          const [name, domain] = e.split('@');
          // Show first 3 chars of name and domain for debugging
          return `${name.substring(0, 3)}***@${domain}`;
        })
      : [];

    // Test url query parameters for email testing
    let emailTest = null;
    
    if (testEmail) {
      const normalizedTestEmail = testEmail.toLowerCase().trim();
      const adminEmailsRaw = env.ADMIN_EMAILS 
        ? env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) 
        : [];
      
      emailTest = {
        email: normalizedTestEmail,
        isAdmin: adminEmailsRaw.includes(normalizedTestEmail),
        exactMatches: adminEmailsRaw.map(e => e === normalizedTestEmail)
      };
    }
    
    return NextResponse.json({
      environment: process.env.NODE_ENV,
      config: {
        adminEmailsCount: adminEmails.length,
        adminEmailsRedacted: adminEmails,
        allowedDomains: env.ALLOWED_EMAIL_DOMAIN?.split(',').map(d => d.trim()) || [],
      },
      emailTest
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return NextResponse.json({ error: "Debug endpoint error" }, { status: 500 });
  }
} 