#!/bin/bash

# Load environment variables from .env.production
set -a # automatically export all variables
source .env.production
set +a # stop automatically exporting

# Verify important environment variables are set
echo "Using database configuration:"
echo "POSTGRES_USER = ${POSTGRES_USER}"
echo "POSTGRES_DB = ${POSTGRES_DB}"
echo "POSTGRES_PASSWORD = [HIDDEN]"
echo "DATABASE_URL = ${DATABASE_URL//:*@/:****@}"

# Run Docker Compose with environment variables directly passed
# Use the --no-build flag to prevent conflicts with build-prod.sh
echo "Starting containers with configuration from .env.production..."
POSTGRES_USER=${POSTGRES_USER} \
POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
POSTGRES_DB=${POSTGRES_DB} \
DATABASE_URL=${DATABASE_URL} \
docker compose up --no-build $@
