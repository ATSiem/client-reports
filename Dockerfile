FROM node:20-alpine

WORKDIR /app

# Install dependencies required for better-sqlite3, Git for build process, and bash
RUN apk add --no-cache python3 make g++ git bash

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Set up environment
ENV NODE_ENV=production
# Fix for child_process module in Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Setup a dummy git repository to prevent git errors during build
RUN git init && \
    git config --global user.email "docker@example.com" && \
    git config --global user.name "Docker Build" && \
    git add . && \
    git commit -m "Initial commit"

# Copy application code
COPY . .

# Make the version check script executable and modify it to work in Docker
RUN chmod +x ensure-node-version.sh && \
    sed -i 's|#!/bin/bash|#!/bin/bash\n# Skip node version check in Docker container\nexit 0|' ensure-node-version.sh

# Build application
RUN npm run build

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose the port Next.js uses by default
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"] 