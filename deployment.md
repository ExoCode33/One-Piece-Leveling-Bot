# Railway Deployment Guide

This guide will walk you through deploying your Discord Leveling Bot on Railway.

## Prerequisites

- Railway account ([sign up here](https://railway.app))
- Discord bot token
- Git repository with your bot code

## Step-by-Step Deployment

### 1. Prepare Your Repository

Ensure your repository contains these files:
- `index.js` (main bot code)
- `package.json` (dependencies)
- `Dockerfile` (containerization)
- `railway.toml` (Railway configuration)
- `.env.example` (environment template)

### 2. Create Railway Project

#### Option A: From GitHub Repository
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your bot repository
5. Railway will automatically detect and deploy

#### Option B: Using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Navigate to your project directory
cd your-discord-bot

# Initialize Railway project
railway init

# Deploy
railway up
```

### 3. Add PostgreSQL Database

1. In your Railway project dashboard
2. Click "New Service"
3. Select "PostgreSQL"
4. Railway will automatically provision the database
5. The `DATABASE_URL` will be automatically set

### 4. Configure Environment Variables

In Railway dashboard:
1. Go to your bot service
2. Click "Variables" tab
3. Add these variables:

```
DISCORD_TOKEN=your_discord_bot_token_here
NODE_ENV=production
```

**Note**: `DATABASE_URL` is automatically set by Railway's PostgreSQL service.

### 5. Deploy and Monitor

1. Railway will automatically deploy after adding variables
2. Check the "Deployments" tab for build status
3. View logs in the "Logs" tab
4. Your bot should come online within 2-3 minutes

## Verification Steps

### 1. Check Bot Status
- Bot should show as "Online" in Discord
- Slash commands should be available (may take up to 1 hour to propagate)

### 2. Test Basic Functionality
```
/level - Check if database connection works
/settings - Verify guild settings are created
```

### 3. Test XP Tracking
- Send a message (wait 60 seconds between messages)
- Add a reaction to someone's message
- Join a voice channel with another person

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DISCORD_TOKEN` | Yes | Your Discord bot token | `MTxx...` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | Auto-set by Railway |
| `NODE_ENV` | Yes | Environment mode | `production` |

## Troubleshooting Deployment

### Build Failures

**Error: "No package.json found"**
- Ensure `package.json` is in repository root
- Check file is committed to Git

**Error: "Docker build failed"**
- Verify `Dockerfile` syntax
- Check Node.js version compatibility

### Runtime Issues

**Bot appears offline:**
1. Check Railway logs for errors
2. Verify `DISCORD_TOKEN` is correct
3. Ensure bot has proper permissions

**Database connection errors:**
1. Verify PostgreSQL service is running
2. Check `DATABASE_URL` is set correctly
3. Review database logs in Railway

**Commands not working:**
1. Wait up to 1 hour for slash command propagation
2. Check bot permissions in Discord server
3. Verify bot has "Use Slash Commands" permission

### Common Error Messages

**"Invalid Form Body"**
- Bot token is incorrect or expired
- Generate new token from Discord Developer Portal

**"Missing Permissions"**
- Bot lacks required Discord permissions
- Re-invite bot with proper permission scopes

**"Connection terminated unexpectedly"**
- Database connection issue
- Check PostgreSQL service status in Railway

## Monitoring and Maintenance

### Viewing Logs
```bash
# Using Railway CLI
railway logs

# Or view in Railway dashboard under "Logs" tab
```

### Updating the Bot
1. Push changes to your Git repository
2. Railway automatically detects and redeploys
3. Monitor deployment in Railway dashboard

### Database Management

**Backup Database:**
```bash
# Get database credentials from Railway
railway connect postgres

# Create backup (replace with actual credentials)
pg_dump postgresql://username:password@host:port/db > backup.sql
```

**View Database:**
- Use Railway's database viewer
- Connect with external tools using `DATABASE_URL`

## Scaling Considerations

### Performance Monitoring
- Monitor CPU and memory usage in Railway dashboard
- Set up alerts for high resource usage
- Consider upgrading Railway plan for larger servers

### Database Optimization
- Add indexes for frequently queried columns
- Regular cleanup of old voice session data
- Monitor database size and performance

## Cost Optimization

### Railway Pricing
- Hobby plan: $5/month for basic usage
- Pro plan: $20/month for higher limits
- Usage-based pricing for resources

### Reducing Costs
- Optimize database queries
- Implement efficient caching
- Clean up old data periodically

## Support Resources

- [Railway Documentation](https://docs.railway.app)
- [Discord.js Guide](https://discordjs.guide)
- [PostgreSQL Documentation](https://postgresql.org/docs)

## Security Best Practices

1. **Never commit tokens to Git**
   - Use `.env` files locally
   - Set environment variables in Railway

2. **Secure Database Access**
   - Use Railway's built-in security
   - Don't expose database publicly

3. **Bot Permissions**
   - Grant minimum required permissions
   - Regularly audit bot access

4. **Regular Updates**
   - Keep dependencies updated
   - Monitor security advisories
