import { db } from "~/lib/db";
import { getGraphClient } from "~/lib/auth/microsoft";
import { findSimilarEmails } from "./email-embeddings";
import { queueBackgroundTask } from "./background-processor";

/**
 * Get the current user's email - works in both browser and server contexts
 */
async function getUserEmail() {
  try {
    // For browser environments, use sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const storedEmail = sessionStorage.getItem('userEmail');
      if (storedEmail) {
        return storedEmail;
      }
    }
    
    // For server-side context, try to get from Graph API
    try {
      const client = getGraphClient();
      if (client) {
        const userInfo = await client.api('/me').select('mail,userPrincipalName').get();
        const userEmail = userInfo.mail || userInfo.userPrincipalName || '';
        
        if (userEmail) {
          return userEmail;
        }
      }
    } catch (graphError) {
      console.log('EmailFetcher - Could not get user email from Graph API:', graphError);
    }
    
    // If we're in development mode, provide a fallback email for testing
    if (process.env.NODE_ENV === 'development') {
      return process.env.DEFAULT_USER_EMAIL || 'dev@example.com';
    }
    
    return null;
  } catch (error) {
    console.error('EmailFetcher - Error getting user email:', error);
    return null;
  }
}

// Parameters for email fetching
interface EmailParams {
  startDate: string;
  endDate: string;
  clientDomains?: string[];
  clientEmails?: string[];
  maxResults?: number;
  searchQuery?: string;  // New: Support semantic search
  useVectorSearch?: boolean; // New: Flag to enable vector search
  userId?: string; // Add userId for secure filtering
}

// Function to normalize domain format for consistent matching
const normalizeDomain = (domain: string): string => {
  // Remove @ prefix if present
  let normalizedDomain = domain.startsWith('@') ? domain.substring(1) : domain;
  
  // Ensure domain has at least one dot (unless it's a simple name like 'localhost')
  if (!normalizedDomain.includes('.') && normalizedDomain !== 'localhost') {
    // If no dot, assume it's a TLD and add .com (e.g., "acme" becomes "acme.com")
    normalizedDomain = `${normalizedDomain}.com`;
  }
  
  return normalizedDomain.toLowerCase();
};

