// index.js - ENHANCED with Robust Initialization, Error Recovery & Performance Monitoring
// FIXED: Added configurable VOICE_PROCESSING_INTERVAL to reduce system load

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// ✅ ENHANCED: Configuration validation and error handling
const CONFIG = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    DATABASE_URL: process.env.DATABASE_URL,
    DEBUG: process.env.DEBUG === 'true',
    NODE_ENV: process.env.NODE_ENV || 'development',
    HEALTH_CHECK_PORT: process.env.PORT || 3000,
    // ✅ NEW: Configurable voice processing interval
    VOICE_PROCESSING_INTERVAL: parseInt(process.env.VOICE_PROCESSING_INTERVAL) || 300000, // Default 5 minutes
    VOICE_COOLDOWN: parseInt(process.env.VOICE_COOLDOWN) || 300000 // Default 5 minutes
};

// ✅ ENHANCED: Validate required environment variables at startup
function validateEnvironment() {
    const requiredVars = [
        { name: 'DISCORD_TOKEN', value: CONFIG.DISCORD_TOKEN },
        { name: 'CLIENT_ID', value: CONFIG.CLIENT_ID },
        { name: 'DATABASE_URL', value: CONFIG.DATABASE_URL }
    ];
    
    const missing = requiredVars.filter(({ value }) => !value);
    
    if (missing.length > 0) {
        console.error('❌ CRITICAL: Missing required environment variables:');
        missing.forEach(({ name }) => console.error(`   - ${name}`));
        console.error('\n💡 Please check your .env file or Railway environment variables');
        process.exit(1);
    }
    
    console.log('✅ Environment validation passed');
    
    // ✅ NEW: Log voice processing configuration
    console.log(`🎤 Voice Processing Config:`);
    console.log(`   - Processing Interval: ${CONFIG.VOICE_PROCESSING_INTERVAL}ms (${CONFIG.VOICE_PROCESSING_INTERVAL/1000}s)`);
    console.log(`   - Voice Cooldown: ${CONFIG.VOICE_COOLDOWN}ms (${CONFIG.VOICE_COOLDOWN/1000}s)`);
    
    // ✅ NEW: Validate voice processing interval is reasonable
    if (CONFIG.VOICE_PROCESSING_INTERVAL < 30000) {
        console.warn('⚠️ WARNING: VOICE_PROCESSING_INTERVAL is less than 30 seconds, this may cause high system load');
    }
    
    if (CONFIG.VOICE_PROCESSING_INTERVAL > 600000) {
        console.warn('⚠️ WARNING: VOICE_PROCESSING_INTERVAL is greater than 10 minutes, XP awards may be delayed');
    }
}

// ✅ ENHANCED: System state management
class SystemState {
    constructor() {
        this.components = {
            database: { ready: false, error: null, retries: 0 },
            xpTracker: { ready: false, error: null, retries: 0 },
            xpBoostManager: { ready: false, error: null, retries: 0 },
            discordClient: { ready: false, error: null, retries: 0 },
            slashCommands: { ready: false, error: null, retries: 0 }
        };
        
        this.startTime = Date.now();
        this.isShuttingDown = false;
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
    }
    
    setComponentState(component, ready, error = null) {
        if (this.components[component]) {
            this.components[component].ready = ready;
            this.components[component].error = error;
            
            if (error) {
                this.components[component].retries++;
            } else if (ready) {
                this.components[component].retries = 0;
            }
        }
    }
    
    isSystemReady() {
        return Object.values(this.components).every(comp => comp.ready);
    }
    
    getSystemStatus() {
        const readyComponents = Object.entries(this.components)
            .filter(([, comp]) => comp.ready)
            .map(([name]) => name);
            
        const failedComponents = Object.entries(this.components)
            .filter(([, comp]) => comp.error && comp.retries >= this.maxRetries)
            .map(([name, comp]) => ({ name, error: comp.error.message }));
            
        return {
            ready: this.isSystemReady(),
            uptime: Date.now() - this.startTime,
            readyComponents,
            failedComponents,
            isShuttingDown: this.isShuttingDown
        };
    }
    
    canRetry(component) {
        return this.components[component] && 
               this.components[component].retries < this.maxRetries;
    }
}

// ✅ ENHANCED: Error recovery manager
class ErrorRecoveryManager {
    constructor() {
        this.errorCounts = new Map();
        this.circuitBreakers = new Map();
        this.recoveryStrategies = new Map();
    }
    
