#!/bin/bash

# Load environment variables from .env.production
set -a # automatically export all variables
source .env.production
set +a # stop automatically exporting

# Print important environment variables for verification
echo "Building production Docker container with PostgreSQL configuration:"
echo "DATABASE_URL = ${DATABASE_URL//:*@/:****@}"
echo "POSTGRES_USER = ${POSTGRES_USER}"
echo "POSTGRES_DB = ${POSTGRES_DB}"
echo "POSTGRES_PASSWORD = [HIDDEN]"

# Run Docker Compose build with environment variables directly passed
echo "Running Docker Compose build..."
POSTGRES_USER=${POSTGRES_USER} \
POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
POSTGRES_DB=${POSTGRES_DB} \
DATABASE_URL=${DATABASE_URL} \
docker compose build

# Check if build was successful
if [ $? -eq 0 ]; then
  echo "Docker build completed successfully!"
  echo "To run the container: ./run-prod.sh"
  
  # Create a run-prod.sh script for convenience
  if [ ! -f "run-prod.sh" ]; then
    cat > run-prod.sh << EOL
#!/bin/bash

# Load environment variables from .env.production
set -a # automatically export all variables
source .env.production
set +a # stop automatically exporting

# Run Docker Compose with environment variables from .env.production
# Use the --no-build flag to prevent conflicts with build-prod.sh
echo "Starting containers with configuration from .env.production..."
POSTGRES_USER=\${POSTGRES_USER} POSTGRES_PASSWORD=\${POSTGRES_PASSWORD} POSTGRES_DB=\${POSTGRES_DB} docker compose up --no-build \$@
EOL
    chmod +x run-prod.sh
    echo "Created run-prod.sh script for easy startup"
  else
    echo "run-prod.sh already exists, skipping creation"
  fi
else
  echo "Docker build failed. Please check the logs above for errors."
  exit 1
fi