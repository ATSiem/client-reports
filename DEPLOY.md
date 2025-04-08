# Deployment Guide for Client Reports Application

This guide covers how to set up and deploy the Client Reports application on a Mac Mini server using Docker and Caddy for HTTPS.

## Initial Setup on Mac Mini Server

1. Clone the repository on your Mac Mini:
   ```bash
   git clone https://github.com/ATSiem/client-reports.git
   cd client-reports
   ```

2. Create an `.env` file:
   ```bash
   # Copy the .env file from your development machine or create a new one
   touch .env
   # Edit the .env file with your preferred editor
   nano .env
   ```
   
   Make sure to set the following variables at minimum:
   ```
   OPENAI_API_KEY=your_openai_api_key
   NEXT_PUBLIC_AZURE_CLIENT_ID=your_azure_client_id
   NEXT_PUBLIC_AZURE_TENANT_ID=your_azure_tenant_id
   NEXT_PUBLIC_AZURE_REDIRECT_URI=https://comms.solutioncenter.ai/api/auth/callback
   WEBHOOK_SECRET=your_webhook_secret
   ```
   
   Note: Remember to update the Azure redirect URI to use your production domain.

3. Make the deployment script executable:
   ```bash
   chmod +x deploy.sh
   ```

4. Initial deployment:
   ```bash
   ./deploy.sh
   ```

## Configuring Caddy for HTTPS

1. Add the following section to your Caddyfile:
   ```
   comms.solutioncenter.ai {
     reverse_proxy localhost:3000
   }
   ```

2. Reload Caddy to apply changes:
   ```bash
   sudo systemctl reload caddy
   # Or if using macOS with Homebrew
   brew services restart caddy
   ```

## Updating the Application

To update the application with the latest changes:

1. SSH into your Mac Mini or access it directly
2. Navigate to the application directory:
   ```bash
   cd /path/to/client-reports
   ```
3. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

The script will:
- Pull the latest changes from GitHub
- Rebuild the Docker container
- Restart the application

## Troubleshooting

If you encounter issues:

1. Check Docker container status:
   ```bash
   docker ps
   docker logs client-reports
   ```

2. Verify Caddy configuration:
   ```bash
   caddy validate
   ```

3. Check application logs:
   ```bash
   docker-compose logs -f
   ```

## Data Persistence

The SQLite database is stored in the `./data` directory on the host machine, which is mounted as a volume in the Docker container. This ensures your data persists across container restarts and updates.

## Security Notes

- Ensure your `.env` file contains proper credentials and is kept secure
- The application is accessible only via HTTPS thanks to Caddy
- Consider setting up regular backups of the `./data` directory 