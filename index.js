// index.js - Clean Discord Leveling Bot with XP System, Daily Quests, and Marine Theme

const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Environment validation
const requiredEnvVars = ['DISCORD_TOKEN', 'DATABASE_URL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

console.log('[INFO] Starting Discord Leveling Bot...');
console.log('[INFO] Environment validation passed');

// Enhanced database connection with better error handling and reconnection
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Enhanced connection pool settings for Railway
    max: 20,                    // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,   // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    maxUses: 7500,              // Close (and replace) a connection after it has been used 7500 times
    allowExitOnIdle: false,     // Don't exit when no connections
    keepAlive: true,            // Enable TCP keep-alive
    keepAliveInitialDelayMillis: 10000, // Initial delay before starting keep-alive probes
});

// Enhanced error handling for database connections
db.on('error', (err, client) => {
    console.error('[DATABASE] Unexpected error on idle client:', err.message);
    // Don't exit the process, just log the error
});

db.on('connect', (client) => {
    console.log('[DATABASE] New client connected');
});

db.on('acquire', (client) => {
    console.log('[DATABASE] Client acquired from pool');
});

db.on('remove', (client) => {
    console.log('[DATABASE] Client removed from pool');
});

// Global variables for XP system
let xpTracker;
let xpBoostManager;
let dailyQuests;

