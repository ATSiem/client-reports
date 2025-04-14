import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/lib/db";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";
import { env } from "~/lib/env";

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Schema for creating/updating a client
const clientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  domains: z.array(z.string()),
  emails: z.array(z.string().email("Invalid email address")),
});

export async function GET(request: Request) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    console.log('Clients API - Auth header present:', !!authHeader);
    
    if (!accessToken) {
      console.log('Clients API - No auth header, trying getUserAccessToken()');
      accessToken = getUserAccessToken();
      console.log('Clients API - Token from getUserAccessToken:', accessToken ? 'present' : 'missing');
    }
    
    if (!accessToken) {
      console.log('Clients API - No token found, returning 401');
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Set the token for Graph API calls that might happen later
    console.log('Clients API - Setting user access token');
    setUserAccessToken(accessToken);
    
    // Get user email from the request headers (set by auth-provider)
    let userEmail = request.headers.get('X-User-Email');
    console.log('Clients API - User email from request headers:', userEmail);
    
    // Check both header formats to ensure we don't miss the email
    if (!userEmail) {
      userEmail = request.headers.get('x-user-email');
      console.log('Clients API - Checking lowercase header, email:', userEmail);
    }
    
    // Ensure email is normalized to lowercase for consistency
    if (userEmail) {
      userEmail = userEmail.toLowerCase();
      console.log('Clients API - Normalized user email:', userEmail);
    }
    
    // In development mode, use a default email if none is provided
    if (!userEmail && isDevelopment) {
      userEmail = 'dev@example.com';
      console.log('Clients API - Using default development email:', userEmail);
    }
    
    if (!userEmail) {
      console.log('Clients API - No user email found, returning 401');
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "User email information is missing"
        },
        { status: 401 }
      );
    }
    
    // Get client ID from URL if provided (for single client fetch)
    const url = new URL(request.url);
    const clientId = url.searchParams.get('id');
    
    // Log database operations
    console.log('Clients API - Database operations starting');
    
    if (clientId) {
      console.log('Clients API - Fetching single client:', clientId);
      // Fetch a single client, ensuring it belongs to the current user
      try {
        if (!db.connection) {
          throw new Error('Database connection not initialized');
        }

        const { rows } = await db.connection.query(
          `SELECT * FROM clients WHERE id = $1 AND (LOWER(user_id) = LOWER($2) OR user_id IS NULL)`,
          [clientId, userEmail]
        );
        
        console.log('Clients API - Query result rows:', rows.length);
        
        if (rows.length === 0) {
          console.log('Clients API - Client not found or does not belong to user');
          return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }
        
        const client = rows[0];
        
        console.log('Clients API - Client found, returning data');
        // Parse JSON strings back to arrays
        return NextResponse.json({
          ...client,
          domains: typeof client.domains === 'string' ? JSON.parse(client.domains) : client.domains,
          emails: typeof client.emails === 'string' ? JSON.parse(client.emails) : client.emails,
        });
      } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: "Database error when fetching client" }, { status: 500 });
      }
    } else {
      console.log('Clients API - Fetching all clients for user:', userEmail);
      // Fetch all clients for the current user, including those without a user_id (for backward compatibility)
      try {
        if (!db.connection) {
          throw new Error('Database connection not initialized');
        }
        
        // Using parameterized query for PostgreSQL with case-insensitive comparison
        const { rows: clients } = await db.connection.query(
          'SELECT * FROM clients WHERE LOWER(user_id) = LOWER($1) OR user_id IS NULL ORDER BY name ASC',
          [userEmail]
        );
        console.log('Clients API - Found', clients.length, 'clients for user');
        
        // Log the user_id values to help debug
        if (clients.length > 0) {
          console.log('Clients API - User IDs in returned clients:', clients.map(c => c.user_id));
        } else {
          // Try running a more permissive query to see what clients exist
          const { rows: allClients } = await db.connection.query('SELECT id, name, user_id FROM clients LIMIT 10');
          console.log('Clients API - Sample of available clients:', allClients);
        }
        
        // Parse JSON strings back to arrays for each client
        const formattedClients = clients.map(client => ({
          ...client,
          domains: typeof client.domains === 'string' ? JSON.parse(client.domains) : client.domains,
          emails: typeof client.emails === 'string' ? JSON.parse(client.emails) : client.emails,
        }));
        
        console.log('Clients API - Returning formatted clients');
        return NextResponse.json({ clients: formattedClients });
      } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: "Database error when fetching clients" }, { status: 500 });
      }
    }
  } catch (error) {
    console.error("Error fetching clients:", error);
    console.error("Error details:", error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    if (!accessToken) {
      accessToken = getUserAccessToken();
    }
    
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
    
    // Get user email from the request headers (set by auth-provider)
    let userEmail = request.headers.get('X-User-Email');
    
    // In development mode, use a default email if none is provided
    if (!userEmail && isDevelopment) {
      userEmail = 'dev@example.com';
      console.log('Clients API - Using default development email:', userEmail);
    }
    
    if (!userEmail) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "User email information is missing"
        },
        { status: 401 }
      );
    }
    
    // Parse and validate the request body
    const body = await request.json();
    const data = clientSchema.parse(body);
    
    // Generate a new client ID
    const clientId = crypto.randomUUID();
    
    // Insert the new client with the user ID - PostgreSQL version
    await db.connection.query(
      `INSERT INTO clients (id, name, domains, emails, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [
        clientId,
        data.name,
        JSON.stringify(data.domains),
        JSON.stringify(data.emails),
        userEmail
      ]
    );
    
    return NextResponse.json({
      id: clientId,
      name: data.name,
      domains: data.domains,
      emails: data.emails,
      userId: userEmail
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    if (!accessToken) {
      accessToken = getUserAccessToken();
    }
    
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
    
    // Get user email from the request headers (set by auth-provider)
    let userEmail = request.headers.get('X-User-Email');
    
    // In development mode, use a default email if none is provided
    if (!userEmail && isDevelopment) {
      userEmail = 'dev@example.com';
      console.log('Clients API - Using default development email:', userEmail);
    }
    
    if (!userEmail) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "User email information is missing"
        },
        { status: 401 }
      );
    }
    
    // Get client ID from URL
    const url = new URL(request.url);
    const clientId = url.searchParams.get('id');
    
    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }
    
    // Parse and validate the request body
    const body = await request.json();
    const data = clientSchema.parse(body);
    
    // Check if client exists and belongs to the current user
    const { rows } = await db.connection.query(`
      SELECT id FROM clients WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
    `, [clientId, userEmail]);
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "Client not found or you don't have permission to update it" }, { status: 404 });
    }
    
    // Update the client
    await db.connection.query(`
      UPDATE clients
      SET name = $1, domains = $2, emails = $3, user_id = $4, updated_at = NOW()
      WHERE id = $5 AND (user_id = $6 OR user_id IS NULL)
    `, [
      data.name,
      JSON.stringify(data.domains),
      JSON.stringify(data.emails),
      userEmail,
      clientId,
      userEmail
    ]);
    
    return NextResponse.json({
      id: clientId,
      name: data.name,
      domains: data.domains,
      emails: data.emails,
      userId: userEmail
    });
  } catch (error) {
    console.error("Error updating client:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    if (!accessToken) {
      accessToken = getUserAccessToken();
    }
    
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
    
    // Get user email from the request headers (set by auth-provider)
    let userEmail = request.headers.get('X-User-Email');
    
    // In development mode, use a default email if none is provided
    if (!userEmail && isDevelopment) {
      userEmail = 'dev@example.com';
      console.log('Clients API - Using default development email:', userEmail);
    }
    
    if (!userEmail) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "User email information is missing"
        },
        { status: 401 }
      );
    }
    
    // Get client ID from URL
    const url = new URL(request.url);
    const clientId = url.searchParams.get('id');
    
    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }
    
    // Check if client exists and belongs to the current user
    const { rows } = await db.connection.query(`
      SELECT id FROM clients WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
    `, [clientId, userEmail]);
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "Client not found or you don't have permission to delete it" }, { status: 404 });
    }
    
    // First, delete any associated report feedback
    try {
      await db.connection.query(`
        DELETE FROM report_feedback WHERE client_id = $1
      `, [clientId]);
      console.log(`Deleted report feedback for client ${clientId}`);
    } catch (feedbackError) {
      console.error("Error deleting client feedback:", feedbackError);
      // Continue with deletion even if feedback deletion fails
    }
    
    // Next, delete any associated report templates
    await db.connection.query(`
      DELETE FROM report_templates WHERE client_id = $1
    `, [clientId]);
    
    // Then delete the client
    await db.connection.query(`
      DELETE FROM clients WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
    `, [clientId, userEmail]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}