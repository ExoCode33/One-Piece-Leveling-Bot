const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DEBUG = process.env.DEBUG === 'true';

// Global variables
let db;
let xpTracker;
let xpBoostManager;

// Initialize database connection
async function initializeConnection() {
    if (process.env.DATABASE_URL) {
        console.log('🚂 Connecting to Railway PostgreSQL...');
        db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
    } else {
        const config = {
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            host: process.env.PGHOST,
            port: process.env.PGPORT || 5432,
            database: process.env.PGDATABASE,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        };
        
        if (!config.user || !config.password || !config.host || !config.database) {
            throw new Error('DATABASE_URL or individual PostgreSQL environment variables are required');
        }
        
        console.log('🗄️ Connecting to PostgreSQL with manual config...');
        db = new Pool(config);
    }
    
    try {
        const client = await db.connect();
        const result = await client.query('SELECT NOW()');
        console.log(`✅ PostgreSQL connected successfully at ${result.rows[0].now}`);
        client.release();
    } catch (error) {
        console.log(`❌ PostgreSQL connection failed: ${error.message}`);
        throw error;
    }
}

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Database functions for XP system
async function initializeDatabase() {
    try {
        // User levels table
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

        // Enhanced guild settings table with all required columns
        await db.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(20) PRIMARY KEY,
                levelup_channel VARCHAR(20),
                levelup_enabled BOOLEAN DEFAULT true,
                xp_log_channel VARCHAR(20),
                xp_log_enabled BOOLEAN DEFAULT false,
                xp_multiplier DECIMAL(3,2) DEFAULT 1.0,
                excluded_role VARCHAR(20),
                category_id VARCHAR(20) DEFAULT '0',
                category_name VARCHAR(100) DEFAULT 'Default Category',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add indexes for better performance
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_levels_guild_xp ON user_levels(guild_id, total_xp DESC)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_levels_user_guild ON user_levels(user_id, guild_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_guild_settings_guild ON guild_settings(guild_id)');

        console.log('✅ Database tables initialized successfully');
        
        // Check existing guild_settings structure
        const tableInfo = await db.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'guild_settings' 
            ORDER BY ordinal_position
        `);
        
        console.log('[DATABASE] Guild settings table structure:');
        tableInfo.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
}

// ✅ FIXED: Load guild settings from database on startup
async function loadGuildSettings() {
    try {
        console.log('🔧 Loading guild settings from database...');
        
        if (!global.guildSettings) {
            global.guildSettings = new Map();
        }
        
        const result = await db.query('SELECT * FROM guild_settings');
        
        let loadedCount = 0;
        for (const row of result.rows) {
            // ✅ FIXED: Proper boolean conversion for PostgreSQL
            const settings = {
                levelupChannel: row.levelup_channel,
                levelupEnabled: row.levelup_enabled === true || row.levelup_enabled === 'true' || row.levelup_enabled === 1,
                xpLogChannel: row.xp_log_channel,
                xpLogEnabled: row.xp_log_enabled === true || row.xp_log_enabled === 'true' || row.xp_log_enabled === 1,
                xpMultiplier: parseFloat(row.xp_multiplier) || 1.0,
                excludedRole: row.excluded_role || null
            };
            
            global.guildSettings.set(row.guild_id, settings);
            loadedCount++;
            
            // Debug logging for specific guild
            if (row.guild_id === '717768828364390432') {
                console.log(`[GUILD SETTINGS] ✅ Loaded for guild ${row.guild_id}:`, {
                    levelupEnabled: settings.levelupEnabled,
                    levelupChannel: settings.levelupChannel,
                    xpLogEnabled: settings.xpLogEnabled,
                    xpLogChannel: settings.xpLogChannel,
                    xpMultiplier: settings.xpMultiplier
                });
                console.log(`[GUILD SETTINGS] Raw database values:`, {
                    levelup_enabled: row.levelup_enabled,
                    xp_log_enabled: row.xp_log_enabled,
                    typeof_levelup: typeof row.levelup_enabled,
                    typeof_xplog: typeof row.xp_log_enabled
                });
            }
        }
        
        console.log(`✅ Loaded ${loadedCount} guild settings from database`);
        
        // Log total guild settings for verification
        console.log(`[GUILD SETTINGS] Total guilds in memory: ${global.guildSettings.size}`);
        
    } catch (error) {
        console.error('❌ Error loading guild settings:', error);
        if (!global.guildSettings) {
            global.guildSettings = new Map();
        }
    }
}

// Register slash commands
async function registerSlashCommands(clientId, token) {
    try {
        const { REST, Routes } = require('discord.js');
        const commands = [];
        const commandsPath = path.join(__dirname, 'src', 'commands');
        
        if (!fs.existsSync(commandsPath)) {
            console.warn('⚠️ Commands directory not found, skipping slash command registration');
            return;
        }
        
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`📋 Loaded command: ${command.data.name}`);
                } else {
                    console.warn(`⚠️ Command at ${filePath} is missing required "data" or "execute" property.`);
                }
            } catch (error) {
                console.warn(`⚠️ Could not load command ${file}:`, error.message);
            }
        }

        if (commands.length === 0) {
            console.warn('⚠️ No valid commands found to register');
            return;
        }

        const rest = new REST().setToken(token);
        console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);
        
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error('❌ Error registering slash commands:', error);
    }
}

// Initialize XP system
async function initializeXP() {
    try {
        // Test if files exist first
        const xpTrackerPath = path.join(__dirname, 'src', 'utils', 'xpTracker.js');
        const xpBoostPath = path.join(__dirname, 'src', 'utils', 'xpBoost.js');
        
        if (!fs.existsSync(xpTrackerPath)) {
            throw new Error('xpTracker.js file not found');
        }
        
        if (!fs.existsSync(xpBoostPath)) {
            throw new Error('xpBoost.js file not found');
        }
        
        console.log('📁 XP system files found, attempting to load...');
        
        const XPTracker = require('./src/utils/xpTracker');
        console.log('✅ XPTracker class loaded');
        
        xpTracker = new XPTracker(client, db);
        global.xpTracker = xpTracker;
        console.log(`⏱️ XP Tracker initialized successfully`);
        
        const XPBoostManager = require('./src/utils/xpBoost');
        console.log('✅ XPBoostManager class loaded');
        
        xpBoostManager = new XPBoostManager(db);
        global.xpBoostManager = xpBoostManager;
        console.log(`🚀 XP Boost Manager initialized successfully`);
        
        // Start voice XP processing
        setInterval(() => {
            if (xpTracker && xpTracker.processVoiceXP) {
                xpTracker.processVoiceXP().catch(error => {
                    console.error('[VOICE XP] Error in processing:', error);
                });
            }
        }, 60000);
        
        // Daily cleanup
        setInterval(() => {
            if (xpTracker && xpTracker.cleanupDailyVoiceXP) {
                xpTracker.cleanupDailyVoiceXP().catch(error => {
                    console.error('[DAILY CLEANUP] Error:', error);
                });
            }
        }, 24 * 60 * 60 * 1000);
        
    } catch (error) {
        console.error('⚠️ XP System initialization error:', error);
        console.error('Stack trace:', error.stack);
        console.log('🚢 Bot will run without XP tracking');
    }
}

// ✅ FIXED: Bot ready event with proper guild settings loading
client.once('ready', async () => {
    console.log(`One Piece Leveling Bot is ready to set sail!`);
    console.log(`⚓ Logged in as ${client.user.tag}`);
    console.log(`🏴‍☠️ Serving ${client.guilds.cache.size} server(s)`);
    
    try {
        await initializeConnection();
        await initializeDatabase();
        
        // ✅ CRITICAL: Load guild settings BEFORE XP system initialization
        await loadGuildSettings();
        
        await initializeXP();
        
        if (CLIENT_ID) {
            await registerSlashCommands(CLIENT_ID, DISCORD_TOKEN);
        }
        
        const result = await db.query('SELECT NOW()');
        console.log(`⏰ Database time: ${result.rows[0].now}`);
        console.log('🗄️ Database connection test successful!');
        console.log('🎯 All systems initialized and ready!');
        
        // ✅ NEW: Verify guild settings loaded properly
        if (global.guildSettings && global.guildSettings.size > 0) {
            console.log(`🎯 Guild settings verification: ${global.guildSettings.size} guilds loaded`);
            
            // Check if our specific guild is loaded
            const testGuild = global.guildSettings.get('717768828364390432');
            if (testGuild) {
                console.log('🎯 Test guild settings confirmed loaded:', {
                    xpLogEnabled: testGuild.xpLogEnabled,
                    xpLogChannel: testGuild.xpLogChannel
                });
            }
        } else {
            console.warn('⚠️ No guild settings loaded from database');
        }
        
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        console.error('❌ Bot will shut down due to error');
        process.exit(1);
    }
});

// Voice state update handler for XP tracking
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        // Handle voice time tracking with XP system
        if (xpTracker && xpTracker.handleVoiceStateUpdate) {
            await xpTracker.handleVoiceStateUpdate(oldState, newState);
        }
    } catch (error) {
        console.error('❌ Error in voiceStateUpdate:', error);
    }
});

// Slash command handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        // Try to load command from file
        const commandsPath = path.join(__dirname, 'src', 'commands');
        const commandFile = path.join(commandsPath, `${commandName}.js`);
        
        if (fs.existsSync(commandFile)) {
            try {
                const command = require(commandFile);
                if (command.execute) {
                    await command.execute(interaction);
                    return;
                }
            } catch (error) {
                console.error(`Error executing command ${commandName}:`, error);
                if (!interaction.replied) {
                    await interaction.reply({
                        content: `❌ Error executing command: ${error.message}`,
                        ephemeral: true
                    });
                }
                return;
            }
        }

        // Fallback commands
        if (commandName === 'ping') {
            const ping = Date.now() - interaction.createdTimestamp;
            await interaction.reply(`🏴‍☠️ **Pong!** 
📡 Bot Latency: \`${ping}ms\`
💓 API Latency: \`${Math.round(client.ws.ping)}ms\`
⚓ Ready to set sail!`);
        }
        else if (commandName === 'check-voice-time') {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            
            if (!xpTracker) {
                return await interaction.reply({
                    content: '❌ XP Tracker not initialized.',
                    ephemeral: true
                });
            }
            
            const userStats = await xpTracker.getUserStats(targetUser.id, interaction.guild.id);
            
            if (!userStats) {
                return await interaction.reply({
                    content: `📊 ${targetUser.displayName} has no XP data in this server.`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎤 Voice Time & XP Statistics')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '👤 User', value: targetUser.displayName, inline: true },
                    { name: '⚡ Total XP', value: `${userStats.total_xp.toLocaleString()} XP`, inline: true },
                    { name: '🎯 Level', value: `${userStats.level}`, inline: true },
                    { name: '📨 Messages', value: `${userStats.messages}`, inline: true },
                    { name: '👍 Reactions', value: `${userStats.reactions}`, inline: true },
                    { name: '🎤 Voice Time', value: `${userStats.voice_time} minutes`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'One Piece XP System' });

            await interaction.reply({ embeds: [embed] });
        }
        else {
            await interaction.reply({
                content: '❌ Command not found or not implemented yet.',
                ephemeral: true
            });
        }

    } catch (error) {
        console.error('❌ Error handling slash command:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while processing this command.',
                ephemeral: true
            }).catch(console.error);
        }
    }
});

