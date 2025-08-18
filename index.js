const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CREATE_CHANNEL_NAME = process.env.CREATE_CHANNEL_NAME || '🏴〢Set Sail Together';
const DEFAULT_CATEGORY_NAME = process.env.CATEGORY_NAME || '✘ SOCIAL ✘';
const CATEGORY_ID = process.env.CATEGORY_ID;
const DELETE_DELAY = parseInt(process.env.DELETE_DELAY) || 1000;
const DEBUG = process.env.DEBUG === 'true';

// Global variables
let pool;
let xpTracker;
let xpBoostManager;
let dailyQuests;

// Initialize database connection
async function initializeConnection() {
    if (process.env.DATABASE_URL) {
        log('🚂 Connecting to Railway PostgreSQL...');
        pool = new Pool({
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
        
        log('🗄️ Connecting to PostgreSQL with manual config...');
        pool = new Pool(config);
    }
    
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        log(`✅ PostgreSQL connected successfully at ${result.rows[0].now}`);
        client.release();
    } catch (error) {
        log(`❌ PostgreSQL connection failed: ${error.message}`);
        throw error;
    }
}

// One Piece themed channel names
const CREW_NAMES = [
    '🐠 Fish-Man Island', '🏝️ Skypiea Adventure', '🌸 Sakura Kingdom', '🏜️ Alabasta Palace',
    '🌋 Punk Hazard Lab', '🍭 Whole Cake Island', '🌺 Wano Country', '⚡ Thriller Bark',
    '🗿 Jaya Island', '🌊 Water 7 Docks', '🔥 Marineford War', '🏴‍☠️ Thousand Sunny',
    '⚓ Going Merry', '🦈 Arlong Park', '🎪 Buggy\'s Circus', '🍖 Baratie Restaurant',
    '📚 Ohara Library', '🌙 Zou Elephant', '⚔️ Dressrosa Colosseum', '🎭 Sabaody Archipelago',
    '🌟 Reverse Mountain', '🐉 Kaido\'s Lair', '🍃 Amazon Lily', '❄️ Drum Island',
    '🔱 Fishman District', '🌈 Long Ring Island', '🏰 Enies Lobby', '🌺 Rusukaina Island',
    '🔥 Ace\'s Adventure', '⚡ Enel\'s Ark'
];

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

// Helper functions
function log(message) {
    console.log(`🏴‍☠️ ${message}`);
}

function debugLog(message) {
    if (DEBUG) {
        console.log(`🔍 DEBUG: ${message}`);
    }
}

function getRandomCrewName() {
    return CREW_NAMES[Math.floor(Math.random() * CREW_NAMES.length)];
}

// Enhanced database initialization with daily system tables
async function initializeDatabase() {
    try {
        log('🔧 Starting auto-initialization of database...');
        
        // 1. Create guild_settings table
        log('📊 Creating guild_settings table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(255) PRIMARY KEY,
                category_id VARCHAR(255),
                category_name VARCHAR(255),
                levelup_channel VARCHAR(255),
                levelup_enabled BOOLEAN DEFAULT true,
                xp_log_channel VARCHAR(255),
                xp_log_enabled BOOLEAN DEFAULT false,
                xp_multiplier DECIMAL(3,2) DEFAULT 1.0,
                excluded_role VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 2. Create user_levels table for XP tracking
        log('👥 Creating user_levels table...');
        await pool.query(`
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
        
        // 3. Create daily_voice_xp table for daily caps
        log('📅 Creating daily_voice_xp table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_voice_xp (
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                date DATE NOT NULL,
                total_xp INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, guild_id, date)
            )
        `);
        
        // 4. Create xp_boosts table for role multipliers
        log('🚀 Creating xp_boosts table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS xp_boosts (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(20) NOT NULL,
                role_id VARCHAR(20) NOT NULL,
                boost_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0,
                boost_name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(guild_id, role_id)
            )
        `);

        // 5. Create daily_buffs table for spin wheel results
        log('🎰 Creating daily_buffs table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_buffs (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                date DATE NOT NULL,
                tier INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, guild_id, date)
            )
        `);

        // 6. Create daily_quests table
        log('📋 Creating daily_quests table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_quests (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                date DATE NOT NULL,
                quest_type VARCHAR(50) NOT NULL,
                target INTEGER NOT NULL,
                progress INTEGER DEFAULT 0,
                xp_reward INTEGER NOT NULL,
                completed BOOLEAN DEFAULT false,
                completed_at TIMESTAMP NULL,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, guild_id, date, quest_type)
            )
        `);

        // 7. Create daily_quest_completions table
        log('🏆 Creating daily_quest_completions table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_quest_completions (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                guild_id VARCHAR(20) NOT NULL,
                date DATE NOT NULL,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                tier_role_awarded BOOLEAN DEFAULT false,
                UNIQUE(user_id, guild_id, date)
            )
        `);
        
        // 8. Create performance indexes
        log('⚡ Creating database indexes for performance...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_user_levels_guild_xp ON user_levels(guild_id, total_xp DESC)',
            'CREATE INDEX IF NOT EXISTS idx_user_levels_guild_level ON user_levels(guild_id, level DESC)',
            'CREATE INDEX IF NOT EXISTS idx_daily_voice_xp_date ON daily_voice_xp(date)',
            'CREATE INDEX IF NOT EXISTS idx_xp_boosts_guild_role ON xp_boosts(guild_id, role_id)',
            'CREATE INDEX IF NOT EXISTS idx_daily_buffs_date ON daily_buffs(date)',
            'CREATE INDEX IF NOT EXISTS idx_daily_quests_user_date ON daily_quests(user_id, guild_id, date)',
            'CREATE INDEX IF NOT EXISTS idx_daily_quest_completions_date ON daily_quest_completions(date)'
        ];
        
        for (const indexQuery of indexes) {
            try {
                await pool.query(indexQuery);
                debugLog('✅ Index created/verified');
            } catch (error) {
                debugLog(`ℹ️ Index might already exist: ${error.message}`);
            }
        }
        
        // 9. Clean up old data (maintain performance)
        try {
            const cleanupResult = await pool.query(
                "DELETE FROM daily_voice_xp WHERE date < CURRENT_DATE - INTERVAL '7 days'"
            );
            if (cleanupResult.rowCount > 0) {
                log(`🗑️ Cleaned up ${cleanupResult.rowCount} old daily XP records`);
            }
        } catch (cleanupError) {
            debugLog('ℹ️ No old records to clean up');
        }
        
        log('✅ Database auto-initialization completed successfully!');
        
    } catch (error) {
        console.error('❌ Critical error in database initialization:', error);
        throw new Error('Database initialization failed - please check connection');
    }
}

