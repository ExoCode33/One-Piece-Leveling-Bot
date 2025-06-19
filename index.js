const { Client, Collection, GatewayIntentBits, REST, Routes, ActivityType } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize commands collection
client.commands = new Collection();

// Environment validation
const requiredEnvVars = ['DISCORD_TOKEN', 'DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error(`[ERROR] Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

console.log('[INFO] Starting Discord Leveling Bot...');
console.log('[INFO] Environment validation passed');

// Load guild settings
const { loadGuildSettings } = require('./src/utils/settings');
loadGuildSettings();

// Load commands
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[DEBUG] ✅ Loaded command: ${command.data.name}`);
    } else {
        console.log(`[WARNING] Command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

// Initialize XP tracking utilities
const xpTracker = require('./src/utils/xpTracker');
const messageXP = require('./src/utils/messageXP');
const reactionXP = require('./src/utils/reactionXP');
const voiceXP = require('./src/utils/voiceXP');

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                username VARCHAR(255),
                total_xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 0,
                message_count INTEGER DEFAULT 0,
                voice_time INTEGER DEFAULT 0,
                last_message TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, guild_id)
            )
        `);

        // Create guild_settings table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20) UNIQUE NOT NULL,
                excluded_role VARCHAR(20),
                levelup_channel VARCHAR(20),
                xp_multiplier DECIMAL(3,2) DEFAULT 1.0,
                levelup_enabled BOOLEAN DEFAULT true,
                xp_log_enabled BOOLEAN DEFAULT false,
                xp_log_channel VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create daily_voice_xp table for voice XP cap tracking
        await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_voice_xp (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                date DATE DEFAULT CURRENT_DATE,
                xp_earned INTEGER DEFAULT 0,
                UNIQUE(user_id, guild_id, date)
            )
        `);

        // Create indexes for better performance
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_guild_xp ON users(guild_id, total_xp DESC)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_user_guild ON users(user_id, guild_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_daily_voice_date ON daily_voice_xp(date)');
        
        console.log('[INFO] Database tables initialized successfully');
    } catch (error) {
        console.error('[ERROR] Database initialization failed:', error);
        throw error;
    }
}

// Bot ready event
client.once('ready', async () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    
    try {
        // Initialize database
        await initializeDatabase();
        console.log('[INFO] Database connection established');
        console.log('[INFO] Database tables initialized');
        
        // Register slash commands
        const commands = Array.from(client.commands.values()).map(command => command.data.toJSON());
        console.log(`[DEBUG] Registering ${commands.length} slash commands: ${commands.map(c => c.name).join(', ')}`);
        
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const applicationId = client.user.id;
        console.log(`[DEBUG] Using bot application ID: ${applicationId}`);
        
        await rest.put(
            Routes.applicationCommands(applicationId),
            { body: commands }
        );
        
        console.log('[INFO] Successfully registered slash commands');
        
        // Start periodic tasks
        console.log('[INFO] Starting periodic tasks...');
        startPeriodicTasks();
        
        // Set bot status
        client.user.setActivity('Marine Operations', { type: ActivityType.Watching });
        
        console.log('[INFO] Discord Leveling Bot is fully operational!');
        console.log(`[INFO] Bot is in ${client.guilds.cache.size} servers`);
        console.log(`[INFO] Monitoring ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} total members`);
        console.log(`[INFO] Daily voice XP cap: ${process.env.DAILY_VOICE_XP_CAP || 4000} XP per user`);
        
        // Initialize voice XP tracking for existing members
        setTimeout(() => {
            voiceXP.scanExistingMembers(client);
        }, 5000);
        
    } catch (error) {
        console.error('[ERROR] Failed to initialize bot:', error);
        process.exit(1);
    }
});

// Slash command interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
            console.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
            return;
        }
        
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('[ERROR] Error executing command:', error);
            
            const errorMessage = {
                content: '```diff\n- MARINE INTELLIGENCE SYSTEM ERROR\n- Command execution failed. Please try again.```',
                ephemeral: true
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    } else if (interaction.isButton()) {
        // Handle button interactions for admin command
        await handleAdminButtons(interaction);
    }
});

