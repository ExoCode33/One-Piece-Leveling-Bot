const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import XP Tracker
const XPTracker = require('./src/utils/xpTracker');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User
    ]
});

// Initialize database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Make database globally accessible for commands
global.db = db;

// Test database connection
db.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('[ERROR] Database connection failed:', err);
        process.exit(1);
    } else {
        console.log('[INFO] Database connected successfully');
    }
});

// Initialize database tables
async function initializeDatabase() {
    try {
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
                excluded_role VARCHAR(20),
                levelup_channel VARCHAR(20),
                xp_multiplier DECIMAL(3,2) DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add indexes for better performance
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_user_levels_guild_xp 
            ON user_levels(guild_id, total_xp DESC)
        `);
        
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_user_levels_user_guild 
            ON user_levels(user_id, guild_id)
        `);

        console.log('[INFO] Database tables initialized successfully');
        
        // Check user count
        const userCount = await db.query('SELECT COUNT(*) FROM user_levels');
        console.log('[DEBUG] Database has', userCount.rows[0].count, 'user records');
        
    } catch (error) {
        console.error('[ERROR] Failed to initialize database:', error);
        process.exit(1);
    }
}

// Initialize XP Tracker
let xpTracker;
async function initializeXPTracker() {
    try {
        xpTracker = new XPTracker(client, db);
        global.xpTracker = xpTracker;
        console.log('[INFO] XP Tracker initialized successfully');
    } catch (error) {
        console.error('[ERROR] Failed to initialize XP Tracker:', error);
        process.exit(1);
    }
}

// Initialize guild settings
global.guildSettings = new Map();

async function loadGuildSettings() {
    try {
        const result = await db.query('SELECT * FROM guild_settings');
        for (const row of result.rows) {
            global.guildSettings.set(row.guild_id, {
                excludedRole: row.excluded_role,
                levelupChannel: row.levelup_channel,
                xpMultiplier: parseFloat(row.xp_multiplier) || 1.0
            });
        }
        console.log('[INFO] Loaded settings for', global.guildSettings.size, 'guilds');
        
        // Debug: Log each guild's settings
        for (const [guildId, settings] of global.guildSettings.entries()) {
            console.log(`[DEBUG] Guild ${guildId}: excludedRole=${settings.excludedRole}, multiplier=${settings.xpMultiplier}`);
        }
    } catch (error) {
        console.error('[ERROR] Failed to load guild settings:', error);
    }
}

// Commands collection
client.commands = new Collection();

// Load commands
function loadCommands() {
    const commandsPath = path.join(__dirname, 'src', 'commands');
    const commandFiles = fs.readdirSync(commandsPath, { recursive: true }).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log('[DEBUG] ✅ Loaded command:', command.data.name);
            } else {
                console.log('[DEBUG] ⚠️ Command missing data or execute:', file);
            }
        } catch (error) {
            console.error('[ERROR] Failed to load command', file, ':', error.message);
        }
    }
}

// Register slash commands
async function registerCommands() {
    const commands = [];
    client.commands.forEach(command => {
        commands.push(command.data.toJSON());
    });

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    try {
        // Use the bot's own application ID (most reliable)
        const applicationId = client.application?.id;
        
        if (!applicationId) {
            console.error('[ERROR] Could not get bot application ID. Make sure bot is ready.');
            return;
        }

        console.log(`[DEBUG] Registering ${commands.length} slash commands:`, commands.map(c => c.name).join(', '));
        console.log(`[DEBUG] Using bot application ID: ${applicationId}`);
        
        await rest.put(
            Routes.applicationCommands(applicationId),
            { body: commands }
        );

        console.log(`[INFO] Successfully registered ${commands.length} slash commands`);
    } catch (error) {
        console.error('[ERROR] Failed to register slash commands:', error);
    }
}

// Client ready event
client.once('ready', async () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    
    // Initialize everything
    await initializeDatabase();
    await loadGuildSettings();
    await initializeXPTracker();
    
    // Load and register commands
    loadCommands();
    await registerCommands();
    
    // Start voice XP processing (runs every 60 seconds)
    setInterval(() => {
        if (global.xpTracker) {
            global.xpTracker.processVoiceXP().catch(console.error);
        }
    }, 60000);

    // Daily cleanup for voice XP caps (runs every 24 hours)
    setInterval(() => {
        if (global.xpTracker) {
            global.xpTracker.cleanupDailyVoiceXP();
            console.log('[INFO] Daily voice XP cap cleanup completed');
        }
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

    // Initial cleanup on startup
    if (global.xpTracker) {
        global.xpTracker.cleanupDailyVoiceXP();
    }
    
    console.log('[INFO] Discord Leveling Bot is fully operational!');
    console.log(`[INFO] Bot is in ${client.guilds.cache.size} servers`);
    console.log(`[INFO] Monitoring ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} total members`);
    
    // Log daily voice XP cap setting
    const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
    console.log(`[INFO] Daily voice XP cap: ${dailyCap} XP per user`);
});

// Message event for XP tracking
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    
    if (global.xpTracker) {
        try {
            await global.xpTracker.handleMessageXP(message);
        } catch (error) {
            console.error('[ERROR] Message XP tracking failed:', error);
        }
    }
});