// Message XP handling
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    // Handle XP for messages
    if (xpTracker && xpTracker.isOnCooldown && xpTracker.setCooldown && xpTracker.awardXP) {
        const cooldownKey = `${message.guild.id}:${message.author.id}:message`;
        const cooldown = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
        
        if (!xpTracker.isOnCooldown(cooldownKey, cooldown)) {
            xpTracker.setCooldown(cooldownKey);
            await xpTracker.awardXP(message.author.id, message.guild.id, null, 'message', message.author);
        }
    }
    
    // Legacy commands
    if (message.content === '!ping') {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`🏴‍☠️ **Pong!** 
📡 Bot Latency: \`${ping}ms\`
💓 API Latency: \`${Math.round(client.ws.ping)}ms\`
⚓ Ready to set sail with XP tracking!`);
    }
    
    if (message.content === '!help') {
        message.reply(`🏴‍☠️ **One Piece Leveling Bot Commands**

**📊 XP & Level Commands:**
\`/level [@user]\` - Check level information and bounty
\`/leaderboard\` - Show server leaderboard with wanted posters
\`/settings\` - Configure XP settings (Admin only)
\`/admin\` - Advanced XP management (Admin only)

**⚡ XP System:**
• **Message XP**: ${process.env.MESSAGE_XP_MIN || 25}-${process.env.MESSAGE_XP_MAX || 35} per message
• **Voice XP**: ${process.env.VOICE_XP_MIN || 45}-${process.env.VOICE_XP_MAX || 55} per minute
• **Reaction XP**: ${process.env.REACTION_XP_MIN || 25}-${process.env.REACTION_XP_MAX || 35} per reaction
• **Daily Voice Cap**: ${process.env.DAILY_VOICE_XP_CAP || 1500} XP
• **Level System**: Automatic bounty progression
• **Role Rewards**: Unlock new roles at milestone levels

**🎯 Features:**
• **Advanced XP tracking with multiple sources**
• **Marine Intelligence logging system**
• **Comprehensive slash commands for XP management**
• **Wanted poster generation for level-ups**

**💡 Use slash commands (/) for the best experience!**
**⚡ All XP activity is logged for Marine Intelligence!**`);
    }
});

