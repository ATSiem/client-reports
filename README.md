# Client Communication Reports

This application helps you generate professional client communication reports by analyzing your email communications with clients. It combines Next.js, TypeScript, the Vercel AI SDK, Microsoft Graph API, and SQLite to create a powerful AI tool for client communication management.

## Features

### Client Management
- Create and manage clients with their domains and email addresses
- Filter emails by client domains and addresses
- Organize communications by client for better relationship management

### Communication Reports
- Generate detailed client communication reports using OpenAI GPT-4o
- Customizable report formats with placeholders
- Save and reuse report templates
- AI synthesizes emails into structured reports with key topics, action items, and more
- Two-tier processing approach for efficient and detailed analysis

### Custom Report Templates
- Create fully customizable report templates
- Use dynamic placeholders like `{summary}`, `{key_topics}`, `{action_items}`
- Add your own custom placeholders (e.g., `{key_technologies}`, `{project_status}`, `{stakeholders}`)
- The AI intelligently generates content for any placeholder you define
- Templates can be linked to specific clients

## Getting Started

### Prerequisites

- Microsoft 365 account
- Azure account with permissions to register apps
- OpenAI API key
- Node.js 20+

### Local Development Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/ATSiem/client-reports
   cd client-reports
   ```

2. Create a `.env` file based on `.env.example` with your:
   - `OPENAI_API_KEY` - Get from [OpenAI Platform](https://platform.openai.com)
   - `WEBHOOK_SECRET` - Random string for webhook security
   - Microsoft Graph API credentials for authentication (see below)

3. Install dependencies:
   ```bash
   npm install
   ```

4. Initialize the database:
   ```bash
   npm run db:migrate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. For webhook testing, use `npm run dev:webhook` with [smee.io](https://smee.io)

### Setting Up Microsoft OAuth

1. Go to the [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory > App registrations > New registration
3. Enter a name for your application (e.g., "Client Reports")
4. Under "Supported account types", select "Accounts in this organizational directory only"
5. Under "Redirect URI", select "Web" and enter: `http://localhost:3000/api/auth/callback`
   - For production, use your domain (e.g., `https://comms.solutioncenter.ai/api/auth/callback`)
6. Click "Register"
7. On the app overview page, note these values:
   - Application (client) ID - copy to NEXT_PUBLIC_AZURE_CLIENT_ID in .env
   - Directory (tenant) ID - copy to NEXT_PUBLIC_AZURE_TENANT_ID in .env

#### Configure API Permissions for Delegated Access

1. In your app registration, go to "API permissions"
2. Click "Add a permission"
3. Select "Microsoft Graph" > "Delegated permissions"
4. Add the following permissions:
   - Mail.Read (under Mail category)
   - Mail.ReadBasic (under Mail category)
   - User.Read (under User category)
5. Click "Add permissions"
6. For testing, you can click "Grant admin consent for [your organization]"
   - This pre-approves the permissions for all users in your organization
   - Without this, each user will need to consent when they first sign in

#### Authentication Settings

1. In your app registration, go to "Authentication"
2. Under "Implicit grant and hybrid flows", enable:
   - Access tokens
   - ID tokens
3. Under "Advanced settings", set "Allow public client flows" to Yes
4. Click "Save"

## Docker Deployment

The application can be deployed using Docker for easy setup and management.

### Prerequisites for Docker Deployment
- Docker and Docker Compose installed
- Git access to the repository

### Building and Running with Docker

1. Clone the repository (or pull the latest changes):
   ```bash
   git clone https://github.com/ATSiem/client-reports.git
   cd client-reports
   ```

2. Create or copy your `.env` file with the required environment variables
   - Update the `NEXT_PUBLIC_AZURE_REDIRECT_URI` to use your production domain if deployed publicly

3. Run the application using Docker Compose:
   ```bash
   docker-compose up -d
   ```

4. Access the application at http://localhost:3000

### Automated Deployment

The repository includes a deployment script (`deploy.sh`) that simplifies updating the application:

1. Make the script executable:
   ```bash
   chmod +x deploy.sh
   ```

2. Run the script to pull the latest changes and rebuild:
   ```bash
   ./deploy.sh
   ```

### Exposing with Caddy

To expose the application with a public URL using Caddy:

1. Add the following section to your Caddyfile:
   ```
   comms.solutioncenter.ai {
     reverse_proxy localhost:3000
   }
   ```

2. Reload Caddy to apply changes:
   ```bash
   brew services restart caddy
   # Or on Linux
   sudo systemctl reload caddy
   ```

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: SQLite with Drizzle ORM
- **AI**: OpenAI GPT-4o via Vercel AI SDK
- **Authentication**: Microsoft OAuth via MSAL
- **Email Integration**: Microsoft Graph API
- **Deployment**: Docker, Docker Compose, Caddy

## How It Works

### Email Collection
Emails are fetched from two sources:
1. Microsoft Graph API - directly fetches emails from your Microsoft account
2. Webhook endpoint - can be connected to other email services like Gmail using external scripts

The system validates, processes, and stores these emails with AI-generated summaries and labels using a dynamic approach for efficiency.

### Email Processing Configuration
The application uses smart, model-aware limits to process emails optimally:

- **Model-based Dynamic Sizing**: Automatically adjusts processing based on the AI model's context window
- **Adaptive Content Analysis**: Allocates more tokens to important/recent emails and less to older ones
- **Token Budget Optimization**: Calculates exact limits based on current model's capabilities

#### Model Selection and Configuration
- **Model Selection**: Control which AI models to use for different tasks:
  - `OPENAI_SUMMARY_MODEL`: Model for email summarization (default: gpt-3.5-turbo)
  - `OPENAI_REPORT_MODEL`: Model for generating reports (default: gpt-4o-2024-08-06)
  - `OPENAI_EMBEDDING_MODEL`: Model for vector embeddings (default: text-embedding-3-small)
  
- **Dynamic Limits**: Enable/disable dynamic calculation:
  - `USE_DYNAMIC_MODEL_LIMITS`: Set to "true" to use model-aware limits (default: true)

- **Configurable Fallback Limits**: Override defaults when needed:
  - `EMAIL_FETCH_LIMIT`: Maximum emails to fetch (default: 1000)
  - `EMAIL_PROCESSING_BATCH_SIZE`: Emails to process in background tasks (default: 200)
  - `EMAIL_EMBEDDING_BATCH_SIZE`: Emails to create embeddings for (default: 200)
  - `EMBEDDING_BATCH_SIZE`: Batch size for embedding processing (default: 20)

### Client Reports
The application analyzes emails related to specific clients and generates comprehensive reports that summarize communications, highlight key topics, identify action items, and more. Reports are fully customizable with templates that support any placeholder fields you define. The processing happens in two stages:
1. Initial summarization of individual emails
2. Comprehensive analysis across the full email thread context

### Creating Custom Reports
When creating a report, you can:
1. Select a client to filter relevant emails
2. Choose a date range for the report
3. Use an existing template or create your own format
4. Add custom placeholders for specialized content
5. Link templates to specific clients for quick report generation

### Accessing the Admin Dashboard

To access the admin dashboard for reviewing user feedback and telemetry, follow these steps:

#### Authentication

1. First, you need to sign in with your Microsoft account. The system is configured to only allow users with specific email domains (as configured in the environment settings).

2. Navigate to the main application and use the "Sign in with Microsoft" button if you're not already authenticated.

#### Accessing the Feedback Dashboard

3. Once authenticated, navigate to the admin feedback dashboard by going to:
   ```
   /admin/feedback
   ```

4. This dashboard provides comprehensive analytics on user feedback and telemetry, including:
   - Total reports generated
   - Average user ratings
   - Vector search usage percentage
   - Average report generation time
   - Clipboard copy rate
   - Feedback submission rate
   - Most common user actions

#### Dashboard Features

The feedback dashboard displays:

- **Summary Statistics**: Key metrics in card format at the top of the page
- **Recent Feedback**: A detailed table showing:
  - Date of feedback
  - Client information
  - User ratings (1-5 stars)
  - Vector search usage
  - Email count
  - Actions taken by users
  - Feedback text/comments

#### Notes

- Access is restricted to users with authorized email domains (as configured in the application)
- The data is fetched from the `/api/admin/feedback` endpoint
- You can return to the main reports page using the "Back to Reports" link in the dashboard

If you're having trouble accessing the admin dashboard, ensure:
1. You're properly authenticated with a Microsoft account
2. Your email domain is authorized in the system
3. You have the necessary permissions to access admin features

The AI will intelligently fill in all placeholders based on your email content, producing a comprehensive client communication report.

## Custom Placeholders
The reporting system supports unlimited custom placeholders. Some examples:
- `{client_name}` - Client's name
- `{date_range}` - Period covered by the report
- `{summary}` - Overall communication summary
- `{key_topics}` - Main topics discussed
- `{action_items}` - Tasks to be completed
- `{next_steps}` - Upcoming actions
- `{key_technologies}` - Technologies mentioned in emails
- `{project_status}` - Overview of project status
- `{stakeholders}` - Key people mentioned
- `{open_questions}` - Questions that need answers
- `{decision_summary}` - Summary of decisions made

You can add any placeholder that makes sense for your reporting needs, and the AI will generate appropriate content by analyzing your email communications.

## Troubleshooting

- If you can't sign in, verify your Azure app registration settings
- If permission errors occur, check that you've added the correct delegated permissions
- For database issues, check that the SQLite database path is correctly set and writable
- For webhook testing, use `npm run dev:webhook` with [smee.io](https://smee.io)
- If Docker container fails to start, check logs with `docker-compose logs`

## Security Measures

### Environment Variables and Secrets

The application uses environment variables to manage secrets and configuration. To set up your environment:

1. Copy `.env.example` to `.env` in your local development environment
   ```bash
   cp .env.example .env
   ```

2. Fill in your own API keys and credentials in the `.env` file
   - Never commit the `.env` file to version control
   - Never share your API keys or tokens

3. The following safeguards are in place to prevent accidental credential exposure:
   - `.env` files are excluded via `.gitignore`
   - A pre-commit hook checks for potential secrets
   - GitHub Actions workflow scans for leaked credentials

### Authentication and Data Protection

- All API routes are protected by authentication middleware
- Authentication is handled via Microsoft OAuth
- User data (emails) are only accessible to authenticated users
- Database files are excluded from version control
- User sessions are properly secured

## Development Guidelines

### Working with Environment Variables

- Always use the `env` helper from `src/lib/env.ts` instead of accessing `process.env` directly
- Mark variables that need to be available client-side with the `NEXT_PUBLIC_` prefix
- Add new environment variables to both `.env.example` and the schema in `src/lib/env.ts`

### Database and Data Handling

- Local database files are stored in the `/data` directory
- The directory is excluded from git via `.gitignore`
- Backups of production data should be properly secured
- Never commit database files to version control

## License
MIT