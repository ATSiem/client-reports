import { openai } from "@ai-sdk/openai";
import { db } from "~/lib/db";
import { messages } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { getGraphClient } from "~/lib/auth/microsoft";

import { getCurrentModelSpec } from "~/lib/ai/model-info";
import { env } from "~/lib/env";

// Initialize OpenAI - make sure API key is set
if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY is not set in the environment");
}

// Constants
const BATCH_SIZE = env.EMBEDDING_BATCH_SIZE;

// Get embedding dimension from the model spec
const embeddingModel = getCurrentModelSpec('embedding');
const EMBEDDING_DIMENSION = embeddingModel.embeddingDimension || 1536; // Default to 1536 as fallback

console.log(`EmailEmbeddings - Using model: ${embeddingModel.name}, dimension: ${EMBEDDING_DIMENSION}`)

/**
 * Generate and store embeddings for emails that haven't been processed yet
 * @param limit Maximum number of emails to process (default: 200, or configurable via env)
 */
export async function processEmailEmbeddings(limit = process.env.EMAIL_EMBEDDING_BATCH_SIZE ? 
  parseInt(process.env.EMAIL_EMBEDDING_BATCH_SIZE) : 200) {
  try {
    console.log('EmailEmbeddings - Starting embedding generation for unprocessed emails');
    
    // Get emails that need embeddings
    const unprocessedEmailsResult = await db.connection.query(`
      SELECT id, subject, body, summary 
      FROM messages 
      WHERE processed_for_vector = false OR embedding IS NULL
      LIMIT $1
    `, [limit]);
    
    const unprocessedEmails = unprocessedEmailsResult.rows;
    console.log(`EmailEmbeddings - Found ${unprocessedEmails.length} emails to process`);
    
    if (unprocessedEmails.length === 0) {
      return { success: true, processed: 0 };
    }
    
    // Process in batches to avoid rate limits
    let processedCount = 0;
    
    for (let i = 0; i < unprocessedEmails.length; i += BATCH_SIZE) {
      const batch = unprocessedEmails.slice(i, i + BATCH_SIZE);
      console.log(`EmailEmbeddings - Processing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(unprocessedEmails.length/BATCH_SIZE)}`);
      
      await Promise.all(batch.map(async (email) => {
        try {
          // Generate embedding using OpenAI
          const embedding = await generateEmbedding(email);
          
          // Store the embedding in the database
          if (embedding) {
            // Format embedding for PostgreSQL vector type
            const formattedEmbedding = formatEmbeddingForPostgres(embedding);
            
            await db.connection.query(`
              UPDATE messages 
              SET embedding = $1, processed_for_vector = true, updated_at = NOW()
              WHERE id = $2
            `, [formattedEmbedding, email.id]);
            processedCount++;
          }
        } catch (err) {
          // Reduce verbosity by not printing full vector in error
          const errorMessage = err.message || String(err);
          const truncatedError = errorMessage.length > 150 ? 
            `${errorMessage.substring(0, 150)}... [truncated]` : errorMessage;
          
          console.error(`EmailEmbeddings - Error processing email ${email.id}:`, truncatedError);
          
          if (err.stack) {
            console.error(`Stack trace: ${err.stack.split('\n')[0]}`);
          }
        }
      }));
      
      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < unprocessedEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`EmailEmbeddings - Successfully processed ${processedCount} emails`);
    return { success: true, processed: processedCount };
  } catch (error) {
    // Truncate long error messages
    const errorMessage = error.message || String(error);
    const truncatedError = errorMessage.length > 150 ? 
      `${errorMessage.substring(0, 150)}... [truncated]` : errorMessage;
      
    console.error('EmailEmbeddings - Error processing email embeddings:', truncatedError);
    return { success: false, error: truncatedError };
  }
}

/**
 * Generate embedding for a single email using the OpenAI API directly
 */
