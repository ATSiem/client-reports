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
    docker compose logs -f app  # View app logs
    docker compose logs -f caddy # View Caddy logs

4. **Configure Caddy within Docker for HTTPS**

   - The `docker-compose.yml` now includes a `caddy` service responsible for handling HTTPS.
   - A `./Caddyfile` configures this Caddy service:
     - It automatically obtains and renews SSL certificates for `comms.solutioncenter.ai` using Let's Encrypt.
     - **Important:** It likely requires DNS challenge configuration (`tls dns ...`) because the main external Caddy uses `tls passthrough`. Credentials for your DNS provider must be securely passed to the Caddy container (e.g., via `.env` and `environment` or `env_file` in `docker-compose.yml`).
     - It reverse proxies HTTPS requests to the `app` service over HTTP (port 3000) within the Docker network.
   - The `caddy` service maps host port `3000` to its container port `443` to receive the passthrough TLS traffic.
   - The `app` service in `docker-compose.yml` no longer exposes port 3000 directly to the host.

- **Main External Caddy Server Configuration (ACTION REQUIRED)**
  - **CRITICAL:** Update the main Caddy server's configuration. The `tls passthrough` directive for `comms.solutioncenter.ai` must now point to the Mac mini's IP address (`192.168.10.39`) and the **host port `3000`** (as defined in `docker-compose.yml`), NOT the original port `3000` used by the app directly or the previously suggested `8443`.
    ```caddy
    # Example snippet for main Caddy server (update required)
    comms.solutioncenter.ai {
      tls passthrough 192.168.10.39:3000
      # Potentially add header forwarding if needed
      # header_up Host {upstream_hostport}
    }
    ```

- DNS Configuration for Production Domain
  - ✅ A record `comms.solutioncenter.ai` points to the main Caddy Server IP.

- Setting up HTTPS for Production Domain
  - ✅ Caddy service added to `docker-compose.yml` (using host port 3000 for TLS).
  - ✅ `Caddyfile` created for automatic HTTPS and reverse proxy.
  - ✅ `app` service configured for HTTP-only within Docker.
  - ☐ Configure DNS challenge for Let's Encrypt in `./Caddyfile` and provide necessary credentials (e.g., environment variables) to the Caddy container in `docker-compose.yml`.
  - ☐ **Update main Caddy server's `tls passthrough` to target port `3000` on the Mac mini.**

- Verify Deployment
  - Check internal Caddy logs for successful certificate acquisition: `docker compose logs -f caddy`
  - Confirm application runs at `https://comms.solutioncenter.ai`
  - Verify login with Azure AD
  - Test report generation functionality

## Troubleshooting

If the application fails to start:
1. Check Docker logs: `docker compose logs app`
2. Check Caddy logs: `docker compose logs caddy` (especially for certificate errors)
3. Verify database connection: `docker compose logs db`
4. CRITICAL: Ensure all environment variables are correctly set in .env, including any needed for Caddy's DNS challenge.
5. Look for PostgreSQL syntax errors in server logs
