// index.js - FIXED with proper XPTracker initialization and error handling

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

// ✅ CRITICAL FIX: Add initialization status tracking
let isXPTrackerReady = false;
let initializationPromise = null;

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

        // Guild settings table
        await db.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(20) PRIMARY KEY,
                levelup_channel VARCHAR(20),
                levelup_enabled BOOLEAN DEFAULT true,
                xp_log_channel VARCHAR(20),
                xp_log_enabled BOOLEAN DEFAULT false,
                xp_multiplier DECIMAL(3,2) DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
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

// ✅ CRITICAL FIX: Enhanced XP system initialization with proper error handling
async function initializeXP() {
    try {
        // ✅ CRITICAL FIX: Prevent multiple initialization attempts
        if (initializationPromise) {
            console.log('[XP INIT] XP system initialization already in progress, waiting...');
            return await initializationPromise;
        }
        
        initializationPromise = (async () => {
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
            
            // ✅ CRITICAL FIX: Initialize XPTracker with proper error handling
            const XPTracker = require('./src/utils/xpTracker');
            console.log('✅ XPTracker class loaded');
            
            xpTracker = new XPTracker(client, process.env.DATABASE_URL);
            
            // ✅ CRITICAL FIX: Wait for initialization to complete
            console.log('🔄 Initializing XP Tracker...');
            const initSuccess = await xpTracker.initialize();
            
            if (!initSuccess) {
                throw new Error('XP Tracker initialization failed');
            }
            
            global.xpTracker = xpTracker;
            isXPTrackerReady = true;
            console.log(`⏱️ XP Tracker initialized successfully`);
            
            // ✅ CRITICAL FIX: Initialize XP Boost Manager only after XP Tracker is ready
            const XPBoostManager = require('./src/utils/xpBoost');
            console.log('✅ XPBoostManager class loaded');
            
            xpBoostManager = new XPBoostManager(xpTracker.db);
            global.xpBoostManager = xpBoostManager;
            console.log(`🚀 XP Boost Manager initialized successfully`);
            
            return true;
        })();
        
        const result = await initializationPromise;
        
        // ✅ CRITICAL FIX: Only start intervals if initialization was successful
        if (result && isXPTrackerReady) {
            // Start voice XP processing with safety checks
            setInterval(() => {
                if (xpTracker && xpTracker.isReady && xpTracker.isReady() && xpTracker.processVoiceXP) {
                    xpTracker.processVoiceXP().catch(error => {
                        console.error('[VOICE XP] Error in processing:', error);
                    });
                } else {
                    console.warn('[VOICE XP] XP Tracker not ready, skipping voice XP processing');
                }
            }, 60000);
            
            // Daily cleanup with safety checks
            setInterval(() => {
                if (xpTracker && xpTracker.dailyResetManager && xpTracker.dailyResetManager.cleanupDailyVoiceXP) {
                    xpTracker.dailyResetManager.cleanupDailyVoiceXP().catch(error => {
                        console.error('[DAILY CLEANUP] Error:', error);
                    });
                }
            }, 24 * 60 * 60 * 1000);
        }
        
        return result;
        
    } catch (error) {
        console.error('⚠️ XP System initialization error:', error);
        console.error('Stack trace:', error.stack);
        console.log('🚢 Bot will run without XP tracking');
        
        // ✅ CRITICAL FIX: Reset initialization promise on failure
        initializationPromise = null;
        isXPTrackerReady = false;
        
        return false;
    }
}

// ✅ CRITICAL FIX: Add utility function to check if XP system is ready
function isXPSystemReady() {
    return isXPTrackerReady && 
           xpTracker && 
           xpTracker.isReady && 
           xpTracker.isReady();
}

