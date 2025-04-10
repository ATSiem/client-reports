# Client Reports
## Preparing for Prod Deployment

- Setup .env.development for dev (npm run dev) and .env.production for prod (docker compose build)
  - verify Dockerfile functions for next.js app and SQLite file
  - verify docker-compose.yml builds for next.js app and PostgreSQL database

- Setup PostgreSQL for dev and prod
  - set DATABASE_TYPE to 'postgres' and verify DATABASE_URL is set in .env files
  - leverage current config of Drizzle ORM
  - leverage pgloader to migrate SQLite data to test PostgreSQL database
  - verify test suite functions with PostgreSQL
  - ensure the test db is wiped each time the test suite runs

- Enable AI Search with pgvector on PostgreSQL
  - install the pgvector extension in the PostgreSQL database
  - update Drizzle ORM or query logic to leverage pgvector
  - verify query and ranking mechanism

- merge `postgres-migration` branch to main
  - git checkout main
  - git merge --strategy=ours main
  - git checkout main
  - git reset --hard postgres-migration
  - git push origin main --force

- deploy to prod on Mac mini via docker compose build

- setup comms.solutioncenter.ai as prod URL
  - create an A record to point comms.solutioncenter.ai to the prod server's IP address 192.168.10.39
  - configure Caddy to handle requests for comms.solutioncenter.ai and route them to 192.168.10.39:3000
  - verify SSL is setup