// Reaction XP handling
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    
    if (xpTracker && xpTracker.isOnCooldown && xpTracker.setCooldown && xpTracker.awardXP) {
        const cooldownKey = `${reaction.message.guild.id}:${user.id}:reaction`;
        const cooldown = parseInt(process.env.REACTION_COOLDOWN) || 300000;
        
        if (!xpTracker.isOnCooldown(cooldownKey, cooldown)) {
            xpTracker.setCooldown(cooldownKey);
            await xpTracker.awardXP(user.id, reaction.message.guild.id, null, 'reaction', user);
        }
    }
});

// Error handling
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

client.on('warn', warning => {
    console.warn('⚠️ Discord client warning:', warning);
});

process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function gracefulShutdown() {
    console.log('🛑 Shutting down bot gracefully...');
    
    try {
        // Clean up XP tracker
        if (xpTracker && xpTracker.cleanup) {
            await xpTracker.cleanup();
        }
        
        // Close database connection
        console.log('🗄️ Closing database connection...');
        if (db) {
            await db.end();
        }
        
        // Destroy Discord client
        client.destroy();
        
        console.log('👋 Bot shutdown complete!');
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
    }
    
    process.exit(0);
}

// ✅ NEW: Refresh guild settings periodically (every 5 minutes)
setInterval(async () => {
    try {
        if (global.guildSettings && db) {
            console.log('[GUILD SETTINGS] Refreshing guild settings from database...');
            await loadGuildSettings();
        }
    } catch (error) {
        console.error('[GUILD SETTINGS] Error during periodic refresh:', error);
    }
}, 300000); // 5 minutes