// Initialize enhanced XP system with daily features - FIXED
async function initializeXP() {
    try {
        // Check if database is available first
        if (!pool) {
            console.error('[XP INIT] Database pool not available');
            return;
        }

        // Test database connection
        try {
            await pool.query('SELECT NOW()');
            console.log('[XP INIT] Database connection verified');
        } catch (dbError) {
            console.error('[XP INIT] Database connection failed:', dbError);
            return;
        }

        // Initialize XP Tracker with database
        const XPTracker = require('./src/utils/xpTracker');
        xpTracker = new XPTracker(client, pool);
        global.xpTracker = xpTracker;
        console.log('⏱️ XP Tracker initialized successfully');
        
        // Initialize XP Boost Manager with database
        const XPBoostManager = require('./src/utils/xpBoost');
        xpBoostManager = new XPBoostManager(pool);
        global.xpBoostManager = xpBoostManager;
        console.log('🚀 XP Boost Manager initialized successfully');

        // Initialize Daily Quests System
        const DailyQuests = require('./src/utils/dailyQuests');
        dailyQuests = new DailyQuests(pool, client);
        global.dailyQuests = dailyQuests;
        console.log('📋 Daily Quests System initialized successfully');
        
        // Start voice XP processing
        setInterval(async () => {
            if (xpTracker && typeof xpTracker.processVoiceXP === 'function') {
                try {
                    await xpTracker.processVoiceXP();
                } catch (error) {
                    console.error('[VOICE XP] Error in processing:', error);
                }
            }
        }, 60000); // Every 60 seconds
        
        // Daily cleanup at 3 AM EST
        setInterval(async () => {
            if (xpTracker && typeof xpTracker.cleanupDailyVoiceXP === 'function') {
                try {
                    await xpTracker.cleanupDailyVoiceXP();
                } catch (error) {
                    console.error('[DAILY CLEANUP] Error:', error);
                }
            }
            if (dailyQuests && typeof dailyQuests.cleanupDailyQuests === 'function') {
                try {
                    await dailyQuests.cleanupDailyQuests();
                } catch (error) {
                    console.error('[QUEST CLEANUP] Error:', error);
                }
            }
        }, 24 * 60 * 60 * 1000); // Every 24 hours
        
        console.log('[XP INIT] ✅ Full XP system initialization complete');
        console.log('[XP INIT] - Voice XP processing: Every 60 seconds');
        console.log('[XP INIT] - Daily cleanup: Every 24 hours');
        console.log('[XP INIT] - Daily quests: Active with 3 AM EST reset');
        console.log('[XP INIT] - Daily buffs: Active with spin wheel system');
        
    } catch (error) {
        console.error('⚠️ XP System initialization failed:', error.message);
        console.log('🚢 Bot will run with limited XP functionality');
        
        // Set globals to null so other parts know XP system isn't available
        global.xpTracker = null;
        global.xpBoostManager = null;
        global.dailyQuests = null;
    }
}

