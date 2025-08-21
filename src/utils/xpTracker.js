// src/utils/xpTracker.js - Optimized XP Tracker with Performance and Reliability Fixes

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

// Database Manager with connection pooling
class DatabaseManager {
    constructor(connectionString) {
        this.pool = new Pool({
            connectionString,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000,
            query_timeout: 10000
        });
        
        this.pool.on('error', (err) => {
            console.error('[DATABASE] Pool error:', err);
        });
        
        this.pool.on('connect', () => {
            console.log('[DATABASE] New client connected');
        });
    }
    
    async query(text, params = []) {
        const start = Date.now();
        let client;
        
        try {
            client = await this.pool.connect();
            const result = await client.query(text, params);
            const duration = Date.now() - start;
            
            console.log(`[DATABASE] Query executed in ${duration}ms (${result.rowCount} rows)`);
            return result;
        } catch (error) {
            const duration = Date.now() - start;
            console.error(`[DATABASE] Query failed after ${duration}ms:`, error.message);
            throw new DatabaseError(`Database query failed: ${error.message}`, text);
        } finally {
            if (client) {
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
            const result = await this.query('SELECT 1 as health');
            return result.rows[0].health === 1;
        } catch (error) {
            console.error('[DATABASE] Health check failed:', error);
            return false;
        }
    }
    
    async close() {
        await this.pool.end();
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
    constructor(client, database) {
        this.client = client;
        
        // Initialize database manager
        this.db = new DatabaseManager(database || process.env.DATABASE_URL);
        
        // Use limited maps for memory management
        this.voiceSessions = new LimitedMap(500, 1800000); // 30 min TTL
        this.cooldowns = new LimitedMap(1000, 300000); // 5 min TTL
        this.userCache = new LimitedMap(200, 300000); // 5 min TTL
        
        // Performance monitoring
        this.monitor = new PerformanceMonitor();
        
        // Configuration
        this.config = this.loadConfiguration();
        
        // Managers
        this.dailyResetManager = null;
        this.voiceXPManager = null;
        this.levelUpManager = null;
        
        // Graceful shutdown handling
        this.isShuttingDown = false;
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
        
        this.initialize().catch(error => {
            console.error('[XP TRACKER] Initialization failed:', error);
            throw error;
        });
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
            
            // Test database connection
            const isHealthy = await this.db.healthCheck();
            if (!isHealthy) {
                throw new BotError('Database health check failed', 'DB_HEALTH_FAIL');
            }
            
            // Load guild settings
            await this.loadGuildSettingsFromDatabase();
            
            // Initialize voice sessions from existing channels
            await this.initializeExistingVoiceSessions();
            
            // Initialize managers
            this.dailyResetManager = new DailyResetManager(this);
            this.voiceXPManager = new VoiceXPManager(this);
            this.levelUpManager = new LevelUpManager(this);
            
            await this.dailyResetManager.initialize();
            
            // Start cleanup interval
            this.cleanupInterval = setInterval(() => this.performMaintenance(), this.config.limits.cleanupInterval);
            
            console.log('[XP TRACKER] Initialization completed successfully');
        } catch (error) {
            console.error('[XP TRACKER] Initialization failed:', error);
            this.monitor.trackError(error, 'initialization');
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
    
    async awardXP(userId, guildId, xpAmount, source, user, skipMultiplier = false) {
        const start = Date.now();
        
        try {
            const guild = this.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            
            let finalXP = xpAmount;
            
            // Generate random XP if amount is null
            if (xpAmount === null) {
                finalXP = this.getRandomXP(source);
            }
            
            // Apply multipliers if not skipping
            if (!skipMultiplier) {
                finalXP = await this.applyMultipliers(finalXP, guildId, member);
            }
            
            const actualXP = Math.max(1, Math.round(finalXP));
            
            // Use transaction for consistency
            await this.db.transaction(async (client) => {
                // Get current stats
                const beforeResult = await client.query(
                    'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                    [userId, guildId]
                );
                
                const oldLevel = beforeResult.rows.length > 0 ? beforeResult.rows[0].level : 0;
                
                // Update user XP
                await client.query(`
                    INSERT INTO user_levels (user_id, guild_id, total_xp, messages, reactions, voice_time, level, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id, guild_id)
                    DO UPDATE SET
                        total_xp = user_levels.total_xp + $3,
                        messages = user_levels.messages + $4,
                        reactions = user_levels.reactions + $5,
                        voice_time = user_levels.voice_time + $6,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    userId, guildId, actualXP,
                    source === 'message' ? 1 : 0,
                    source === 'reaction' ? 1 : 0,
                    source === 'voice' ? 1 : 0,
                    oldLevel
                ]);
                
                // Get updated total XP and calculate new level
                const afterResult = await client.query(
                    'SELECT total_xp FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                    [userId, guildId]
                );
                
                const newTotalXP = afterResult.rows[0].total_xp;
                const newLevel = this.calculateLevel(newTotalXP);
                
                // Update level if changed
                if (newLevel !== oldLevel) {
                    await client.query(
                        'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                        [newLevel, userId, guildId]
                    );
                    
                    // Handle level up (outside transaction)
                    setImmediate(() => {
                        this.handleLevelUpWithCanvas(userId, guildId, oldLevel, newLevel, newTotalXP, user, source)
                            .catch(error => {
                                console.error('[LEVEL UP] Error handling level up:', error);
                                this.monitor.trackError(error, 'level_up');
                            });
                    });
                }
                
                return { newTotalXP, newLevel, oldLevel };
            });
            
            // Update cache
            this.userCache.set(`${userId}:${guildId}`, {
                total_xp: finalXP,
                level: this.calculateLevel(finalXP),
                updated_at: new Date()
            });
            
            const duration = Date.now() - start;
            this.monitor.trackCommand('awardXP', duration, true);
            
        } catch (error) {
            const duration = Date.now() - start;
            this.monitor.trackCommand('awardXP', duration, false);
            this.monitor.trackError(error, 'award_xp');
            console.error('[XP TRACKER] Error awarding XP:', error);
            throw error;
        }
    }
    
    async applyMultipliers(baseXP, guildId, member) {
        let finalXP = baseXP;
        
        try {
            // Apply XP role boosts
            if (global.xpBoostManager && member) {
                const boostResult = await global.xpBoostManager.calculateUserBoost(guildId, member);
                if (boostResult.multiplier > 1.0) {
                    finalXP *= boostResult.multiplier;
                }
            }
            
            // Apply global multiplier
            const guildSettings = global.guildSettings?.get(guildId) || { xpMultiplier: 1.0 };
            const multiplier = guildSettings.xpMultiplier || parseFloat(process.env.XP_MULTIPLIER) || 1.0;
            
            if (multiplier !== 1.0) {
                finalXP *= multiplier;
            }
        } catch (error) {
            console.warn('[XP TRACKER] Error applying multipliers, using base XP:', error);
            this.monitor.trackError(error, 'multipliers');
        }
        
        return finalXP;
    }
    
    async handleLevelUpWithCanvas(userId, guildId, oldLevel, newLevel, totalXP, user, xpSource = 'unknown') {
        try {
            console.log(`[LEVEL UP] Processing level up for ${user.username}: ${oldLevel} → ${newLevel}`);
            
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;
            
            // Award level roles
            const roleReward = await this.awardLevelRoles(userId, guildId, newLevel, member);
            
            // Send level up notification with canvas
            await this.sendLevelUpNotificationWithCanvas(userId, guildId, oldLevel, newLevel, totalXP, user, member, roleReward);
            
            // Log level up
            await this.logLevelUp(user, guildId, oldLevel, newLevel, totalXP, roleReward, xpSource);
            
        } catch (error) {
            console.error('[LEVEL UP] Error handling level up:', error);
            this.monitor.trackError(error, 'level_up');
        }
    }
    
    async awardLevelRoles(userId, guildId, level, member) {
        try {
            const levelRoles = [
                { level: 5, roleId: process.env.LEVEL_5_ROLE },
                { level: 10, roleId: process.env.LEVEL_10_ROLE },
                { level: 15, roleId: process.env.LEVEL_15_ROLE },
                { level: 20, roleId: process.env.LEVEL_20_ROLE },
                { level: 25, roleId: process.env.LEVEL_25_ROLE },
                { level: 30, roleId: process.env.LEVEL_30_ROLE },
                { level: 35, roleId: process.env.LEVEL_35_ROLE },
                { level: 40, roleId: process.env.LEVEL_40_ROLE },
                { level: 45, roleId: process.env.LEVEL_45_ROLE },
                { level: 50, roleId: process.env.LEVEL_50_ROLE }
            ];
            
            let roleReward = null;
            
            for (const { level: reqLevel, roleId } of levelRoles) {
                if (level >= reqLevel && roleId && roleId !== `role_id_${reqLevel}`) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role && !member.roles.cache.has(roleId)) {
                        await withRetry(async () => {
                            await member.roles.add(role, `Level up reward: reached level ${level}`);
                        });
                        
                        roleReward = role.name;
                        console.log(`[LEVEL UP] Added level ${reqLevel} role (${role.name}) to ${member.user.username}`);
                        break;
                    }
                }
            }
            
            return roleReward;
        } catch (error) {
            console.error('[LEVEL UP] Error awarding level roles:', error);
            this.monitor.trackError(error, 'role_award');
            return null;
        }
    }
    
    async sendLevelUpNotificationWithCanvas(userId, guildId, oldLevel, newLevel, totalXP, user, member, roleReward = null) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            
            const guildSettings = global.guildSettings?.get(guildId);
            
            const levelupEnabled = guildSettings?.levelupEnabled !== false;
            if (!levelupEnabled) {
                console.log('[LEVEL UP] Level up announcements disabled for this guild');
                return;
            }
            
            let channelId = guildSettings?.levelupChannel;
            
            if (!channelId) {
                // Find a suitable channel
                const defaultChannel = guild.channels.cache.find(ch => 
                    (ch.name.toLowerCase().includes('general') || 
                     ch.name.toLowerCase().includes('chat') ||
                     ch.name.toLowerCase().includes('level') ||
                     ch.name.toLowerCase().includes('bounty')) && ch.isTextBased()
                );
                
                if (defaultChannel) {
                    channelId = defaultChannel.id;
                }
            }
            
            if (!channelId) {
                console.log('[LEVEL UP] No suitable channel found for announcements');
                return;
            }
            
            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) {
                console.log(`[LEVEL UP] Channel ${channelId} not found or not text-based`);
                return;
            }
            
            // Create wanted poster canvas
            const userData = {
                userId: user.id,
                level: newLevel,
                total_xp: totalXP,
                messages: 0,
                reactions: 0,
                voice_time: 0,
                member: member,
                isPirateKing: false
            };
            
            const canvas = await this.createWantedPoster(userData, guild);
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `levelup_wanted_${user.id}.png` });
            
            // Create Marine Intelligence embed with canvas
            const embed = this.createLevelUpEmbedWithCanvas(user, oldLevel, newLevel, totalXP, roleReward);
            
            const messageOptions = { 
                embeds: [embed], 
                files: [attachment] 
            };
            
            // Ping user if enabled
            const pingUser = process.env.LEVELUP_PING_USER !== 'false';
            if (pingUser) {
                messageOptions.content = `<@${userId}>`;
            }
            
            await withRetry(async () => {
                await channel.send(messageOptions);
            });
            
            console.log(`[LEVEL UP] Level up notification with canvas sent for ${user.username} in #${channel.name}`);
            
        } catch (error) {
            console.error('[LEVEL UP] Error sending level up notification with canvas:', error);
            this.monitor.trackError(error, 'level_notification');
        }
    }
    
    createLevelUpEmbedWithCanvas(user, oldLevel, newLevel, totalXP, roleReward = null) {
        try {
            const oldBounty = getBountyForLevel(oldLevel);
            const newBounty = getBountyForLevel(newLevel);
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: 'World Government Intelligence Bureau'
                })
                .setColor(0xFF0000)
                .setTitle('Bounty Update - Threat Level Increased')
                .setDescription(`**${user.username}** has reached a new level of infamy!`)
                .addFields({
                    name: 'Intelligence Summary',
                    value: `\`\`\`diff\n- Subject: ${user.username}\n- Previous Bounty: ${oldBounty.toLocaleString()}\n- New Bounty: ${newBounty.toLocaleString()}\n- Level: ${oldLevel} → ${newLevel}\n- Total XP: ${totalXP.toLocaleString()}\n${roleReward ? `- Role Awarded: ${roleReward}\n` : ''}\`\`\``,
                    inline: false
                })
                .setImage(`attachment://levelup_wanted_${user.id}.png`)
                .setFooter({ text: 'Marine Intelligence Division - Bounty System' })
                .setTimestamp();
            
            return embed;
        } catch (error) {
            console.error('[LEVEL UP] Error creating level up embed with canvas:', error);
            this.monitor.trackError(error, 'level_embed');
            
            return new EmbedBuilder()
                .setColor('#DC143C')
                .setTitle('Level Up!')
                .setDescription(`**${user.username}** leveled up from ${oldLevel} to ${newLevel}!`)
                .setThumbnail(user.displayAvatarURL({ size: 128 }))
                .setTimestamp();
        }
    }
    
    async createWantedPoster(userData, guild) {
        const width = 600, height = 900;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        try {
            // Load and draw scroll texture background
            try {
                const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
                ctx.drawImage(scrollTexture, 0, 0, width, height);
            } catch (error) {
                // Fallback background
                ctx.fillStyle = '#f5e6c5';
                ctx.fillRect(0, 0, width, height);
            }
            
            // Borders
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 8;
            ctx.strokeRect(0, 0, width, height);
            
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, width - 20, height - 20);
            
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeRect(18, 18, width - 36, height - 36);
            
            // WANTED title
            ctx.fillStyle = '#111';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '81px CaptainKiddNF, Arial, sans-serif';
            const wantedY = height * (1 - 92/100);
            const wantedX = (50/100) * width;
            ctx.fillText('WANTED', wantedX, wantedY);
            
            // Image Box
            const photoSize = (95/100) * 400;
            const photoX = ((50/100) * width) - (photoSize/2);
            const photoY = height * (1 - 65/100) - (photoSize/2);
            
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeRect(photoX, photoY, photoSize, photoSize);
            
            // Avatar
            let member = null;
            try {
                if (guild && userData.userId) member = await guild.members.fetch(userData.userId);
            } catch {}
            
            const avatarArea = { x: photoX + 3, y: photoY + 3, width: photoSize - 6, height: photoSize - 6 };
            if (member) {
                try {
                    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
                    const avatar = await loadImage(avatarURL);
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                    ctx.clip();
                    
                    ctx.filter = 'contrast(0.95) sepia(0.05)';
                    ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                    ctx.filter = 'none';
                    
                    ctx.restore();
                } catch (error) {
                    console.log('[CANVAS] No avatar found, texture will show through');
                }
            }
            
            // "DEAD OR ALIVE"
            ctx.fillStyle = '#111';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '57px CaptainKiddNF, Arial, sans-serif';
            const deadOrAliveY = height * (1 - 39/100);
            const deadOrAliveX = (50/100) * width;
            ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);
            
            // Name
            ctx.font = '69px CaptainKiddNF, Arial, sans-serif';
            let displayName = 'UNKNOWN PIRATE';
            if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
            else if (userData.userId) displayName = `PIRATE ${userData.userId.slice(-4)}`;
            
            // Check if name is too long and adjust
            ctx.textAlign = 'center';
            let nameWidth = ctx.measureText(displayName).width;
            if (nameWidth > width - 60) {
                ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
            }
            
            const nameY = height * (1 - 30/100);
            const nameX = (50/100) * width;
            ctx.fillText(displayName, nameX, nameY);
            
            // Berry Symbol and Bounty Numbers
            const berryBountyGap = 5;
            const isPirateKingData = userData.isPirateKing || false;
            const bountyAmount = getBountyForLevel(userData.level, isPirateKingData);
            const bountyStr = bountyAmount.toLocaleString();
            
            ctx.font = '54px Cinzel, Georgia, serif';
            const bountyTextWidth = ctx.measureText(bountyStr).width;
            
            // Berry symbol size
            const berrySize = (32/100) * 150;
            
            // Calculate total width of the bounty unit (berry + gap + text)
            const gapPixels = (berryBountyGap/100) * width;
            const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
            
            // Center the entire bounty unit horizontally
            const bountyUnitStartX = (width - totalBountyWidth) / 2;
            
            // Position berry symbol at the start of the centered unit
            const berryX = bountyUnitStartX + (berrySize/2);
            const berryY = height * (1 - 22/100) - (berrySize/2);
            
            let berryImg;
            try {
                const berryPath = path.join(__dirname, '../../assets/berry.png');
                berryImg = await loadImage(berryPath);
            } catch {
                // Create simple berry symbol
                const berryCanvas = createCanvas(berrySize, berrySize);
                const berryCtx = berryCanvas.getContext('2d');
                berryCtx.fillStyle = '#111';
                berryCtx.font = `bold ${berrySize}px serif`;
                berryCtx.textAlign = 'center';
                berryCtx.textBaseline = 'middle';
                berryCtx.fillText('฿', berrySize/2, berrySize/2);
                berryImg = berryCanvas;
            }
            
            ctx.drawImage(berryImg, berryX - (berrySize/2), berryY, berrySize, berrySize);
            
            // Position bounty numbers with fixed gap from berry
            const bountyX = bountyUnitStartX + berrySize + gapPixels;
            const bountyY = height * (1 - 22/100);
            
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#111';
            ctx.fillText(bountyStr, bountyX, bountyY);
            
            // One Piece logo
            try {
                const onePieceLogoPath = path.join(__dirname, '../../assets/one-piece-symbol.png');
                const onePieceLogo = await loadImage(onePieceLogoPath);
                const logoSize = (26/100) * 200;
                const logoX = ((50/100) * width) - (logoSize/2);
                const logoY = height * (1 - 4.5/100) - (logoSize/2);
                
                ctx.globalAlpha = 0.6;
                ctx.filter = 'sepia(0.2) brightness(0.9)';
                ctx.drawImage(onePieceLogo, logoX, logoY, logoSize, logoSize);
                ctx.globalAlpha = 1.0;
                ctx.filter = 'none';
            } catch {
                // Logo not found, continue without it
            }
            
            // "MARINE" text
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.font = '24px TimesNewNormal, Times, serif';
            ctx.fillStyle = '#111';
            
            const marineText = 'M A R I N E';
            const marineX = (96/100) * width;
            const marineY = height * (1 - 2/100);
            ctx.fillText(marineText, marineX, marineY);
            
            return canvas;
        } catch (error) {
            console.error('[CANVAS] Error creating wanted poster:', error);
            this.monitor.trackError(error, 'canvas');
            throw error;
        }
    }
    
    async logLevelUp(user, guildId, oldLevel, newLevel, totalXP, roleReward, xpSource) {
        try {
            const guildSettings = global.guildSettings?.get(guildId);
            
            if (!guildSettings?.xpLogEnabled || !guildSettings?.xpLogChannel) return;
            
            const channel = await this.client.channels.fetch(guildSettings.xpLogChannel).catch(() => null);
            if (!channel || !channel.isTextBased()) return;
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setAuthor({ 
                    name: 'Marine Intelligence Bureau',
                    iconURL: user.displayAvatarURL({ size: 32 })
                })
                .setTitle('Threat Level Increased')
                .setDescription(`\`\`\`diff\n- BOUNTY UPDATE CONFIRMED\n- SUBJECT: ${user.username} (${user.id})\n- LEVEL: ${oldLevel} → ${newLevel}\n- TOTAL XP: ${totalXP.toLocaleString()}\n- XP SOURCE: ${xpSource.toUpperCase()}\n${roleReward ? `- ROLE AWARDED: ${roleReward}\n` : ''}\`\`\``)
                .setTimestamp()
                .setFooter({ text: 'Marine Intelligence Division' });
            
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[XP LOG] Failed to send level up log:', error);
            this.monitor.trackError(error, 'level_log');
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
    
    createProgressBar(current, max, length = 20) {
        const percentage = Math.max(0, Math.min(1, current / max));
        const filled = Math.round(percentage * length);
        const empty = length - filled;
        
        const filledChar = '█';
        const emptyChar = '░';
        
        return filledChar.repeat(filled) + emptyChar.repeat(empty);
    }
    
    // Database query methods with caching
    async getUserStats(userId, guildId) {
        const cacheKey = `${userId}:${guildId}`;
        let stats = this.userCache.get(cacheKey);
        
        if (stats) {
            return stats;
        }
        
        try {
            const result = await this.db.query(`
                SELECT user_id, guild_id, total_xp, level, messages, reactions, voice_time, 
                       created_at, updated_at
                FROM user_levels 
                WHERE user_id = $1 AND guild_id = $2
            `, [userId, guildId]);
            
            stats = result.rows.length > 0 ? result.rows[0] : null;
            
            if (stats) {
                this.userCache.set(cacheKey, stats);
            }
            
            return stats;
        } catch (error) {
            console.error('[XP TRACKER] Error getting user stats:', error);
            this.monitor.trackError(error, 'user_stats');
            return null;
        }
    }
    
    async getUserRank(userId, guildId) {
        try {
            const result = await this.db.query(`
                SELECT COUNT(*) + 1 as rank 
                FROM user_levels 
                WHERE guild_id = $1 AND total_xp > (
                    SELECT total_xp FROM user_levels WHERE user_id = $2 AND guild_id = $1
                )
            `, [guildId, userId]);
            
            return result.rows[0]?.rank || null;
        } catch (error) {
            console.error('[XP TRACKER] Error getting user rank:', error);
            this.monitor.trackError(error, 'user_rank');
            return null;
        }
    }
    
    async getLeaderboard(guildId, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;
            
            const result = await this.db.query(`
                SELECT user_id, total_xp, level, messages, reactions, voice_time
                FROM user_levels 
                WHERE guild_id = $1 AND total_xp > 0
                ORDER BY total_xp DESC 
                LIMIT $2 OFFSET $3
            `, [guildId, limit, offset]);
            
            const countResult = await this.db.query(
                'SELECT COUNT(*) FROM user_levels WHERE guild_id = $1 AND total_xp > 0',
                [guildId]
            );
            
            const totalUsers = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalUsers / limit);
            
            return {
                users: result.rows.map((row, index) => ({
                    userId: row.user_id,
                    level: row.level,
                    total_xp: row.total_xp,
                    messages: row.messages,
                    reactions: row.reactions,
                    voice_time: row.voice_time,
                    rank: offset + index + 1
                })),
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalUsers,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            };
        } catch (error) {
            console.error('[XP TRACKER] Error getting leaderboard:', error);
            this.monitor.trackError(error, 'leaderboard');
            throw error;
        }
    }
    
    // Maintenance and cleanup
    async performMaintenance() {
        if (this.isShuttingDown) return;
        
        try {
            console.log('[XP TRACKER] Starting maintenance...');
            
            // Clear expired cache entries (handled automatically by LimitedMap)
            // Clean up old cooldowns (handled automatically by LimitedMap)
            
            // Database health check
            const isHealthy = await this.db.healthCheck();
            if (!isHealthy) {
                console.error('[XP TRACKER] Database health check failed during maintenance');
                this.monitor.trackError(new BotError('Database unhealthy', 'DB_HEALTH_FAIL'), 'maintenance');
            }
            
            // Log performance metrics
            const stats = this.monitor.getStats();
            console.log(`[PERFORMANCE] Uptime: ${Math.round(stats.uptime / 1000 / 60)}min, Memory: ${stats.memory[stats.memory.length - 1]?.heapUsed || 0}MB`);
            
            console.log('[XP TRACKER] Maintenance completed');
        } catch (error) {
            console.error('[XP TRACKER] Error during maintenance:', error);
            this.monitor.trackError(error, 'maintenance');
        }
    }
    
    // Force daily reset (delegated to reset manager)
    async forceDailyReset(triggeredBy = 'SYSTEM') {
        if (!this.dailyResetManager) {
            throw new BotError('Daily reset manager not initialized', 'MANAGER_NOT_READY');
        }
        
        return await this.dailyResetManager.forceDailyReset(triggeredBy);
    }
    
    // Enhanced logging with daily cap information
    async logXPActivity(type, user, guildId, xpGain, additionalInfo = {}) {
        try {
            const guildSettings = global.guildSettings?.get(guildId);
            
            if (!guildSettings?.xpLogEnabled || !guildSettings?.xpLogChannel) return;
            
            const channel = await this.client.channels.fetch(guildSettings.xpLogChannel).catch(() => null);
            if (!channel || !channel.isTextBased()) return;
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setAuthor({ 
                    name: 'Marine Intelligence Bureau',
                    iconURL: user.displayAvatarURL({ size: 32 })
                })
                .setTimestamp()
                .setFooter({ text: 'Marine Intelligence Division' });
            
            switch (type) {
                case 'voice':
                    const dailyCap = this.config.limits.dailyVoiceXP;
                    const currentDay = this.dailyResetManager ? this.dailyResetManager.getCurrentDay() : 'Unknown';
                    const dailyXP = this.dailyResetManager ? 
                        this.dailyResetManager.getDailyVoiceXP(user.id, guildId, currentDay) : 0;
                    const remainingXP = Math.max(0, dailyCap - dailyXP);
                    const capPercentage = Math.round((dailyXP / dailyCap) * 100);
                    const progressBar = this.createProgressBar(dailyXP, dailyCap, 20);
                    
                    embed
                        .setTitle('Voice Activity Detected')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- VOICE CHANNEL: ${additionalInfo.channelName || 'Unknown'}\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || '0'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || '0'}\n\`\`\``)
                        .addFields(
                            {
                                name: 'Daily Voice XP Progress',
                                value: `\`\`\`yaml\nDaily XP: ${dailyXP.toLocaleString()}/${dailyCap.toLocaleString()} (${capPercentage}%)\nRemaining: ${remainingXP.toLocaleString()} XP\nReset Day: ${currentDay}\n\`\`\``,
                                inline: true
                            },
                            {
                                name: 'Progress Bar',
                                value: `\`${progressBar}\`\n${dailyXP >= dailyCap ? 'DAILY CAP REACHED' : `${remainingXP} XP until cap`}`,
                                inline: true
                            }
                        );
                    break;
                
                case 'message':
                    embed
                        .setTitle('Message Activity Detected')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || '0'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || '0'}\n\`\`\``);
                    break;
                
                case 'reaction':
                    embed
                        .setTitle('Reaction Activity Detected')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || '0'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || '0'}\n\`\`\``);
                    break;
                
                default:
                    embed
                        .setTitle(`${type.toUpperCase()} Activity Detected`)
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || '0'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || '0'}\n\`\`\``);
                    break;
            }
            
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[XP LOG] Failed to send XP log:', error);
            this.monitor.trackError(error, 'xp_log');
        }
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
            await this.db.close();
            
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
