# Client Reports - Production Deployment Plan
## Overview

The Client Reports application is being migrated from SQLite to PostgreSQL for better scalability and vector search capabilities. This document outlines the steps required for deployment to the production environment on the Mac mini.

## Completed Tasks

- ✅ Setup .env.development for dev (npm run dev) and .env.production for prod (docker compose build)
- ✅ Configured Dockerfile for Next.js app with PostgreSQL support
- ✅ Created docker-compose.yml that builds both the Next.js app and PostgreSQL database
- ✅ Set DATABASE_TYPE to 'postgres' and added proper DATABASE_URL in env files
- ✅ Configured Drizzle ORM for PostgreSQL compatibility
- ✅ Created schema migration script to set up PostgreSQL tables
- ✅ Added pgvector extension for AI search capabilities
- ✅ Fixed SQL syntax for PostgreSQL compatibility (quoted reserved keywords)

## Deployment Instructions for Mac Mini

1. **Clone and Configure Repository**
   ```bash
   git clone [repository-url] client-reports
   cd client-reports
   git checkout postgres-migration
   ```

2. **Setup Environment Variables**
   ```bash
   cp .env.example .env.production
   ```
   
   Edit `.env.production` to include:
   ```
   DATABASE_TYPE=postgres
   DATABASE_URL=postgres://postgres:postgres@db:5432/email_agent
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=email_agent
   NEXT_PUBLIC_AZURE_REDIRECT_URI=https://comms.solutioncenter.ai/api/auth/callback
   ```

3. **Build and Deploy Application**
   ```bash
   docker compose down -v
   docker compose build
   docker compose up -d
   ```

4. **Configure Caddy**
   Add to Caddyfile:
   ```
   comms.solutioncenter.ai {
       reverse_proxy localhost:3000
   }
   ```
   
   Restart Caddy:
   ```bash
   sudo systemctl restart caddy
   ```

5. **Verify Deployment**
   - Confirm application runs at https://comms.solutioncenter.ai
   - Verify login with Azure AD
   - Test report generation functionality

## DNS Configuration
- Create an A record pointing comms.solutioncenter.ai to 192.168.10.39
- Verify SSL certificate is properly provisioned by Caddy

## Troubleshooting

If the application fails to start:
1. Check Docker logs: `docker compose logs app`
2. Verify database connection: `docker compose logs db`
3. Ensure all environment variables are correctly set
4. Look for PostgreSQL syntax errors in server logs

## Data Migration (If Needed)
Instructions for migrating existing SQLite data to PostgreSQL using pgloader:
```bash
pgloader sqlite:///path/to/data.db postgresql://postgres:postgres@localhost:5432/email_agent
