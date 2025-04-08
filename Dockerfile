FROM node:20-alpine

WORKDIR /app

# Install dependencies required for better-sqlite3, bash, and git
RUN apk add --no-cache python3 make g++ bash git

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Set up environment
ENV NODE_ENV=production
ENV DATABASE_TYPE=sqlite
ENV NEXT_TELEMETRY_DISABLED=1
ENV SQLITE_DB_PATH=/app/data/email_agent.db

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /app/data && \
    chmod -R 755 /app/data

# Copy application code
COPY . .

# Set Git env variables to prevent errors when building without a git repository
ENV NEXT_PUBLIC_GIT_COMMIT_SHA=standalone
ENV NEXT_PUBLIC_GIT_BRANCH=standalone

# Build application
RUN npm run build

# Expose the port Next.js uses by default
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 