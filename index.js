// index.js - Complete fixed version with Pirate King exclusion

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const XPTracker = require('./src/utils/xpTracker');

// Environment validation
const requiredEnvVars = ['DISCORD_TOKEN', 'DATABASE_URL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`[ERROR] Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

console.log('[INFO] Starting Discord Leveling Bot...');
console.log('[INFO] Environment validation passed');

// Initialize database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection and create tables
async function initializeDatabase() {
    try {
        await db.query('SELECT NOW()');
        console.log('[INFO] Database connection established');

        // Create tables if they don't exist
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_levels (
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                total_xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 0,
                messages INTEGER DEFAULT 0,
                reactions INTEGER DEFAULT 0,
                voice_time INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, guild_id)
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(20) PRIMARY KEY,
                levelup_channel VARCHAR(20),
                excluded_role VARCHAR(20),
                xp_multiplier DECIMAL(3,1) DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('[INFO] Database tables initialized');
    } catch (error) {
        console.error('[ERROR] Database initialization failed:', error);
        process.exit(1);
    }
}

// Create client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize collections
client.commands = new Collection();

// Set global client reference IMMEDIATELY
global.client = client;

// Initialize guild settings cache
global.guildSettings = new Map();

// Initialize XP Tracker with database
const xpTracker = new XPTracker(client, db);
global.xpTracker = xpTracker;

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
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Helper function to get guild settings
async function getGuildSettings(guildId) {
    // Check cache first
    if (global.guildSettings.has(guildId)) {
        return global.guildSettings.get(guildId);
    }

    try {
        // Get from database
        const result = await db.query(
            'SELECT * FROM guild_settings WHERE guild_id = $1',
            [guildId]
        );

        let settings;
        if (result.rows.length > 0) {
            settings = {
                levelupChannel: result.rows[0].levelup_channel,
                excludedRole: result.rows[0].excluded_role,
                xpMultiplier: parseFloat(result.rows[0].xp_multiplier) || 1.0
            };
        } else {
            // Create default settings
            settings = {
                levelupChannel: null,
                excludedRole: null,
                xpMultiplier: 1.0
            };
            
            // Insert default settings into database
            await db.query(
                'INSERT INTO guild_settings (guild_id, xp_multiplier) VALUES ($1, $2) ON CONFLICT (guild_id) DO NOTHING',
                [guildId, 1.0]
            );
        }

        // Cache the settings
        global.guildSettings.set(guildId, settings);
        return settings;
    } catch (error) {
        console.error('[ERROR] Error getting guild settings:', error);
        return {
            levelupChannel: null,
            excludedRole: null,
            xpMultiplier: 1.0
        };
    }
}

// Event handlers
client.once('ready', async () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    
    try {
        // Initialize database first
        await initializeDatabase();
        
        // Register slash commands
        const commands = Array.from(client.commands.values()).map(command => command.data.toJSON());
        console.log(`[DEBUG] Registering ${commands.length} slash commands: ${commands.map(c => c.name).join(', ')}`);
        console.log(`[DEBUG] Using bot application ID: ${client.application.id}`);
        
        await client.application.commands.set(commands);
        console.log('[INFO] Successfully registered slash commands');
        
        // Start periodic tasks ONLY after client is ready
        console.log('[INFO] Starting periodic tasks...');
        
        // Process voice XP every minute
        setInterval(() => {
            if (client.isReady()) {
                xpTracker.processVoiceXP().catch(error => {
                    console.error('[ERROR] Error in voice XP processing:', error);
                });
            }
        }, 60000);
        
        // Cleanup daily voice XP (run every 24 hours)
        setInterval(() => {
            if (client.isReady()) {
                xpTracker.cleanupDailyVoiceXP().catch(error => {
                    console.error('[ERROR] Error in daily cleanup:', error);
                });
            }
        }, 24 * 60 * 60 * 1000);
        
        // Run initial cleanup
        await xpTracker.cleanupDailyVoiceXP();
        
        console.log('[INFO] Discord Leveling Bot is fully operational!');
        console.log(`[INFO] Bot is in ${client.guilds.cache.size} servers`);
        console.log(`[INFO] Monitoring ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} total members`);
        console.log(`[INFO] Daily voice XP cap: ${process.env.DAILY_VOICE_XP_CAP || 6000} XP per user`);
        
    } catch (error) {
        console.error('[ERROR] Error during bot initialization:', error);
    }
});

// Handle button interactions for leaderboard first
client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId.startsWith('leaderboard_')) {
        const leaderboardCommand = client.commands.get('leaderboard');
        if (leaderboardCommand && leaderboardCommand.handleButtonInteraction) {
            try {
                await leaderboardCommand.handleButtonInteraction(interaction, xpTracker);
            } catch (error) {
                console.error('[ERROR] Button interaction error:', error);
            }
        }
        return;
    }
});