async function generateEmbedding(email: { id: string, subject: string, body: string, summary: string }) {
  try {
    // Combine relevant fields for embedding
    const content = [
      `Subject: ${email.subject}`,
      `Summary: ${email.summary || ''}`,
      `Body: ${email.body}`
    ].join('\n');
    
    // Truncate to avoid token limits (ada-002 has max 8191 tokens)
    const truncatedContent = content.slice(0, 6000);
    
    // Create API request directly with fetch
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: truncatedContent,
        dimensions: EMBEDDING_DIMENSION
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    
    const result = await response.json();
    // Return the raw embedding array
    return result.data[0].embedding;
  } catch (err) {
    console.error(`EmailEmbeddings - Error generating embedding for email ${email.id}:`, err);
    return null;
  }
}

// Helper function to convert embedding format for PostgreSQL vector type
function formatEmbeddingForPostgres(embedding) {
  if (!embedding || !Array.isArray(embedding)) {
    return null;
  }
  
  // Convert array to PostgreSQL vector format - using square brackets instead of curly braces
  return `[${embedding.join(',')}]`;
}

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
      console.log('EmailEmbeddings - Could not get user email from Graph API:', graphError);
    }
    
    // If we're in development mode, provide a fallback email for testing
    if (process.env.NODE_ENV === 'development') {
      return process.env.DEFAULT_USER_EMAIL || 'dev@example.com';
    }
    
    return null;
  } catch (error) {
    console.error('EmailEmbeddings - Error getting user email:', error);
    return null;
  }
}

/**
 * Find similar emails using vector similarity search
 */