// Bot ready event
client.once('ready', async () => {
    console.log(`One Piece Leveling Bot is ready to set sail!`);
    console.log(`⚓ Logged in as ${client.user.tag}`);
    console.log(`🏴‍☠️ Serving ${client.guilds.cache.size} server(s)`);
    
    try {
        await initializeConnection();
        await initializeDatabase();
        
        // ✅ CRITICAL FIX: Initialize XP system after database is ready
        const xpInitSuccess = await initializeXP();
        
        if (CLIENT_ID) {
            await registerSlashCommands(CLIENT_ID, DISCORD_TOKEN);
        }
        
        const result = await db.query('SELECT NOW()');
        console.log(`⏰ Database time: ${result.rows[0].now}`);
        console.log('🗄️ Database connection test successful!');
        
        if (xpInitSuccess) {
            console.log('🎯 All systems initialized and ready!');
        } else {
            console.log('⚠️ Bot ready but XP system failed to initialize');
        }
        
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        console.error('❌ Bot will continue without some features');
    }
});

// ✅ CRITICAL FIX: Enhanced voice state update handler with safety checks
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        // ✅ CRITICAL FIX: Check if XP system is ready before processing
        if (!isXPSystemReady()) {
            console.warn('[VOICE] XP system not ready, skipping voice state update');
            return;
        }
        
        // Handle voice time tracking with XP system
        if (xpTracker.handleVoiceStateUpdate) {
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
            
            // ✅ CRITICAL FIX: Check if XP system is ready
            if (!isXPSystemReady()) {
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

// ✅ CRITICAL FIX: Enhanced message XP handling with safety checks
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    // ✅ CRITICAL FIX: Check if XP system is ready before awarding XP
    if (isXPSystemReady()) {
        try {
            const cooldownKey = `${message.guild.id}:${message.author.id}:message`;
            const cooldown = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
            
            if (!xpTracker.isOnCooldown(cooldownKey, cooldown)) {
                xpTracker.setCooldown(cooldownKey);
                await xpTracker.awardXP(message.author.id, message.guild.id, null, 'message', message.author);
            }
        } catch (error) {
            console.error('[MESSAGE XP] Error awarding XP:', error);
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
        const xpStatus = isXPSystemReady() ? '⚡ All XP systems operational' : '⚠️ XP system initializing...';
        
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
**🔧 System Status:** ${xpStatus}`);
    }
});

// ✅ CRITICAL FIX: Enhanced reaction XP handling with safety checks
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    
    // ✅ CRITICAL FIX: Check if XP system is ready before awarding XP
    if (isXPSystemReady()) {
        try {
            const cooldownKey = `${reaction.message.guild.id}:${user.id}:reaction`;
            const cooldown = parseInt(process.env.REACTION_COOLDOWN) || 300000;
            
            if (!xpTracker.isOnCooldown(cooldownKey, cooldown)) {
                xpTracker.setCooldown(cooldownKey);
                await xpTracker.awardXP(user.id, reaction.message.guild.id, null, 'reaction', user);
            }
        } catch (error) {
            console.error('[REACTION XP] Error awarding XP:', error);
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

// ✅ CRITICAL FIX: Enhanced graceful shutdown with XP tracker cleanup
async function gracefulShutdown() {
    console.log('🛑 Shutting down bot gracefully...');
    
    try {
        // ✅ CRITICAL FIX: Clean up XP tracker with safety checks
        if (xpTracker && typeof xpTracker.cleanup === 'function') {
            console.log('🧹 Cleaning up XP tracker...');
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

// ✅ CRITICAL FIX: Enhanced status logging with XP system status
setInterval(() => {
    if (DEBUG) {
        const activeSessions = (xpTracker && xpTracker.voiceSessions) ? 
            xpTracker.voiceSessions.size : 0;
        const xpSystemStatus = isXPSystemReady() ? '✅ Ready' : '⚠️ Not Ready';
        
        console.log(`🏴‍☠️ Bot Status - Guilds: ${client.guilds.cache.size}, Active Voice Sessions: ${activeSessions}, XP System: ${xpSystemStatus}, Uptime: ${Math.floor(process.uptime()/60)}m`);
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
module.exports = { client, db, xpBoostManager, isXPSystemReady };

// Start the bot
startBot();
