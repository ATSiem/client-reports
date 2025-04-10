# PostgreSQL Migration

This document outlines the steps taken to migrate the application from SQLite to PostgreSQL.

## Setup Process

1. Configured PostgreSQL in Docker Compose:
   - Used pgvector/pgvector:pg15 image for PostgreSQL with vector extension
   - Set up environment variables to connect to PostgreSQL
   - Configured healthcheck for PostgreSQL readiness

2. Modified Environment Configuration:
   - Used `.env.production` for production environment variables
   - Set DATABASE_TYPE to 'postgres'
   - Configured PostgreSQL connection parameters

3. Docker Build Process:
   - Created build-prod.sh script to build the Docker image
   - Created run-prod.sh script to run the containers
   - Combined both into deploy-prod.sh for one-step deployment

4. Fixed Environment Variable Handling:
   - Passed environment variables directly to Docker Compose commands
   - Used environment references in docker-compose.yml
   - Removed need for hardcoded credentials

## Usage

To deploy the application in production mode:

```bash
# Build and start the application
./deploy-prod.sh

# View logs
docker compose logs

# Stop the application
docker compose down
```

## Notes

- The application now uses PostgreSQL with pgvector extension for AI search
- There are some non-critical ESM/CommonJS module warnings in the build logs
- The database tables are created automatically on first run

## For Mac mini Deployment

1. Ensure Docker and Docker Compose are installed
2. Clone the repository and check out the postgres-migration branch
3. Configure .env.production with correct database credentials
4. Run ./deploy-prod.sh to build and start the application
5. Configure Caddy to route external traffic to the application

## Future Improvements

- Add database backup mechanism
- Configure database migrations for schema changes
- Resolve ESM/CommonJS module warnings