// Enhanced helper function with connection recovery
async function executeQuery(query, params = []) {
    let retries = 3;
    
    while (retries > 0) {
        try {
            const result = await db.query(query, params);
            return result;
        } catch (error) {
            retries--;
            console.error(`[DATABASE] Query failed (${retries} retries left):`, error.message);
            
            if (retries === 0) {
                throw error;
            }
            
            // Short delay before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Enhanced database initialization with retry logic
async function initializeDatabase() {
    let retries = 5;
    
    while (retries > 0) {
        try {
            console.log(`[DATABASE] Attempting connection (${6 - retries}/5)...`);
            
            // Test connection with timeout
            const testClient = await db.connect();
            const result = await testClient.query('SELECT NOW()');
            testClient.release();
            
            console.log('[INFO] Database connection established successfully');
            console.log(`[DATABASE] Current time: ${result.rows[0].now}`);

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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, guild_id)
                )
            `);

            // Create guild_settings table
            await db.query(`
                CREATE TABLE IF NOT EXISTS guild_settings (
                    guild_id VARCHAR(20) PRIMARY KEY,
                    levelup_channel VARCHAR(20),
                    levelup_enabled BOOLEAN DEFAULT true,
                    xp_log_channel VARCHAR(20),
                    xp_log_enabled BOOLEAN DEFAULT false,
                    excluded_role VARCHAR(20),
                    xp_multiplier DECIMAL(3,2) DEFAULT 1.0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create daily_voice_xp table for daily caps
            await db.query(`
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

            // Create xp_boosts table for role multipliers
            await db.query(`
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

            // Create daily_buffs table for spin wheel results
            await db.query(`
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

            // Create daily_quests table
            await db.query(`
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

            // Create daily_quest_completions table
            await db.query(`
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

            // Create performance indexes
            console.log('[DATABASE] Creating database indexes for performance...');
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
                    await db.query(indexQuery);
                } catch (error) {
                    // Index might already exist
                }
            }

            // Clean up old data (maintain performance)
            try {
                const cleanupResult = await db.query(
                    "DELETE FROM daily_voice_xp WHERE date < CURRENT_DATE - INTERVAL '7 days'"
                );
                if (cleanupResult.rowCount > 0) {
                    console.log(`[DATABASE] Cleaned up ${cleanupResult.rowCount} old daily XP records`);
                }
            } catch (cleanupError) {
                // No old records to clean up
            }

            console.log('[INFO] Database tables and indexes initialized');
            return; // Success, exit retry loop
            
        } catch (error) {
            retries--;
            console.error(`[ERROR] Database connection attempt failed (${retries} retries left):`, error.message);
            
            if (retries === 0) {
                console.error('[FATAL] Could not establish database connection after 5 attempts');
                process.exit(1);
            }
            
            // Wait before retry (exponential backoff)
            const delay = (6 - retries) * 2000; // 2s, 4s, 6s, 8s, 10s
            console.log(`[DATABASE] Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Initialize XP Boost System
async function initializeXPBoostSystem() {
    try {
        const XPBoostManager = require('./src/utils/xpBoost');
        xpBoostManager = new XPBoostManager(db);
        global.xpBoostManager = xpBoostManager;
        console.log('[INFO] XP Boost system initialized successfully');
    } catch (error) {
        console.error('[ERROR] Failed to initialize XP Boost system:', error);
    }
}

// Initialize XP Tracker
async function initializeXPTracker() {
    try {
        const XPTracker = require('./src/utils/xpTracker');
        xpTracker = new XPTracker(client, db);
        global.xpTracker = xpTracker;
        console.log('[INFO] XP Tracker initialized successfully');
    } catch (error) {
        console.error('[ERROR] Failed to initialize XP Tracker:', error);
    }
}

// Initialize Daily Quests System
async function initializeDailyQuests() {
    try {
        const DailyQuests = require('./src/utils/dailyQuests');
        dailyQuests = new DailyQuests(db, client);
        global.dailyQuests = dailyQuests;
        console.log('[INFO] Daily Quests system initialized successfully');
    } catch (error) {
        console.error('[ERROR] Failed to initialize Daily Quests system:', error);
    }
}

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'src', 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`[COMMANDS] Loaded: ${command.data.name}`);
            } else {
                console.warn(`[WARNING] Command at ${filePath} is missing required "data" or "execute" property.`);
            }
        } catch (error) {
            console.error(`[ERROR] Failed to load command ${file}:`, error.message);
        }
    }
}

// Enhanced guild settings function with better error handling
async function getGuildSettings(guildId) {
    // Check cache first
    if (global.guildSettings && global.guildSettings.has(guildId)) {
        return global.guildSettings.get(guildId);
    }

    try {
        // Get from database with retry logic
        const result = await executeQuery(
            'SELECT * FROM guild_settings WHERE guild_id = $1',
            [guildId]
        );

        let settings;
        if (result.rows.length > 0) {
            settings = {
                levelupChannel: result.rows[0].levelup_channel,
                levelupEnabled: result.rows[0].levelup_enabled,
                xpLogChannel: result.rows[0].xp_log_channel,
                xpLogEnabled: result.rows[0].xp_log_enabled,
                excludedRole: result.rows[0].excluded_role,
                xpMultiplier: parseFloat(result.rows[0].xp_multiplier) || 1.0
            };
        } else {
            // Create default settings
            settings = {
                levelupChannel: null,
                levelupEnabled: true,
                xpLogChannel: null,
                xpLogEnabled: false,
                excludedRole: null,
                xpMultiplier: 1.0
            };

            // Insert default settings into database
            await executeQuery(
                'INSERT INTO guild_settings (guild_id, xp_multiplier) VALUES ($1, $2) ON CONFLICT (guild_id) DO NOTHING',
                [guildId, 1.0]
            );
        }

        // Cache settings
        if (!global.guildSettings) global.guildSettings = new Map();
        global.guildSettings.set(guildId, settings);
        return settings;

    } catch (error) {
        console.error('[ERROR] Error getting guild settings:', error);
        return {
            levelupChannel: null,
            levelupEnabled: true,
            xpLogChannel: null,
            xpLogEnabled: false,
            excludedRole: null,
            xpMultiplier: 1.0
        };
    }
}

// Auto-assign Level 0 role to new members
client.on('guildMemberAdd', async member => {
    try {
        // Skip bots
        if (member.user.bot) return;

        console.log(`[NEW MEMBER] Processing new member: ${member.user.username} in ${member.guild.name}`);

        // Check if Level 0 role is configured
        const level0RoleId = process.env.LEVEL_0_ROLE || '1382198693545115658';
        if (!level0RoleId || level0RoleId === 'role_id_0') {
            console.log('[NEW MEMBER] Level 0 role not configured, skipping role assignment');
            return;
        }

        // Get the Level 0 role
        const level0Role = member.guild.roles.cache.get(level0RoleId);
        if (!level0Role) {
            console.log(`[NEW MEMBER] Level 0 role ${level0RoleId} not found in ${member.guild.name}`);
            return;
        }

        // Check if member already has the role
        if (member.roles.cache.has(level0RoleId)) {
            console.log(`[NEW MEMBER] ${member.user.username} already has Level 0 role`);
            return;
        }

        // Add Level 0 role
        await member.roles.add(level0Role);
        console.log(`[NEW MEMBER] ✅ Added Level 0 role "${level0Role.name}" to ${member.user.username}`);

        // Initialize user in database with enhanced error handling
        if (global.xpTracker && global.xpTracker.db) {
            try {
                await executeQuery(`
                    INSERT INTO user_levels (user_id, guild_id, total_xp, level, messages, reactions, voice_time)
                    VALUES ($1, $2, 0, 0, 0, 0, 0)
                    ON CONFLICT (user_id, guild_id) DO NOTHING
                `, [member.user.id, member.guild.id]);

                console.log(`[NEW MEMBER] ✅ Initialized database entry for ${member.user.username}`);
            } catch (dbError) {
                console.error(`[NEW MEMBER] Database error for ${member.user.username}:`, dbError.message);
            }
        }

    } catch (error) {
        console.error(`[NEW MEMBER] Error processing new member ${member.user.username}:`, error.message);
    }
});

// Enhanced Level 0 audit with better error handling and batching
async function assignMissingLevel0Roles() {
    try {
        console.log('[LEVEL 0 AUDIT] Starting enhanced audit with connection recovery...');

        const level0RoleId = process.env.LEVEL_0_ROLE || '1382198693545115658';
        if (!level0RoleId || level0RoleId === 'role_id_0') {
            console.log('[LEVEL 0 AUDIT] Level 0 role not configured, skipping audit');
            return;
        }

        let totalProcessed = 0;
        let totalAssigned = 0;

        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const level0Role = guild.roles.cache.get(level0RoleId);
                if (!level0Role) {
                    console.log(`[LEVEL 0 AUDIT] Level 0 role not found in ${guild.name}, skipping`);
                    continue;
                }

                // Get all members
                await guild.members.fetch();
                console.log(`[LEVEL 0 AUDIT] Checking ${guild.memberCount} members in ${guild.name}...`);

                // Process members in batches to avoid overwhelming the database
                const members = Array.from(guild.members.cache.values());
                const batchSize = 10;

                for (let i = 0; i < members.length; i += batchSize) {
                    const batch = members.slice(i, i + batchSize);

                    for (const member of batch) {
                        totalProcessed++;
                        
                        // Skip bots
                        if (member.user.bot) continue;
                        
                        // Skip if already has Level 0 role
                        if (member.roles.cache.has(level0RoleId)) continue;
                        
                        // Skip if has any higher level roles
                        const hasHigherRole = [
                            process.env.LEVEL_5_ROLE,
                            process.env.LEVEL_10_ROLE,
                            process.env.LEVEL_15_ROLE,
                            process.env.LEVEL_20_ROLE,
                            process.env.LEVEL_25_ROLE,
                            process.env.LEVEL_30_ROLE,
                            process.env.LEVEL_35_ROLE,
                            process.env.LEVEL_40_ROLE,
                            process.env.LEVEL_45_ROLE,
                            process.env.LEVEL_50_ROLE
                        ].some(roleId => roleId && member.roles.cache.has(roleId));
                        
                        if (hasHigherRole) continue;
                        
                        // Check database level with enhanced error handling
                        try {
                            const userStats = await executeQuery(
                                'SELECT level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                                [member.user.id, guild.id]
                            );

                            // If they're Level 1+ in database, don't give Level 0 role
                            if (userStats.rows.length > 0 && userStats.rows[0].level > 0) {
                                continue;
                            }
                        } catch (dbError) {
                            console.error(`[LEVEL 0 AUDIT] Database check error for ${member.user.username}:`, dbError.message);
                            continue;
                        }
                        
                        // Assign Level 0 role with retry logic
                        try {
                            await member.roles.add(level0Role);
                            totalAssigned++;
                            console.log(`[LEVEL 0 AUDIT] ✅ Added Level 0 role to ${member.user.username}`);
                        } catch (roleError) {
                            console.error(`[LEVEL 0 AUDIT] Failed to add Level 0 role to ${member.user.username}:`, roleError.message);
                        }
                    }

                    // Delay between batches to avoid rate limits and reduce database load
                    if (i + batchSize < members.length) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

            } catch (guildError) {
                console.error(`[LEVEL 0 AUDIT] Error processing guild ${guild.name}:`, guildError.message);
            }
        }

        console.log(`[LEVEL 0 AUDIT] ✅ Enhanced audit complete: Processed ${totalProcessed} members, assigned ${totalAssigned} Level 0 roles`);

    } catch (error) {
        console.error('[LEVEL 0 AUDIT] Enhanced audit failed:', error.message);
    }
}

// Bot ready event
client.once('ready', async () => {
    console.log(`⚓ Marine Intelligence Bot is ready for surveillance!`);
    console.log(`⚓ Logged in as ${client.user.tag}`);
    console.log(`🏴‍☠️ Monitoring ${client.guilds.cache.size} server(s) for criminal activity`);
    
    try {
        // Initialize database first
        await initializeDatabase();

        // Initialize XP Boost system
        await initializeXPBoostSystem();

        // Initialize XP Tracker
        await initializeXPTracker();

        // Initialize Daily Quests
        await initializeDailyQuests();

        // Register slash commands if CLIENT_ID is provided
        if (process.env.CLIENT_ID) {
            await registerSlashCommands(process.env.CLIENT_ID, process.env.DISCORD_TOKEN);
        }

        // Initialize guild settings cache
        if (!global.guildSettings) {
            global.guildSettings = new Map();
        }

        // Start voice XP processing
        setInterval(() => {
            if (client.isReady() && xpTracker) {
                xpTracker.processVoiceXP().catch(error => {
                    console.error('[ERROR] Error in voice XP processing:', error.message);
                });
            }
        }, 60000);

        // Daily cleanup
        setInterval(() => {
            if (client.isReady() && xpTracker) {
                xpTracker.cleanupDailyVoiceXP().catch(error => {
                    console.error('[ERROR] Error in daily cleanup:', error.message);
                });
            }
        }, 24 * 60 * 60 * 1000);

        // Run initial cleanup
        if (xpTracker) {
            await xpTracker.cleanupDailyVoiceXP();
        }

        // Check for existing members without Level 0 role (run once on startup)
        setTimeout(async () => {
            await assignMissingLevel0Roles();
        }, 10000); // Wait 10 seconds after bot startup

        console.log('⚓ Marine Intelligence System fully operational!');
        console.log('🎯 Ready to track criminal bounties and XP!');
        console.log('🎰 Daily buff system active!');
        console.log('📋 Daily quest system active!');
        console.log(`🎯 Level 0 role: ${process.env.LEVEL_0_ROLE || '1382198693545115658'}`);

    } catch (error) {
        console.error('[ERROR] Error during bot initialization:', error.message);
    }
});

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

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    // Handle button interactions for leaderboard navigation
    if (interaction.isButton()) {
        try {
            if (interaction.customId.startsWith('leaderboard_')) {
                const leaderboardCommand = client.commands.get('leaderboard');
                if (leaderboardCommand && leaderboardCommand.handleButtonInteraction) {
                    await leaderboardCommand.handleButtonInteraction(interaction, xpTracker);
                }
            } else if (interaction.customId.startsWith('daily_buff_spin_')) {
                const dailyBuffCommand = client.commands.get('daily-buff');
                if (dailyBuffCommand && dailyBuffCommand.handleSpinInteraction) {
                    await dailyBuffCommand.handleSpinInteraction(interaction);
                }
            } else if (interaction.customId.startsWith('cleanup_') || interaction.customId.startsWith('optimize_') || interaction.customId.startsWith('backup_')) {
                const adminCommand = client.commands.get('admin');
                if (adminCommand && adminCommand.handleMaintenanceButtons) {
                    await adminCommand.handleMaintenanceButtons(interaction, db);
                }
            } else if (interaction.customId.startsWith('nuclear_')) {
                const adminCommand = client.commands.get('admin');
                if (adminCommand && adminCommand.handleNuclearButtons) {
                    await adminCommand.handleNuclearButtons(interaction, db);
                }
            }
        } catch (error) {
            console.error('[ERROR] Button interaction error:', error.message);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[ERROR] Error executing command ${interaction.commandName}:`, error.message);

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

// Message handler with proper XP boost integration
client.on('messageCreate', async message => {
    // Ignore bots and system messages
    if (message.author.bot || !message.guild) return;

    try {
        // Check cooldown
        const cooldownKey = `${message.author.id}_${message.guild.id}_message`;
        const now = Date.now();
        const cooldown = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;

        if (xpTracker && xpTracker.cooldowns.has(cooldownKey)) {
            const lastUse = xpTracker.cooldowns.get(cooldownKey);
            if (now - lastUse < cooldown) {
                return; // Still on cooldown
            }
        }

        // Check if user has excluded role (Pirate King)
        const guildSettings = await getGuildSettings(message.guild.id);
        if (guildSettings.excludedRole && message.member.roles.cache.has(guildSettings.excludedRole)) {
            return; // Skip XP for excluded role (Pirate King)
        }

        // Award XP with boost integration
        if (xpTracker && typeof xpTracker.awardXP === 'function') {
            await xpTracker.awardXP(message.author.id, message.guild.id, null, 'message', message.author);
        }

        // Update quest progress for messages
        if (dailyQuests) {
            await dailyQuests.updateQuestProgress(message.author.id, message.guild.id, 'messages', 1, {
                channelId: message.channel.id
            });
            await dailyQuests.updateQuestProgress(message.author.id, message.guild.id, 'channel_explorer', 1, {
                channelId: message.channel.id
            });
        }

        // Set cooldown
        if (xpTracker) {
            xpTracker.cooldowns.set(cooldownKey, now);
        }

    } catch (error) {
        console.error('[ERROR] Error processing message XP:', error.message);
    }
});

// Reaction handler with proper XP boost integration
client.on('messageReactionAdd', async (reaction, user) => {
    // Ignore bots
    if (user.bot || !reaction.message.guild) return;

    try {
        // Check cooldown
        const cooldownKey = `${user.id}_${reaction.message.guild.id}_reaction`;
        const now = Date.now();
        const cooldown = parseInt(process.env.REACTION_COOLDOWN) || 300000;

        if (xpTracker && xpTracker.cooldowns.has(cooldownKey)) {
            const lastUse = xpTracker.cooldowns.get(cooldownKey);
            if (now - lastUse < cooldown) {
                return; // Still on cooldown
            }
        }

        // Get member object
        const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        // Check if user has excluded role (Pirate King)
        const guildSettings = await getGuildSettings(reaction.message.guild.id);
        if (guildSettings.excludedRole && member.roles.cache.has(guildSettings.excludedRole)) {
            return; // Skip XP for excluded role (Pirate King)
        }

        // Award XP with boost integration
        if (xpTracker && typeof xpTracker.awardXP === 'function') {
            await xpTracker.awardXP(user.id, reaction.message.guild.id, null, 'reaction', user);
        }

        // Update quest progress for reactions
        if (dailyQuests) {
            await dailyQuests.updateQuestProgress(user.id, reaction.message.guild.id, 'reactions', 1);
            await dailyQuests.updateQuestProgress(user.id, reaction.message.guild.id, 'reaction_collector', 1);
            await dailyQuests.updateQuestProgress(user.id, reaction.message.guild.id, 'social_butterfly', 1, {
                channelId: reaction.message.channel.id
            });
        }

        // Set cooldown
        if (xpTracker) {
            xpTracker.cooldowns.set(cooldownKey, now);
        }

    } catch (error) {
        console.error('[ERROR] Error processing reaction XP:', error.message);
    }
});

// Voice state update handler
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        // Handle voice time tracking with XP system
        if (xpTracker && typeof xpTracker.handleVoiceStateUpdate === 'function') {
            await xpTracker.handleVoiceStateUpdate(oldState, newState);
        }

        // Update quest progress for voice activities
        const userId = newState.id || oldState.id;
        const guildId = newState.guild?.id || oldState.guild?.id;

        if (dailyQuests && userId && guildId) {
            // User joined voice - update voice_sessions quest
            if (newState.channelId && !oldState.channelId) {
                await dailyQuests.updateQuestProgress(userId, guildId, 'voice_sessions', 1);
            }
        }

    } catch (error) {
        console.error('[ERROR] Error processing voice state update:', error.message);
    }
});

// Enhanced error handlers
client.on('error', error => {
    console.error('[ERROR] Discord client error:', error.message);
});

process.on('unhandledRejection', error => {
    console.error('[ERROR] Unhandled promise rejection:', error.message);
    // Don't exit the process for database connection errors
});

process.on('uncaughtException', error => {
    console.error('[ERROR] Uncaught Exception:', error.message);
    // Don't exit the process for database connection errors, just log
    if (error.message.includes('Connection terminated unexpectedly')) {
        console.log('[INFO] Database connection will be automatically restored');
        return;
    }
    // For other critical errors, still exit
    process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
    console.log('\n[INFO] Received SIGINT, shutting down gracefully...');
    try {
        if (client) {
            await client.destroy();
            console.log('[INFO] Discord client disconnected');
        }
        
        if (db) {
            await db.end();
            console.log('[INFO] Database connection closed');
        }
        
        if (xpTracker) {
            await xpTracker.cleanup();
            console.log('[INFO] XP Tracker cleaned up');
        }
        
        console.log('[INFO] Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error.message);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n[INFO] Received SIGTERM, shutting down gracefully...');
    try {
        if (client) {
            await client.destroy();
            console.log('[INFO] Discord client disconnected');
        }
        
        if (db) {
            await db.end();
            console.log('[INFO] Database connection closed');
        }
        
        if (xpTracker) {
            await xpTracker.cleanup();
            console.log('[INFO] XP Tracker cleaned up');
        }
        
        console.log('[INFO] Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error.message);
        process.exit(1);
    }
});

// Export database and XP boost manager for use in commands
module.exports = { db, xpBoostManager, executeQuery };

// Login to Discord
client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        console.log('[INFO] Discord client login initiated');
    })
    .catch(error => {
        console.error('[ERROR] Failed to login to Discord:', error.message);
        process.exit(1);
    });
