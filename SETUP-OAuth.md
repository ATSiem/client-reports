# Setting Up the Email Agent with Microsoft OAuth Integration

This guide helps you set up the Email Agent with secure Microsoft OAuth authentication, enabling users to access their own emails without administrator access to all email accounts.

## Prerequisites

- Microsoft 365 account
- Azure account with permissions to register apps
- OpenAI API key

## Step 1: Register an App in Azure AD for OAuth

1. Go to the [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory > App registrations > New registration
3. Enter a name for your application (e.g., "Email Agent")
4. Under "Supported account types", select "Accounts in this organizational directory only"
5. Under "Redirect URI", select "Web" and enter: `http://localhost:3000/api/auth/callback`
6. Click "Register"
7. On the app overview page, note these values:
   - Application (client) ID - copy to AZURE_CLIENT_ID in .env
   - Directory (tenant) ID - copy to AZURE_TENANT_ID in .env

## Step 2: Configure API Permissions for Delegated Access

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

## Step 3: Authentication Settings

1. In your app registration, go to "Authentication"
2. Under "Implicit grant and hybrid flows", enable:
   - Access tokens
   - ID tokens
3. Under "Advanced settings", set "Allow public client flows" to Yes
4. Click "Save"
