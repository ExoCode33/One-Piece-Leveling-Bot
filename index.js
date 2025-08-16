// index.js - Complete enhanced version with XP Boost System, Level 0 roles, and robust database handling

const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const XPTracker = require('./src/utils/xpTracker');
const XPBoostManager = require('./src/utils/xpBoost');

// Environment validation
const requiredEnvVars = ['DISCORD_TOKEN', 'DATABASE_URL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`[ERROR] Missing required environment variable: ${envVar}`);
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

// XP Boost Manager
let xpBoostManager;

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

            // Create tables if they don't exist
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

            // Create XP boosts table
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

            // Create indexes for better performance
            await db.query('CREATE INDEX IF NOT EXISTS idx_user_levels_guild ON user_levels(guild_id)');
            await db.query('CREATE INDEX IF NOT EXISTS idx_user_levels_xp ON user_levels(guild_id, total_xp DESC)');
            await db.query('CREATE INDEX IF NOT EXISTS idx_xp_boosts_guild_role ON xp_boosts(guild_id, role_id)');

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
        xpBoostManager = new XPBoostManager(db);
        global.xpBoostManager = xpBoostManager;
        console.log('[INFO] XP Boost system initialized successfully');
    } catch (error) {
        console.error('[ERROR] Failed to initialize XP Boost system:', error);
    }
}

// Create client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize collections
client.commands = new Collection();

// Set global client reference IMMEDIATELY
global.client = client;

// Initialize guild settings cache
global.guildSettings = new Map();

// Initialize XP Tracker with database
const xpTracker = new XPTracker(client, db);
global.xpTracker = xpTracker;

// Load commands
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[DEBUG] ✅ Loaded command: ${command.data.name}`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Enhanced guild settings function with better error handling
async function getGuildSettings(guildId) {
    // Check cache first
    if (global.guildSettings.has(guildId)) {
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

        // Cache the settings
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
        
        console.log(`[NEW MEMBER] ${member.user.username} joined ${member.guild.name}`);
        
        // Get Level 0 role ID from environment
        const level0RoleId = process.env.LEVEL_0_ROLE || '1382198693545115658';
        
        if (!level0RoleId || level0RoleId === 'role_id_0') {
            console.log('[NEW MEMBER] No Level 0 role configured');
            return;
        }
        
        // Find the role
        const level0Role = member.guild.roles.cache.get(level0RoleId);
        if (!level0Role) {
            console.error(`[NEW MEMBER] Level 0 role ${level0RoleId} not found in ${member.guild.name}`);
            return;
        }
        
        // Check if member already has the role
        if (member.roles.cache.has(level0RoleId)) {
            console.log(`[NEW MEMBER] ${member.user.username} already has Level 0 role`);
            return;
        }
        
        // Add the Level 0 role
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
        
        // Optional: Send welcome message with Marine theme
        const welcomeChannelId = process.env.WELCOME_CHANNEL;
        if (welcomeChannelId) {
            const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
            if (welcomeChannel && welcomeChannel.isTextBased()) {
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🚨 NEW PIRATE DETECTED 🚨')
                    .setDescription(`**${member.user.username}** has entered Marine surveillance!\n\n*Initial bounty: ฿0 - Classification: Civilian*`)
                    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
                    .addFields({
                        name: '📋 Marine Intelligence Report',
                        value: `\`\`\`diff\n- SUBJECT: ${member.user.username}\n- STATUS: Under Observation\n- INITIAL LEVEL: 0\n- BOUNTY: ฿0\n- THREAT LEVEL: Minimal\n\`\`\``,
                        inline: false
                    })
                    .setFooter({ text: '⚓ Marine Intelligence Division • New Recruit Processing' })
                    .setTimestamp();
                
                await welcomeChannel.send({ embeds: [welcomeEmbed] });
                console.log(`[NEW MEMBER] ✅ Sent welcome message for ${member.user.username}`);
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
            console.log('[LEVEL 0 AUDIT] No Level 0 role configured, skipping audit');
            return;
        }
        
        let totalProcessed = 0;
        let totalAssigned = 0;
        
        // Check each guild
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const level0Role = guild.roles.cache.get(level0RoleId);
                if (!level0Role) {
                    console.log(`[LEVEL 0 AUDIT] Level 0 role not found in ${guild.name}, skipping`);
                    continue;
                }
                
                // Get all members
                await guild.members.fetch();
                console.log(`[LEVEL 0 AUDIT] Processing ${guild.memberCount} members in ${guild.name}...`);
                
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

