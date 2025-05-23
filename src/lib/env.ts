import { z } from "zod";

// Define schema for environment variables with default values
const envSchema = z.object({
  // Database - PostgreSQL only
  DATABASE_URL: z.string().default('postgres://postgres:postgres@db:5432/email_agent'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),
  POSTGRES_DB: z.string().default('email_agent'),
  
  // OpenAI
  OPENAI_API_KEY: z.string(),
  
  // OpenAI Model Selection
  OPENAI_SUMMARY_MODEL: z.string().default('gpt-3.5-turbo'),
  OPENAI_REPORT_MODEL: z.string().default('gpt-4o-2024-08-06'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  
  // Dynamic Model Limits
  USE_DYNAMIC_MODEL_LIMITS: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().default(true)
  ),
  
  // Microsoft Graph API (OAuth setup)
  NEXT_PUBLIC_AZURE_CLIENT_ID: z.string(),
  NEXT_PUBLIC_AZURE_TENANT_ID: z.string(),
  NEXT_PUBLIC_AZURE_REDIRECT_URI: z.string(),
  
  // Server-side Azure credentials 
  AZURE_CLIENT_ID: z.string(),
  AZURE_TENANT_ID: z.string(),
  AZURE_REDIRECT_URI: z.string(),
  
  // Domain restriction - optional in development, required in production
  ALLOWED_EMAIL_DOMAIN: z.string().optional(),
  
  // Admin emails - comma-separated list
  ADMIN_EMAILS: z.string().default(''),
  
  // Webhook
  WEBHOOK_SECRET: z.string().default('dummy-webhook-secret'),
  
  // Email Processing Limits and Batch Sizes
  EMAIL_FETCH_LIMIT: z.preprocess(
    (val) => val ? parseInt(String(val)) : 1000,
    z.number().positive().default(1000)
  ),
  EMAIL_PROCESSING_BATCH_SIZE: z.preprocess(
    (val) => val ? parseInt(String(val)) : 200,
    z.number().positive().default(200)
  ),
  EMAIL_EMBEDDING_BATCH_SIZE: z.preprocess(
    (val) => val ? parseInt(String(val)) : 200,
    z.number().positive().default(200)
  ),
  EMBEDDING_BATCH_SIZE: z.preprocess(
    (val) => val ? parseInt(String(val)) : 20,
    z.number().positive().default(20)
  ),
  
  // Azure Deployment (optional with defaults)
  AZURE_WEBAPP_NAME: z.string().optional(),
  AZURE_RESOURCE_GROUP: z.string().optional(),
  AZURE_LOCATION: z.string().optional(),
  SCM_DO_BUILD_DURING_DEPLOYMENT: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().default(true)
  ),
});

// Process env variables through schema validation
// This will throw an error if required variables are missing
function getEnvVariables() {
  // Always make all variables optional to prevent client-side errors
  // This solves the ZodError issues with missing env variables
  return envSchema.partial().parse(process.env);
}

// Export validated environment variables
export const env = getEnvVariables();

// Export a helper to check if running in production
export const isProduction = process.env.NODE_ENV === 'production';

// Export a helper to get URL with appropriate HTTP/HTTPS
export function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return '';
  }
  
  if (process.env.VERCEL_URL) {
    // SSR should use Vercel URL
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Dev SSR should use localhost
  return `http://localhost:${process.env.PORT || 3000}`;
}