    async executeWithRecovery(operation, context, maxRetries = 3) {
        const errorCount = this.errorCounts.get(context) || 0;
        
        if (errorCount >= maxRetries) {
            const strategy = this.recoveryStrategies.get(context);
            if (strategy) {
                console.log(`[RECOVERY] Applying recovery strategy for ${context}`);
                return await strategy();
            }
            throw new Error(`Max retries exceeded for ${context}`);
        }
        
        try {
            const result = await operation();
            this.errorCounts.delete(context);
            return result;
        } catch (error) {
            this.errorCounts.set(context, errorCount + 1);
            console.error(`[RECOVERY] Attempt ${errorCount + 1} failed for ${context}:`, error.message);
            
            if (errorCount + 1 < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, errorCount), 10000);
                console.log(`[RECOVERY] Retrying ${context} in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.executeWithRecovery(operation, context, maxRetries);
            }
            
            throw error;
        }
    }
    
    setRecoveryStrategy(context, strategy) {
        this.recoveryStrategies.set(context, strategy);
    }
}

// ✅ ENHANCED: Health monitoring system
class HealthMonitor {
    constructor() {
        this.metrics = {
            commandsExecuted: 0,
            xpAwarded: 0,
            errorsLogged: 0,
            voiceSessionsActive: 0,
            voiceProcessingRuns: 0, // ✅ NEW: Track voice processing runs
            memoryUsage: [],
            lastHealthCheck: Date.now(),
            lastVoiceProcessing: Date.now() // ✅ NEW: Track last voice processing time
        };
        
        this.healthCheckInterval = setInterval(() => this.collectMetrics(), 60000);
    }
    
    collectMetrics() {
        const memUsage = process.memoryUsage();
        this.metrics.memoryUsage.push({
            timestamp: Date.now(),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            rss: Math.round(memUsage.rss / 1024 / 1024) // MB
        });
        
        // Keep only last 24 entries (24 hours if collecting every hour)
        if (this.metrics.memoryUsage.length > 24) {
            this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-24);
        }
        
        this.metrics.lastHealthCheck = Date.now();
        
        // Memory usage warning
        const currentMem = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
        if (currentMem && currentMem.heapUsed > 500) {
            console.warn(`[HEALTH] High memory usage: ${currentMem.heapUsed}MB`);
        }
    }
    
    incrementMetric(metric, value = 1) {
        if (this.metrics.hasOwnProperty(metric)) {
            this.metrics[metric] += value;
        }
    }
    
    // ✅ NEW: Track voice processing
    trackVoiceProcessing() {
        this.metrics.voiceProcessingRuns++;
        this.metrics.lastVoiceProcessing = Date.now();
    }
    
    getHealthStatus() {
        const lastMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
        const voiceProcessingAge = Date.now() - this.metrics.lastVoiceProcessing;
        
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: lastMemory || { heapUsed: 0, heapTotal: 0, rss: 0 },
            metrics: {
                commandsExecuted: this.metrics.commandsExecuted,
                xpAwarded: this.metrics.xpAwarded,
                errorsLogged: this.metrics.errorsLogged,
                voiceSessionsActive: global.xpTracker?.voiceSessions?.size || 0,
                voiceProcessingRuns: this.metrics.voiceProcessingRuns,
                timeSinceLastVoiceProcessing: Math.round(voiceProcessingAge / 1000), // seconds
                voiceProcessingInterval: CONFIG.VOICE_PROCESSING_INTERVAL / 1000 // seconds
            },
            bot: {
                guilds: client.guilds?.cache?.size || 0,
                users: client.users?.cache?.size || 0
            }
        };
    }
    
    cleanup() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
    }
}

// Global instances
let db;
let xpTracker;
let xpBoostManager;
const systemState = new SystemState();
const errorRecovery = new ErrorRecoveryManager();
const healthMonitor = new HealthMonitor();

// ✅ NEW: Voice processing interval tracker
let voiceProcessingInterval = null;

// ✅ ENHANCED: Database initialization with connection pooling and retry logic
async function initializeDatabase() {
    console.log('🔄 Initializing database connection...');
    
    return await errorRecovery.executeWithRecovery(async () => {
        if (CONFIG.DATABASE_URL) {
            console.log('🚂 Connecting to Railway PostgreSQL...');
            db = new Pool({
                connectionString: CONFIG.DATABASE_URL,
                ssl: { rejectUnauthorized: false },
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000
            });
        } else {
            throw new Error('DATABASE_URL is required');
        }
        
        // Test connection
        const client = await db.connect();
        const result = await client.query('SELECT NOW()');
        console.log(`✅ PostgreSQL connected at ${result.rows[0].now}`);
        client.release();
        
        // Initialize tables
        await initializeDatabaseTables();
        
        systemState.setComponentState('database', true);
        return true;
        
    }, 'database_init');
}

// ✅ ENHANCED: Database table initialization
async function initializeDatabaseTables() {
    try {
        console.log('🔄 Creating database tables...');
        
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

        // Create indexes for better performance
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_levels_guild_xp ON user_levels(guild_id, total_xp DESC)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_levels_updated ON user_levels(updated_at)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_guild_settings_guild ON guild_settings(guild_id)');

        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing database tables:', error);
        throw error;
    }
}

// Create Discord client with enhanced configuration
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    failIfNotExists: false
});

// ✅ ENHANCED: Slash command registration with better error handling
async function registerSlashCommands() {
    return await errorRecovery.executeWithRecovery(async () => {
        const { REST, Routes } = require('discord.js');
        const commands = [];
        const commandsPath = path.join(__dirname, 'src', 'commands');
        
        if (!fs.existsSync(commandsPath)) {
            console.warn('⚠️ Commands directory not found, skipping slash command registration');
            systemState.setComponentState('slashCommands', true);
            return true;
        }
        
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        console.log(`🔄 Loading ${commandFiles.length} command files...`);
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`📋 Loaded command: ${command.data.name}`);
                } else {
                    console.warn(`⚠️ Command at ${filePath} is missing required properties`);
                }
            } catch (error) {
                console.warn(`⚠️ Could not load command ${file}:`, error.message);
            }
        }

        if (commands.length === 0) {
            console.warn('⚠️ No valid commands found to register');
            systemState.setComponentState('slashCommands', true);
            return true;
        }

        const rest = new REST().setToken(CONFIG.DISCORD_TOKEN);
        console.log(`🔄 Registering ${commands.length} slash commands...`);
        
        const data = await rest.put(
            Routes.applicationCommands(CONFIG.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ Successfully registered ${data.length} slash commands`);
        systemState.setComponentState('slashCommands', true);
        return true;
        
    }, 'slash_commands');
}