// Event handlers
client.once('ready', async () => {
    console.log(`[INFO] Bot logged in as ${client.user.tag}`);
    
    try {
        // Initialize database first
        await initializeDatabase();
        
        // Initialize XP Boost system
        await initializeXPBoostSystem();
        
        // Register slash commands
        const commands = Array.from(client.commands.values()).map(command => command.data.toJSON());
        console.log(`[DEBUG] Registering ${commands.length} slash commands: ${commands.map(c => c.name).join(', ')}`);
        console.log(`[DEBUG] Using bot application ID: ${client.application.id}`);
        
        await client.application.commands.set(commands);
        console.log('[INFO] Successfully registered slash commands');
        
        // Start periodic tasks ONLY after client is ready
        console.log('[INFO] Starting periodic tasks...');
        
        // Process voice XP every minute
        setInterval(() => {
            if (client.isReady()) {
                xpTracker.processVoiceXP().catch(error => {
                    console.error('[ERROR] Error in voice XP processing:', error.message);
                });
            }
        }, 60000);
        
        // Cleanup daily voice XP (run every 24 hours)
        setInterval(() => {
            if (client.isReady()) {
                xpTracker.cleanupDailyVoiceXP().catch(error => {
                    console.error('[ERROR] Error in daily cleanup:', error.message);
                });
            }
        }, 24 * 60 * 60 * 1000);
        
        // Run initial cleanup
        await xpTracker.cleanupDailyVoiceXP();
        
        // Check for existing members without Level 0 role (run once on startup)
        setTimeout(async () => {
            await assignMissingLevel0Roles();
        }, 10000); // Wait 10 seconds after bot startup
        
        console.log('[INFO] Discord Leveling Bot is fully operational!');
        console.log(`[INFO] Bot is in ${client.guilds.cache.size} servers`);
        console.log(`[INFO] Monitoring ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} total members`);
        console.log(`[INFO] Daily voice XP cap: ${process.env.DAILY_VOICE_XP_CAP || 6000} XP per user`);
        console.log(`[INFO] Level 0 role: ${process.env.LEVEL_0_ROLE || '1382198693545115658'}`);
        
    } catch (error) {
        console.error('[ERROR] Error during bot initialization:', error.message);
    }
});

// Handle button interactions for leaderboard first
client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId.startsWith('leaderboard_')) {
        const leaderboardCommand = client.commands.get('leaderboard');
        if (leaderboardCommand && leaderboardCommand.handleButtonInteraction) {
            try {
                await leaderboardCommand.handleButtonInteraction(interaction, xpTracker);
            } catch (error) {
                console.error('[ERROR] Button interaction error:', error.message);
            }
        }
        return;
    }
    
    // Handle admin nuclear buttons
    if (interaction.isButton() && ['cleanup_inactive', 'optimize_db', 'backup_stats', 'nuclear_confirm', 'nuclear_abort', 'nuclear_execute'].includes(interaction.customId)) {
        
        // Security check
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: '```diff\n- ACCESS DENIED - NUCLEAR AUTHORIZATION REQUIRED\n- ADMINISTRATOR PERMISSIONS MANDATORY```',
                ephemeral: true
            });
        }
        
        try {
            const adminCommand = client.commands.get('admin');
            
            // Handle maintenance buttons
            if (['cleanup_inactive', 'optimize_db', 'backup_stats'].includes(interaction.customId)) {
                await adminCommand.handleMaintenanceButtons(interaction, db);
            }
            
            // Handle nuclear buttons  
            if (['nuclear_confirm', 'nuclear_abort', 'nuclear_execute'].includes(interaction.customId)) {
                await adminCommand.handleNuclearButtons(interaction, db);
            }
        } catch (error) {
            console.error('[ERROR] Admin button error:', error.message);
            
            const errorMessage = {
                content: '```diff\n- MARINE INTELLIGENCE SYSTEM ERROR\n- Button interaction failed. Please try again.```',
                ephemeral: true
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
        return;
    }
});

// Interaction handler for slash commands
client.on('interactionCreate', async interaction => {
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
        
        if (!xpTracker.cooldowns) xpTracker.cooldowns = new Map();
        
        const lastUse = xpTracker.cooldowns.get(cooldownKey);
        const cooldownTime = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
        
        if (lastUse && (now - lastUse) < cooldownTime) {
            return;
        }
        
        // Get guild settings
        const guildSettings = await getGuildSettings(message.guild.id);
        
        // Check if user has excluded role
        const member = message.member;
        if (guildSettings.excludedRole && member && member.roles.cache.has(guildSettings.excludedRole)) {
            return; // Skip XP for excluded role (Pirate King)
        }
        
        // Award XP with boost integration
        await xpTracker.awardXP(message.author.id, message.guild.id, null, 'message', message.author);
        
        // Set cooldown
        xpTracker.cooldowns.set(cooldownKey, now);
        
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
        
        if (!xpTracker.cooldowns) xpTracker.cooldowns = new Map();
        
        const lastUse = xpTracker.cooldowns.get(cooldownKey);
        const cooldownTime = parseInt(process.env.REACTION_COOLDOWN) || 300000;
        
        if (lastUse && (now - lastUse) < cooldownTime) {
            return;
        }
        
        // Get guild settings
        const guildSettings = await getGuildSettings(reaction.message.guild.id);
        
        // Check if user has excluded role
        const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
        if (guildSettings.excludedRole && member && member.roles.cache.has(guildSettings.excludedRole)) {
            return; // Skip XP for excluded role (Pirate King)
        }
        
        // Award XP with boost integration
        await xpTracker.awardXP(user.id, reaction.message.guild.id, null, 'reaction', user);
        
        // Set cooldown
        xpTracker.cooldowns.set(cooldownKey, now);
        
    } catch (error) {
        console.error('[ERROR] Error processing reaction XP:', error.message);
    }
});

// Voice state update handler
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        await xpTracker.handleVoiceStateUpdate(oldState, newState);
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

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[INFO] Received SIGINT, shutting down gracefully...');
    
    try {
        if (xpTracker && xpTracker.cleanup) {
            await xpTracker.cleanup();
        }
        
        if (db) {
            await db.end();
        }
        
        if (client) {
            client.destroy();
        }
        
        console.log('[INFO] Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error.message);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('[INFO] Received SIGTERM, shutting down gracefully...');
    
    try {
        if (xpTracker && xpTracker.cleanup) {
            await xpTracker.cleanup();
        }
        
        if (db) {
            await db.end();
        }
        
        if (client) {
            client.destroy();
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
client.login(process.env.DISCORD_TOKEN);
