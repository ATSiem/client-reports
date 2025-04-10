# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- `npm run dev`: Run development server with Turbopack
- `docker compose build`: Build production version

## Database Commands
- `npm run db:init`: Initialize database
- `npm run db:generate`: Generate Drizzle migrations
- `npm run db:migrate`: Run migrations

## Deployment Commands
- `docker compose build` for production deployment

## Environment Configuration
- Use `.env.development` for dev (npm run dev)
- Use `.env.production` for prod (docker compose build)
- Set `DATABASE_TYPE` to 'postgres' and verify `DATABASE_URL` is set correctly

## Database Configuration
- Use PostgreSQL for both dev and prod
- Use pgvector extension in PostgreSQL for AI Search capabilities
- Use pgloader to migrate SQLite data to PostgreSQL
- Eliminate SQLite from the project

## Test Commands
- `npm test`: Run all tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:api`: Run only API tests
- `npm run test:summarizer`: Run only summarizer tests
- Run single test: `jest tests/path-to-test.test.js`

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