// index.js - Clean Discord Leveling Bot Main File

const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();

// Import our modular systems
const XPTracker = require('./src/utils/xpTracker');
const XPLogger = require('./src/utils/xpLogger');

// Import command modules
const levelCommand = require('./src/commands/level');
const adminCommand = require('./src/commands/admin');
const leaderboardCommand = require('./src/commands/leaderboard');

// === Database Setup ===
const { Pool } = require('pg');
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// === Discord Client Setup ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
});

// Initialize our XP system
const xpTracker = new XPTracker(client, db);
const logger = new XPLogger(client);

// Attach to client for command access
client.commands = new Collection();
client.db = db;
client.xpTracker = xpTracker;
client.logger = logger;

// === Register Commands ===
const commands = [levelCommand, adminCommand, leaderboardCommand];
for (const command of commands) {
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
    }
}

// === Database Initialization ===
async function initializeDatabase() {
    try {
        // Create user_levels table
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_levels (
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                total_xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 0,
                messages INTEGER DEFAULT 0,
                reactions INTEGER DEFAULT 0,
                voice_time INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (user_id, guild_id)
            )
        `);
        
        // Create voice_sessions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                channel_id VARCHAR(20) NOT NULL,
                start_time TIMESTAMP DEFAULT NOW(),
                end_time TIMESTAMP,
                duration INTEGER DEFAULT 0,
                xp_awarded INTEGER DEFAULT 0
            )
        `);
        
        // Create guild_settings table
        await db.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(20) PRIMARY KEY,
                level_roles JSONB DEFAULT '{}',
                settings JSONB DEFAULT '{}'
            )
        `);
        
        console.log('[INFO] Database tables initialized successfully');
        
        if (process.env.DEBUG_DATABASE === 'true') {
            const userCount = await db.query('SELECT COUNT(*) FROM user_levels');
            console.log(`[DEBUG] Database has ${userCount.rows[0].count} user records`);
        }
    } catch (error) {
        console.error('Error initializing database:', error);
        await logger.logError(error, 'Database initialization');
    }
}

// === Slash Command Definitions ===
const slashCommands = [
    {
        name: 'level',
        description: 'Check your or someone\'s level and stats',
        options: [
            {
                name: 'user',
                description: 'User to check (optional)',
                type: 6,
                required: false
            }
        ]
    },
    {
        name: 'leaderboard',
        description: 'Show the server leaderboard',
        options: [
            {
                name: 'page',
                description: 'Page number (default: 1)',
                type: 4,
                required: false
            },
            {
                name: 'type',
                description: 'Leaderboard type',
                type: 3,
                required: false,
                choices: [
                    { name: 'Total XP', value: 'xp' },
                    { name: 'Level', value: 'level' },
                    { name: 'Messages', value: 'messages' },
                    { name: 'Reactions', value: 'reactions' },
                    { name: 'Voice Time', value: 'voice' }
                ]
            }
        ]
    },
    {
        name: 'admin',
        description: 'Admin commands for managing the leveling system',
        options: [
            {
                name: 'settings',
                description: 'View current bot settings',
                type: 1
            },
            {
                name: 'setlevelrole',
                description: 'Set role reward for a specific level',
                type: 1,
                options: [
                    {
                        name: 'level',
                        description: 'Level number (5, 10, 15, etc.)',
                        type: 4,
                        required: true,
                        min_value: 1,
                        max_value: parseInt(process.env.MAX_LEVEL) || 50
                    },
                    {
                        name: 'role',
                        description: 'Role to assign (leave empty to remove)',
                        type: 8,
                        required: false
                    }
                ]
            },
            {
                name: 'levelroles',
                description: 'View all configured level role rewards',
                type: 1
            },
            {
                name: 'resetuser',
                description: 'Reset a user\'s XP and level',
                type: 1,
                options: [
                    {
                        name: 'user',
                        description: 'User to reset',
                        type: 6,
                        required: true
                    }
                ]
            },
            {
                name: 'addxp',
                description: 'Add XP to a user',
                type: 1,
                options: [
                    {
                        name: 'user',
                        description: 'User to give XP to',
                        type: 6,
                        required: true
                    },
                    {
                        name: 'amount',
                        description: 'Amount of XP to add',
                        type: 4,
                        required: true,
                        min_value: 1,
                        max_value: 1000000
                    }
                ]
            },
            {
                name: 'removexp',
                description: 'Remove XP from a user',
                type: 1,
                options: [
                    {
                        name: 'user',
                        description: 'User to remove XP from',
                        type: 6,
                        required: true
                    },
                    {
                        name: 'amount',
                        description: 'Amount of XP to remove',
                        type: 4,
                        required: true,
                        min_value: 1,
                        max_value: 1000000
                    }
                ]
            },
            {
                name: 'stats',
                description: 'View server leveling statistics',
                type: 1
            }
        ]
    }
];

// === Event Handlers ===

// Bot Ready Event
client.once('ready', async () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    
    // Initialize database
    await initializeDatabase();
    
    // Register slash commands
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        if (process.env.DEBUG_COMMANDS === 'true') {
            console.log('[DEBUG] Registering slash commands...');
        }
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: slashCommands }
        );
        
        console.log('[INFO] Slash commands registered successfully');
    } catch (error) {
        console.error('Error registering slash commands:', error);
        await logger.logError(error, 'Slash command registration');
    }
    
    // Set bot status
    client.user.setActivity('for XP gains!', { type: 'WATCHING' });
    
    // Start voice XP tracking loop
    startVoiceXPLoop();
    
    console.log('[INFO] Discord Leveling Bot is fully operational!');
    
    // Send startup notification to log channel
    if (process.env.XP_LOG_ENABLED === 'true') {
        await logger.sendXPLog('startup', client.user, 0, {
            message: 'Bot has started successfully',
            timestamp: new Date().toISOString()
        });
    }
});

// Slash Command Handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isButton()) return;
    
    try {
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            
            await command.execute(interaction, client);
        }
        
        // Handle button interactions for leaderboard pagination
        if (interaction.isButton() && interaction.customId.startsWith('leaderboard_')) {
            const [, type, pageStr] = interaction.customId.split('_');
            const page = parseInt(pageStr);
            
            if (!isNaN(page)) {
                // Create a mock interaction for the leaderboard command
                const mockInteraction = {
                    ...interaction,
                    options: {
                        getInteger: (name) => name === 'page' ? page : null,
                        getString: (name) => name === 'type' ? type : null
                    }
                };
                
                await interaction.deferUpdate();
                await leaderboardCommand.execute(mockInteraction, client);
            }
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        await logger.logError(error, `Interaction: ${interaction.commandName || interaction.customId}`);
        
        try {
            const errorMessage = 'An error occurred while executing this command.';
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (e) {
            console.error('Error sending error message:', e);
        }
    }
});

// XP Event Handlers - Delegated to XPTracker
client.on('messageCreate', async message => {
    try {
        await xpTracker.handleMessageXP(message);
    } catch (error) {
        await logger.logError(error, 'Message XP handling');
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    try {
        await xpTracker.handleReactionXP(reaction, user);
    } catch (error) {
        await logger.logError(error, 'Reaction XP handling');
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        await xpTracker.handleVoiceStateUpdate(oldState, newState);
    } catch (error) {
        await logger.logError(error, 'Voice state update handling');
    }
});

// Voice XP Loop
function startVoiceXPLoop() {
    setInterval(async () => {
        try {
            await xpTracker.processVoiceXP();
        } catch (error) {
            await logger.logError(error, 'Voice XP processing loop');
        }
    }, 60000); // Check every minute
}

// === Error Handling ===
client.on('error', async error => {
    console.error('Discord client error:', error);
    await logger.logError(error, 'Discord client');
});

process.on('unhandledRejection', async error => {
    console.error('Unhandled promise rejection:', error);
    await logger.logError(error, 'Unhandled promise rejection');
});

process.on('uncaughtException', async error => {
    console.error('Uncaught exception:', error);
    await logger.logError(error, 'Uncaught exception');
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[INFO] Received SIGINT, shutting down gracefully...');
    
    // Send shutdown notification
    if (process.env.XP_LOG_ENABLED === 'true') {
        await logger.sendXPLog('shutdown', client.user, 0, {
            message: 'Bot is shutting down',
            timestamp: new Date().toISOString()
        });
    }
    
    // Close database connection
    await db.end();
    
    // Destroy Discord client
    client.destroy();
    
    console.log('[INFO] Shutdown complete');
    process.exit(0);
});

// === Login ===
client.login(process.env.DISCORD_TOKEN);
