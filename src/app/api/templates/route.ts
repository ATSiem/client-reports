import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/lib/db";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";
import { headers } from "next/headers";

// Schema for report template
const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  format: z.string().min(1, "Template format is required"),
  clientId: z.string().optional(),
  examplePrompt: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // Try to get token from header
    if (!accessToken) {
      // Check X-MS-TOKEN header (added by our client)
      const msTokenHeader = request.headers.get('X-MS-TOKEN');
      if (msTokenHeader) {
        accessToken = msTokenHeader;
      } else {
        accessToken = getUserAccessToken();
      }
    }
    
    // Check cookies as a last resort
    if (!accessToken && request.headers.get('cookie')) {
      const cookies = request.headers.get('cookie') || '';
      const msGraphTokenMatch = cookies.match(/msGraphToken=([^;]+)/);
      if (msGraphTokenMatch && msGraphTokenMatch[1]) {
        accessToken = msGraphTokenMatch[1];
      }
    }
    
    console.log('Templates API - Token available:', !!accessToken);
    
    if (!accessToken) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Set the token for Graph API calls that might happen later
    setUserAccessToken(accessToken);
    
    // Get template ID or client ID from URL
    const url = new URL(request.url);
    const templateId = url.searchParams.get('id');
    const clientId = url.searchParams.get('clientId');
    
    if (templateId) {
      // Fetch a single template
      const result = await db.connection.query(`
        SELECT t.*, c.name as client_name
        FROM report_templates t
        LEFT JOIN clients c ON t.client_id = c.id
        WHERE t.id = $1
      `, [templateId]);
      
      const template = result.rows[0];
      
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      
      return NextResponse.json(template);
    } else if (clientId) {
      // Fetch templates for a specific client
      const result = await db.connection.query(`
        SELECT t.*, c.name as client_name
        FROM report_templates t
        LEFT JOIN clients c ON t.client_id = c.id
        WHERE t.client_id = $1
        ORDER BY t.name ASC
      `, [clientId]);
      
      return NextResponse.json({ templates: result.rows });
    } else {
      // Fetch all templates
      const result = await db.connection.query(`
        SELECT t.*, c.name as client_name
        FROM report_templates t
        LEFT JOIN clients c ON t.client_id = c.id
        ORDER BY t.name ASC
      `);
      
      return NextResponse.json({ templates: result.rows });
    }
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // Try to get token from header
    if (!accessToken) {
      // Check X-MS-TOKEN header (added by our client)
      const msTokenHeader = request.headers.get('X-MS-TOKEN');
      if (msTokenHeader) {
        accessToken = msTokenHeader;
      } else {
        accessToken = getUserAccessToken();
      }
    }
    
    // Check cookies as a last resort
    if (!accessToken && request.headers.get('cookie')) {
      const cookies = request.headers.get('cookie') || '';
      const msGraphTokenMatch = cookies.match(/msGraphToken=([^;]+)/);
      if (msGraphTokenMatch && msGraphTokenMatch[1]) {
        accessToken = msGraphTokenMatch[1];
      }
    }
    
    console.log('Templates API (POST) - Token available:', !!accessToken);
    
    if (!accessToken) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Set the token for Graph API calls that might happen later
    setUserAccessToken(accessToken);
    
    // Parse and validate the request body
    const body = await request.json();
    const data = templateSchema.parse(body);
    
    // If clientId is provided, check if client exists
    if (data.clientId) {
      const clientResult = await db.connection.query(`
        SELECT id FROM clients WHERE id = $1
      `, [data.clientId]);
      
      const existingClient = clientResult.rows[0];
      
      if (!existingClient) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
    }
    
    // Generate a new template ID
    const templateId = crypto.randomUUID();
    
    // Insert the new template
    await db.connection.query(`
      INSERT INTO report_templates (id, name, format, client_id, created_at, updated_at, example_prompt)
      VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)
    `, [
      templateId,
      data.name,
      data.format,
      data.clientId || null,
      data.examplePrompt || null
    ]);
    
    return NextResponse.json({
      id: templateId,
      name: data.name,
      format: data.format,
      clientId: data.clientId || null,
      examplePrompt: data.examplePrompt || null,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // Try to get token from header
    if (!accessToken) {
      // Check X-MS-TOKEN header (added by our client)
      const msTokenHeader = request.headers.get('X-MS-TOKEN');
      if (msTokenHeader) {
        accessToken = msTokenHeader;
      } else {
        accessToken = getUserAccessToken();
      }
    }
    
    // Check cookies as a last resort
    if (!accessToken && request.headers.get('cookie')) {
      const cookies = request.headers.get('cookie') || '';
      const msGraphTokenMatch = cookies.match(/msGraphToken=([^;]+)/);
      if (msGraphTokenMatch && msGraphTokenMatch[1]) {
        accessToken = msGraphTokenMatch[1];
      }
    }
    
    console.log('Templates API (PUT) - Token available:', !!accessToken);
    
    if (!accessToken) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Set the token for Graph API calls that might happen later
    setUserAccessToken(accessToken);
    
    // Get template ID from URL
    const url = new URL(request.url);
    const templateId = url.searchParams.get('id');
    
    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }
    
    // Parse and validate the request body
    const body = await request.json();
    const data = templateSchema.parse(body);
    
    // Check if template exists
    const templateResult = await db.connection.query(`
      SELECT id FROM report_templates WHERE id = $1
    `, [templateId]);
    
    const existingTemplate = templateResult.rows[0];
    
    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    
    // If clientId is provided, check if client exists
    if (data.clientId) {
      const clientResult = await db.connection.query(`
        SELECT id FROM clients WHERE id = $1
      `, [data.clientId]);
      
      const existingClient = clientResult.rows[0];
      
      if (!existingClient) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
    }
    
    // Update the template
    await db.connection.query(`
      UPDATE report_templates
      SET name = $1, format = $2, client_id = $3, updated_at = NOW(), example_prompt = $4
      WHERE id = $5
    `, [
      data.name,
      data.format,
      data.clientId || null,
      data.examplePrompt || null,
      templateId
    ]);
    
    return NextResponse.json({
      id: templateId,
      name: data.name,
      format: data.format,
      clientId: data.clientId || null,
      examplePrompt: data.examplePrompt || null,
    });
  } catch (error) {
    console.error("Error updating template:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // Try to get token from header
    if (!accessToken) {
      // Check X-MS-TOKEN header (added by our client)
      const msTokenHeader = request.headers.get('X-MS-TOKEN');
      if (msTokenHeader) {
        accessToken = msTokenHeader;
      } else {
        accessToken = getUserAccessToken();
      }
    }
    
    // Check cookies as a last resort
    if (!accessToken && request.headers.get('cookie')) {
      const cookies = request.headers.get('cookie') || '';
      const msGraphTokenMatch = cookies.match(/msGraphToken=([^;]+)/);
      if (msGraphTokenMatch && msGraphTokenMatch[1]) {
        accessToken = msGraphTokenMatch[1];
      }
    }
    
    console.log('Templates API (DELETE) - Token available:', !!accessToken);
    
    if (!accessToken) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Set the token for Graph API calls that might happen later
    setUserAccessToken(accessToken);
    
    // Get template ID from URL
    const url = new URL(request.url);
    const templateId = url.searchParams.get('id');
    
    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }
    
    // Check if template exists
    const templateResult = await db.connection.query(`
      SELECT id FROM report_templates WHERE id = $1
    `, [templateId]);
    
    const existingTemplate = templateResult.rows[0];
    
    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    
    // Delete the template
    await db.connection.query(`
      DELETE FROM report_templates WHERE id = $1
    `, [templateId]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}