async function getCategoryForGuild(guildId) {
    try {
        const result = await pool.query(`
            SELECT category_id, category_name 
            FROM guild_settings 
            WHERE guild_id = $1
        `, [guildId]);
        
        if (result.rows.length > 0) {
            return {
                categoryId: result.rows[0].category_id,
                categoryName: result.rows[0].category_name
            };
        }
        return null;
    } catch (error) {
        console.error('❌ Error getting category from database:', error);
        return null;
    }
}

async function updateCategoryForGuild(guildId, categoryId, categoryName) {
    try {
        await pool.query(`
            INSERT INTO guild_settings (guild_id, category_id, category_name, updated_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (guild_id) 
            DO UPDATE SET 
                category_id = EXCLUDED.category_id,
                category_name = EXCLUDED.category_name,
                updated_at = CURRENT_TIMESTAMP
        `, [guildId, categoryId, categoryName]);
        debugLog(`📝 Updated category for guild ${guildId}: ${categoryName} (${categoryId})`);
    } catch (error) {
        console.error('❌ Error updating category in database:', error);
    }
}

// Function to sync channel permissions with category
async function syncChannelWithCategory(channel, category, creatorId) {
    try {
        const categoryPermissions = category.permissionOverwrites.cache;
        const channelPermissions = [];
        
        categoryPermissions.forEach((overwrite) => {
            channelPermissions.push({
                id: overwrite.id,
                allow: overwrite.allow,
                deny: overwrite.deny,
                type: overwrite.type
            });
        });
        
        const creatorPermissionExists = channelPermissions.find(perm => perm.id === creatorId);
        if (creatorPermissionExists) {
            creatorPermissionExists.allow = creatorPermissionExists.allow.add([
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
            ]);
        } else {
            channelPermissions.push({
                id: creatorId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.Connect,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.MoveMembers,
                    PermissionFlagsBits.MuteMembers,
                    PermissionFlagsBits.DeafenMembers
                ],
                type: 1
            });
        }
        
        await channel.permissionOverwrites.set(channelPermissions);
        debugLog(`🔐 Synced permissions for ${channel.name} with category ${category.name}`);
    } catch (error) {
        console.error('❌ Error syncing channel permissions:', error);
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

// Bot ready event
client.once('ready', async () => {
    log(`Marine Intelligence Bot is ready for surveillance!`);
    log(`⚓ Logged in as ${client.user.tag}`);
    log(`🏴‍☠️ Monitoring ${client.guilds.cache.size} server(s) for criminal activity`);
    
    if (CATEGORY_ID) {
        log(`🎯 Using direct category ID: ${CATEGORY_ID}`);
    } else {
        log(`📁 Using dynamic category management`);
    }
    
    try {
        await initializeConnection();
        await initializeDatabase();
        await initializeXP();
        
        if (CLIENT_ID) {
            await registerSlashCommands(CLIENT_ID, DISCORD_TOKEN);
        }
        
        const result = await pool.query('SELECT NOW()');
        log(`⏰ Database time: ${result.rows[0].now}`);
        log('🗄️ Database connection test successful!');
        log('⚓ Marine Intelligence System fully operational!');
        log('🎯 Ready to track criminal bounties and XP!');
        log('🎰 Daily buff system active!');
        log('📋 Daily quest system active!');
        
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        console.error('❌ Bot will shut down due to error');
        process.exit(1);
    }
});

// Voice state update handler
client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id;
    const member = newState.member;
    const guildId = newState.guild.id;

    try {
        // Handle voice time tracking with XP system
        if (xpTracker && typeof xpTracker.handleVoiceStateUpdate === 'function') {
            await xpTracker.handleVoiceStateUpdate(oldState, newState);
        }

        // Update quest progress for voice activities
        if (dailyQuests && newState.channelId && !oldState.channelId) {
            // User joined voice - update voice_sessions quest
            await dailyQuests.updateQuestProgress(userId, guildId, 'voice_sessions', 1);
        }

        // Dynamic Voice Channel Creation
        if (newState.channelId && newState.channel?.name === CREATE_CHANNEL_NAME) {
            const guild = newState.guild;
            
            if (!member.voice.channelId) {
                debugLog(`User ${member.displayName} no longer in voice, skipping channel creation`);
                return;
            }
            
            let category;
            
            if (CATEGORY_ID) {
                category = guild.channels.cache.get(CATEGORY_ID);
                if (category) {
                    debugLog(`✅ Using direct category ID: ${CATEGORY_ID} (${category.name})`);
                    await updateCategoryForGuild(guildId, category.id, category.name);
                } else {
                    console.error(`❌ Category with ID ${CATEGORY_ID} not found! Creating fallback category.`);
                }
            }
