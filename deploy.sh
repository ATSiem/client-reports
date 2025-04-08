#!/bin/bash

# Simple deployment script for client-reports application
# This script will pull the latest changes from GitHub and rebuild the Docker container

# Move to the application directory
cd "$(dirname "$0")"

echo "🔄 Deploying client-reports application..."

# Pull the latest changes from GitHub
echo "📥 Pulling latest changes from GitHub..."
git pull

# Build and restart the Docker container
echo "🔨 Building and starting Docker container..."
docker-compose down
docker-compose build
docker-compose up -d

echo "✅ Deployment completed! Application is running on localhost:3000"
echo "ℹ️  You can access the application at http://comms.solutioncenter.ai" 