# Discord Leveling Bot

A comprehensive Discord leveling bot that tracks user activity through messages, reactions, and voice chat time. Features configurable role rewards and PostgreSQL database storage.

## Features

### XP System
- **Messages**: 15-25 XP per message (60-second cooldown)
- **Reactions**: 5 XP per reaction given (30-second cooldown)  
- **Voice Chat**: 1 XP per minute (only when 2+ humans are in channel, excluding bots)

### Level Rewards
- Automatic role assignment at levels: 5, 10, 15, 20, 25, 30, 35, 40, 45, 50
- Fully configurable role rewards per server
- Level-up announcements with optional dedicated channel

### Commands
- `/level [user]` - Check your or someone's level and stats
- `/leaderboard` - View top 10 users by XP
- `/setlevelrole <level> [role]` - Configure role rewards (Admin only)
- `/levelroles` - View all configured level roles
- `/settings` - View server leveling settings

## Setup Instructions

### 1. Discord Bot Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Copy the bot token
4. Add bot to your server with these permissions:
   - Send Messages
   - Use Slash Commands
   - Read Message History
   - Add Reactions
   - Connect (Voice)
   - Speak (Voice)
   - Manage Roles

### 2. Railway Deployment

#### Option A: Deploy from GitHub
1. Fork this repository
2. Connect your GitHub to Railway
3. Create new project from your forked repo
4. Add PostgreSQL database service
5. Set environment variables (see below)

#### Option B: Deploy with Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add postgresql

# Deploy
railway up
```

### 3. Environment Variables
Set these in Railway dashboard or `.env` file:

```bash
DISCORD_TOKEN=your_discord_bot_token_here
DATABASE_URL=postgresql://username:password@hostname:port/database_name
NODE_ENV=production
```

### 4. Local Development
```bash
# Clone repository
git clone <your-repo-url>
cd discord-leveling-bot

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev
```

## Database Schema

### user_levels
- `user_id` - Discord user ID
- `guild_id` - Discord server ID  
- `messages` - Total messages sent
- `reactions` - Total reactions given
- `voice_time` - Total voice minutes
- `total_xp` - Total experience points
- `level` - Current level

### guild_settings
- `guild_id` - Discord server ID
- `level_roles` - JSON object mapping levels to role IDs
- `xp_multiplier` - Global XP multiplier
- `voice_xp_rate` - XP per minute in voice
- `message_xp_min/max` - Message XP range
- `reaction_xp` - XP per reaction
- `level_up_channel` - Channel for level announcements

### voice_sessions
- `user_id` - Discord user ID
- `guild_id` - Discord server ID
- `duration` - Session length in seconds
- `start_time/end_time` - Session timestamps

## XP Formula

The bot uses a square root progression system:
- **Level calculation**: `√(totalXP / 100)`
- **XP for level**: `level² × 100`

Example progression:
- Level 10: 10,000 XP required
- Level 25: 62,500 XP required  
- Level 50: 250,000 XP required

This matches your calculator showing ~25,427 XP for level 50 from level 0.

## Voice Chat Requirements

Voice XP is only awarded when:
- User is in a voice channel
- At least 2 human members are present (bots excluded)
- User stays for minimum 1 minute intervals

## Customization

### Adjusting XP Rates
Modify these values in the guild settings:
- `xp_multiplier` - Global multiplier for all XP gains
- `voice_xp_rate` - XP awarded per minute in voice
- `message_xp_min/max` - Range for message XP
- `reaction_xp` - XP per reaction

### Role Configuration
Use `/setlevelrole` command to assign roles:
```
/setlevelrole level:5 role:@Beginner
/setlevelrole level:25 role:@Veteran  
/setlevelrole level:50 role:@Legend
```

Remove role rewards:
```
/setlevelrole level:10
```

## Troubleshooting

### Common Issues

**Bot not responding to commands:**
- Ensure bot has proper permissions
- Check if slash commands are registered
- Verify bot token is correct

**Database connection errors:**
- Verify DATABASE_URL format
- Check PostgreSQL service is running
- Ensure database exists and is accessible

**XP not being awarded:**
- Check cooldown periods (60s messages, 30s reactions)
- Verify voice channel has 2+ human members
- Check user permissions and bot roles

### Logs
Check Railway logs for detailed error information:
```bash
railway logs
```

## Advanced Configuration

### Custom Level Formula
To modify the leveling curve, edit the `calculateLevel()` and `calculateXPForLevel()` functions in `index.js`.

Current formula: `level = √(totalXP / 100)`

### Adding New Commands
1. Create command in `setupCommands()` method
2. Add handler in `interactionCreate` event
3. Implement command logic

### Database Migrations
For schema changes, add migration queries to `initializeDatabase()` method with proper IF NOT EXISTS checks.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Railway and Discord documentation
3. Create an issue on GitHub with detailed logs

## Version History

- **v1.0.0** - Initial release with core leveling features
  - Message, reaction, and voice XP tracking
  - Configurable role rewards
  - PostgreSQL database integration
  - Railway deployment support