// Reaction events for XP tracking
client.on('messageReactionAdd', async (reaction, user) => {
    if (!reaction.message.guild || user.bot) return;
    
    if (global.xpTracker) {
        try {
            await global.xpTracker.handleReactionXP(reaction, user);
        } catch (error) {
            console.error('[ERROR] Reaction XP tracking failed:', error);
        }
    }
});

// Voice state update for XP tracking
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (global.xpTracker) {
        try {
            await global.xpTracker.handleVoiceStateUpdate(oldState, newState);
        } catch (error) {
            console.error('[ERROR] Voice XP tracking failed:', error);
        }
    }
});

// Slash command interaction handler (UPDATED)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        // Pass additional parameters that commands might need
        await command.execute(interaction, client, global.xpTracker);
    } catch (error) {
        console.error(`[ERROR] Error executing command ${interaction.commandName}:`, error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Command Error')
            .setDescription('There was an error executing this command.')
            .setColor('#FF0000')
            .setTimestamp();

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
        }
    }
});

// Button interaction handler for leaderboard navigation
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // Handle leaderboard button interactions
    if (interaction.customId.startsWith('leaderboard_')) {
        const command = client.commands.get('leaderboard');
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('[ERROR] Button interaction failed:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to process button interaction.')
                .setColor('#FF0000');

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
            }
        }
    }
});

// Guild join event
client.on('guildCreate', async (guild) => {
    console.log(`[INFO] Joined new guild: ${guild.name} (${guild.memberCount} members)`);
    
    // Initialize default settings for new guild
    try {
        await db.query(
            `INSERT INTO guild_settings (guild_id, xp_multiplier) 
             VALUES ($1, $2) 
             ON CONFLICT (guild_id) DO NOTHING`,
            [guild.id, 1.0]
        );
        
        global.guildSettings.set(guild.id, {
            excludedRole: null,
            levelupChannel: null,
            xpMultiplier: 1.0
        });
        
        console.log(`[INFO] Initialized settings for new guild: ${guild.name}`);
    } catch (error) {
        console.error('[ERROR] Failed to initialize settings for new guild:', error);
    }
});

// Guild leave event
client.on('guildDelete', (guild) => {
    console.log(`[INFO] Left guild: ${guild.name}`);
    global.guildSettings.delete(guild.id);
});

// Enhanced error handling with more context
process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit on unhandled rejections to keep bot running
});

process.on('uncaughtException', (error) => {
    console.error('[ERROR] Uncaught Exception:', error);
    // Log the error but try to restart gracefully
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// Enhanced graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`[INFO] Received ${signal}, shutting down gracefully...`);
    
    try {
        // Stop processing new voice XP
        if (global.xpTracker) {
            console.log('[INFO] Stopping XP tracker...');
        }
        
        // Close Discord connection
        if (client) {
            console.log('[INFO] Closing Discord connection...');
            await client.destroy();
        }
        
        // Close database connection
        if (db) {
            console.log('[INFO] Closing database connection...');
            await db.end();
        }
        
        console.log('[INFO] Graceful shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Enhanced startup validation
function validateEnvironment() {
    const required = ['DISCORD_TOKEN', 'DATABASE_URL'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('[ERROR] Missing required environment variables:', missing.join(', '));
        process.exit(1);
    }
    
    console.log('[INFO] Environment validation passed');
}

// Connection monitoring
db.on('error', (err) => {
    console.error('[ERROR] Database connection error:', err);
});

client.on('error', (error) => {
    console.error('[ERROR] Discord client error:', error);
});

client.on('warn', (warning) => {
    console.warn('[WARN] Discord client warning:', warning);
});

// Rate limiting handling
client.on('rateLimit', (rateLimitData) => {
    console.warn('[WARN] Rate limit hit:', {
        timeout: rateLimitData.timeout,
        limit: rateLimitData.limit,
        method: rateLimitData.method,
        path: rateLimitData.path,
        route: rateLimitData.route
    });
});

// Login to Discord with validation
async function startBot() {
    try {
        console.log('[INFO] Starting Discord Leveling Bot...');
        
        // Validate environment
        validateEnvironment();
        
        // Login to Discord
        await client.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('[ERROR] Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the bot
startBot();