// ✅ ENHANCED: XP system initialization with comprehensive error handling
async function initializeXPSystem() {
    return await errorRecovery.executeWithRecovery(async () => {
        console.log('🔄 Initializing XP system...');
        
        // Test if required files exist
        const xpTrackerPath = path.join(__dirname, 'src', 'utils', 'xpTracker.js');
        const xpBoostPath = path.join(__dirname, 'src', 'utils', 'xpBoost.js');
        
        if (!fs.existsSync(xpTrackerPath)) {
            throw new Error('xpTracker.js file not found');
        }
        
        if (!fs.existsSync(xpBoostPath)) {
            throw new Error('xpBoost.js file not found');
        }
        
        // Initialize XP Tracker
        const XPTracker = require('./src/utils/xpTracker');
        console.log('✅ XPTracker class loaded');
        
        xpTracker = new XPTracker(client, CONFIG.DATABASE_URL);
        
        console.log('🔄 Initializing XP Tracker...');
        const initSuccess = await xpTracker.initialize();
        
        if (!initSuccess) {
            throw new Error('XP Tracker initialization failed');
        }
        
        global.xpTracker = xpTracker;
        systemState.setComponentState('xpTracker', true);
        console.log('✅ XP Tracker initialized successfully');
        
        // Initialize XP Boost Manager
        const XPBoostManager = require('./src/utils/xpBoost');
        console.log('✅ XPBoostManager class loaded');
        
        xpBoostManager = new XPBoostManager(xpTracker.db);
        global.xpBoostManager = xpBoostManager;
        systemState.setComponentState('xpBoostManager', true);
        console.log('✅ XP Boost Manager initialized successfully');
        
        return true;
        
    }, 'xp_system');
}

