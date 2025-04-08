import { db } from "~/lib/db";
import { getGraphClient, getUserEmail } from "~/lib/auth/microsoft";
import { findSimilarEmails } from "./email-embeddings";
import { queueBackgroundTask } from "./background-processor";
import { isServiceOrTechnicalEmail, sanitizeContent } from "./email-sanitizer";

// Parameters for email fetching
interface EmailParams {
  startDate: string;
  endDate: string;
  clientDomains?: string[];
  clientEmails?: string[];
  maxResults?: number;
  searchQuery?: string;  // Support semantic search
  useVectorSearch?: boolean; // Flag to enable vector search
  skipGraphApi?: boolean; // Skip Graph API calls when using pre-processed emails
}

// Function to get emails from both database and Microsoft Graph API
export async function getClientEmails(params: EmailParams) {
  try {
    console.log('EmailFetcher - Fetching client emails with params:', params);
    
    const { 
      startDate, 
      endDate, 
      clientDomains = [], 
      clientEmails = [], 
      maxResults = process.env.EMAIL_FETCH_LIMIT ? parseInt(process.env.EMAIL_FETCH_LIMIT) : 500,
      searchQuery,
      useVectorSearch = false,
      skipGraphApi = false
    } = params;
    
    console.log('EmailFetcher - Original client domains:', clientDomains);
    console.log('EmailFetcher - Original client emails:', clientEmails);
    
    // Expand client domains to include common variations
    const expandedDomains = [...clientDomains];
    
    // If any email from albany.edu is included, add the domain
    if (clientEmails.some(email => email.endsWith('@albany.edu')) && !clientDomains.includes('albany.edu')) {
      console.log('EmailFetcher - Adding albany.edu domain based on email addresses');
      expandedDomains.push('albany.edu');
    }
    
    // Extract domains from emails and add them if not already included
    const emailDomains = clientEmails
      .map(email => {
        const parts = email.split('@');
        return parts.length > 1 ? parts[1] : null;
      })
      .filter(domain => domain && !expandedDomains.includes(domain));
    
    emailDomains.forEach(domain => {
      if (domain && !expandedDomains.includes(domain)) {
        console.log(`EmailFetcher - Adding domain ${domain} extracted from client emails`);
        expandedDomains.push(domain);
      }
    });
    
    // Use expanded domains for queries
    const enhancedParams = {
      ...params,
      clientDomains: expandedDomains
    };
    
    console.log('EmailFetcher - Enhanced client domains:', expandedDomains);
    
    let dbEmails = [];
    
    // Try both vector and SQL search when appropriate
    let vectorEmails = [];
    
    // If search query is provided and vector search is enabled, try semantic search
    if (searchQuery && useVectorSearch) {
      console.log(`EmailFetcher - Using vector search for query: "${searchQuery}"`);
      try {
        vectorEmails = await findSimilarEmails(searchQuery, {
          limit: maxResults,
          startDate,
          endDate,
          clientDomains,
          clientEmails
        });
        console.log(`EmailFetcher - Found ${vectorEmails.length} emails via vector search`);
      } catch (error) {
        console.error("EmailFetcher - Vector search error:", error);
        // Continue with traditional search if vector search fails
      }
    }
    
    // Always perform traditional SQL search
    const sqlEmails = await getClientEmailsFromDatabase(enhancedParams);
    console.log(`EmailFetcher - Found ${sqlEmails.length} emails via SQL search`);
    
    // Use vector search results if available and not empty, otherwise fall back to SQL results
    if (searchQuery && useVectorSearch && vectorEmails.length > 0) {
      dbEmails = vectorEmails;
    } else {
      dbEmails = sqlEmails;
    }
    
    // If we have enough emails from the database or skipGraphApi is true, return them
    if (dbEmails.length >= maxResults || skipGraphApi) {
      console.log(`EmailFetcher - Using ${dbEmails.length} emails from database only`);
      return {
        emails: dbEmails.slice(0, maxResults),
        fromGraphApi: false
      };
    }
    
    // Otherwise, try to fetch additional emails from Graph API
    console.log('EmailFetcher - Fetching additional emails from Graph API');
    
    try {
      // Only fetch from Graph API if we don't have enough emails from the database
      const graphEmails = await getClientEmailsFromGraph(enhancedParams);
      console.log(`EmailFetcher - Found ${graphEmails.length} emails from Graph API`);
      
      // Combine emails from both sources, removing duplicates
      const allEmails = [...dbEmails];
      const dbEmailIds = new Set(dbEmails.map(email => email.id));
      
      for (const email of graphEmails) {
        if (!dbEmailIds.has(email.id)) {
          allEmails.push(email);
        }
      }
      
      console.log(`EmailFetcher - Combined total: ${allEmails.length} emails`);
      
      // Queue background task to process new emails for future use
      if (graphEmails.length > 0) {
        try {
          const emailIds = graphEmails.map(email => email.id);
          queueBackgroundTask('process_new_emails', { emailIds });
        } catch (queueError) {
          console.error('EmailFetcher - Error queueing background task:', queueError);
          // Continue even if queueing fails
        }
      }
      
      return {
        emails: allEmails.slice(0, maxResults),
        fromGraphApi: graphEmails.length > 0
      };
    } catch (graphError) {
      console.error('EmailFetcher - Error fetching from Graph API:', graphError);
      
      // If Graph API fails, just return what we have from the database
      console.log(`EmailFetcher - Falling back to ${dbEmails.length} emails from database only`);
      return {
        emails: dbEmails.slice(0, maxResults),
        fromGraphApi: false,
        error: graphError.message
      };
    }
  } catch (error) {
    console.error('EmailFetcher - Error in getClientEmails:', error);
    
    // Return an empty result with error information rather than throwing
    // This prevents the entire application from crashing on email fetch errors
    return {
      emails: [],
      fromGraphApi: false,
      error: error.message || 'An error occurred while fetching emails'
    };
  }
}

