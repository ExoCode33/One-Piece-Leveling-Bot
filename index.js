// index.js - Discord Leveling Bot with Clean Modular Structure

const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();

const XPTracker = require('./src/utils/xpTracker');
const { sendXPLog } = require('./src/utils/xpLogger');

// Import commands
const levelCommand = require('./src/commands/level');
const leaderboardCommand = require('./src/commands/leaderboard');
const adminCommand = require('./src/commands/admin');

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

client.commands = new Collection();
client.db = db;

const xpTracker = new XPTracker(client, db);

client.commands.set('level', levelCommand);
client.commands.set('leaderboard', leaderboardCommand);
client.commands.set('settings', adminCommand);

// === Database Initialization (with migrations) ===
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
        // Patch for missing "rep" column in user_levels
        await db.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='user_levels' AND column_name='rep'
            ) THEN
                ALTER TABLE user_levels ADD COLUMN rep INTEGER DEFAULT 0;
            END IF;
        END$$;
        `);

        console.log('[INFO] Database tables initialized successfully');
        if (process.env.DEBUG_DATABASE === 'true') {
            const userCount = await db.query('SELECT COUNT(*) FROM user_levels');
            console.log(`[DEBUG] Database has ${userCount.rows[0].count} user records`);
        }
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// === Event Handlers ===

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isButton()) return;
    try {
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction, client, xpTracker);
        }
        // Handle button interactions for leaderboard pagination
        if (interaction.isButton() && interaction.customId.startsWith('leaderboard_')) {
            const parts = interaction.customId.split('_');
            const view = parts[1]; // 'short' or 'long'
            const page = parseInt(parts[2]) || 1;
            const type = parts[3] || 'xp';
            await interaction.deferUpdate();
            // Mock interaction for leaderboard command
            const mockInteraction = {
                ...interaction,
                deferReply: async () => {},
                editReply: async (options) => await interaction.editReply(options),
                reply: async (options) => await interaction.editReply(options),
                options: {
                    getString: (name) => {
                        if (name === 'view') return view;
                        if (name === 'type') return type;
                        return null;
                    },
                    getInteger: (name) => name === 'page' ? page : null
                }
            };
            const leaderboardCommand = client.commands.get('leaderboard');
            if (leaderboardCommand) {
                await leaderboardCommand.execute(mockInteraction, client, xpTracker);
            }
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
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

client.on('messageCreate', async message => {
    try {
        await xpTracker.handleMessageXP(message);
    } catch (e) {
        console.error(e);
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    try {
        await xpTracker.handleReactionXP(reaction, user);
    } catch (e) {
        console.error(e);
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        await xpTracker.handleVoiceStateUpdate(oldState, newState);
    } catch (e) {
        console.error(e);
    }
});

setInterval(async () => {
    try {
        await xpTracker.processVoiceXP();
    } catch (e) {
        console.error(e);
    }
}, 60000);

client.once('ready', async () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    await initializeDatabase();
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const commands = [
            levelCommand.data,
            leaderboardCommand.data,
            adminCommand.data
        ];
        if (process.env.DEBUG_COMMANDS === 'true') {
            console.log('[DEBUG] Registering slash commands...');
        }
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('[INFO] Slash commands registered successfully');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
    client.user.setActivity('for XP gains!', { type: 'WATCHING' });
    console.log('[INFO] Discord Leveling Bot is fully operational!');
});

client.on('error', error => {
    console.error('Discord client error:', error);
});
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

client.login(process.env.DISCORD_TOKEN);
