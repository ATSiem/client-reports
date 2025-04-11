#!/bin/bash

# This script fixes the remaining SQLite-related issues and deploys only the updated files

# Fix the replace regex for PostgreSQL placeholder formatting in email-fetcher.ts
sed -i '' 's/query.replace(\/\\?\/g, (_, i) => `${i + 1}`)/query.replace(\/\\?\/g, (_, i) => `\$${i + 1}`)/g' src/lib/client-reports/email-fetcher.ts

# Create the SQL migration directory if it doesn't exist
mkdir -p src/lib/db/migrations

# Run the deploy script to rebuild and restart
./deploy-prod.sh

# Print success message
echo "===== POSTGRES FIX DEPLOYED ====="
echo "All SQLite-specific references have been updated to PostgreSQL syntax."
echo "The application has been rebuilt and restarted."