// Function to get client emails from database using SQL
async function getClientEmailsFromDatabase(params: EmailParams) {
  const { startDate, endDate, clientDomains = [], clientEmails = [], maxResults = 1000, searchQuery = '', useVectorSearch = false } = params;
  
  try {
    console.log('EmailFetcher - Fetching from database with date range:');
    console.log(`  - Start date: ${startDate}`);
    console.log(`  - End date: ${endDate}`);
    
    // For the database, we need to get it from the Graph API first
    let userEmail = '';
    try {
      const client = getGraphClient();
      if (client) {
        const userInfo = await client.api('/me').select('mail,userPrincipalName').get();
        userEmail = userInfo.mail || userInfo.userPrincipalName || '';
        console.log(`EmailFetcher - User email for database query: ${userEmail}`);
      }
    } catch (error) {
      console.error('EmailFetcher - Error getting user email for database query:', error);
      // Continue with empty userEmail - will fall back to old behavior
    }
    
    // Check if the database connection is properly initialized
    if (!db.connection) {
      console.error('EmailFetcher - Database connection not initialized');
      return { emails: [], fromGraphApi: false };
    }
    
    // Check if cc and bcc columns exist in the database using prepare/all instead of get
    let hasCcBccColumns = false;
    try {
      const stmt = db.connection.prepare('PRAGMA table_info(messages)');
      const columnInfo = stmt.all();
      
      hasCcBccColumns = columnInfo.some((column: any) => column.name === 'cc') && 
                        columnInfo.some((column: any) => column.name === 'bcc');
      
      console.log(`EmailFetcher - Database has cc/bcc columns: ${hasCcBccColumns}`);
    } catch (error) {
      console.error('EmailFetcher - Error checking database columns:', error);
      // Continue without cc/bcc columns
      hasCcBccColumns = false;
    }
    
    // If columns don't exist, log a warning but continue
    if (!hasCcBccColumns) {
      console.warn('EmailFetcher - CC and BCC columns not found in messages table. Some email filtering may be limited.');
    }
    
    // Get formatted date strings for query params
    const startDateStr = new Date(startDate).toISOString().split('T')[0];
    const endDateStr = new Date(endDate).toISOString().split('T')[0];
    const queryParams = [startDateStr, endDateStr];
    
    // Build domain-based conditions
    let domainConditions = '';
    if (clientDomains.length > 0) {
      const domainFilters = clientDomains.map((domain, i) => {
        const sanitizedDomain = domain.replace(/'/g, "''");  // SQL escape single quotes
        return `("from" LIKE '%@${sanitizedDomain}%' OR "from" LIKE '%@%.${sanitizedDomain}%' OR "to" LIKE '%@${sanitizedDomain}%' OR "to" LIKE '%@%.${sanitizedDomain}%'${hasCcBccColumns ? ` OR "cc" LIKE '%@${sanitizedDomain}%' OR "cc" LIKE '%@%.${sanitizedDomain}%' OR "bcc" LIKE '%@${sanitizedDomain}%' OR "bcc" LIKE '%@%.${sanitizedDomain}%'` : ''})`;
      }).join(' OR ');
      
      if (domainFilters) {
        domainConditions = ` OR (${domainFilters})`;
      }
    }
    
    // Build client email conditions with checks against both FROM and TO fields
    const emailConditions = [];
    
    const userEmailFromGraph = await getUserEmail();
    if (userEmailFromGraph) {
      const sanitizedUserEmail = userEmailFromGraph.replace(/'/g, "''");  // SQL escape single quotes
      
      // Add conditions for each client email
      clientEmails.forEach(clientEmail => {
        const sanitizedClientEmail = clientEmail.replace(/'/g, "''");  // SQL escape single quotes
        if (hasCcBccColumns) {
          // User to client
          emailConditions.push(`("from" = '${sanitizedUserEmail}' AND ("to" = '${sanitizedClientEmail}' OR "cc" LIKE '%${sanitizedClientEmail}%' OR "bcc" LIKE '%${sanitizedClientEmail}%'))`);
          // Client to user
          emailConditions.push(`("from" = '${sanitizedClientEmail}' AND ("to" = '${sanitizedUserEmail}' OR "cc" LIKE '%${sanitizedUserEmail}%' OR "bcc" LIKE '%${sanitizedUserEmail}%'))`);
        } else {
          // User to client
          emailConditions.push(`("from" = '${sanitizedUserEmail}' AND "to" = '${sanitizedClientEmail}')`);
          // Client to user
          emailConditions.push(`("from" = '${sanitizedClientEmail}' AND "to" = '${sanitizedUserEmail}')`);
        }
      });
    } else {
      // If we can't get the user's email, just search for client emails in general
      console.log('EmailFetcher - No user email available, searching for client emails only');
      
      // Add conditions for each client email
      clientEmails.forEach(clientEmail => {
        const sanitizedClientEmail = clientEmail.replace(/'/g, "''");  // SQL escape single quotes
        if (hasCcBccColumns) {
          emailConditions.push(`("from" = '${sanitizedClientEmail}' OR "to" = '${sanitizedClientEmail}' OR "cc" LIKE '%${sanitizedClientEmail}%' OR "bcc" LIKE '%${sanitizedClientEmail}%')`);
        } else {
          emailConditions.push(`("from" = '${sanitizedClientEmail}' OR "to" = '${sanitizedClientEmail}')`);
        }
      });
    }
    
    // Combine all email conditions
    const emailFilter = emailConditions.length > 0 ? `(${emailConditions.join(' OR ')})` : '1=1'; // Default condition that's always true
    
    // Final WHERE clause combining date range, email conditions, and domain conditions
    const whereClause = `WHERE date >= ? AND date <= ? AND (${emailFilter}${domainConditions})`;
    
    // Full query with proper ordering and limit
    const query = `
      SELECT * FROM messages 
      ${whereClause}
      ORDER BY date DESC
      LIMIT ?
    `;
    
    console.log('EmailFetcher - Database query:', query);
    console.log('EmailFetcher - Database query params:', queryParams);
    
    // Add the maxResults parameter to the query params, converting to string to match expected type
    queryParams.push(String(maxResults));
    
    // Execute the raw SQL query instead of using the ORM
    const stmt = db.connection.prepare(query);
    const emails = stmt.all(...queryParams);
    
    // Add source information to emails for weighting and sanitize sensitive content
    return emails.map((email: any) => {
      // First determine the source for weighting
      let source = 'database';
      
      // Apply the same sanitization to database emails
      const fromEmail = email.from || '';
      
      if (fromEmail === userEmail) {
        source = 'user'; // Email is from the current user
      } else if (
        clientEmails.includes(fromEmail) ||
        clientDomains.some(domain => fromEmail.endsWith(`@${domain}`))
      ) {
        source = 'client'; // Email is from a client
      }
      
      // For database emails, we need to parse the recipient strings
      const toAddress = email.to || '';
      const ccAddress = email.cc || '';
      
      // Split recipient strings
      const toAddresses = toAddress.split(',').map(addr => addr.trim());
      const ccAddresses = ccAddress.split(',').map(addr => addr.trim());
      const allRecipients = [...toAddresses, ...ccAddresses];
      
      // Simple rule: Is this email relevant to the client?
      // Either it's FROM the client, TO the client, or BETWEEN user and client
      const isClientSender = clientEmails.includes(fromEmail) || 
                              clientDomains.some(domain => fromEmail.endsWith(`@${domain}`));
                              
      const isClientRecipient = allRecipients.some(addr => 
                               clientEmails.includes(addr) || 
                               clientDomains.some(domain => addr.endsWith(`@${domain}`)));
                               
      const isUserToClient = fromEmail === userEmail && isClientRecipient;
      const isClientToUser = isClientSender && allRecipients.includes(userEmail);
      
      // Only include emails that directly involve the client
      const isRelevantToClient = isClientSender || isClientRecipient || isUserToClient || isClientToUser;
      
      // If it's not relevant to the client, skip this email
      if (!isRelevantToClient) {
        return null;
      }
      
      return {
        ...email,
        source
      };
    }).filter(email => email !== null); // Remove null emails
  } catch (error) {
    console.error('EmailFetcher - Error getting emails from database:', error);
    return [];
  }
}

// Function to get client emails from Microsoft Graph API
async function getClientEmailsFromGraph(params: EmailParams) {
  try {
    const { startDate, endDate, clientDomains = [], clientEmails = [], maxResults = 100 } = params;
    
    console.log('EmailFetcher - Fetching from Graph with date range:');
    console.log(`  - Start date: ${startDate}`);
    console.log(`  - End date: ${endDate}`);
    
    // Build filter conditions for Graph API
    const filterParts = [];
    
    // Date range filter
    filterParts.push(`receivedDateTime ge ${startDate} and receivedDateTime le ${endDate}`);
    
    // Get Microsoft Graph client
    const client = getGraphClient();
    
    if (!client) {
      console.log('EmailFetcher - No Graph client available');
      return [];
    }
    
    // First get the current user's email address
    const userInfo = await client.api('/me').select('mail,userPrincipalName').get();
    const userEmail = userInfo.mail || userInfo.userPrincipalName || '';
    
    if (!userEmail) {
      console.log('EmailFetcher - Could not determine user email');
      return [];
    }
    
    console.log(`EmailFetcher - User email identified as: ${userEmail}`);
    
    // Query Graph API
    const graphResult = await client
      .api('/me/messages')
      .select('id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,bodyPreview,body,hasAttachments')
      .filter(filterParts.join(' and '))
      .top(maxResults)
      .orderby('receivedDateTime desc')
      .get();
    
    if (!graphResult || !graphResult.value) {
      console.log('EmailFetcher - No results from Graph API');
      return [];
    }
    
    // Filter results by client domains/emails with improved logic
    let filteredResults = graphResult.value;
    
    if (clientDomains.length > 0 || clientEmails.length > 0) {
      filteredResults = graphResult.value.filter(message => {
        const fromEmail = message.from?.emailAddress?.address || '';
        const toRecipients = message.toRecipients?.map(r => r.emailAddress?.address || '') || [];
        const ccRecipients = message.ccRecipients?.map(r => r.emailAddress?.address || '') || [];
        // Add BCC recipients if available (usually only visible to the sender)
        const bccRecipients = message.bccRecipients?.map(r => r.emailAddress?.address || '') || [];
        
        // All recipients combined for broader matching
        const allRecipients = [...toRecipients, ...ccRecipients, ...bccRecipients];
        
        // Simple rule: Is this email relevant to the client?
        // Either it's FROM the client, TO the client, or BETWEEN user and client
        const isClientSender = clientEmails.includes(fromEmail) || 
                                clientDomains.some(domain => fromEmail.endsWith(`@${domain}`));
                                
        const isClientRecipient = allRecipients.some(addr => 
                                  clientEmails.includes(addr) || 
                                  clientDomains.some(domain => addr.endsWith(`@${domain}`)));
                                  
        const isUserToClient = fromEmail === userEmail && isClientRecipient;
        const isClientToUser = isClientSender && allRecipients.includes(userEmail);
        
        // Only include emails that directly involve the client
        return isClientSender || isClientRecipient || isUserToClient || isClientToUser;
      });
    }
    
    // Enhanced logging for diagnostic purposes
    console.log(`EmailFetcher - Graph API returned ${graphResult.value.length} emails, filtered to ${filteredResults.length}`);
    if (filteredResults.length === 0 && graphResult.value.length > 0) {
      // Log a sample of what emails were returned but filtered out
      const sampleSize = Math.min(5, graphResult.value.length);
      console.log(`EmailFetcher - Sample of filtered out emails (${sampleSize} of ${graphResult.value.length}):`);
      
      for (let i = 0; i < sampleSize; i++) {
        const email = graphResult.value[i];
        console.log(`  Email ${i+1}:`, {
          subject: email.subject,
          from: email.from?.emailAddress?.address,
          to: email.toRecipients?.map(r => r.emailAddress?.address),
          cc: email.ccRecipients?.map(r => r.emailAddress?.address),
          receivedDateTime: email.receivedDateTime
        });
      }
    }
    
    // Check if the table has cc and bcc columns
    let hasCcBccColumns = false;
    try {
      const tableInfo = db.connection.prepare('PRAGMA table_info(messages)').all();
      const columnNames = tableInfo.map(col => col.name);
      hasCcBccColumns = columnNames.includes('cc') && columnNames.includes('bcc');
    } catch (error) {
      console.error('EmailFetcher - Error checking table schema for cc/bcc columns:', error);
    }
    
    // Convert Graph API format to our format
    const emails = filteredResults.map(message => {
      // Extract text from HTML body
      const bodyContent = message.body?.content || '';
      const body = bodyContent
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/\\s+/g, ' ')    // Normalize whitespace
        .trim();
      
      // Determine the source (user, client, or other)
      let source = 'other';
      const fromEmail = message.from?.emailAddress?.address || '';
      
      if (fromEmail === userEmail) {
        source = 'user'; // Email is from the current user
      } else if (
        clientEmails.includes(fromEmail) ||
        clientDomains.some(domain => fromEmail.endsWith(`@${domain}`))
      ) {
        source = 'client'; // Email is from a client
      }
      
      // Extract all recipient email addresses
      const toRecipientEmails = message.toRecipients?.map(r => r.emailAddress?.address || '') || [];
      const ccRecipientEmails = message.ccRecipients?.map(r => r.emailAddress?.address || '') || [];
      const allRecipientEmails = [...toRecipientEmails, ...ccRecipientEmails];
      
      // Simple rule: Is this email relevant to the client?
      // Either it's FROM the client, TO the client, or BETWEEN user and client
      const isClientSender = clientEmails.includes(fromEmail) || 
                              clientDomains.some(domain => fromEmail.endsWith(`@${domain}`));
                              
      const isClientRecipient = allRecipientEmails.some(addr => 
                               clientEmails.includes(addr) || 
                               clientDomains.some(domain => addr.endsWith(`@${domain}`)));
                               
      const isUserToClient = fromEmail === userEmail && isClientRecipient;
      const isClientToUser = isClientSender && allRecipientEmails.includes(userEmail);
      
      // Only include emails that directly involve the client
      const isRelevantToClient = isClientSender || isClientRecipient || isUserToClient || isClientToUser;
      
      // If it's not relevant to the client, exclude it completely
      if (!isRelevantToClient) {
        return null; // Skip this email
      }
      
      // Store CC and BCC data in the appropriate fields
      const ccStr = message.ccRecipients?.map(r => r.emailAddress?.address || '').join(', ') || '';
      const bccStr = message.bccRecipients?.map(r => r.emailAddress?.address || '').join(', ') || '';
      
      const emailData: any = {
        id: message.id,
        subject: message.subject || '',
        from: message.from?.emailAddress?.address || '',
        to: message.toRecipients?.[0]?.emailAddress?.address || '',
        date: message.receivedDateTime,
        body: body,
        summary: '',
        labels: JSON.stringify([]),
        attachments: JSON.stringify([]),
        source: source // Add source field
      };
      
      // Add CC and BCC fields if the database supports them
      if (hasCcBccColumns) {
        emailData.cc = ccStr;
        emailData.bcc = bccStr;
      }
      
      return emailData;
    }).filter(email => email !== null); // Remove null emails
    
    // Save emails to database
    try {
      console.log(`EmailFetcher - Attempting to save ${emails.length} emails to database`);
      
      // Log database schema for debugging
      try {
        const tableInfoStmt = db.connection.prepare('PRAGMA table_info(messages)');
        const tableInfo = tableInfoStmt.all();
        console.log('EmailFetcher - Database schema for messages table:', tableInfo);
      } catch (schemaError) {
        console.error('EmailFetcher - Error fetching schema:', schemaError);
      }
      
      const savedEmails = [];
      for (const email of emails) {
        try {
          // Check if email already exists in database
          const existingStmt = db.connection.prepare('SELECT id FROM messages WHERE id = ?');
          const existing = existingStmt.get(email.id);
          
          if (!existing) {
            // Create columns string and values placeholders dynamically based on columns
            const columnsArr = ['id', 'subject', 'from', 'to', 'date', 'body', 'attachments', 'summary', 'labels', 'processed_for_vector'];
            const valuesArr = ['?', '?', '?', '?', '?', '?', '?', '?', '?', '0'];
            
            // Add cc and bcc if they exist in the schema
            if (hasCcBccColumns && email.cc !== undefined) {
              columnsArr.push('cc');
              valuesArr.push('?');
            }
            
            if (hasCcBccColumns && email.bcc !== undefined) {
              columnsArr.push('bcc');
              valuesArr.push('?');
            }
            
            // Generate column string and values placeholders
            const columnsStr = columnsArr.map(col => `"${col}"`).join(', ');
            const valuesStr = valuesArr.join(', ');
            
            // Build insert SQL
            const insertSQL = `
              INSERT INTO messages (
                ${columnsStr}
              ) VALUES (${valuesStr})
            `;
            
            // Build params array
            const params = [
              email.id,
              email.subject,
              email.from,
              email.to,
              email.date,
              email.body,
              email.attachments,
              email.summary,
              email.labels
            ];
            
            // Add cc and bcc if they exist in the schema
            if (hasCcBccColumns && email.cc !== undefined) {
              params.push(email.cc);
            }
            
            if (hasCcBccColumns && email.bcc !== undefined) {
              params.push(email.bcc);
            }
            
            // Execute insert
            const insertStmt = db.connection.prepare(insertSQL);
            insertStmt.run(...params);
            
            console.log(`EmailFetcher - Saved email with ID ${email.id} to database`);
            savedEmails.push(email.id);
          } else {
            console.log(`EmailFetcher - Email ${email.id} already exists in database`);
          }
        } catch (singleEmailError) {
          console.error(`EmailFetcher - Error saving email ${email.id}:`, singleEmailError);
          console.error(`EmailFetcher - Email data:`, JSON.stringify({
            id: email.id,
            subject: email.subject,
            from: email.from,
            to: email.to,
            date: email.date?.substring(0, 30) + '...',
          }));
        }
      }
      
      if (savedEmails.length > 0) {
        console.log(`EmailFetcher - Saved ${savedEmails.length} new emails to database`);
        // Queue background processing for these specific emails
        queueBackgroundTask('process_new_emails', { 
          emailIds: savedEmails,
          priority: 'high'
        });
      } else {
        console.log('EmailFetcher - No new emails to save to database');
      }
    } catch (dbError) {
      console.error('EmailFetcher - Error saving emails to database:', dbError);
    }
    
    return emails;
  } catch (error) {
    console.error('EmailFetcher - Error getting emails from Graph API:', error);
    return [];
  }
}