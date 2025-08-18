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
        
        // 6. Create performance indexes
        log('⚡ Creating database indexes for performance...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_user_levels_guild_xp ON user_levels(guild_id, total_xp DESC)',
            'CREATE INDEX IF NOT EXISTS idx_user_levels_guild_level ON user_levels(guild_id, level DESC)',
            'CREATE INDEX IF NOT EXISTS idx_daily_voice_xp_date ON daily_voice_xp(date)',
            'CREATE INDEX IF NOT EXISTS idx_xp_boosts_guild_role ON xp_boosts(guild_id, role_id)',
            'CREATE INDEX IF NOT EXISTS idx_daily_buffs_date ON daily_buffs(date)'
        ];
        
        for (const indexQuery of indexes) {
            try {
                await pool.query(indexQuery);
                debugLog('✅ Index created/verified');
            } catch (error) {
                debugLog(`ℹ️ Index might already exist: ${error.message}`);
            }
        }
        
        // 7. Clean up old data (maintain performance)
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

// Initialize enhanced XP system with daily features
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
        console.log(`⏱️ XP Tracker initialized successfully`);
        
        // Initialize XP Boost Manager with database
        const XPBoostManager = require('./src/utils/xpBoost');
        xpBoostManager = new XPBoostManager(pool);
        global.xpBoostManager = xpBoostManager;
        console.log(`🚀 XP Boost Manager initialized successfully`);

        // Initialize Daily Quests System
        const DailyQuests = require('./src/utils/dailyQuests');
        dailyQuests = new DailyQuests(pool, client);
        global.dailyQuests = dailyQuests;
        console.log(`📋 Daily Quests System initialized successfully`);
        
        // Start voice XP processing
        setInterval(async () => {
            if (xpTracker && xpTracker.processVoiceXP) {
                try {
                    await xpTracker.processVoiceXP();
                } catch (error) {
                    console.error('[VOICE XP] Error in processing:', error);
                }
            }
        }, 60000); // Every 60 seconds
        
        // Daily cleanup at 3 AM EST
        setInterval(async () => {
            if (xpTracker && xpTracker.cleanupDailyVoiceXP) {
                try {
                    await xpTracker.cleanupDailyVoiceXP();
                } catch (error) {
                    console.error('[DAILY CLEANUP] Error:', error);
                }
            }
            if (dailyQuests && dailyQuests.cleanupDailyQuests) {
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
        if (xpTracker && xpTracker.handleVoiceStateUpdate) {
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

// Enhanced slash command handler with daily systems
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    try {
        // Handle button interactions for daily systems
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('daily_buff_spin_')) {
                const dailyBuffCommand = require('./src/commands/daily-buff');
                if (dailyBuffCommand.handleSpinInteraction) {
                    await dailyBuffCommand.handleSpinInteraction(interaction);
                }
                return;
            }
            
            // Handle other button interactions (leaderboard, admin, etc.)
            if (interaction.customId.startsWith('leaderboard_')) {
                const leaderboardCommand = require('./src/commands/leaderboard');
                if (leaderboardCommand.handleButtonInteraction) {
                    await leaderboardCommand.handleButtonInteraction(interaction, xpTracker);
                }
                return;
            }
            
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
            return;
        }

        // Handle slash commands
        const { commandName } = interaction;
        
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
        } else {
            await interaction.reply({
                content: '❌ Command not found or not implemented yet.',
                ephemeral: true
            });
        }

    } catch (error) {
        console.error('❌ Error handling interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while processing this interaction.',
                ephemeral: true
            }).catch(console.error);
        }
    }
});