// ✅ ENHANCED: Setup intervals with error handling and configurable voice processing
function setupIntervals() {
    console.log('🔄 Setting up background intervals...');
    
    // ✅ FIXED: Configurable voice XP processing interval
    console.log(`🎤 Voice XP processing interval: ${CONFIG.VOICE_PROCESSING_INTERVAL}ms (${CONFIG.VOICE_PROCESSING_INTERVAL/1000}s)`);
    
    voiceProcessingInterval = setInterval(() => {
        if (systemState.components.xpTracker.ready && xpTracker?.processVoiceXP) {
            healthMonitor.trackVoiceProcessing(); // ✅ NEW: Track processing runs
            
            xpTracker.processVoiceXP().catch(error => {
                console.error('[VOICE XP] Error in processing:', error);
                healthMonitor.incrementMetric('errorsLogged');
            });
        }
    }, CONFIG.VOICE_PROCESSING_INTERVAL); // ✅ FIXED: Use configurable interval
    
    // Daily cleanup with safety checks
    setInterval(() => {
        if (systemState.components.xpTracker.ready && 
            xpTracker?.dailyResetManager?.cleanupDailyVoiceXP) {
            xpTracker.dailyResetManager.cleanupDailyVoiceXP().catch(error => {
                console.error('[DAILY CLEANUP] Error:', error);
                healthMonitor.incrementMetric('errorsLogged');
            });
        }
    }, 24 * 60 * 60 * 1000);
    
    // System health monitoring with voice processing stats
    setInterval(() => {
        if (CONFIG.DEBUG) {
            const status = systemState.getSystemStatus();
            const health = healthMonitor.getHealthStatus();
            
            console.log(`🏴‍☠️ System Status - Ready: ${status.ready}, ` +
                       `Guilds: ${client.guilds.cache.size}, ` +
                       `Voice Sessions: ${health.metrics.voiceSessionsActive}, ` +
                       `Voice Runs: ${health.metrics.voiceProcessingRuns}, ` +
                       `Memory: ${health.memory.heapUsed}MB, ` +
                       `Uptime: ${Math.floor(health.uptime/60)}m`);
        }
    }, 300000); // Every 5 minutes
    
    console.log('✅ Background intervals configured');
    console.log(`   - Voice XP processing: every ${CONFIG.VOICE_PROCESSING_INTERVAL/1000}s`);
    console.log(`   - Daily cleanup: every 24h`);
    console.log(`   - Health monitoring: every 5m`);
}

// ✅ ENHANCED: Bot ready event with sequential initialization
client.once('ready', async () => {
    console.log(`\n🏴‍☠️ One Piece Leveling Bot is starting initialization...`);
    console.log(`⚓ Logged in as ${client.user.tag}`);
    console.log(`🏴‍☠️ Serving ${client.guilds.cache.size} server(s)\n`);
    
    systemState.setComponentState('discordClient', true);
    
    try {
        // Sequential initialization to avoid race conditions
        console.log('🔄 Starting sequential system initialization...\n');
        
        // Step 1: Database
        await initializeDatabase();
        console.log('✅ Database initialization complete\n');
        
        // Step 2: XP System
        await initializeXPSystem();
        console.log('✅ XP system initialization complete\n');
        
        // Step 3: Slash Commands
        if (CONFIG.CLIENT_ID) {
            await registerSlashCommands();
            console.log('✅ Slash commands registration complete\n');
        } else {
            console.warn('⚠️ CLIENT_ID not provided, skipping slash command registration\n');
            systemState.setComponentState('slashCommands', true);
        }
        
        // Step 4: Background processes
        setupIntervals();
        console.log('✅ Background processes started\n');
        
        // Final system check
        const systemStatus = systemState.getSystemStatus();
        
        if (systemStatus.ready) {
            console.log('🎯 ===============================================');
            console.log('🎯 ALL SYSTEMS OPERATIONAL AND READY TO SAIL!');
            console.log('🎯 ===============================================\n');
            
            console.log('📊 System Components Status:');
            systemStatus.readyComponents.forEach(component => {
                console.log(`  ✅ ${component}`);
            });
            
            console.log('\n🎤 Voice Processing Configuration:');
            console.log(`  ⏱️ Processing Interval: ${CONFIG.VOICE_PROCESSING_INTERVAL}ms (${CONFIG.VOICE_PROCESSING_INTERVAL/1000}s)`);
            console.log(`  🔄 Voice Cooldown: ${CONFIG.VOICE_COOLDOWN}ms (${CONFIG.VOICE_COOLDOWN/1000}s)`);
            
        } else {
            console.log('⚠️ ===============================================');
            console.log('⚠️ PARTIAL SYSTEM INITIALIZATION');
            console.log('⚠️ ===============================================\n');
            
            console.log('📊 Ready Components:');
            systemStatus.readyComponents.forEach(component => {
                console.log(`  ✅ ${component}`);
            });
            
            if (systemStatus.failedComponents.length > 0) {
                console.log('\n❌ Failed Components:');
                systemStatus.failedComponents.forEach(({ name, error }) => {
                    console.log(`  ❌ ${name}: ${error}`);
                });
            }
        }
        
        // Database time check
        if (systemState.components.database.ready) {
            const result = await db.query('SELECT NOW()');
            console.log(`\n⏰ Database time: ${result.rows[0].now}`);
        }
        
    } catch (error) {
        console.error('❌ Critical initialization failure:', error);
        console.error('❌ Bot will continue with limited functionality');
        healthMonitor.incrementMetric('errorsLogged');
    }
});

// ✅ ENHANCED: Voice state update with error handling
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (!systemState.components.xpTracker.ready) {
            return;
        }
        
        if (xpTracker?.handleVoiceStateUpdate) {
            await xpTracker.handleVoiceStateUpdate(oldState, newState);
        }
    } catch (error) {
        console.error('❌ Error in voiceStateUpdate:', error);
        healthMonitor.incrementMetric('errorsLogged');
    }
});

