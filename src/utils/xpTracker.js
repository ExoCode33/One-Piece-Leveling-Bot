// src/utils/xpTracker.js - Fixed XP Tracker with Database Connection Debugging

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { getBountyForLevel } = require('./bountySystem');
const DailyResetManager = require('./dailyResetManager');
const VoiceXPManager = require('./voiceXPManager');
const LevelUpManager = require('./levelUpManager');
const path = require('path');
const { Pool } = require('pg');

// Custom Error Classes
class BotError extends Error {
    constructor(message, code, recoverable = false) {
        super(message);
        this.name = 'BotError';
        this.code = code;
        this.recoverable = recoverable;
    }
}

class DatabaseError extends BotError {
    constructor(message, query = null) {
        super(message, 'DB_ERROR', true);
        this.query = query;
    }
}

// Limited Map for memory management
class LimitedMap extends Map {
    constructor(maxSize = 1000, ttl = 300000) { // 5 minutes TTL
        super();
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.timers = new Map();
    }
    
    set(key, value) {
        // Clean up if at max size
        if (this.size >= this.maxSize && !this.has(key)) {
            const firstKey = this.keys().next().value;
            this.delete(firstKey);
        }
        
        // Clear existing timer
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        
        // Set TTL timer
        const timer = setTimeout(() => {
            this.delete(key);
        }, this.ttl);
        
        this.timers.set(key, timer);
        return super.set(key, value);
    }
    
    delete(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        return super.delete(key);
    }
    
    clear() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        return super.clear();
    }
}

// Performance Monitor
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            commands: new Map(),
            dbQueries: new Map(),
            errors: new Map(),
            memory: []
        };
        
        this.startTime = Date.now();
        this.collectInterval = setInterval(() => this.collectMetrics(), 60000);
    }
    
    trackCommand(commandName, duration, success = true) {
        const key = `${commandName}_${success ? 'success' : 'error'}`;
        const stats = this.metrics.commands.get(key) || { count: 0, totalTime: 0, avgTime: 0 };
        stats.count++;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.count;
        this.metrics.commands.set(key, stats);
    }
    
    trackDbQuery(query, duration, success = true) {
        const queryType = query.split(' ')[0].toUpperCase();
        const key = `${queryType}_${success ? 'success' : 'error'}`;
        const stats = this.metrics.dbQueries.get(key) || { count: 0, totalTime: 0, avgTime: 0 };
        stats.count++;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.count;
        this.metrics.dbQueries.set(key, stats);
    }
    
    trackError(error, context = 'unknown') {
        const key = `${context}_${error.code || 'UNKNOWN'}`;
        const count = this.metrics.errors.get(key) || 0;
        this.metrics.errors.set(key, count + 1);
    }
    
    collectMetrics() {
        const used = process.memoryUsage();
        this.metrics.memory.push({
            timestamp: Date.now(),
            heapUsed: Math.round(used.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(used.heapTotal / 1024 / 1024), // MB
            external: Math.round(used.external / 1024 / 1024), // MB
            rss: Math.round(used.rss / 1024 / 1024) // MB
        });
        
        // Keep only last 24 hours
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        this.metrics.memory = this.metrics.memory.filter(m => m.timestamp > cutoff);
        
        // Log performance warnings
        const latestMemory = this.metrics.memory[this.metrics.memory.length - 1];
        if (latestMemory && latestMemory.heapUsed > 500) { // 500MB warning
            console.warn(`[PERFORMANCE] High memory usage: ${latestMemory.heapUsed}MB heap`);
        }
    }
    
    getStats() {
        return {
            uptime: Date.now() - this.startTime,
            commands: Object.fromEntries(this.metrics.commands),
            dbQueries: Object.fromEntries(this.metrics.dbQueries),
            errors: Object.fromEntries(this.metrics.errors),
            memory: this.metrics.memory.slice(-10) // Last 10 samples
        };
    }
    
    cleanup() {
        if (this.collectInterval) {
            clearInterval(this.collectInterval);
        }
    }
}

