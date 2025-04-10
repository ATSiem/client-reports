#!/bin/bash

# Load environment variables from .env.production
set -a # automatically export all variables
source .env.production
set +a # stop automatically exporting

# Make sure the script is executable
chmod +x ./build-prod.sh
chmod +x ./run-prod.sh

# Print important environment variables for verification
echo "===== DEPLOYING PRODUCTION APPLICATION ====="
echo "DATABASE_URL = ${DATABASE_URL//:*@/:****@}"
echo "POSTGRES_USER = ${POSTGRES_USER}"
echo "POSTGRES_DB = ${POSTGRES_DB}"
echo "POSTGRES_PASSWORD = [HIDDEN]"

# Build the application
echo "===== BUILDING APPLICATION ====="
./build-prod.sh

# Check if build succeeded
if [ $? -ne 0 ]; then
  echo "Build failed! Check the logs above."
  exit 1
fi

# Run the application
echo "===== STARTING APPLICATION ====="
./run-prod.sh -d

# Check if application started
if [ $? -ne 0 ]; then
  echo "Application failed to start! Check the logs above."
  exit 1
fi

# Print success message
echo "===== DEPLOYMENT SUCCESSFUL ====="
echo "The application is running at http://localhost:3000"
echo "To view logs: docker compose logs"
echo "To stop: docker compose down"