// ✅ ENHANCED: Slash command handler with comprehensive error handling
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    
    // Track command execution
    healthMonitor.incrementMetric('commandsExecuted');
    
    try {
        // Check if system is ready for complex commands
        if (['leaderboard', 'level', 'admin', 'settings', 'daily-quiz'].includes(commandName) && 
            !systemState.components.xpTracker.ready) {
            return await interaction.reply({
                content: '⚠️ **System Starting Up**\n\nXP system is still initializing. Please try again in a few moments.',
                ephemeral: true
            });
        }
        
        // Try to load command from file
        const commandsPath = path.join(__dirname, 'src', 'commands');
        const commandFile = path.join(commandsPath, `${commandName}.js`);
        
        if (fs.existsSync(commandFile)) {
            try {
                delete require.cache[require.resolve(commandFile)]; // Clear cache for hot reloading in dev
                const command = require(commandFile);
                if (command.execute) {
                    await command.execute(interaction);
                    return;
                }
            } catch (error) {
                console.error(`❌ Error executing command ${commandName}:`, error);
                healthMonitor.incrementMetric('errorsLogged');
                
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: `❌ **Command Error**\n\nThere was an error executing this command. The error has been logged.`,
                        ephemeral: true
                    });
                }
                return;
            }
        }

        // Fallback commands
        if (commandName === 'ping') {
            const ping = Date.now() - interaction.createdTimestamp;
            const systemStatus = systemState.getSystemStatus();
            const readyComponents = systemStatus.readyComponents.length;
            const totalComponents = Object.keys(systemState.components).length;
            const health = healthMonitor.getHealthStatus();
            
            const embed = new EmbedBuilder()
                .setColor(systemStatus.ready ? '#00FF00' : '#FFA500')
                .setTitle('🏴‍☠️ One Piece Bot Status')
                .addFields(
                    { name: '📡 Latency', value: `\`${ping}ms\``, inline: true },
                    { name: '💓 API Latency', value: `\`${Math.round(client.ws.ping)}ms\``, inline: true },
                    { name: '🎯 System Status', value: systemStatus.ready ? '✅ All Systems Ready' : `⚠️ ${readyComponents}/${totalComponents} Ready`, inline: true },
                    { name: '⏰ Uptime', value: `\`${Math.floor(systemStatus.uptime / 60000)}m\``, inline: true },
                    { name: '🏴‍☠️ Guilds', value: `\`${client.guilds.cache.size}\``, inline: true },
                    { name: '👥 Users', value: `\`${client.users.cache.size}\``, inline: true },
                    { name: '🎤 Voice Processing', value: `\`${health.metrics.voiceProcessingRuns} runs\`\n\`Every ${health.metrics.voiceProcessingInterval}s\``, inline: true },
                    { name: '🎤 Active Sessions', value: `\`${health.metrics.voiceSessionsActive} sessions\``, inline: true },
                    { name: '📊 Memory Usage', value: `\`${health.memory.heapUsed}MB\``, inline: true }
                )
                .setFooter({ text: 'Ready to set sail!' })
                .setTimestamp();
                
            await interaction.reply({ embeds: [embed] });
        }
        else if (commandName === 'check-voice-time') {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            
            if (!systemState.components.xpTracker.ready) {
                return await interaction.reply({
                    content: '❌ **XP System Not Ready**\n\nXP tracker is still initializing.',
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
                content: '❌ **Command Not Found**\n\nThis command is not implemented yet.',
                ephemeral: true
            });
        }

    } catch (error) {
        console.error('❌ Error handling slash command:', error);
        healthMonitor.incrementMetric('errorsLogged');
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ **Unexpected Error**\n\nAn error occurred while processing this command.',
                ephemeral: true
            }).catch(console.error);
        }
    }
});

