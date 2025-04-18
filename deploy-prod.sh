#!/bin/bash

# Load environment variables from .env but allow overriding below
set -a # automatically export all variables
source .env
# Force production mode for this deploy regardless of .env default
export NODE_ENV=production
set +a # stop automatically exporting

echo "===== DEPLOYING PRODUCTION APPLICATION ====="
echo "NODE_ENV = ${NODE_ENV}"
echo "DATABASE_TYPE = ${DATABASE_TYPE}"
echo "DATABASE_URL = ${DATABASE_URL//:*@/:****@}"
echo "POSTGRES_USER = ${POSTGRES_USER}"
echo "POSTGRES_DB = ${POSTGRES_DB}"
echo "POSTGRES_PASSWORD = [HIDDEN]"

echo "===== BUILDING APPLICATION ====="
echo "Building production Docker container (profile=prod) with fresh layers..."

if [ "$SKIP_CADDY" = "true" ]; then
  echo "SKIP_CADDY=true → tearing down existing stack (including Caddy, orphans, volumes)…"
  docker compose down --remove-orphans --volumes || true
  COMPOSE_PROFILES="--profile direct"
else
  COMPOSE_PROFILES="--profile prod"
fi

docker compose $COMPOSE_PROFILES build --no-cache

if [ $? -eq 0 ]; then
  echo "Docker build completed successfully!"
else
  echo "Docker build failed. Please check the logs above for errors."
  exit 1
fi

echo "===== STARTING APPLICATION ====="
# Bring up the stack with the 'prod' profile activated (includes Caddy)
docker compose $COMPOSE_PROFILES up --no-build -d

if [ $? -ne 0 ]; then
  echo "Application failed to start! Check the logs above."
  exit 1
fi

echo "===== RUNNING DATABASE CHECKS ====="
echo "Checking database connection inside container..."
# Use a simpler test that directly checks the database connection
docker compose exec app node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query('SELECT 1 as connected')
    .then(result => {
      console.log('Database connection successful!');
      console.log('Result:', result.rows[0]);
      pool.end();
      process.exit(0);
    })
    .catch(err => {
      console.error('Database connection failed:', err.message);
      process.exit(1);
    });
"

if [ $? -eq 0 ]; then
  echo "Database connection check passed!"
else
  echo "⚠️ Database connection check failed! Please verify your database configuration."
  echo "Continuing with deployment, but the application may not function correctly."
fi

echo "===== DEPLOYMENT SUCCESSFUL ====="
echo "The application is running at http://localhost:3000"
echo "To view logs: docker compose logs"
echo "To stop: docker compose down"
