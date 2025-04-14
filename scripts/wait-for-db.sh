#!/bin/sh

# wait-for-db.sh - Script to wait for PostgreSQL to be ready
set -e

# PostgreSQL connection parameters
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD:-postgres}
DB_NAME=${POSTGRES_DB:-email_agent}

# Maximum number of retry attempts
MAX_RETRIES=30
# Delay between retries (in seconds)
RETRY_DELAY=5

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} to become available..."
echo "Connection details: user=${DB_USER}, database=${DB_NAME}"
echo "Password length: ${#DB_PASSWORD} characters"
echo "Environment variables:"
env | grep -e POSTGRES -e DATABASE

# Counter for retry attempts
RETRIES=0

# Loop until the database is ready or max retries is reached
until PGPASSWORD=$DB_PASSWORD pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; do
  RETRIES=$((RETRIES+1))
  echo "PostgreSQL not available yet (attempt $RETRIES/$MAX_RETRIES), waiting ${RETRY_DELAY}s..."
  
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo "Error: PostgreSQL did not become available in time"
    exit 1
  fi
  
  sleep $RETRY_DELAY
done

echo "PostgreSQL is now available!"

# Create pgvector extension if it doesn't exist
echo "Creating pgvector extension..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
  echo "Failed to create pgvector extension"
  # Try with more verbose error output
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;"
  exit 1
}

echo "Database is ready!"