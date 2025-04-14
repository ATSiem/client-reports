#!/bin/bash

# Load environment variables from .env.production
set -a # automatically export all variables
source .env.production
set +a # stop automatically exporting

echo "===== DEPLOYING PRODUCTION APPLICATION ====="
echo "NODE_ENV = ${NODE_ENV}"
echo "DATABASE_TYPE = ${DATABASE_TYPE}"
echo "DATABASE_URL = ${DATABASE_URL//:*@/:****@}"
echo "POSTGRES_USER = ${POSTGRES_USER}"
echo "POSTGRES_DB = ${POSTGRES_DB}"
echo "POSTGRES_PASSWORD = [HIDDEN]"

echo "===== BUILDING APPLICATION ====="
echo "Building production Docker container with configuration..."
docker compose build --no-cache

if [ $? -eq 0 ]; then
  echo "Docker build completed successfully!"
else
  echo "Docker build failed. Please check the logs above for errors."
  exit 1
fi

echo "===== STARTING APPLICATION ====="
echo "Starting containers with configuration from .env.production..."
docker compose up --no-build -d

if [ $? -ne 0 ]; then
  echo "Application failed to start! Check the logs above."
  exit 1
fi

echo "===== DEPLOYMENT SUCCESSFUL ====="
echo "The application is running at http://localhost:3000"
echo "To view logs: docker compose logs"
echo "To stop: docker compose down"
