# Client Reports - Production Deployment Plan
## Overview

The Client Reports application uses PostgreSQL for better scalability and vector search capabilities. This document outlines the steps required for deployment to the production environment on the Mac mini.

## Completed Tasks

- ✅ Setup .env.development for dev (npm run dev) and .env.production for prod (docker compose build)
- ✅ Configured Dockerfile for Next.js app with PostgreSQL support
- ✅ Created docker-compose.yml that builds both the Next.js app and PostgreSQL database

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
    # Make the deployment script executable
    chmod +x ./deploy-prod.sh

    # Run the deployment script which handles environment variables,
    # builds the container, and starts the services
    ./deploy-prod.sh

    The deploy-prod.sh script:
- Sources environment variables from .env.production
- Builds the application using Docker Compose
- Starts the containers in detached mode
- Provides status information during deployment

    If you need to restart the application without rebuilding:
./run-prod.sh -d

    To view logs:
docker compose logs -f

4. **Configure Express/Caddy**

setting up HTTPS for node application:
- ✅ configured TLS pass-through for comms.solutioncenter.ai to 192.168.10.39:3000
- ✅ enabled HTTP connectivity to comms.solutioncenter.ai
- setup HTTPS certificate via Express server
  - backup plan: setting up another Caddy server on the end server as part of the docker stack to enable the certificate
   ```

5. **Verify Deployment**
   - Confirm application runs at https://comms.solutioncenter.ai
   - Verify login with Azure AD
   - Test report generation functionality

## DNS Configuration
- Create an A record pointing comms.solutioncenter.ai to 192.168.10.39
- Verify SSL certificate is properly provisioned by Express/Caddy

## Troubleshooting

If the application fails to start:
1. Check Docker logs: `docker compose logs app`
2. Verify database connection: `docker compose logs db`
3. Ensure all environment variables are correctly set
4. Look for PostgreSQL syntax errors in server logs