// Keep the process alive and log status
setInterval(() => {
    if (DEBUG) {
        const activeSessions = xpTracker && xpTracker.voiceSessions ? 
            Object.keys(xpTracker.voiceSessions).length : 0;
        console.log(`🏴‍☠️ Bot Status - Guilds: ${client.guilds.cache.size}, Active Voice Sessions: ${activeSessions}, Uptime: ${Math.floor(process.uptime()/60)}m`);
    }
}, 300000); // Log every 5 minutes in debug mode

// Start the bot
async function startBot() {
    console.log('🚀 Starting One Piece Leveling Bot...');
    console.log(`🔑 Discord Token: ${DISCORD_TOKEN ? '✅ Provided' : '❌ MISSING'}`);
    console.log(`🆔 Client ID: ${CLIENT_ID ? '✅ Provided' : '❌ MISSING'}`);
    console.log(`🗄️ Database URL: ${process.env.DATABASE_URL ? '✅ Provided' : '❌ MISSING'}`);

    if (!DISCORD_TOKEN) {
        console.error('❌ DISCORD_TOKEN is required! Please check your .env file.');
        process.exit(1);
    }

    if (!CLIENT_ID) {
        console.error('❌ CLIENT_ID is required for slash commands! Please check your .env file.');
        process.exit(1);
    }

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is required! Please check your .env file.');
        process.exit(1);
    }

    try {
        await client.login(DISCORD_TOKEN);
    } catch (error) {
        console.error('❌ Failed to login to Discord:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = { client, db, xpBoostManager };

// Start the bot
startBot();