// ✅ ENHANCED: Message XP handling with system state checks
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    // Award XP if system is ready
    if (systemState.components.xpTracker.ready && xpTracker?.awardXP) {
        try {
            const cooldownKey = `${message.guild.id}:${message.author.id}:message`;
            const cooldown = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
            
            if (!xpTracker.isOnCooldown(cooldownKey, cooldown)) {
                xpTracker.setCooldown(cooldownKey);
                await xpTracker.awardXP(message.author.id, message.guild.id, null, 'message', message.author);
                healthMonitor.incrementMetric('xpAwarded');
            }
        } catch (error) {
            console.error('[MESSAGE XP] Error awarding XP:', error);
            healthMonitor.incrementMetric('errorsLogged');
        }
    }
    
    // Legacy commands
    if (message.content === '!ping') {
        const ping = Date.now() - message.createdTimestamp;
        const systemStatus = systemState.getSystemStatus();
        const health = healthMonitor.getHealthStatus();
        
        message.reply(`🏴‍☠️ **Pong!** 
📡 Bot Latency: \`${ping}ms\`
💓 API Latency: \`${Math.round(client.ws.ping)}ms\`
🎯 System: ${systemStatus.ready ? '✅ All Ready' : '⚠️ Starting Up'}
🎤 Voice Processing: Every ${CONFIG.VOICE_PROCESSING_INTERVAL/1000}s (${health.metrics.voiceProcessingRuns} runs)
⚓ Ready to set sail with XP tracking!`);
    }
    
    if (message.content === '!help') {
        const systemStatus = systemState.getSystemStatus();
        const xpStatus = systemStatus.ready ? '⚡ All XP systems operational' : '⚠️ XP system initializing...';
        
        message.reply(`🏴‍☠️ **One Piece Leveling Bot Commands**

**📊 XP & Level Commands:**
\`/level [@user]\` - Check level information and bounty
\`/leaderboard\` - Show server leaderboard with wanted posters
\`/settings\` - Configure XP settings (Admin only)
\`/admin\` - Advanced XP management (Admin only)
\`/daily-quiz\` - Take the daily anime quiz for XP bonuses

**⚡ XP System:**
• **Message XP**: ${process.env.MESSAGE_XP_MIN || 25}-${process.env.MESSAGE_XP_MAX || 35} per message
• **Voice XP**: ${process.env.VOICE_XP_MIN || 45}-${process.env.VOICE_XP_MAX || 55} per minute (processed every ${CONFIG.VOICE_PROCESSING_INTERVAL/1000}s)
• **Reaction XP**: ${process.env.REACTION_XP_MIN || 25}-${process.env.REACTION_XP_MAX || 35} per reaction
• **Daily Voice Cap**: ${process.env.DAILY_VOICE_XP_CAP || 1500} XP
• **Level System**: Automatic bounty progression
• **Role Rewards**: Unlock new roles at milestone levels

**🎯 Features:**
• **Advanced XP tracking with multiple sources**
• **Marine Intelligence logging system**
• **Comprehensive slash commands for XP management**
• **Wanted poster generation for level-ups**
• **Daily anime quiz with tier-based bonuses**
• **Optimized voice processing (${CONFIG.VOICE_PROCESSING_INTERVAL/1000}s intervals)**

**💡 Use slash commands (/) for the best experience!**
**🔧 System Status:** ${xpStatus}`);
    }
    
    if (message.content === '!health') {
        const systemStatus = systemState.getSystemStatus();
        const healthStatus = healthMonitor.getHealthStatus();
        
        const embed = new EmbedBuilder()
            .setColor(systemStatus.ready ? '#00FF00' : '#FFA500')
            .setTitle('🏥 System Health Report')
            .addFields(
                { name: '🎯 Overall Status', value: systemStatus.ready ? '✅ Healthy' : '⚠️ Partial', inline: true },
                { name: '⏰ Uptime', value: `${Math.floor(healthStatus.uptime / 3600)}h ${Math.floor((healthStatus.uptime % 3600) / 60)}m`, inline: true },
                { name: '💾 Memory', value: `${healthStatus.memory.heapUsed}MB / ${healthStatus.memory.heapTotal}MB`, inline: true },
                { name: '📊 Commands Executed', value: `${healthStatus.metrics.commandsExecuted}`, inline: true },
                { name: '⚡ XP Awarded', value: `${healthStatus.metrics.xpAwarded}`, inline: true },
                { name: '🎤 Active Voice Sessions', value: `${healthStatus.metrics.voiceSessionsActive}`, inline: true },
                { name: '🎤 Voice Processing', value: `**Runs:** ${healthStatus.metrics.voiceProcessingRuns}\n**Interval:** ${healthStatus.metrics.voiceProcessingInterval}s\n**Last Run:** ${healthStatus.metrics.timeSinceLastVoiceProcessing}s ago`, inline: true },
                { name: '🏴‍☠️ Guilds', value: `${healthStatus.bot.guilds}`, inline: true },
                { name: '👥 Users', value: `${healthStatus.bot.users}`, inline: true }
            )
            .setFooter({ text: 'Health check completed' })
            .setTimestamp();
            
        message.reply({ embeds: [embed] });
    }
    
    if (message.content === '!voice-config') {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎤 Voice XP Configuration')
            .addFields(
                { name: '⏱️ Processing Interval', value: `${CONFIG.VOICE_PROCESSING_INTERVAL}ms (${CONFIG.VOICE_PROCESSING_INTERVAL/1000}s)`, inline: true },
                { name: '🔄 Voice Cooldown', value: `${CONFIG.VOICE_COOLDOWN}ms (${CONFIG.VOICE_COOLDOWN/1000}s)`, inline: true },
                { name: '📊 XP Range', value: `${process.env.VOICE_XP_MIN || 45}-${process.env.VOICE_XP_MAX || 55} per minute`, inline: true },
                { name: '🔒 Daily Cap', value: `${process.env.DAILY_VOICE_XP_CAP || 1500} XP per day`, inline: true },
                { name: '👥 Min Members', value: `${process.env.VOICE_MIN_MEMBERS || 2} members required`, inline: true },
                { name: '🔇 Anti-AFK', value: `${process.env.VOICE_ANTI_AFK === 'true' ? 'Enabled' : 'Disabled'}`, inline: true }
            )
            .setDescription('Current voice XP system configuration for optimized performance.')
            .setFooter({ text: 'Voice XP System Configuration' })
            .setTimestamp();
            
        message.reply({ embeds: [embed] });
    }
});