export async function findSimilarEmails(query: string, options: {
  limit?: number;
  startDate?: string;
  endDate?: string;
  clientDomains?: string[];
  clientEmails?: string[];
}) {
  try {
    const {
      limit = 10,
      startDate,
      endDate,
      clientDomains = [],
      clientEmails = []
    } = options;

    // Check if vector extension is properly set up
    let vectorExtensionAvailable = true;
    try {
      // Check if the vector column type is available
      await db.connection.query(`SELECT 'vector'::regtype;`);
    } catch (e) {
      console.log('Vector extension is not available, will use text-based search instead');
      vectorExtensionAvailable = false;
    }

    // Check the actual type of the embedding column
    const columnTypeResult = await db.connection.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'embedding'
    `);
    
    const embeddingColumnType = columnTypeResult.rows.length > 0 ? columnTypeResult.rows[0].data_type : null;
    console.log(`EmailEmbeddings - Embedding column type: ${embeddingColumnType}`);
    
    // Determine if vector search is possible
    const canUseVectorSearch = vectorExtensionAvailable && embeddingColumnType !== 'text';
    
    if (!canUseVectorSearch) {
      console.log('EmailEmbeddings - Cannot use vector search, falling back to text search');
      // Return empty array since the real search will be done by standard SQL query
      return [];
    }

    // Check if cc and bcc columns exist in the database
    const columnInfoResult = await db.connection.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name IN ('cc', 'bcc')
    `);
    
    const hasCcBccColumns = columnInfoResult.rows.length === 2;
    console.log(`EmailEmbeddings - Vector search has cc/bcc columns: ${hasCcBccColumns}`);
    
    // If columns don't exist, log a warning but continue
    if (!hasCcBccColumns) {
      console.warn('EmailEmbeddings - CC and BCC columns not found in messages table. Some email filtering may be limited.');
    }
    
    // Get user email for filtering
    const userEmail = await getUserEmail();
    console.log(`EmailEmbeddings - User email for vector search: ${userEmail}`);
    
    // Build domain-based conditions
    let domainConditions = '';
    if (clientDomains.length > 0) {
      const domainFilters = clientDomains.map((domain) => {
        const sanitizedDomain = domain.replace(/'/g, "''");  // SQL escape single quotes
        return `("from" LIKE '%@${sanitizedDomain}%' OR "from" LIKE '%@%.${sanitizedDomain}%' OR "to" LIKE '%@${sanitizedDomain}%' OR "to" LIKE '%@%.${sanitizedDomain}%'${hasCcBccColumns ? ` OR "cc" LIKE '%@${sanitizedDomain}%' OR "cc" LIKE '%@%.${sanitizedDomain}%' OR "bcc" LIKE '%@${sanitizedDomain}%' OR "bcc" LIKE '%@%.${sanitizedDomain}%'` : ''})`;
      }).join(' OR ');
      
      if (domainFilters) {
        domainConditions = ` OR (${domainFilters})`;
      }
    }
    
    // Build client email conditions with checks against both FROM and TO fields
    const emailConditions = [];
    
    if (clientEmails.length > 0) {
      const emailFilters = clientEmails.map(email => {
        const sanitizedEmail = email.replace(/'/g, "''");  // SQL escape single quotes
        return `("from" LIKE '%${sanitizedEmail}%' OR "to" LIKE '%${sanitizedEmail}%'${hasCcBccColumns ? ` OR "cc" LIKE '%${sanitizedEmail}%' OR "bcc" LIKE '%${sanitizedEmail}%'` : ''})`;
      });
      
      emailConditions.push(`(${emailFilters.join(' OR ')})`);
    }
    
    // Add user's own email to filter, if available
    if (userEmail) {
      const sanitizedUserEmail = userEmail.replace(/'/g, "''");
      emailConditions.push(`("from" LIKE '%${sanitizedUserEmail}%' OR "to" LIKE '%${sanitizedUserEmail}%'${hasCcBccColumns ? ` OR "cc" LIKE '%${sanitizedUserEmail}%' OR "bcc" LIKE '%${sanitizedUserEmail}%'` : ''})`);
    }
    
    // Combine all email conditions
    const emailFilter = emailConditions.length > 0 ? `(${emailConditions.join(' OR ')})` : '1=1'; // Default condition that's always true
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbeddingForQuery(query);
    if (!queryEmbedding) {
      console.error('EmailEmbeddings - Failed to generate embedding for query');
      return [];
    }
    
    // Build date conditions
    const dateConditions = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (startDate) {
      const startDateStr = new Date(startDate).toISOString().split('T')[0];
      dateConditions.push(`date >= $${paramIndex++}`);
      params.push(startDateStr);
    }
    if (endDate) {
      const endDateStr = new Date(endDate).toISOString().split('T')[0];
      dateConditions.push(`date <= $${paramIndex++}`);
      params.push(endDateStr);
    }
    
    // Combine date conditions
    const dateFilter = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : '';
    
    // Build the SQL query for vector search using PostgreSQL vector extension
    const vectorSearchQuery = `
      SELECT id, subject, "from" as from, "to" as to, date, body, summary, 
        embedding,
        (embedding <=> $${paramIndex}) as similarity
      FROM messages
      WHERE embedding IS NOT NULL ${dateFilter}
        AND (${emailFilter}${domainConditions})
      ORDER BY similarity ASC
      LIMIT $${paramIndex+1}
    `;
    
    // Add vector embedding and limit parameters
    params.push(queryEmbedding);
    params.push(limit);
    
    console.log('EmailEmbeddings - Vector search query:', vectorSearchQuery);
    console.log('EmailEmbeddings - Query parameters:', params.map(p => typeof p === 'object' ? '[embedding]' : p));
    
    // Execute vector search
    const result = await db.connection.query(vectorSearchQuery, params);
    
    // Process results
    return result.rows.map((row: any) => ({
      ...row,
      source: 'vector_search'
    }));
  } catch (error) {
    console.error('EmailEmbeddings - Error finding similar emails:', error);
    return [];
  }
}

/**
 * Generate embedding for a search query using the OpenAI API directly
 */
async function generateEmbeddingForQuery(query: string) {
  try {
    // Create API request directly with fetch
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: query,
        dimensions: EMBEDDING_DIMENSION
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    
    const result = await response.json();
    const embedding = result.data[0].embedding;
    
    // Format the embedding for PostgreSQL vector search
    return formatEmbeddingForPostgres(embedding);
  } catch (err) {
    console.error('EmailEmbeddings - Error generating embedding for query:', err);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}