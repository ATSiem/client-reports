# Client Reports - Production Deployment Plan
## Overview

The Client Reports application uses PostgreSQL for better scalability and pgvector for vector search capabilities. This document outlines the steps required for deployment to the production environment on the Mac mini.

## Completed Tasks

- ✅ Setup .env for docker compose build to be used by deploy-prod.sh
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
   cp .env.example .env
   ```

3. **Build and Deploy Application**
    ```bash
    # Make the deployment script executable
    chmod +x ./deploy-prod.sh

    # Run the deployment script which handles environment variables,
    # builds the container, and starts the services
    ./deploy-prod.sh

    The deploy-prod.sh script:
- Sources environment variables from .env
- Builds the application using Docker Compose
- Starts the containers in detached mode
- Provides status information during deployment

    To view logs:
docker compose logs -f

4. **Configure Express (https://expressjs.com) to work with Caddy**

- DNS Configuration for Production Domain
  - ✅ Create an A record pointing comms.solutioncenter.ai to Caddy Server
- Verify SSL certificate is properly provisioned by Express with TLS pass-through via Caddy

- Setting up HTTPS for Production Domain
  - ✅ configured TLS pass-through for comms.solutioncenter.ai to 192.168.10.39:3000
  - ✅ enabled HTTP connectivity to comms.solutioncenter.ai
  - setup HTTPS certificate via Express server
  - backup plan: setting up another Caddy server on the end server as part of the docker stack to enable the certificate

- Verify Deployment
  - Confirm application runs at https://comms.solutioncenter.ai
  - Verify login with Azure AD
  - Test report generation functionality

## Troubleshooting

If the application fails to start:
1. Check Docker logs: `docker compose logs app`
2. Verify database connection: `docker compose logs db`
3. CRITICAL: Ensure all environment variables are correctly set in .env
4. Look for PostgreSQL syntax errors in server logs
