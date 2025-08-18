const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const VoiceTimeTracker = require('./voiceTimeTracker');
const { registerSlashCommands } = require('./slashCommands');

// Load environment variables
require('dotenv').config();

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CREATE_CHANNEL_NAME = process.env.CREATE_CHANNEL_NAME || '🏴〢Set Sail Together';
const DEFAULT_CATEGORY_NAME = process.env.CATEGORY_NAME || '✘ SOCIAL ✘';
const CATEGORY_ID = process.env.CATEGORY_ID; // Direct category ID override
const DELETE_DELAY = parseInt(process.env.DELETE_DELAY) || 1000;
const DEBUG = process.env.DEBUG === 'true';

// Audio Configuration
const AUDIO_VOLUME = parseFloat(process.env.AUDIO_VOLUME) || 0.4;

// PostgreSQL connection with Railway support
let pool;
let voiceTimeTracker;

async function initializeConnection() {
    // Railway PostgreSQL connection
    if (process.env.DATABASE_URL) {
        // Direct connection with DATABASE_URL (Railway style)
        log('🚂 Connecting to Railway PostgreSQL...');
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    } else {
        // Manual connection (fallback)
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
    
    // Test the connection
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
    '🐠 Fish-Man Island',
    '🏝️ Skypiea Adventure',
    '🌸 Sakura Kingdom',
    '🏜️ Alabasta Palace',
    '🌋 Punk Hazard Lab',
    '🍭 Whole Cake Island',
    '🌺 Wano Country',
    '⚡ Thriller Bark',
    '🗿 Jaya Island',
    '🌊 Water 7 Docks',
    '🔥 Marineford War',
    '🏴‍☠️ Thousand Sunny',
    '⚓ Going Merry',
    '🦈 Arlong Park',
    '🎪 Buggy\'s Circus',
    '🍖 Baratie Restaurant',
    '📚 Ohara Library',
    '🌙 Zou Elephant',
    '⚔️ Dressrosa Colosseum',
    '🎭 Sabaody Archipelago',
    '🌟 Reverse Mountain',
    '🐉 Kaido\'s Lair',
    '🍃 Amazon Lily',
    '❄️ Drum Island',
    '🔱 Fishman District',
    '🌈 Long Ring Island',
    '🏰 Enies Lobby',
    '🌺 Rusukaina Island',
    '🔥 Ace\'s Adventure',
    '⚡ Enel\'s Ark'
];

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Track audio connections
const activeConnections = new Map(); // channelId -> voice connection

// Audio file paths
const SOUNDS_DIR = path.join(__dirname, '..', 'sounds');
const WELCOME_SOUND = path.join(SOUNDS_DIR, 'The Going Merry One Piece.ogg');

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

// Database functions for guild settings
async function initializeDatabase() {
    try {
        // Create guild_settings table (keep this for category management)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(255) PRIMARY KEY,
                category_id VARCHAR(255) NOT NULL,
                category_name VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
    }
}

async function getCategoryForGuild(guildId) {
    try {
        const result = await pool.query(
            'SELECT category_id, category_name FROM guild_settings WHERE guild_id = $1',
            [guildId]
        );
        
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

// Function to play welcome sound in a voice channel
async function playWelcomeSound(channel) {
    try {
        if (!fs.existsSync(WELCOME_SOUND)) {
            debugLog(`❌ Welcome sound file not found: ${WELCOME_SOUND}`);
            log(`⚠️ Create a 'sounds' folder and add 'The Going Merry One Piece.ogg' file`);
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
                    // Leave immediately when sound finishes
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

        // Faster timeout for connection issues
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
        // Get category permission overwrites
        const categoryPermissions = category.permissionOverwrites.cache;
        
        // Create permission overwrites array for the new channel
        const channelPermissions = [];
        
        // Copy all category permissions
        categoryPermissions.forEach((overwrite) => {
            channelPermissions.push({
                id: overwrite.id,
                allow: overwrite.allow,
                deny: overwrite.deny,
                type: overwrite.type
            });
        });
        
        // Add creator permissions (captain of the crew)
        const creatorPermissionExists = channelPermissions.find(perm => perm.id === creatorId);
        if (creatorPermissionExists) {
            // Merge with existing permissions
            creatorPermissionExists.allow = creatorPermissionExists.allow.add([
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
            ]);
        } else {
            // Add new creator permissions
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
                type: 1 // Member type
            });
        }
        
        // Apply permissions to the channel
        await channel.permissionOverwrites.set(channelPermissions);
        
        debugLog(`🔐 Synced permissions for ${channel.name} with category ${category.name}`);
        debugLog(`👑 Granted captain permissions to creator ${creatorId}`);
        
    } catch (error) {
        console.error('❌ Error syncing channel permissions:', error);
    }
}

// Bot event handlers
client.once('ready', async () => {
    log(`One Piece Dynamic Voice Bot with XP System is ready to set sail!`);
    log(`⚓ Logged in as ${client.user.tag}`);
    log(`🏴‍☠️ Serving ${client.guilds.cache.size} server(s)`);
    log(`🔊 Audio Volume: ${Math.round(AUDIO_VOLUME * 100)}%`);
    
    // Check if welcome sound exists
    if (fs.existsSync(WELCOME_SOUND)) {
        const stats = fs.statSync(WELCOME_SOUND);
        log(`🎵 Welcome sound ready: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
        console.warn(`⚠️ Welcome sound not found at: ${WELCOME_SOUND}`);
        console.warn(`📁 Make sure the file exists in the sounds folder`);
    }
    
    if (CATEGORY_ID) {
        log(`🎯 Using direct category ID: ${CATEGORY_ID}`);
    } else {
        log(`📁 Using dynamic category management`);
    }
    
    try {
        // Initialize database connection and create database if needed
        await initializeConnection();
        
        // Initialize database tables
        await initializeDatabase();
        
        // Initialize voice time tracker with XP system (this will wipe old tables)
        voiceTimeTracker = new VoiceTimeTracker(client, pool);
        log(`⏱️ Voice Time Tracker with XP System initialized (database wiped and recreated)`);
        
        // Register slash commands
        if (CLIENT_ID) {
            await registerSlashCommands(CLIENT_ID, DISCORD_TOKEN);
        }
        
        // Test database connection
        const result = await pool.query('SELECT NOW()');
        log(`⏰ Database time: ${result.rows[0].now}`);
        log('🗄️ Database connection test successful!');
        
        // Set up voice tracking for existing voice channel users
        log('🔍 Checking for existing voice channel users...');
        client.guilds.cache.forEach(guild => {
            guild.channels.cache
                .filter(channel => 
                    channel.type === ChannelType.GuildVoice && 
                    channel.members.size > 0 &&
                    channel.name !== CREATE_CHANNEL_NAME // Skip trigger channel
                )
                .forEach(channel => {
                    channel.members.forEach(member => {
                        if (!member.user.bot) {
                            const userId = member.id;
                            const username = member.displayName;
                            const guildId = guild.id;
                            const channelId = channel.id;
                            const channelName = channel.name;
                            
                            // Start tracking existing users
                            voiceTimeTracker.startSession(userId, username, guildId, channelId, channelName);
                            
                            log(`🔄 Now tracking existing user: ${username} in ${channelName}`);
                        }
                    });
                });
        });

        // Add debug logging for voice logging status
        if (process.env.ENABLE_VOICE_LOGGING === 'true') {
            log(`🔍 Voice channel logging is ENABLED`);
            if (process.env.VOICE_LOG_CHANNEL_ID) {
                log(`📝 Target log channel ID: ${process.env.VOICE_LOG_CHANNEL_ID}`);
            } else {
                log(`📝 Target log channel name: ${process.env.VOICE_LOG_CHANNEL || 'voice-activity-log'}`);
            }
        } else {
            log(`⚠️ Voice channel logging is DISABLED`);
        }
        
        // Log XP system configuration
        log(`⚡ XP System Configuration:`);
        log(`   - XP per minute: ${process.env.XP_PER_MINUTE || 5}`);
        log(`   - Daily XP cap: ${process.env.DAILY_XP_CAP || 500}`);
        log(`   - Weekly XP cap: ${process.env.WEEKLY_XP_CAP || 2500}`);
        log(`   - Monthly XP cap: ${process.env.MONTHLY_XP_CAP || 10000}`);
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        console.error('❌ Bot will shut down due to database error');
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
        if (voiceTimeTracker) {
            await voiceTimeTracker.handleVoiceStateUpdate(oldState, newState);
        }

        // Dynamic Voice Channel Creation
        if (newState.channelId && newState.channel?.name === CREATE_CHANNEL_NAME) {
            const guild = newState.guild;
            
            if (!member.voice.channelId) {
                debugLog(`User ${member.displayName} no longer in voice, skipping channel creation`);
                return;
            }
            
            let category;
            
            // If CATEGORY_ID is provided, use it directly
            if (CATEGORY_ID) {
                category = guild.channels.cache.get(CATEGORY_ID);
                if (category) {
                    debugLog(`✅ Using direct category ID: ${CATEGORY_ID} (${category.name})`);
                    // Save/update this category in database
                    await updateCategoryForGuild(guildId, category.id, category.name);
                } else {
                    console.error(`❌ Category with ID ${CATEGORY_ID} not found! Creating fallback category.`);
                }
            }
            
            // If no direct category ID or category not found, use saved/default logic
            if (!category) {
                // Get saved category or use default
                let savedCategory = await getCategoryForGuild(guildId);
                
                if (savedCategory) {
                    // Try to find the saved category by ID first
                    category = guild.channels.cache.get(savedCategory.categoryId);
                    if (!category) {
                        // Saved category doesn't exist anymore, find by name
                        category = guild.channels.cache.find(c => 
                            c.name === savedCategory.categoryName && c.type === ChannelType.GuildCategory
                        );
                        
                        if (category) {
                            // Update the database with the new category ID
                            await updateCategoryForGuild(guildId, category.id, category.name);
                            log(`🔄 Category ID updated: ${savedCategory.categoryName}`);
                        }
                    }
                }
                
                if (!category) {
                    // Create new category with default name
                    debugLog(`Category not found, creating new one: ${DEFAULT_CATEGORY_NAME}`);
                    category = await guild.channels.create({
                        name: DEFAULT_CATEGORY_NAME,
                        type: ChannelType.GuildCategory,
                    });
                    
                    // Save the new category to database
                    await updateCategoryForGuild(guildId, category.id, category.name);
                    log(`📁 Created and saved new category: ${DEFAULT_CATEGORY_NAME}`);
                }
            }

            const crewName = getRandomCrewName();
            
            // Create the new voice channel with basic setup first
            const newChannel = await guild.channels.create({
                name: crewName,
                type: ChannelType.GuildVoice,
                parent: category.id,
            });

            // Sync permissions with category and add creator permissions
            await syncChannelWithCategory(newChannel, category, member.id);

            // Ensure channel is in the correct category
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
                    
                    // Play welcome sound immediately after moving user
                    log(`🎵 Playing welcome sound in ${crewName}...`);
                    setTimeout(() => {
                        playWelcomeSound(newChannel);
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