// Button interaction handler for admin command
async function handleAdminButtons(interaction) {
    try {
        // Check for admin buttons
        if (['cleanup_inactive', 'optimize_db', 'backup_stats', 'nuclear_confirm', 'nuclear_abort', 'nuclear_execute'].includes(interaction.customId)) {
            
            // Security check
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({
                    content: '```diff\n- ACCESS DENIED - NUCLEAR AUTHORIZATION REQUIRED\n- ADMINISTRATOR PERMISSIONS MANDATORY```',
                    ephemeral: true
                });
            }
            
            const adminCommand = require('./src/commands/admin');
            
            // Handle maintenance buttons
            if (['cleanup_inactive', 'optimize_db', 'backup_stats'].includes(interaction.customId)) {
                await adminCommand.handleMaintenanceButtons(interaction, pool);
            }
            
            // Handle nuclear buttons  
            if (['nuclear_confirm', 'nuclear_abort', 'nuclear_execute'].includes(interaction.customId)) {
                await adminCommand.handleNuclearButtons(interaction, pool);
            }
        }
    } catch (error) {
        console.error('[ERROR] Admin button error:', error);
        
        const errorMessage = {
            content: '```diff\n- MARINE INTELLIGENCE SYSTEM ERROR\n- Button interaction failed. Please try again.```',
            ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
}

// Message events for XP tracking
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    
    // Check if user has excluded role (Pirate King)
    const excludedRoleId = process.env.LEADERBOARD_EXCLUDE_ROLE;
    if (excludedRoleId && message.member.roles.cache.has(excludedRoleId)) {
        return; // Skip XP tracking for Pirate King
    }
    
    try {
        await messageXP.handleMessage(message);
        await xpTracker.updateUserXP(message.author.id, message.guild.id, 'message');
    } catch (error) {
        console.error('[ERROR] Message XP tracking error:', error);
    }
});

// Reaction events for XP tracking
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    
    // Check if user has excluded role (Pirate King)
    const excludedRoleId = process.env.LEADERBOARD_EXCLUDE_ROLE;
    const member = reaction.message.guild.members.cache.get(user.id);
    if (excludedRoleId && member && member.roles.cache.has(excludedRoleId)) {
        return; // Skip XP tracking for Pirate King
    }
    
    try {
        await reactionXP.handleReaction(reaction, user);
        await xpTracker.updateUserXP(user.id, reaction.message.guild.id, 'reaction');
    } catch (error) {
        console.error('[ERROR] Reaction XP tracking error:', error);
    }
});

// Voice state events for XP tracking
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        await voiceXP.handleVoiceStateUpdate(oldState, newState);
    } catch (error) {
        console.error('[ERROR] Voice XP tracking error:', error);
    }
});

// Guild member events
client.on('guildMemberAdd', member => {
    console.log(`[INFO] New member joined: ${member.user.tag} in ${member.guild.name}`);
});

client.on('guildMemberRemove', member => {
    console.log(`[INFO] Member left: ${member.user.tag} from ${member.guild.name}`);
});

// Guild events
client.on('guildCreate', guild => {
    console.log(`[INFO] Bot added to new guild: ${guild.name} (${guild.id})`);
});

client.on('guildDelete', guild => {
    console.log(`[INFO] Bot removed from guild: ${guild.name} (${guild.id})`);
});

// Error handling
client.on('error', error => {
    console.error('[ERROR] Discord client error:', error);
});

client.on('warn', warning => {
    console.warn('[WARNING] Discord client warning:', warning);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', error => {
    console.error('[ERROR] Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[INFO] Received SIGINT, shutting down gracefully...');
    
    try {
        await client.destroy();
        console.log('[INFO] Discord client destroyed');
        
        if (pool) {
            await pool.end();
            console.log('[INFO] Database connection closed');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('[INFO] Received SIGTERM, shutting down gracefully...');
    
    try {
        await client.destroy();
        if (pool) {
            await pool.end();
        }
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
    }
});

// Periodic tasks
function startPeriodicTasks() {
    // Health check every 5 minutes
    setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        if (memoryMB > 450) { // Warning at 450MB
            console.warn(`[WARNING] High memory usage: ${memoryMB}MB`);
        }
        
        console.log(`[HEALTH] Memory: ${memoryMB}MB | Guilds: ${client.guilds.cache.size} | Uptime: ${Math.floor(process.uptime() / 60)}min`);
    }, 5 * 60 * 1000);
    
    // Database cleanup every hour
    setInterval(async () => {
        try {
            // Clean up old voice sessions that might be stuck
            await pool.query(`
                DELETE FROM daily_voice_xp 
                WHERE date < CURRENT_DATE - INTERVAL '7 days'
            `);
            
            console.log('[CLEANUP] Cleaned old voice XP records');
        } catch (error) {
            console.error('[ERROR] Cleanup task failed:', error);
        }
    }, 60 * 60 * 1000);
}

// Export pool for use in commands
module.exports = { pool };

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
