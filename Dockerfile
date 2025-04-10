FROM node:20-alpine AS builder
WORKDIR /app
# Install required dependencies for PostgreSQL
RUN apk add --no-cache python3 make g++ postgresql-dev

# Create a simplified ensure-node-version.sh for Docker
RUN echo '#!/bin/sh' > ensure-node-version.sh && \
    echo 'echo "Node.js version: $(node -v)"' >> ensure-node-version.sh && \
    echo 'exit 0' >> ensure-node-version.sh && \
    chmod +x ensure-node-version.sh

COPY package.json package-lock.json ./
RUN npm install
COPY . .
# Overwrite the ensure-node-version.sh with our Docker-compatible version
RUN mv -f /app/ensure-node-version.sh /app/ensure-node-version.sh.bak && \
    echo '#!/bin/sh' > ensure-node-version.sh && \
    echo 'echo "Node.js version: $(node -v)"' >> ensure-node-version.sh && \
    echo 'exit 0' >> ensure-node-version.sh && \
    chmod +x ensure-node-version.sh

# Build the application for production
RUN npm run build

# Verify build output exists
RUN ls -la .next

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install required dependencies for PostgreSQL at runtime
RUN apk add --no-cache postgresql-client

# Copy necessary files for the application
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json 
COPY --from=builder /app/public ./public
# Copy the .next directory with all its contents
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/ensure-node-version.sh ./
COPY --from=builder /app/.env.production ./

# Make the ensure-node-version.sh script executable
RUN chmod +x ./ensure-node-version.sh

# Initialize database first
RUN mkdir -p /app/data

# Verify build output exists in the runner stage
RUN ls -la .next

# Expose port for web server
EXPOSE 3000

# Start the application with Next.js server
CMD ["sh", "-c", "./scripts/wait-for-db.sh && node ./scripts/init-database.js && node ./node_modules/next/dist/bin/next start"]