// Interaction handler for slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[ERROR] Error executing command ${interaction.commandName}:`, error);
        
        const errorMessage = {
            content: 'There was an error while executing this command!',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Message handler for XP tracking
client.on('messageCreate', async message => {
    // Ignore bots and system messages
    if (message.author.bot || !message.guild) return;
    
    try {
        // Check cooldown (simple implementation)
        const cooldownKey = `${message.author.id}_${message.guild.id}_message`;
        const now = Date.now();
        
        if (!xpTracker.cooldowns) xpTracker.cooldowns = new Map();
        
        const lastUse = xpTracker.cooldowns.get(cooldownKey);
        const cooldownTime = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
        
        if (lastUse && (now - lastUse) < cooldownTime) {
            return;
        }
        
        // Get guild settings
        const guildSettings = await getGuildSettings(message.guild.id);
        
        // Check if user has excluded role (Pirate King)
        const member = message.member;
        const excludedRoleId = guildSettings.excludedRole || process.env.LEADERBOARD_EXCLUDE_ROLE;
        if (excludedRoleId && member && member.roles.cache.has(excludedRoleId)) {
            console.log(`[XP] Skipping XP for Pirate King: ${member.displayName}`);
            return; // Skip XP for excluded role (Pirate King)
        }
        
        // Calculate XP
        const messageXPMin = parseInt(process.env.MESSAGE_XP_MIN) || 25;
        const messageXPMax = parseInt(process.env.MESSAGE_XP_MAX) || 35;
        const baseXP = Math.floor(Math.random() * (messageXPMax - messageXPMin + 1)) + messageXPMin;
        const finalXP = Math.floor(baseXP * guildSettings.xpMultiplier);
        
        // Add XP for message
        await xpTracker.awardXP(message.author.id, message.guild.id, finalXP, 'message', message.author);
        
        // Set cooldown
        xpTracker.cooldowns.set(cooldownKey, now);
        
    } catch (error) {
        console.error('[ERROR] Error processing message XP:', error);
    }
});

// Reaction handler for XP tracking
client.on('messageReactionAdd', async (reaction, user) => {
    // Ignore bots
    if (user.bot || !reaction.message.guild) return;
    
    try {
        // Check cooldown
        const cooldownKey = `${user.id}_${reaction.message.guild.id}_reaction`;
        const now = Date.now();
        
        if (!xpTracker.cooldowns) xpTracker.cooldowns = new Map();
        
        const lastUse = xpTracker.cooldowns.get(cooldownKey);
        const cooldownTime = parseInt(process.env.REACTION_COOLDOWN) || 300000;
        
        if (lastUse && (now - lastUse) < cooldownTime) {
            return;
        }
        
        // Get guild settings
        const guildSettings = await getGuildSettings(reaction.message.guild.id);
        
        // Check if user has excluded role (Pirate King)
        const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
        const excludedRoleId = guildSettings.excludedRole || process.env.LEADERBOARD_EXCLUDE_ROLE;
        if (excludedRoleId && member && member.roles.cache.has(excludedRoleId)) {
            console.log(`[XP] Skipping reaction XP for Pirate King: ${member.displayName}`);
            return; // Skip XP for excluded role (Pirate King)
        }
        
        // Calculate XP
        const reactionXPMin = parseInt(process.env.REACTION_XP_MIN) || 25;
        const reactionXPMax = parseInt(process.env.REACTION_XP_MAX) || 35;
        const baseXP = Math.floor(Math.random() * (reactionXPMax - reactionXPMin + 1)) + reactionXPMin;
        const finalXP = Math.floor(baseXP * guildSettings.xpMultiplier);
        
        // Add XP for reaction
        await xpTracker.awardXP(user.id, reaction.message.guild.id, finalXP, 'reaction', user);
        
        // Set cooldown
        xpTracker.cooldowns.set(cooldownKey, now);
        
    } catch (error) {
        console.error('[ERROR] Error processing reaction XP:', error);
    }
});

// Voice state update handler
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        await xpTracker.handleVoiceStateUpdate(oldState, newState);
    } catch (error) {
        console.error('[ERROR] Error processing voice state update:', error);
    }
});

// Error handlers
client.on('error', error => {
    console.error('[ERROR] Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('[ERROR] Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('[ERROR] Uncaught Exception:', error);
    // Don't exit the process, just log the error
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[INFO] Received SIGINT, shutting down gracefully...');
    
    try {
        if (xpTracker && xpTracker.cleanup) {
            await xpTracker.cleanup();
        }
        
        if (db) {
            await db.end();
        }
        
        if (client) {
            client.destroy();
        }
        
        console.log('[INFO] Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('[INFO] Received SIGTERM, shutting down gracefully...');
    
    try {
        if (xpTracker && xpTracker.cleanup) {
            await xpTracker.cleanup();
        }
        
        if (db) {
            await db.end();
        }
        
        if (client) {
            client.destroy();
        }
        
        console.log('[INFO] Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
    }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