// Database Manager with better connection handling
class DatabaseManager {
    constructor(connectionString) {
        console.log('[DATABASE] Initializing database manager...');
        console.log('[DATABASE] Connection string provided:', !!connectionString);
        
        if (!connectionString) {
            throw new Error('Database connection string is required');
        }
        
        // Parse connection string for debugging (without exposing password)
        try {
            const url = new URL(connectionString);
            console.log('[DATABASE] Host:', url.hostname);
            console.log('[DATABASE] Port:', url.port || '5432');
            console.log('[DATABASE] Database:', url.pathname.slice(1));
            console.log('[DATABASE] Username:', url.username);
        } catch (error) {
            console.warn('[DATABASE] Could not parse connection string for debugging');
        }
        
        this.pool = new Pool({
            connectionString,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000, // Increased timeout
            statement_timeout: 15000, // Increased timeout
            query_timeout: 15000, // Increased timeout
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.pool.on('error', (err) => {
            console.error('[DATABASE] Pool error:', err);
        });
        
        this.pool.on('connect', (client) => {
            console.log('[DATABASE] New client connected to database');
        });
        
        this.pool.on('acquire', () => {
            console.log('[DATABASE] Client acquired from pool');
        });
        
        this.pool.on('remove', () => {
            console.log('[DATABASE] Client removed from pool');
        });
    }
    
    async query(text, params = []) {
        const start = Date.now();
        let client;
        
        try {
            console.log('[DATABASE] Attempting to acquire client from pool...');
            client = await this.pool.connect();
            console.log('[DATABASE] Client acquired, executing query...');
            
            const result = await client.query(text, params);
            const duration = Date.now() - start;
            
            console.log(`[DATABASE] Query executed successfully in ${duration}ms (${result.rowCount} rows)`);
            return result;
        } catch (error) {
            const duration = Date.now() - start;
            console.error(`[DATABASE] Query failed after ${duration}ms:`, error.message);
            console.error('[DATABASE] Query text:', text.substring(0, 100) + '...');
            console.error('[DATABASE] Error code:', error.code);
            console.error('[DATABASE] Error severity:', error.severity);
            throw new DatabaseError(`Database query failed: ${error.message}`, text);
        } finally {
            if (client) {
                console.log('[DATABASE] Releasing client back to pool');
                client.release();
            }
        }
    }
    
    async transaction(callback) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    async healthCheck() {
        try {
            console.log('[DATABASE] Performing health check...');
            const start = Date.now();
            const result = await this.query('SELECT 1 as health, NOW() as timestamp');
            const duration = Date.now() - start;
            
            console.log(`[DATABASE] Health check successful in ${duration}ms`);
            console.log('[DATABASE] Server time:', result.rows[0].timestamp);
            return result.rows[0].health === 1;
        } catch (error) {
            console.error('[DATABASE] Health check failed:', error);
            console.error('[DATABASE] Error details:', {
                code: error.code,
                severity: error.severity,
                message: error.message
            });
            return false;
        }
    }
    
    async testBasicOperations() {
        try {
            console.log('[DATABASE] Testing basic operations...');
            
            // Test creating a temporary table
            await this.query(`
                CREATE TEMPORARY TABLE test_connection (
                    id SERIAL PRIMARY KEY,
                    test_value TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Test insert
            await this.query(`
                INSERT INTO test_connection (test_value) VALUES ($1)
            `, ['connection_test']);
            
            // Test select
            const result = await this.query(`
                SELECT * FROM test_connection WHERE test_value = $1
            `, ['connection_test']);
            
            console.log('[DATABASE] Basic operations test successful');
            return result.rows.length > 0;
        } catch (error) {
            console.error('[DATABASE] Basic operations test failed:', error);
            return false;
        }
    }
    
    async close() {
        console.log('[DATABASE] Closing connection pool...');
        await this.pool.end();
        console.log('[DATABASE] Connection pool closed');
    }
}

// Retry utility function
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries || !error.recoverable) {
                throw error;
            }
            
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.warn(`[RETRY] Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

// Register fonts with error handling
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[XP TRACKER] Custom fonts registered successfully');
} catch (error) {
    console.warn('[XP TRACKER] Failed to register custom fonts, using fallbacks:', error.message);
}

class XPTracker {
    constructor(client, databaseUrl) {
        this.client = client;
        
        // Use limited maps for memory management
        this.voiceSessions = new LimitedMap(500, 1800000); // 30 min TTL
        this.cooldowns = new LimitedMap(1000, 300000); // 5 min TTL
        this.userCache = new LimitedMap(200, 300000); // 5 min TTL
        
        // Performance monitoring
        this.monitor = new PerformanceMonitor();
        
        // Configuration
        this.config = this.loadConfiguration();
        
        // Database will be initialized in initialize()
        this.db = null;
        this.databaseUrl = databaseUrl || process.env.DATABASE_URL;
        
        // Managers (initialized later)
        this.dailyResetManager = null;
        this.voiceXPManager = null;
        this.levelUpManager = null;
        
        // Graceful shutdown handling
        this.isShuttingDown = false;
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
        
        // Don't auto-initialize, let the caller handle it
        console.log('[XP TRACKER] XP Tracker constructed, call initialize() to start');
    }
    
    loadConfiguration() {
        return {
            xp: {
                message: {
                    min: parseInt(process.env.MESSAGE_XP_MIN) || 25,
                    max: parseInt(process.env.MESSAGE_XP_MAX) || 35,
                    cooldown: parseInt(process.env.MESSAGE_COOLDOWN) || 60000
                },
                voice: {
                    min: parseInt(process.env.VOICE_XP_MIN) || 45,
                    max: parseInt(process.env.VOICE_XP_MAX) || 55,
                    cooldown: parseInt(process.env.VOICE_COOLDOWN) || 180000
                },
                reaction: {
                    min: parseInt(process.env.REACTION_XP_MIN) || 25,
                    max: parseInt(process.env.REACTION_XP_MAX) || 35,
                    cooldown: parseInt(process.env.REACTION_COOLDOWN) || 300000
                }
            },
            formula: {
                curve: process.env.FORMULA_CURVE || 'exponential',
                multiplier: parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75,
                baseXP: parseInt(process.env.FORMULA_BASE_XP) || 500,
                maxLevel: parseInt(process.env.MAX_LEVEL) || 50
            },
            limits: {
                dailyVoiceXP: parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500,
                maxCacheSize: 1000,
                cleanupInterval: 300000 // 5 minutes
            }
        };
    }
    
    async initialize() {
        try {
            console.log('[XP TRACKER] Starting initialization...');
            console.log('[XP TRACKER] Database URL provided:', !!this.databaseUrl);
            
            if (!this.databaseUrl) {
                throw new BotError('Database URL is required but not provided', 'DB_URL_MISSING');
            }
            
            // Initialize database manager
            console.log('[XP TRACKER] Creating database manager...');
            this.db = new DatabaseManager(this.databaseUrl);
            
            // Test database connection with multiple attempts
            console.log('[XP TRACKER] Testing database connection...');
            let isHealthy = false;
            let attempts = 0;
            const maxAttempts = 5;
            
            while (!isHealthy && attempts < maxAttempts) {
                attempts++;
                console.log(`[XP TRACKER] Database connection attempt ${attempts}/${maxAttempts}...`);
                
                try {
                    isHealthy = await this.db.healthCheck();
                    
                    if (isHealthy) {
                        console.log('[XP TRACKER] Database health check passed');
                        
                        // Test basic operations
                        const operationsWork = await this.db.testBasicOperations();
                        if (!operationsWork) {
                            console.error('[XP TRACKER] Basic database operations failed');
                            isHealthy = false;
                        }
                    }
                } catch (error) {
                    console.error(`[XP TRACKER] Database connection attempt ${attempts} failed:`, error);
                    isHealthy = false;
                }
                
                if (!isHealthy && attempts < maxAttempts) {
                    const delay = 2000 * attempts; // Progressive delay
                    console.log(`[XP TRACKER] Retrying database connection in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
            if (!isHealthy) {
                throw new BotError(
                    `Database connection failed after ${maxAttempts} attempts. Check your DATABASE_URL and database server.`, 
                    'DB_HEALTH_FAIL'
                );
            }
            
            // Load guild settings
            console.log('[XP TRACKER] Loading guild settings...');
            await this.loadGuildSettingsFromDatabase();
            
            // Initialize voice sessions from existing channels
            console.log('[XP TRACKER] Initializing voice sessions...');
            await this.initializeExistingVoiceSessions();
            
            // Initialize managers
            console.log('[XP TRACKER] Initializing managers...');
            this.dailyResetManager = new DailyResetManager(this);
            this.voiceXPManager = new VoiceXPManager(this);
            this.levelUpManager = new LevelUpManager(this);
            
            await this.dailyResetManager.initialize();
            
            // Start cleanup interval
            this.cleanupInterval = setInterval(() => this.performMaintenance(), this.config.limits.cleanupInterval);
            
            console.log('[XP TRACKER] Initialization completed successfully');
            return true;
        } catch (error) {
            console.error('[XP TRACKER] Initialization failed:', error);
            this.monitor.trackError(error, 'initialization');
            
            // Clean up any partially initialized resources
            try {
                if (this.db) {
                    await this.db.close();
                }
            } catch (cleanupError) {
                console.error('[XP TRACKER] Error during cleanup:', cleanupError);
            }
            
            throw error;
        }
    }
    
    async loadGuildSettingsFromDatabase() {
        try {
            console.log('[SETTINGS] Loading guild settings from database...');
            
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }
            
            // Ensure table exists and has required columns
            await this.ensureGuildSettingsTable();
            
            const result = await this.db.query(`
                SELECT guild_id, levelup_channel, levelup_enabled, xp_log_channel, xp_log_enabled, xp_multiplier
                FROM guild_settings
            `);
            
            let loadedCount = 0;
            for (const row of result.rows) {
                const guildSettings = {
                    levelupChannel: row.levelup_channel,
                    levelupEnabled: row.levelup_enabled !== false,
                    xpLogChannel: row.xp_log_channel,
                    xpLogEnabled: row.xp_log_enabled === true,
                    xpMultiplier: parseFloat(row.xp_multiplier) || 1.0
                };
                
                global.guildSettings.set(row.guild_id, guildSettings);
                loadedCount++;
            }
            
            console.log(`[SETTINGS] Loaded ${loadedCount} guild configurations`);
        } catch (error) {
            console.error('[SETTINGS] Error loading guild settings:', error);
            this.monitor.trackError(error, 'guild_settings');
            
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }
        }
    }
    
    async ensureGuildSettingsTable() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(20) PRIMARY KEY,
                levelup_channel VARCHAR(20),
                levelup_enabled BOOLEAN DEFAULT true,
                xp_log_channel VARCHAR(20),
                xp_log_enabled BOOLEAN DEFAULT false,
                xp_multiplier DECIMAL(3,2) DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE INDEX IF NOT EXISTS idx_guild_settings_guild_id ON guild_settings(guild_id)`
        ];
        
        for (const query of queries) {
            await this.db.query(query);
        }
    }
    
    async initializeExistingVoiceSessions() {
        try {
            console.log('[VOICE XP] Scanning for existing voice channel members...');
            
            // Wait for client to be ready
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            let totalFound = 0;
            
            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    const voiceChannels = guild.channels.cache.filter(channel => 
                        channel.type === 2 && channel.members && channel.members.size > 0
                    );
                    
                    for (const [channelId, channel] of voiceChannels) {
                        for (const [memberId, member] of channel.members) {
                            if (!member.user.bot) {
                                this.voiceSessions.set(memberId, {
                                    guildId,
                                    channelId,
                                    joinTime: Date.now(),
                                    lastXPTime: Date.now(),
                                    isMuted: member.voice.mute || member.voice.selfMute,
                                    isDeafened: member.voice.deaf || member.voice.selfDeaf
                                });
                                totalFound++;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`[VOICE XP] Error scanning guild ${guild.name}:`, error);
                    this.monitor.trackError(error, 'voice_init');
                }
            }
            
            console.log(`[VOICE XP] Initialized ${totalFound} existing voice sessions`);
        } catch (error) {
            console.error('[VOICE XP] Error initializing existing voice sessions:', error);
            this.monitor.trackError(error, 'voice_init');
        }
    }

    // All the other methods from the previous version would go here...
    // I'll include a few key ones and indicate where the rest should go
    
    async handleVoiceStateUpdate(oldState, newState) {
        if (this.isShuttingDown) return;
        
        try {
            return await this.voiceXPManager.handleVoiceStateUpdate(oldState, newState);
        } catch (error) {
            console.error('[VOICE XP] Error handling voice state update:', error);
            this.monitor.trackError(error, 'voice_update');
        }
    }
    
    async processVoiceXP() {
        if (this.isShuttingDown) return;
        
        try {
            return await this.voiceXPManager.processVoiceXP();
        } catch (error) {
            console.error('[VOICE XP] Error processing voice XP:', error);
            this.monitor.trackError(error, 'voice_xp');
        }
    }
    
    // Utility methods
    getRandomXP(type) {
        const xpConfig = this.config.xp[type];
        if (!xpConfig) {
            console.warn(`[XP TRACKER] Unknown XP type: ${type}, using default`);
            return Math.floor(Math.random() * 11) + 25; // 25-35
        }
        
        return Math.floor(Math.random() * (xpConfig.max - xpConfig.min + 1)) + xpConfig.min;
    }
    
    calculateLevel(totalXP) {
        const { curve, multiplier, baseXP, maxLevel } = this.config.formula;
        
        for (let level = 1; level <= maxLevel; level++) {
            let requiredXP;
            
            switch (curve) {
                case 'exponential':
                    requiredXP = Math.floor(baseXP * Math.pow(level, multiplier));
                    break;
                case 'linear':
                    requiredXP = baseXP * level * multiplier;
                    break;
                case 'logarithmic':
                    requiredXP = Math.floor(baseXP * Math.log(level + 1) * multiplier * 2);
                    break;
                default:
                    requiredXP = Math.floor(baseXP * Math.pow(level, multiplier));
            }
            
            if (totalXP < requiredXP) {
                return level - 1;
            }
        }
        
        return maxLevel;
    }
    
    getXPForLevel(level) {
        const { curve, multiplier, baseXP } = this.config.formula;
        
        if (level === 0) return 0;
        
        switch (curve) {
            case 'exponential':
                return Math.floor(baseXP * Math.pow(level, multiplier));
            case 'linear':
                return Math.floor(baseXP * level * multiplier);
            case 'logarithmic':
                return Math.floor(baseXP * Math.log(level + 1) * multiplier * 2);
            default:
                return Math.floor(baseXP * Math.pow(level, multiplier));
        }
    }
    
    isOnCooldown(key, cooldownMs) {
        const now = Date.now();
        const lastUse = this.cooldowns.get(key);
        return lastUse && (now - lastUse) < cooldownMs;
    }
    
    setCooldown(key) {
        this.cooldowns.set(key, Date.now());
    }
    
    // Get performance stats
    getPerformanceStats() {
        return this.monitor.getStats();
    }
    
    // Graceful shutdown
    async gracefulShutdown() {
        if (this.isShuttingDown) return;
        
        console.log('[XP TRACKER] Starting graceful shutdown...');
        this.isShuttingDown = true;
        
        try {
            // Clear intervals
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }
            
            // Cleanup managers
            if (this.dailyResetManager) {
                await this.dailyResetManager.cleanup();
            }
            
            // Clear caches
            this.voiceSessions.clear();
            this.cooldowns.clear();
            this.userCache.clear();
            
            // Cleanup monitor
            this.monitor.cleanup();
            
            // Close database connections
            if (this.db) {
                await this.db.close();
            }
            
            console.log('[XP TRACKER] Graceful shutdown completed');
        } catch (error) {
            console.error('[XP TRACKER] Error during shutdown:', error);
        }
    }
    
    async cleanup() {
        await this.gracefulShutdown();
    }
}

module.exports = XPTracker;
