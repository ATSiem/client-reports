# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- `npm run dev`: Run development server with Turbopack
- `docker compose build`: Build and deploy production version

## Database Commands
- `npm run db:init`: Initialize database
- `npm run db:generate`: Generate Drizzle migrations
- `npm run db:migrate`: Run migrations

## Environment Configuration
- Use `.env.development` for dev (npm run dev)
- Use `.env.production` for prod (docker compose build)

## Database Configuration
- Use PostgreSQL for all database operations
- Include pgvector for vector search functionality (AI Search)
- Eliminate any reference to SQLite, even in development environments

## Test Commands
- `npm test`: Run all tests

## Code Style Guidelines
- TypeScript with `strict: false` in tsconfig
- Next.js React app with path alias `~/*` for src directory
- Prettier for formatting with tailwindcss plugin
- Tailwind CSS for styling
- ESLint extends Next.js core web vitals
- Jest for testing, testTimeout: 30000ms
- Commit migrations using Drizzle ORM pattern
- Handle errors with proper logging and user feedback
- Follow Zod schema patterns for data validation
- Use Drizzle ORM with type-safe queries and relationships
- Organize code by features/domains with clear module boundaries
- Prioritize React Server Components where possible
- Use React Context for global state management
- Implement React Query for server state and data fetching
- Follow REST conventions for API endpoints
- Document public functions and components with JSDoc
- Ensure WCAG 2.1 AA compliance for all user interfaces
- Implement lazy loading and code splitting for performance
- Maintain consistent error handling patterns across API routes
- Design components for reusability and composition
- Apply semantic versioning for package dependencies