// ✅ ENHANCED: Reaction XP handling with system state checks
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    
    if (systemState.components.xpTracker.ready && xpTracker?.awardXP) {
        try {
            const cooldownKey = `${reaction.message.guild.id}:${user.id}:reaction`;
            const cooldown = parseInt(process.env.REACTION_COOLDOWN) || 300000;
            
            if (!xpTracker.isOnCooldown(cooldownKey, cooldown)) {
                xpTracker.setCooldown(cooldownKey);
                await xpTracker.awardXP(user.id, reaction.message.guild.id, null, 'reaction', user);
                healthMonitor.incrementMetric('xpAwarded');
            }
        } catch (error) {
            console.error('[REACTION XP] Error awarding XP:', error);
            healthMonitor.incrementMetric('errorsLogged');
        }
    }
});

// ✅ ENHANCED: Error handling and logging
client.on('error', error => {
    console.error('❌ Discord client error:', error);
    healthMonitor.incrementMetric('errorsLogged');
});

client.on('warn', warning => {
    console.warn('⚠️ Discord client warning:', warning);
});

process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
    healthMonitor.incrementMetric('errorsLogged');
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
    healthMonitor.incrementMetric('errorsLogged');
    
    // Don't exit immediately, try graceful shutdown
    gracefulShutdown();
});

