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
const AUDIO_VOLUME = parseFloat(process.env.AUDIO_VOLUME) || 0.4;

// Global variables
let pool;
let xpTracker;
let xpBoostManager;

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

// Track audio connections
const activeConnections = new Map();

// Audio file paths - Make audio optional
const SOUNDS_DIR = path.join(__dirname, 'sounds');
const WELCOME_SOUND = path.join(SOUNDS_DIR, 'welcome.mp3'); // Changed to mp3

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

// AUTO-INITIALIZE DATABASE - Complete database setup with error recovery
async function initializeDatabase() {
    try {
        log('🔧 Starting auto-initialization of database...');
        
        // 1. Create guild_settings table with ALL required columns
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
        
        // 2. Auto-fix missing columns with robust error handling
        log('🔧 Checking and adding missing columns...');
        const columnUpdates = [
            { column: 'category_id', type: 'VARCHAR(255)', description: 'Voice category tracking' },
            { column: 'category_name', type: 'VARCHAR(255)', description: 'Voice category name' },
            { column: 'levelup_channel', type: 'VARCHAR(255)', description: 'Level up announcements' },
            { column: 'levelup_enabled', type: 'BOOLEAN', default: 'true', description: 'Level up toggle' },
            { column: 'xp_log_channel', type: 'VARCHAR(255)', description: 'XP activity logs' },
            { column: 'xp_log_enabled', type: 'BOOLEAN', default: 'false', description: 'XP log toggle' },
            { column: 'xp_multiplier', type: 'DECIMAL(3,2)', default: '1.0', description: 'Global XP multiplier' },
            { column: 'excluded_role', type: 'VARCHAR(255)', description: 'Pirate King role exclusion' },
            { column: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP', description: 'Record creation' },
            { column: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP', description: 'Record updates' }
        ];
        
        for (const col of columnUpdates) {
            try {
                let alterQuery = `ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS ${col.column} ${col.type}`;
                if (col.default) {
                    alterQuery += ` DEFAULT ${col.default}`;
                }
                
                await pool.query(alterQuery);
                debugLog(`✅ Column ${col.column} verified/added (${col.description})`);
            } catch (error) {
                if (error.code === '42701') {
                    debugLog(`ℹ️ Column ${col.column} already exists`);
                } else {
                    console.warn(`⚠️ Issue with column ${col.column}:`, error.message);
                }
            }
        }
        
        // 3. Create user_levels table for XP tracking
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
        
        // 4. Create daily_voice_xp table for daily caps
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
        
        // 5. Create xp_boosts table for role multipliers
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
        
        // 6. Create performance indexes
        log('⚡ Creating database indexes for performance...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_user_levels_guild_xp ON user_levels(guild_id, total_xp DESC)',
            'CREATE INDEX IF NOT EXISTS idx_user_levels_guild_level ON user_levels(guild_id, level DESC)',
            'CREATE INDEX IF NOT EXISTS idx_daily_voice_xp_date ON daily_voice_xp(date)',
            'CREATE INDEX IF NOT EXISTS idx_xp_boosts_guild_role ON xp_boosts(guild_id, role_id)'
        ];
        
        for (const indexQuery of indexes) {
            try {
                await pool.query(indexQuery);
                debugLog('✅ Index created/verified');
            } catch (error) {
                debugLog(`ℹ️ Index might already exist: ${error.message}`);
            }
        }
        
        // 7. Verify table structure
        const tableCheck = await pool.query(`
            SELECT table_name, column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name IN ('guild_settings', 'user_levels', 'daily_voice_xp', 'xp_boosts')
            ORDER BY table_name, ordinal_position
        `);
        
        log(`📋 Database verification: ${tableCheck.rows.length} columns across 4 tables`);
        
        // 8. Clean up old data (maintain performance)
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
        log('🎯 All tables, columns, and indexes are ready');
        
    } catch (error) {
        console.error('❌ Critical error in database initialization:', error);
        
        // Emergency fallback - try to create minimal structure
        try {
            log('🆘 Attempting emergency database recovery...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS guild_settings (
                    guild_id VARCHAR(255) PRIMARY KEY,
                    category_id VARCHAR(255),
                    category_name VARCHAR(255)
                )
            `);
            log('✅ Emergency database structure created');
        } catch (emergencyError) {
            console.error('💥 Emergency database creation failed:', emergencyError);
            throw new Error('Database initialization completely failed - please check connection');
        }
    }
}

async function getCategoryForGuild(guildId) {
    try {
        // Enhanced error handling for missing columns
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
        if (error.code === '42703') { // Column does not exist
            console.warn('⚠️ Database column missing - auto-fixing...');
            try {
                // Auto-fix missing columns
                await pool.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS category_id VARCHAR(255)');
                await pool.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS category_name VARCHAR(255)');
                log('✅ Auto-fixed missing database columns');
                // Retry the query
                return await getCategoryForGuild(guildId);
            } catch (fixError) {
                console.error('❌ Could not auto-fix database:', fixError);
                return null;
            }
        } else {
            console.error('❌ Error getting category from database:', error);
            return null;
        }
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
        if (error.code === '42703') { // Column does not exist
            console.warn('⚠️ Database column missing during update - auto-fixing...');
            try {
                // Auto-fix and retry
                await pool.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS category_id VARCHAR(255)');
                await pool.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS category_name VARCHAR(255)');
                await pool.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
                log('✅ Auto-fixed missing database columns during update');
                // Retry the update
                return await updateCategoryForGuild(guildId, categoryId, categoryName);
            } catch (fixError) {
                console.error('❌ Could not auto-fix database during update:', fixError);
            }
        } else {
            console.error('❌ Error updating category in database:', error);
        }
    }
}

// Function to play welcome sound with error handling - Made optional
async function playWelcomeSound(channel) {
    try {
        // Check if audio file exists and audio is enabled
        if (!fs.existsSync(WELCOME_SOUND)) {
            debugLog(`🎵 Welcome sound file not found, skipping audio: ${WELCOME_SOUND}`);
            return;
        }

        // Check if audio is disabled
        if (process.env.DISABLE_AUDIO === 'true') {
            debugLog('🎵 Audio disabled by configuration');
            return;
        }

        log(`🎵 Joining ${channel.name} for welcome sound...`);
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        activeConnections.set(channel.id, connection);

        const playAudio = () => {
            try {
                const player = createAudioPlayer();
                let resource;
                
                try {
                    resource = createAudioResource(WELCOME_SOUND, { 
                        inlineVolume: true,
                        inputType: 'arbitrary'
                    });
                } catch (ffmpegError) {
                    console.warn(`⚠️ FFmpeg issue, trying alternative:`, ffmpegError.message);
                    try {
                        resource = createAudioResource(WELCOME_SOUND);
                    } catch (fallbackError) {
                        console.error(`❌ Audio creation failed:`, fallbackError);
                        connection.destroy();
                        activeConnections.delete(channel.id);
                        return;
                    }
                }
                
                if (resource.volume) {
                    resource.volume.setVolume(AUDIO_VOLUME);
                }

                player.play(resource);
                connection.subscribe(player);
                log(`🎵 ✅ Playing welcome sound in ${channel.name}!`);

                player.on(AudioPlayerStatus.Idle, () => {
                    log(`🎵 Welcome sound finished, leaving ${channel.name}`);
                    if (activeConnections.has(channel.id)) {
                        const conn = activeConnections.get(channel.id);
                        conn.destroy();
                        activeConnections.delete(channel.id);
                    }
                });

                player.on('error', error => {
                    console.error(`❌ Audio error in ${channel.name}:`, error);
                    if (activeConnections.has(channel.id)) {
                        const conn = activeConnections.get(channel.id);
                        conn.destroy();
                        activeConnections.delete(channel.id);
                    }
                });
            } catch (audioError) {
                console.error(`❌ Audio setup error:`, audioError);
                connection.destroy();
                activeConnections.delete(channel.id);
            }
        };

        connection.on(VoiceConnectionStatus.Ready, () => {
            log(`✅ Connected to ${channel.name}, starting audio...`);
            playAudio();
        });

        connection.on(VoiceConnectionStatus.Disconnected, () => {
            activeConnections.delete(channel.id);
            debugLog(`🔌 Disconnected from ${channel.name}`);
        });

        connection.on('error', error => {
            console.error(`❌ Connection error in ${channel.name}:`, error);
            activeConnections.delete(channel.id);
        });

        setTimeout(() => {
            if (activeConnections.has(channel.id)) {
                const conn = activeConnections.get(channel.id);
                if (conn.state.status !== VoiceConnectionStatus.Ready) {
                    log(`⚠️ Connection timeout for ${channel.name}`);
                    conn.destroy();
                    activeConnections.delete(channel.id);
                }
            }
        }, 5000);

    } catch (error) {
        console.error(`❌ Error joining ${channel.name}:`, error);
        if (activeConnections.has(channel.id)) {
            const conn = activeConnections.get(channel.id);
            conn.destroy();
            activeConnections.delete(channel.id);
        }
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

// Initialize XP system
async function initializeXP() {
    try {
        const XPTracker = require('./src/utils/xpTracker');
        xpTracker = new XPTracker(client, pool);
        global.xpTracker = xpTracker;
        log(`⏱️ XP Tracker initialized successfully`);
        
        const XPBoostManager = require('./src/utils/xpBoost');
        xpBoostManager = new XPBoostManager(pool);
        global.xpBoostManager = xpBoostManager;
        log(`🚀 XP Boost Manager initialized successfully`);
        
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
        console.warn('⚠️ XP System not available:', error.message);
        log('🚢 Bot will run without XP tracking');
    }
}

// Bot ready event
client.once('ready', async () => {
    log(`One Piece Dynamic Voice Bot with XP System is ready to set sail!`);
    log(`⚓ Logged in as ${client.user.tag}`);
    log(`🏴‍☠️ Serving ${client.guilds.cache.size} server(s)`);
    log(`🔊 Audio Volume: ${Math.round(AUDIO_VOLUME * 100)}%`);
    
    if (fs.existsSync(WELCOME_SOUND)) {
        const stats = fs.statSync(WELCOME_SOUND);
        log(`🎵 Welcome sound ready: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
        console.warn(`⚠️ Welcome sound not found at: ${WELCOME_SOUND}`);
        log(`🎵 Audio features disabled - no welcome sound file`);
    }
    
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
        log('🎯 All systems initialized and ready!');
        
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
        if (xpTracker && xpTracker.handleVoiceStateUpdate) {
            await xpTracker.handleVoiceStateUpdate(oldState, newState);
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
            
            if (!category) {
                let savedCategory = await getCategoryForGuild(guildId);
                
                if (savedCategory) {
                    category = guild.channels.cache.get(savedCategory.categoryId);
                    if (!category) {
                        category = guild.channels.cache.find(c => 
                            c.name === savedCategory.categoryName && c.type === ChannelType.GuildCategory
                        );
                        
                        if (category) {
                            await updateCategoryForGuild(guildId, category.id, category.name);
                            log(`🔄 Category ID updated: ${savedCategory.categoryName}`);
                        }
                    }
                }
                
                if (!category) {
                    debugLog(`Category not found, creating new one: ${DEFAULT_CATEGORY_NAME}`);
                    category = await guild.channels.create({
                        name: DEFAULT_CATEGORY_NAME,
                        type: ChannelType.GuildCategory,
                    });
                    
                    await updateCategoryForGuild(guildId, category.id, category.name);
                    log(`📁 Created and saved new category: ${DEFAULT_CATEGORY_NAME}`);
                }
            }

            const crewName = getRandomCrewName();
            const newChannel = await guild.channels.create({
                name: crewName,
                type: ChannelType.GuildVoice,
                parent: category.id,
            });

            await syncChannelWithCategory(newChannel, category, member.id);

            if (newChannel.parentId !== category.id) {
                try {
                    await newChannel.setParent(category.id);
                    debugLog(`🔧 Manually moved ${crewName} to category ${category.name}`);
                } catch (moveError) {
                    console.error(`❌ Error moving channel to category:`, moveError);
                }
            }

            log(`🚢 Created new crew: ${crewName} for ${member.displayName}`);
            log(`👑 ${member.displayName} is now captain of ${crewName}`);

            try {
                if (member.voice.channelId) {
                    await member.voice.setChannel(newChannel);
                    debugLog(`✅ Successfully moved ${member.displayName} to ${crewName}`);
                    
                    // Play welcome sound with delay - only if audio is available
                    setTimeout(() => {
                        playWelcomeSound(newChannel).catch(error => {
                            debugLog(`⚠️ Could not play welcome sound: ${error.message}`);
                        });
                    }, 1500);
                    
                } else {
                    debugLog(`User ${member.displayName} disconnected before move, cleaning up channel`);
                    setTimeout(async () => {
                        try {
                            if (newChannel.members.size === 0) {
                                await newChannel.delete();
                                debugLog(`🗑️ Cleaned up unused crew: ${crewName}`);
                            }
                        } catch (cleanupError) {
                            console.error(`❌ Error cleaning up channel:`, cleanupError);
                        }
                    }, 1000);
                }
            } catch (moveError) {
                console.error(`❌ Error moving user to new channel:`, moveError);
                setTimeout(async () => {
                    try {
                        if (newChannel.members.size === 0) {
                            await newChannel.delete();
                            debugLog(`🗑️ Cleaned up failed crew: ${crewName}`);
                        }
                    } catch (cleanupError) {
                        console.error(`❌ Error cleaning up channel:`, cleanupError);
                    }
                }, 1000);
            }
        }

        // Auto-delete empty dynamic channels
        if (oldState.channelId) {
            const oldChannel = oldState.channel;
            const savedCategory = await getCategoryForGuild(guildId);
            const categoryName = savedCategory ? savedCategory.categoryName : DEFAULT_CATEGORY_NAME;
            
            if (oldChannel && 
                oldChannel.name !== CREATE_CHANNEL_NAME && 
                oldChannel.parent?.name === categoryName &&
                oldChannel.members.size === 0) {
                
                debugLog(`🕐 Scheduling deletion of empty crew: ${oldChannel.name} in ${DELETE_DELAY}ms`);
                
                if (activeConnections.has(oldChannel.id)) {
                    const connection = activeConnections.get(oldChannel.id);
                    connection.destroy();
                    activeConnections.delete(oldChannel.id);
                    debugLog(`🔌 Cleaned up voice connection for ${oldChannel.name}`);
                }
                
                setTimeout(async () => {
                    try {
                        const channelToDelete = oldChannel.guild.channels.cache.get(oldChannel.id);
                        if (channelToDelete && channelToDelete.members.size === 0) {
                            await channelToDelete.delete();
                            log(`🗑️ Deleted empty crew: ${oldChannel.name}`);
                        } else {
                            debugLog(`👥 Crew ${oldChannel.name} no longer empty, keeping it`);
                        }
                    } catch (error) {
                        console.error(`❌ Error deleting channel ${oldChannel.name}:`, error);
                    }
                }, DELETE_DELAY);
            }
        }

    } catch (error) {
        console.error('❌ Error in voiceStateUpdate:', error);
    }
});

// Handle category moves
client.on('channelUpdate', async (oldChannel, newChannel) => {
    try {
        if (newChannel.type === ChannelType.GuildCategory) {
            const guildId = newChannel.guild.id;
            const savedCategory = await getCategoryForGuild(guildId);
            
            if (savedCategory && savedCategory.categoryId === newChannel.id) {
                if (savedCategory.categoryName !== newChannel.name) {
                    await updateCategoryForGuild(guildId, newChannel.id, newChannel.name);
                    log(`📁 Category renamed and synced: ${savedCategory.categoryName} → ${newChannel.name}`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error handling category update:', error);
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
        message.reply(`🏴‍☠️ **One Piece Voice Bot Commands - XP System Edition**

**📊 XP & Level Commands:**
\`/level [@user]\` - Check level information and bounty
\`/leaderboard\` - Show server leaderboard with wanted posters
\`/settings\` - Configure XP settings (Admin only)
\`/admin\` - Advanced XP management (Admin only)

**🚢 Dynamic Voice Channels:**
1. Join "${CREATE_CHANNEL_NAME}" voice channel
2. Bot creates a new crew with One Piece themed name
3. You become the captain with full channel permissions
4. **Earn XP automatically while in voice channels!**
5. Empty crews are automatically deleted after ${DELETE_DELAY/1000} seconds

**⚡ XP System:**
• **Message XP**: ${process.env.MESSAGE_XP_MIN || 25}-${process.env.MESSAGE_XP_MAX || 35} per message
• **Voice XP**: ${process.env.VOICE_XP_MIN || 45}-${process.env.VOICE_XP_MAX || 55} per minute
• **Reaction XP**: ${process.env.REACTION_XP_MIN || 25}-${process.env.REACTION_XP_MAX || 35} per reaction
• **Daily Voice Cap**: ${process.env.DAILY_VOICE_XP_CAP || 1500} XP
• **Level System**: Automatic bounty progression
• **Role Rewards**: Unlock new roles at milestone levels

**🎯 Features:**
• Dynamic voice channel creation with One Piece themed names
• **Advanced XP tracking with multiple sources**
• **Marine Intelligence logging system**
• Captain permissions for channel creators
• Automatic cleanup of empty channels
• Welcome sounds with pirate theme (if available)
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

// Button interaction handler for leaderboard
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    try {
        // Handle leaderboard button interactions
        if (interaction.customId.startsWith('leaderboard_')) {
            const leaderboardCommand = require('./src/commands/leaderboard');
            if (leaderboardCommand.handleButtonInteraction) {
                await leaderboardCommand.handleButtonInteraction(interaction, xpTracker);
            }
            return;
        }
        
        // Handle admin maintenance/nuclear buttons
        if (['cleanup_inactive', 'optimize_db', 'backup_stats'].includes(interaction.customId)) {
            const adminCommand = require('./src/commands/admin');
            if (adminCommand.handleMaintenanceButtons) {
                await adminCommand.handleMaintenanceButtons(interaction, pool);
            }
            return;
        }
        
        if (['nuclear_confirm', 'nuclear_abort', 'nuclear_execute'].includes(interaction.customId)) {
            const adminCommand = require('./src/commands/admin');
            if (adminCommand.handleNuclearButtons) {
                await adminCommand.handleNuclearButtons(interaction, pool);
            }
            return;
        }
        
    } catch (error) {
        console.error('❌ Error handling button interaction:', error);
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while processing this button.',
                ephemeral: true
            }).catch(console.error);
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
    log('🛑 Shutting down bot gracefully...');
    
    try {
        // Clean up XP tracker
        if (xpTracker && xpTracker.cleanup) {
            await xpTracker.cleanup();
        }
        
        // Clean up voice connections
        log(`🔌 Cleaning up ${activeConnections.size} voice connections...`);
        activeConnections.forEach((connection, key) => {
            try {
                connection.destroy();
                debugLog(`🔌 Destroyed connection for ${key}`);
            } catch (error) {
                // Ignore errors during shutdown
            }
        });
        activeConnections.clear();
        
        // Close database connection
        log('🗄️ Closing database connection...');
        if (pool) {
            await pool.end();
        }
        
        // Destroy Discord client
        client.destroy();
        
        log('👋 Bot shutdown complete!');
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
    }
    
    process.exit(0);
}

// Keep the process alive and log status
setInterval(() => {
    if (DEBUG) {
        const activeSessions = xpTracker && xpTracker.voiceSessions ? 
            Object.keys(xpTracker.voiceSessions).length : 0;
        console.log(`🏴‍☠️ Bot Status - Guilds: ${client.guilds.cache.size}, Active Voice Sessions: ${activeSessions}, Audio Connections: ${activeConnections.size}, Uptime: ${Math.floor(process.uptime()/60)}m`);
    }
}, 300000); // Log every 5 minutes in debug mode

// Start the bot
async function startBot() {
    log('🚀 Starting One Piece Dynamic Voice Bot with XP System...');
    log(`🔑 Discord Token: ${DISCORD_TOKEN ? '✅ Provided' : '❌ MISSING'}`);
    log(`🆔 Client ID: ${CLIENT_ID ? '✅ Provided' : '❌ MISSING'}`);
    log(`🗄️ Database URL: ${process.env.DATABASE_URL ? '✅ Provided' : '❌ MISSING'}`);

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
module.exports = { client, pool };

// Start the bot
startBot();