// Function to get emails from both database and Microsoft Graph API
export async function getClientEmails(params: EmailParams) {
  let userId = params.userId;
  if (!userId) {
    userId = await getUserEmail();
  }
  try {
    console.log('EmailFetcher - Fetching client emails with params:', params);
    
    const { 
      startDate, 
      endDate, 
      clientDomains = [], 
      clientEmails = [], 
      maxResults = process.env.EMAIL_FETCH_LIMIT ? parseInt(process.env.EMAIL_FETCH_LIMIT) : 500,
      searchQuery,
      useVectorSearch = false
    } = params;
    
    console.log('EmailFetcher - Original client domains:', clientDomains);
    console.log('EmailFetcher - Original client emails:', clientEmails);
    
    // Normalize all client domains
    const normalizedDomains = clientDomains.map(normalizeDomain);
    console.log('EmailFetcher - Normalized client domains:', normalizedDomains);
    
    // Expand client domains to include common variations
    const expandedDomains = [...normalizedDomains];
    
    // If any email from albany.edu is included, add the domain
    if (clientEmails.some(email => email.endsWith('@albany.edu')) && !expandedDomains.includes('albany.edu')) {
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
      clientDomains: expandedDomains,
      userId
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
    
    // Queue a background task to process any new emails
    // Use configurable batch size from environment or a reasonable default
    const batchSize = process.env.EMAIL_PROCESSING_BATCH_SIZE ? 
      parseInt(process.env.EMAIL_PROCESSING_BATCH_SIZE) : 200;
    
    queueBackgroundTask('process_new_emails', { limit: batchSize });
    
    // Try to fetch emails from Graph API if we have access
    let graphEmails = [];
    let fromGraphApi = false;
    
    try {
      // Get Microsoft Graph client
      const client = getGraphClient();
      
      if (client) {
        // Get emails from Graph API filtered by client domains/emails
        graphEmails = await getClientEmailsFromGraph(enhancedParams);
        console.log(`EmailFetcher - Found ${graphEmails.length} emails from Graph API`);
        fromGraphApi = graphEmails.length > 0;
      }
    } catch (error) {
      console.error('EmailFetcher - Error fetching from Graph API:', error);
      // Continue with just the database emails
    }
    
    // Combine emails from both sources and deduplicate
    let allEmails = [...dbEmails, ...graphEmails];
    
    // Deduplicate based on email ID
    const emailMap = new Map();
    for (const email of allEmails) {
      emailMap.set(email.id, email);
    }
    
    // Convert back to array
    allEmails = Array.from(emailMap.values());
    
    // Sort by date (newest first) - unless we're using vector search, which already orders by relevance
    if (!useVectorSearch) {
      allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    // Limit the number of results
    if (maxResults && allEmails.length > maxResults) {
      allEmails = allEmails.slice(0, maxResults);
    }
    
    return {
      emails: allEmails,
      fromGraphApi,
      vectorSearchUsed: useVectorSearch && !!searchQuery
    };
  } catch (error) {
    console.error('EmailFetcher - Error getting comprehensive emails:', error);
    throw error;
  }
}

// Function to get client emails from database using SQL
async function getClientEmailsFromDatabase(params: EmailParams) {
  const { startDate, endDate, clientDomains = [], clientEmails = [], maxResults = 1000, searchQuery = "", userId } = params;
  
  console.log('EmailFetcher - Fetching from database with date range:');
  console.log(`  - Start date: ${startDate}`);
  console.log(`  - End date: ${endDate}`);
  if (searchQuery) {
    console.log(`  - Search query: "${searchQuery}"`);
  }
  
  // First, get the user's own email
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
  
  // Check if cc and bcc columns exist in the database
  let hasCcBccColumns = false;
  try {
    const tableInfoResult = await db.connection.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name IN ('cc', 'bcc')
    `);
    hasCcBccColumns = tableInfoResult.rows.length === 2;
    console.log(`EmailFetcher - Database has cc/bcc columns: ${hasCcBccColumns}`);
  } catch (error) {
    console.error('EmailFetcher - Error checking table schema for cc/bcc columns:', error);
  }
  
  // Build SQL query conditions
  let domainConditions = '';
  // Initialize query params array here with the date values
  const queryParams = [startDate, endDate, userId];
  
  if (clientDomains.length > 0) {
    // Normalize all domains for consistent matching
    const normalizedDomains = clientDomains.map(normalizeDomain);
    
    const domainFilters = normalizedDomains.map((domain, i) => {
      const sanitizedDomain = domain.replace(/'/g, "''");  // SQL escape single quotes
      
      // Create more precise domain matching conditions
      // Match exact domain after @ or subdomain ending with .domain
      return `(
        "from" LIKE '%@${sanitizedDomain}%' OR 
        "from" LIKE '%@%.${sanitizedDomain}%' OR 
        "to" LIKE '%@${sanitizedDomain}%' OR 
        "to" LIKE '%@%.${sanitizedDomain}%'
        ${hasCcBccColumns ? 
          ` OR "cc" LIKE '%@${sanitizedDomain}%' OR 
            "cc" LIKE '%@%.${sanitizedDomain}%' OR 
            "bcc" LIKE '%@${sanitizedDomain}%' OR 
            "bcc" LIKE '%@%.${sanitizedDomain}%'` 
          : ''}
      )`;
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
  }
  
  // Combine all email conditions
  const emailFilter = emailConditions.length > 0 ? `(${emailConditions.join(' OR ')})` : '1=1'; // Default condition that's always true
  
  // Final WHERE clause combining date range, email conditions, and domain conditions
  const whereClause = `WHERE date >= $1 AND date <= $2 AND (${emailFilter}${domainConditions}) AND user_id = $${queryParams.length}`;
  
  // Full query with proper ordering and limit
  const query = `
    SELECT * FROM messages 
    ${whereClause}
    ORDER BY date DESC
    LIMIT $${queryParams.length + 1}
  `;
  
  console.log('EmailFetcher - Database query:', query);
  console.log('EmailFetcher - Database query params:', queryParams);
  
  // Add max results parameter
  queryParams.push(maxResults.toString());
  
  // Execute the query using PostgreSQL syntax with $ parameter placeholders
  const { rows } = await db.connection.query(query, queryParams);
  
  // Add source information to emails for weighting
  return rows.map((email: any) => ({
    ...email,
    source: 'database'
  }));
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
        
        // Enhanced matching logic:
        
        // Case 1: Email from user to client (direct or CC/BCC)
        const isFromUserToClient = 
          fromEmail === userEmail && 
          (
            // Check if any client email is in any recipient field
            clientEmails.some(email => allRecipients.includes(email)) ||
            // Check if any client domain is in any recipient field
            clientDomains.some(domain => 
              allRecipients.some(recipient => recipient.endsWith(`@${domain}`))
            )
          );
        
        // Case 2: Email from client to user (as any type of recipient)
        const isFromClientToUser = 
          allRecipients.includes(userEmail) &&
          (
            // From email matches a client email exactly
            clientEmails.includes(fromEmail) ||
            // From email domain matches a client domain
            clientDomains.some(domain => fromEmail.endsWith(`@${domain}`))
          );
        
        // Case 3: Partial email address matching (for when only username is different)
        const hasPartialMatch = () => {
          // Check client domains
          if (clientDomains && clientDomains.length > 0) {
            // Normalize all domains for consistent matching
            const normalizedClientDomains = clientDomains.map(normalizeDomain);
            
            // Original domain matching logic with normalized domains
            const fromDomainMatch = normalizedClientDomains.some(domain => {
              // Get the domain part of the from email
              const fromParts = fromEmail?.split('@');
              if (fromParts && fromParts.length > 1) {
                const fromDomain = fromParts[1].toLowerCase();
                // Match exact domain or subdomain
                return fromDomain === domain || fromDomain.endsWith(`.${domain}`);
              }
              return false;
            });
            
            if (fromDomainMatch) {
              return true;
            }
            
            // Check recipient, cc and bcc for domain matches with normalized domains
            const checkAddressForDomainMatch = (address: string) => {
              const addressParts = address.split('@');
              if (addressParts.length > 1) {
                const addressDomain = addressParts[1].toLowerCase();
                return normalizedClientDomains.some(domain => 
                  addressDomain === domain || addressDomain.endsWith(`.${domain}`)
                );
              }
              return false;
            };
            
            // Check all recipient types
            const toDomainMatch = toRecipients?.some(checkAddressForDomainMatch);
            const ccDomainMatch = ccRecipients?.some(checkAddressForDomainMatch);
            const bccDomainMatch = bccRecipients?.some(checkAddressForDomainMatch);
            
            if (toDomainMatch || ccDomainMatch || bccDomainMatch) {
              return true;
            }
          }
          
          // Check for specific email matches
          if (clientEmails && clientEmails.length > 0) {
            // Check if from address matches any client email
            if (clientEmails.some(email => fromEmail?.toLowerCase() === email.toLowerCase())) {
              return true;
            }
            
            // Check if any recipient matches client emails
            if (toRecipients?.some(addr => clientEmails.some(email => addr.toLowerCase() === email.toLowerCase()))) {
              return true;
            }
            
            // Check CC recipients
            if (ccRecipients?.some(addr => clientEmails.some(email => addr.toLowerCase() === email.toLowerCase()))) {
              return true;
            }
            
            // Check BCC recipients
            if (bccRecipients?.some(addr => clientEmails.some(email => addr.toLowerCase() === email.toLowerCase()))) {
              return true;
            }
            
            // Check for partial matches (same domain with different username)
            for (const clientEmail of clientEmails) {
              const [, clientDomain] = clientEmail.split('@');
              if (clientDomain) {
                // Normalize the domain from the client email
                const normalizedClientDomain = normalizeDomain(clientDomain);
                
                // Check if from email uses same domain
                const fromParts = fromEmail?.split('@');
                if (fromParts && fromParts.length > 1) {
                  const fromDomain = fromParts[1].toLowerCase();
                  if (fromDomain === normalizedClientDomain || fromDomain.endsWith(`.${normalizedClientDomain}`)) {
                    return true;
                  }
                }
                
                // Check if any recipient uses same domain
                const checkRecipientDomain = (addr: string) => {
                  const addrParts = addr.split('@');
                  if (addrParts.length > 1) {
                    const addrDomain = addrParts[1].toLowerCase();
                    return addrDomain === normalizedClientDomain || addrDomain.endsWith(`.${normalizedClientDomain}`);
                  }
                  return false;
                };
                
                if (toRecipients?.some(checkRecipientDomain) ||
                    ccRecipients?.some(checkRecipientDomain) ||
                    bccRecipients?.some(checkRecipientDomain)) {
                  return true;
                }
              }
            }
          }
          
          return false;
        };
        
        // Case 4 (to exclude): Both user and client are recipients but from someone else (newsletters, notifications)
        // We now want to include these as they may be relevant to the client
        const isNewsletter = 
          allRecipients.includes(userEmail) && 
          (
            clientEmails.some(email => allRecipients.includes(email)) ||
            clientDomains.some(domain => 
              allRecipients.some(recipient => recipient.endsWith(`@${domain}`))
            )
          ) &&
          !isFromUserToClient && 
          !isFromClientToUser;
        
        // Include all relevant cases:
        // - From user to client (any recipient field)
        // - From client to user (any recipient field)
        // - Has partial match on email domains of interest
        // - Include newsletters/notifications when they involve the client
        return isFromUserToClient || isFromClientToUser || hasPartialMatch() || isNewsletter;
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
    
    // Filter by client criteria
    let hasCcBccColumns = false;
    try {
      const tableInfoResult = await db.connection.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name IN ('cc', 'bcc')
      `);
      hasCcBccColumns = tableInfoResult.rows.length === 2;
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
      
      // Store CC and BCC data in the appropriate fields
      const ccStr = message.ccRecipients?.map(r => r.emailAddress?.address || '').join(', ') || '';
      const bccStr = message.bccRecipients?.map(r => r.emailAddress?.address || '').join(', ') || '';
      
      const emailData: any = {
        id: message.id,
        subject: message.subject || '(No Subject)',
        from: message.from?.emailAddress?.address || '',
        to: message.toRecipients?.[0]?.emailAddress?.address || '',
        date: message.receivedDateTime,
        body: body,
        summary: '',
        labels: JSON.stringify([]),
        attachments: JSON.stringify([]),
        source: source, // Add source field
        user_id: params.userId
      };
      
      // Add CC and BCC fields if the database supports them
      if (hasCcBccColumns) {
        emailData.cc = ccStr;
        emailData.bcc = bccStr;
      }
      
      return emailData;
    });
    
    // Save emails to database
    try {
      console.log(`EmailFetcher - Attempting to save ${emails.length} emails to database`);
      
      // Log database schema for debugging (PostgreSQL version)
      try {
        const { rows } = await db.connection.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'messages'
        `);
        console.log('EmailFetcher - Database schema for messages table:', rows);
      } catch (schemaError) {
        console.error('EmailFetcher - Error fetching schema:', schemaError);
      }
      
      const savedEmails = [];
      for (const email of emails) {
        try {
          // Check if email already exists in database (PostgreSQL version)
          const { rows } = await db.connection.query(
            'SELECT id FROM messages WHERE id = $1',
            [email.id]
          );
          
          if (rows.length === 0) {
            // Create columns string and values placeholders dynamically based on columns
            const columnsArr = ['id', 'subject', 'from', 'to', 'date', 'body', 'attachments', 'summary', 'labels', 'processed_for_vector', 'user_id'];
            let paramIndex = 1; // PostgreSQL uses $1, $2, etc.
            let valuesArr = [`$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, 
                           `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`, `$${paramIndex++}`];
            
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
              email.labels,
              false, // processed_for_vector
              email.user_id
            ];
            
            // Add cc and bcc if they exist in the schema
            if (hasCcBccColumns && email.cc !== undefined) {
              columnsArr.push('cc');
              valuesArr.push(`$${paramIndex++}`);
              params.push(email.cc);
            }
            
            if (hasCcBccColumns && email.bcc !== undefined) {
              columnsArr.push('bcc');
              valuesArr.push(`$${paramIndex++}`);
              params.push(email.bcc);
            }
            
            // Generate column string and values placeholders
            const columnsStr = columnsArr.map(col => `"${col}"`).join(', ');
            const valuesStr = valuesArr.join(', ');
            
            // Build insert SQL for PostgreSQL
            const insertSQL = `
              INSERT INTO messages (${columnsStr}) VALUES (${valuesStr})
            `;
            
            // Execute the insert SQL query
            await db.connection.query(insertSQL, params);
            
            savedEmails.push(email);
          }
        } catch (error) {
          console.error('EmailFetcher - Error saving email to database:', error);
        }
      }
      
      return savedEmails;
    } catch (error) {
      console.error('EmailFetcher - Error saving emails to database:', error);
      return [];
    }
  } catch (error) {
    console.error('EmailFetcher - Error getting emails from Graph API:', error);
    return [];
  }
}