// Enhanced message XP handling with quest progress
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Handle XP for messages
    if (xpTracker && xpTracker.isOnCooldown && xpTracker.setCooldown && xpTracker.awardXP) {
        const cooldownKey = `${guildId}:${userId}:message`;
        const cooldown = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
        
        if (!xpTracker.isOnCooldown(cooldownKey, cooldown)) {
            xpTracker.setCooldown(cooldownKey);
            await xpTracker.awardXP(userId, guildId, null, 'message', message.author);
        }
    }

    // Update quest progress for messages
    if (dailyQuests) {
        await dailyQuests.updateQuestProgress(userId, guildId, 'messages', 1);
        await dailyQuests.updateQuestProgress(userId, guildId, 'channel_explorer', 1, { channelId: message.channel.id });
        await dailyQuests.updateQuestProgress(userId, guildId, 'social_butterfly', 1, { channelId: message.channel.id });
        await dailyQuests.updateQuestProgress(userId, guildId, 'early_bird', 1);
        await dailyQuests.updateQuestProgress(userId, guildId, 'night_owl', 1);
        await dailyQuests.updateQuestProgress(userId, guildId, 'streak_keeper', 1);
    }
    
    // Legacy commands
    if (message.content === '!ping') {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`🏴‍☠️ **Marine Intelligence - Pong!** 
📡 Bot Latency: \`${ping}ms\`
💓 API Latency: \`${Math.round(client.ws.ping)}ms\`
⚓ Marine Intelligence System operational and tracking bounties!`);
    }
    
    if (message.content === '!help') {
        message.reply(`🏴‍☠️ **Marine Intelligence Commands - Enhanced Bounty Tracking System**

**📊 XP & Bounty Commands:**
\`/level [@user]\` - Check criminal bounty level and wanted poster
\`/leaderboard\` - Show most wanted criminals with bounty posters
\`/settings\` - Configure bounty tracking settings (Admin only)
\`/admin\` - Marine command center operations (Admin only)

**🎰 Daily Systems:**
\`/daily-buff\` - Spin for daily XP buffs (Tier 1-3 multipliers & caps)
\`/daily-quest\` - View daily missions for bonus XP and Tier 2 cap

**🚢 Dynamic Voice Channels:**
1. Join "${CREATE_CHANNEL_NAME}" voice channel
2. Bot creates a new crew with One Piece themed name
3. You become the captain with full channel permissions
4. **Earn XP automatically while in voice channels!**
5. Empty crews are automatically deleted after ${DELETE_DELAY/1000} seconds

**⚡ Enhanced XP System:**
• **Message XP**: ${process.env.MESSAGE_XP_MIN || 25}-${process.env.MESSAGE_XP_MAX || 35} per message
• **Voice XP**: ${process.env.VOICE_XP_MIN || 45}-${process.env.VOICE_XP_MAX || 55} per minute
• **Reaction XP**: ${process.env.REACTION_XP_MIN || 25}-${process.env.REACTION_XP_MAX || 35} per reaction
• **Daily XP Caps**: Default ${process.env.DAILY_VOICE_XP_CAP_DEFAULT || 1500} | Tier 1: ${process.env.DAILY_VOICE_XP_CAP_TIER_1 || 2000} | Tier 2: ${process.env.DAILY_VOICE_XP_CAP_TIER_2 || 3000} | Tier 3: ${process.env.DAILY_VOICE_XP_CAP_TIER_3 || 5000}
• **XP Multipliers**: Tier 1: ${process.env.DAILY_XP_BUFF_TIER_1 || 1.25}x | Tier 2: ${process.env.DAILY_XP_BUFF_TIER_2 || 1.5}x | Tier 3: ${process.env.DAILY_XP_BUFF_TIER_3 || 2.0}x
• **Daily Reset**: 3:00 AM EST for all daily systems

**🎯 Daily Features:**
• **Spin Wheel**: Daily luck-based XP buffs with role rewards
• **Quest System**: 4-5 daily missions based on Discord activity
• **Tier Rewards**: Complete all quests for Tier 2 XP cap bonus
• **Auto-posting**: Quest completions announced in quest channel

**💡 Use slash commands (/) for the best experience!**
**⚡ All activity is tracked for Marine Intelligence and daily quests!**
**🎰 Daily buffs and quests reset at 3:00 AM EST!**`);
    }
});

// Enhanced reaction XP handling with quest progress
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    
    const userId = user.id;
    const guildId = reaction.message.guild.id;
    
    // Handle XP for reactions
    if (xpTracker && xpTracker.isOnCooldown && xpTracker.setCooldown && xpTracker.awardXP) {
        const cooldownKey = `${guildId}:${userId}:reaction`;
        const cooldown = parseInt(process.env.REACTION_COOLDOWN) || 300000;
        
        if (!xpTracker.isOnCooldown(cooldownKey, cooldown)) {
            xpTracker.setCooldown(cooldownKey);
            await xpTracker.awardXP(userId, guildId, null, 'reaction', user);
        }
    }

    // Update quest progress for reactions
    if (dailyQuests) {
        await dailyQuests.updateQuestProgress(userId, guildId, 'reactions', 1);
        await dailyQuests.updateQuestProgress(userId, guildId, 'reaction_collector', 1);
        await dailyQuests.updateQuestProgress(userId, guildId, 'early_bird', 1);
        await dailyQuests.updateQuestProgress(userId, guildId, 'night_owl', 1);
        await dailyQuests.updateQuestProgress(userId, guildId, 'streak_keeper', 1);
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
        console.log(`🏴‍☠️ Bot Status - Guilds: ${client.guilds.cache.size}, Active Voice Sessions: ${activeSessions}, Uptime: ${Math.floor(process.uptime()/60)}m`);
    }
}, 300000); // Log every 5 minutes in debug mode

// Export for use in other modules
module.exports = { client, pool };

// Start the bot
async function startBot() {
    log('🚀 Starting Enhanced Marine Intelligence System...');
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

startBot();