// ✅ ENHANCED: Graceful shutdown with comprehensive cleanup
async function gracefulShutdown() {
    if (systemState.isShuttingDown) return;
    
    console.log('\n🛑 Graceful shutdown initiated...');
    systemState.isShuttingDown = true;
    
    try {
        // Stop accepting new work
        client.removeAllListeners();
        
        // ✅ NEW: Clear voice processing interval
        if (voiceProcessingInterval) {
            clearInterval(voiceProcessingInterval);
            voiceProcessingInterval = null;
            console.log('✅ Voice processing interval cleared');
        }
        
        // Clean up health monitor
        healthMonitor.cleanup();
        console.log('✅ Health monitor cleaned up');
        
        // Clean up XP tracker
        if (xpTracker && typeof xpTracker.cleanup === 'function') {
            console.log('🧹 Cleaning up XP tracker...');
            await xpTracker.cleanup();
            console.log('✅ XP tracker cleaned up');
        }
        
        // Close database connections
        if (db) {
            console.log('🗄️ Closing database connections...');
            await db.end();
            console.log('✅ Database connections closed');
        }
        
        // Destroy Discord client
        client.destroy();
        console.log('✅ Discord client destroyed');
        
        console.log('👋 Graceful shutdown completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
    } finally {
        process.exit(0);
    }
}

// ✅ ENHANCED: Health check HTTP endpoint for Railway/Docker
if (CONFIG.HEALTH_CHECK_PORT) {
    const http = require('http');
    
    const server = http.createServer((req, res) => {
        if (req.url === '/health') {
            const systemStatus = systemState.getSystemStatus();
            const healthStatus = healthMonitor.getHealthStatus();
            
            const response = {
                status: systemStatus.ready ? 'healthy' : 'degraded',
                timestamp: new Date().toISOString(),
                system: systemStatus,
                health: healthStatus,
                voiceProcessing: {
                    interval: CONFIG.VOICE_PROCESSING_INTERVAL,
                    cooldown: CONFIG.VOICE_COOLDOWN,
                    runs: healthStatus.metrics.voiceProcessingRuns,
                    lastRun: healthStatus.metrics.timeSinceLastVoiceProcessing,
                    activeSessions: healthStatus.metrics.voiceSessionsActive
                },
                version: require('./package.json').version || 'unknown'
            };
            
            res.writeHead(systemStatus.ready ? 200 : 503, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(response, null, 2));
            
        } else if (req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>One Piece Discord Bot</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: #fff; }
                        .status { padding: 20px; border-radius: 10px; margin: 20px 0; }
                        .healthy { background: #2d5a27; }
                        .degraded { background: #5a4227; }
                        .config { background: #273d5a; margin: 20px 0; padding: 15px; border-radius: 8px; }
                    </style>
                </head>
                <body>
                    <h1>🏴‍☠️ One Piece Discord Bot</h1>
                    <div class="status ${systemState.isSystemReady() ? 'healthy' : 'degraded'}">
                        <h2>Status: ${systemState.isSystemReady() ? '✅ All Systems Ready' : '⚠️ Initializing'}</h2>
                        <p>Bot is ${client.readyAt ? 'online and operational' : 'starting up'}</p>
                    </div>
                    <div class="config">
                        <h3>🎤 Voice XP Configuration</h3>
                        <p><strong>Processing Interval:</strong> ${CONFIG.VOICE_PROCESSING_INTERVAL/1000}s</p>
                        <p><strong>Voice Cooldown:</strong> ${CONFIG.VOICE_COOLDOWN/1000}s</p>
                        <p><strong>Processing Runs:</strong> ${healthMonitor.getHealthStatus().metrics.voiceProcessingRuns}</p>
                    </div>
                    <p><a href="/health" style="color: #4CAF50;">View Health Report</a></p>
                </body>
                </html>
            `);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });
    
    server.listen(CONFIG.HEALTH_CHECK_PORT, () => {
        console.log(`🏥 Health check server running on port ${CONFIG.HEALTH_CHECK_PORT}`);
    });
}

// ✅ ENHANCED: Process signal handlers
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ✅ ENHANCED: Bot startup sequence
async function startBot() {
    console.log('🚀 Starting One Piece Leveling Bot...\n');
    
    // Validate environment first
    validateEnvironment();
    
    console.log('🔑 Configuration Check:');
    console.log(`   Discord Token: ${CONFIG.DISCORD_TOKEN ? '✅ Provided' : '❌ MISSING'}`);
    console.log(`   Client ID: ${CONFIG.CLIENT_ID ? '✅ Provided' : '❌ MISSING'}`);
    console.log(`   Database URL: ${CONFIG.DATABASE_URL ? '✅ Provided' : '❌ MISSING'}`);
    console.log(`   Environment: ${CONFIG.NODE_ENV}`);
    console.log(`   Debug Mode: ${CONFIG.DEBUG ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Health Check Port: ${CONFIG.HEALTH_CHECK_PORT}`);
    console.log(`   Voice Processing Interval: ${CONFIG.VOICE_PROCESSING_INTERVAL}ms (${CONFIG.VOICE_PROCESSING_INTERVAL/1000}s)`);
    console.log(`   Voice Cooldown: ${CONFIG.VOICE_COOLDOWN}ms (${CONFIG.VOICE_COOLDOWN/1000}s)\n`);

    // Setup error recovery strategies
    errorRecovery.setRecoveryStrategy('database_init', async () => {
        console.log('[RECOVERY] Attempting database recovery...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await initializeDatabase();
    });
    
    errorRecovery.setRecoveryStrategy('xp_system', async () => {
        console.log('[RECOVERY] Attempting XP system recovery...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        return await initializeXPSystem();
    });

    try {
        console.log('🔄 Connecting to Discord...\n');
        await client.login(CONFIG.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Failed to login to Discord:', error);
        
        if (error.code === 'TokenInvalid') {
            console.error('💡 Please check your DISCORD_TOKEN in the environment variables');
        }
        
        process.exit(1);
    }
}

// ✅ ENHANCED: Export for use in other modules and testing
module.exports = { 
    client, 
    db, 
    xpTracker,
    xpBoostManager, 
    systemState, 
    healthMonitor,
    gracefulShutdown,
    CONFIG, // ✅ NEW: Export config for external access
    // Utility functions for external use
    isSystemReady: () => systemState.isSystemReady(),
    getSystemStatus: () => systemState.getSystemStatus(),
    getHealthStatus: () => healthMonitor.getHealthStatus(),
    getVoiceProcessingConfig: () => ({
        interval: CONFIG.VOICE_PROCESSING_INTERVAL,
        cooldown: CONFIG.VOICE_COOLDOWN,
        runs: healthMonitor.getHealthStatus().metrics.voiceProcessingRuns
    })
};

// Start the bot
if (require.main === module) {
    startBot();
}
