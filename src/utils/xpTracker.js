// src/utils/xpTracker.js - Core XP Tracking System

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

class XPTracker {
    constructor(client, database) {
        this.client = client;
        this.db = database;
        this.voiceSessions = new Map();
        this.cooldowns = new Map();
        this.dailyVoiceXP = new Map(); // Format: "userId_guildId_YYYY-MM-DD" -> total XP earned today
        
        this.loadGuildSettingsFromDatabase();
        this.initializeExistingVoiceSessions();
        this.loadDailyVoiceXPFromDatabase();
        
        // Schedule daily cleanup at 3 AM EST
        this.scheduleDailyReset();
    }

    // Get next reset time for display
    getNextResetTime() {
        const now = new Date();
        const estOffset = this.isESTDaylightSaving(now) ? -4 : -5;
        const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        
        // Calculate next 3 AM EST
        const nextReset = new Date(estTime);
        nextReset.setHours(3, 0, 0, 0);
        
        // If it's already past 3 AM today, set to 3 AM tomorrow
        if (estTime.getHours() >= 3) {
            nextReset.setDate(nextReset.getDate() + 1);
        }
        
        // Convert back to local time for display
        const localReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
        
        return localReset.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    }

    // Load daily voice XP from database on startup with 3 AM EST reset
    async loadDailyVoiceXPFromDatabase() {
        try {
            console.log('[DAILY CAP] Loading daily voice XP data from database (3 AM EST reset)...');
            
            // Create daily_voice_xp table if it doesn't exist
            await this.db.query(`
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

            // Create index for better performance
            await this.db.query('CREATE INDEX IF NOT EXISTS idx_daily_voice_xp_date ON daily_voice_xp(date)');

            // Load today's data using 3 AM EST reset
            const today = this.getCurrentDayKey(); // Use 3 AM EST reset
            const result = await this.db.query(
                'SELECT user_id, guild_id, total_xp FROM daily_voice_xp WHERE date = $1',
                [today]
            );

            let loadedCount = 0;
            for (const row of result.rows) {
                const dailyKey = `${row.user_id}_${row.guild_id}_${today}`;
                this.dailyVoiceXP.set(dailyKey, row.total_xp);
                loadedCount++;
            }

            console.log(`[DAILY CAP] Loaded ${loadedCount} daily voice XP records for current day (${today})`);
            console.log(`[DAILY CAP] Next reset: ${this.getNextResetTime()}`);

            // Clean up old records (older than 7 days)
            await this.db.query(
                "DELETE FROM daily_voice_xp WHERE date < CURRENT_DATE - INTERVAL '7 days'"
            );

        } catch (error) {
            console.error('[DAILY CAP] Error loading daily voice XP data:', error);
        }
    }

    // Save daily voice XP to database
    async saveDailyVoiceXP(userId, guildId, date, totalXP) {
        try {
            await this.db.query(`
                INSERT INTO daily_voice_xp (user_id, guild_id, date, total_xp, updated_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET
                    total_xp = $4,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, guildId, date, totalXP]);

        } catch (error) {
            console.error('[DAILY CAP] Error saving daily voice XP:', error);
        }
    }

    // Get current "day" based on 3 AM EST reset time
    getCurrentDayKey() {
        const now = new Date();
        
        // Convert to EST/EDT (UTC-5/UTC-4)
        const estOffset = this.isESTDaylightSaving(now) ? -4 : -5; // EDT vs EST
        const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        
        // If it's before 3 AM EST, use previous day
        if (estTime.getHours() < 3) {
            estTime.setDate(estTime.getDate() - 1);
        }
        
        // Return YYYY-MM-DD format
        return estTime.toISOString().split('T')[0];
    }

    // Check if daylight saving time is active (approximate)
    isESTDaylightSaving(date) {
        const year = date.getFullYear();
        
        // DST typically runs from 2nd Sunday in March to 1st Sunday in November
        const march = new Date(year, 2, 1); // March 1st
        const november = new Date(year, 10, 1); // November 1st
        
        // Find 2nd Sunday in March
        const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
        
        // Find 1st Sunday in November  
        const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
        
        return date >= dstStart && date < dstEnd;
    }

    // Get daily voice XP with 3 AM EST reset
    getDailyVoiceXP(userId, guildId, date = null) {
        if (!date) {
            date = this.getCurrentDayKey(); // Use 3 AM EST reset
        }
        const dailyKey = `${userId}_${guildId}_${date}`;
        return this.dailyVoiceXP.get(dailyKey) || 0;
    }

    // Set daily voice XP with 3 AM EST reset and database persistence
    async setDailyVoiceXP(userId, guildId, xp, date = null) {
        if (!date) {
            date = this.getCurrentDayKey(); // Use 3 AM EST reset
        }
        const dailyKey = `${userId}_${guildId}_${date}`;
        this.dailyVoiceXP.set(dailyKey, xp);
        
        // Save to database asynchronously
        this.saveDailyVoiceXP(userId, guildId, date, xp).catch(error => {
            console.error('[DAILY CAP] Failed to save to database:', error);
        });
    }

    // Simplified: Everyone uses the same daily XP cap
    getUserDailyXPCap(member) {
        const defaultCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || parseInt(process.env.DAILY_VOICE_XP_CAP_DEFAULT) || 1500;
        return {
            cap: defaultCap,
            source: 'Default',
            tier: 0
        };
    }

    async loadGuildSettingsFromDatabase() {
        try {
            console.log('[SETTINGS] Loading guild settings from database...');
            
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }

            const tableInfo = await this.db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'guild_settings'
                ORDER BY ordinal_position
            `);

            console.log('[SETTINGS] Current guild_settings table columns:', tableInfo.rows.map(r => r.column_name).join(', '));

            const existingColumns = tableInfo.rows.map(r => r.column_name);
            
            if (!existingColumns.includes('levelup_enabled')) {
                console.log('[SETTINGS] Adding levelup_enabled column...');
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS levelup_enabled BOOLEAN DEFAULT true');
            }
            
            if (!existingColumns.includes('xp_log_enabled')) {
                console.log('[SETTINGS] Adding xp_log_enabled column...');
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_log_enabled BOOLEAN DEFAULT false');
            }
            
            if (!existingColumns.includes('xp_multiplier')) {
                console.log('[SETTINGS] Adding xp_multiplier column...');
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_multiplier DECIMAL(3,2) DEFAULT 1.0');
            }

            if (!existingColumns.includes('levelup_channel')) {
                console.log('[SETTINGS] Adding levelup_channel column...');
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS levelup_channel VARCHAR(20)');
            }

            if (!existingColumns.includes('xp_log_channel')) {
                console.log('[SETTINGS] Adding xp_log_channel column...');
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_log_channel VARCHAR(20)');
            }

            const result = await this.db.query(`
                SELECT guild_id, levelup_channel, levelup_enabled, xp_log_channel, xp_log_enabled, xp_multiplier
                FROM guild_settings
            `);

            console.log(`[SETTINGS] Found ${result.rows.length} guild configurations in database`);

            let loadedCount = 0;
            for (const row of result.rows) {
                const guildSettings = {
                    levelupChannel: row.levelup_channel,
                    levelupEnabled: row.levelup_enabled,
                    xpLogChannel: row.xp_log_channel,
                    xpLogEnabled: row.xp_log_enabled,
                    xpMultiplier: parseFloat(row.xp_multiplier)
                };

                global.guildSettings.set(row.guild_id, guildSettings);
                loadedCount++;
            }

            console.log(`[SETTINGS] Successfully loaded ${loadedCount} guild configurations from database`);

        } catch (error) {
            console.error('[SETTINGS] Error loading guild settings from database:', error);
            
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }
        }
    }

    async initializeExistingVoiceSessions() {
        try {
            console.log('[VOICE XP] Scanning for existing voice channel members...');
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            let totalFound = 0;
            
            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    const voiceChannels = guild.channels.cache.filter(channel => 
                        channel.type === 2 && 
                        channel.members && 
                        channel.members.size > 0
                    );
                    
                    for (const [channelId, channel] of voiceChannels) {
                        for (const [memberId, member] of channel.members) {
                            if (!member.user.bot) {
                                this.voiceSessions.set(memberId, {
                                    guildId: guildId,
                                    channelId: channelId,
                                    joinTime: Date.now(),
                                    lastXPTime: Date.now(),
                                    isMuted: member.voice.mute || member.voice.selfMute,
                                    isDeafened: member.voice.deaf || member.voice.selfDeaf
                                });
                                totalFound++;
                                console.log(`[VOICE XP] Added existing member: ${member.user.username} in ${channel.name}`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`[VOICE XP] Error scanning guild ${guild.name}:`, error);
                }
            }
            
            console.log(`[VOICE XP] Initialized ${totalFound} existing voice sessions`);
            
        } catch (error) {
            console.error('[VOICE XP] Error initializing existing voice sessions:', error);
        }
    }

    async scheduleDailyReset() {
        try {
            // Calculate milliseconds until next 3 AM EST
            const now = new Date();
            const estOffset = this.isESTDaylightSaving(now) ? -4 : -5;
            const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
            
            const nextReset = new Date(estTime);
            nextReset.setHours(3, 0, 0, 0);
            
            if (estTime.getHours() >= 3) {
                nextReset.setDate(nextReset.getDate() + 1);
            }
            
            const msUntilReset = nextReset.getTime() - estTime.getTime();
            
            console.log(`[DAILY RESET] Scheduled daily cleanup in ${Math.round(msUntilReset / 1000 / 60 / 60)} hours (at 3 AM EST)`);
            
            setTimeout(async () => {
                await this.performDailyReset();
                // Schedule next reset (24 hours later)
                setInterval(async () => {
                    await this.performDailyReset();
                }, 24 * 60 * 60 * 1000);
            }, msUntilReset);
            
        } catch (error) {
            console.error('[DAILY RESET] Error scheduling daily reset:', error);
        }
    }

    async performDailyReset() {
        try {
            console.log('[DAILY RESET] Starting daily cleanup at 3 AM EST...');
            
            // Clean up old daily voice XP records (keep last 7 days)
            const result = await this.db.query(
                "DELETE FROM daily_voice_xp WHERE date < CURRENT_DATE - INTERVAL '7 days'"
            );
            
            // Clear in-memory cache of old data
            const today = this.getCurrentDayKey();
            const keysToDelete = [];
            
            for (const [key, value] of this.dailyVoiceXP.entries()) {
                const keyParts = key.split('_');
                const keyDate = keyParts[keyParts.length - 1]; // Last part is the date
                
                if (keyDate !== today) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => this.dailyVoiceXP.delete(key));
            
            console.log(`[DAILY RESET] Cleaned up ${result.rowCount || 0} old daily XP records and ${keysToDelete.length} cached entries`);
            
        } catch (error) {
            console.error('[DAILY RESET] Error during daily cleanup:', error);
        }
    }

    // Cleanup method
    async cleanupDailyVoiceXP() {
        return this.performDailyReset();
    }

    async cleanup() {
        this.voiceSessions.clear();
        this.cooldowns.clear();
        this.dailyVoiceXP.clear();
    }

    // Award XP method
    async awardXP(userId, guildId, xpAmount, source, user, skipMultiplier = false) {
        const { awardXP } = require('./awardManager');
        return await awardXP(this, userId, guildId, xpAmount, source, user, skipMultiplier);
    }

    // Get user stats
    async getUserStats(userId, guildId) {
        const { getUserStats } = require('./xpUtils');
        return await getUserStats(this, userId, guildId);
    }

    // Get user rank
    async getUserRank(userId, guildId) {
        const { getUserRank } = require('./xpUtils');
        return await getUserRank(this, userId, guildId);
    }

    // Get leaderboard
    async getLeaderboard(guildId, page = 1, limit = 50) {
        const { getLeaderboard } = require('./xpUtils');
        return await getLeaderboard(this, guildId, page, limit);
    }

    // Calculate level from XP
    calculateLevel(totalXP) {
        const { calculateLevel } = require('./awardManager');
        return calculateLevel(totalXP);
    }

    // Get XP required for level
    getXPForLevel(level) {
        const { getXPForLevel } = require('./awardManager');
        return getXPForLevel(level);
    }

    // Log XP activity
    async logXPActivity(type, user, guildId, xpGain, additionalInfo = {}) {
        const { logXPActivity } = require('./awardManager');
        return await logXPActivity(this, type, user, guildId, xpGain, additionalInfo);
    }

    // Handle voice state updates
    async handleVoiceStateUpdate(oldState, newState) {
        const { VoiceHandler } = require('./voiceHandler');
        const voiceHandler = new VoiceHandler(this);
        return await voiceHandler.handleVoiceStateUpdate(oldState, newState);
    }

    // Process voice XP
    async processVoiceXP() {
        try {
            const now = Date.now();
            const voiceXPCooldown = parseInt(process.env.VOICE_COOLDOWN) || 60000;
            const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
            const antiAFK = process.env.VOICE_ANTI_AFK === 'true';
            const today = this.getCurrentDayKey();

            console.log(`[VOICE XP] Processing voice XP for ${this.voiceSessions.size} active sessions (3 AM EST reset)`);

            const processedUsers = new Set();

            for (const [userId, session] of this.voiceSessions.entries()) {
                try {
                    if (processedUsers.has(userId)) continue;
                    processedUsers.add(userId);

                    if (now - session.lastXPTime < voiceXPCooldown) continue;

                    const guild = this.client.guilds.cache.get(session.guildId);
                    if (!guild) {
                        this.voiceSessions.delete(userId);
                        continue;
                    }

                    const channel = guild.channels.cache.get(session.channelId);
                    if (!channel) {
                        this.voiceSessions.delete(userId);
                        continue;
                    }

                    const memberCount = channel.members.filter(m => !m.user.bot).size;
                    if (memberCount < minMembers) {
                        console.log(`[VOICE XP] ${userId} in ${channel.name}: Not enough members (${memberCount}/${minMembers}), skipping`);
                        continue;
                    }

                    const user = await this.client.users.fetch(userId).catch(() => null);
                    if (!user) continue;

                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (!member) continue;

                    const guildSettings = global.guildSettings?.get(session.guildId) || { xpMultiplier: 1.0 };
                    if (guildSettings.excludedRole && member.roles.cache.has(guildSettings.excludedRole)) {
                        console.log(`[VOICE XP] ${user.username} has excluded role, skipping`);
                        continue;
                    }

                    // Get daily cap (simplified - everyone uses same cap)
                    const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
                    const currentDailyXP = this.getDailyVoiceXP(userId, session.guildId, today);
                    
                    if (currentDailyXP >= dailyCap) {
                        console.log(`[VOICE XP] ${user.username} has reached daily cap: ${currentDailyXP}/${dailyCap} XP`);
                        continue;
                    }

                    const voiceXPMin = parseInt(process.env.VOICE_XP_MIN) || 45;
                    const voiceXPMax = parseInt(process.env.VOICE_XP_MAX) || 55;
                    const baseXP = Math.floor(Math.random() * (voiceXPMax - voiceXPMin + 1)) + voiceXPMin;

                    let finalXP = baseXP;

                    // Apply mute/deafen penalty
                    let muteMultiplier = 1.0;
                    let muteReason = '';
                    if (antiAFK && (session.isMuted || session.isDeafened)) {
                        const exemptUsers = process.env.VOICE_MUTE_EXEMPT_USERS?.split(',') || [];
                        const exemptUser = process.env.VOICE_MUTE_EXEMPT_USER;
                        const exemptRoles = process.env.VOICE_MUTE_EXEMPT_ROLES?.split(',') || [];
                        const exemptMultiplier = parseFloat(process.env.VOICE_MUTE_EXEMPT_MULTIPLIER) || 1.0;
                        
                        let isExempt = false;
                        
                        if (exemptUsers.includes(userId) || userId === exemptUser) {
                            isExempt = true;
                            muteMultiplier = exemptMultiplier;
                            muteReason = 'EXEMPT USER';
                        }
                        
                        if (!isExempt && exemptRoles.length > 0) {
                            for (const roleId of exemptRoles) {
                                if (roleId && member.roles.cache.has(roleId.trim())) {
                                    isExempt = true;
                                    muteMultiplier = exemptMultiplier;
                                    muteReason = 'EXEMPT ROLE';
                                    break;
                                }
                            }
                        }
                        
                        if (!isExempt) {
                            muteMultiplier = 0.25;
                            muteReason = session.isMuted && session.isDeafened ? 'MUTED+DEAFENED' : 
                                       session.isMuted ? 'MUTED' : 'DEAFENED';
                        }
                        
                        console.log(`[VOICE XP] ${user.username} mute status: ${muteReason}, multiplier: ${muteMultiplier}x`);
                    }
                    
                    finalXP = Math.round(baseXP * muteMultiplier);
                    
                    // Apply XP boosts
                    if (global.xpBoostManager && member) {
                        try {
                            const boostResult = await global.xpBoostManager.calculateUserBoost(session.guildId, member);
                            if (boostResult.multiplier > 1.0) {
                                const boostedXP = Math.round(finalXP * boostResult.multiplier);
                                console.log(`[XP BOOST] ${user.username} voice: ${finalXP} → ${boostedXP} (${boostResult.multiplier}x boost)`);
                                finalXP = boostedXP;
                            }
                        } catch (error) {
                            console.error('[XP BOOST ERROR] Failed to calculate user boost for voice:', error);
                        }
                    }
                    
                    const globalMultiplier = guildSettings.xpMultiplier || 1.0;
                    if (globalMultiplier !== 1.0) {
                        const afterGlobal = Math.round(finalXP * globalMultiplier);
                        console.log(`[XP CALC] ${user.username} voice: ${finalXP} → ${afterGlobal} (${globalMultiplier}x global)`);
                        finalXP = afterGlobal;
                    }

                    // Apply daily cap
                    const newDailyTotal = currentDailyXP + finalXP;
                    if (newDailyTotal > dailyCap) {
                        finalXP = dailyCap - currentDailyXP;
                        console.log(`[VOICE XP] ${user.username} capped at daily limit: ${finalXP} XP awarded (${newDailyTotal}/${dailyCap})`);
                    }

                    if (finalXP > 0) {
                        await this.awardXP(userId, session.guildId, finalXP, 'voice', user, true);
                        
                        // Update daily voice XP
                        await this.setDailyVoiceXP(userId, session.guildId, currentDailyXP + finalXP, today);
                        
                        session.lastXPTime = now;
                        
                        console.log(`[VOICE XP] ${user.username}: +${finalXP} XP (Daily: ${currentDailyXP + finalXP}/${dailyCap})`);
                    }

                } catch (error) {
                    console.error(`[VOICE XP] Error processing user ${userId}:`, error);
                }
            }

        } catch (error) {
            console.error('[VOICE XP] Error in processVoiceXP:', error);
        }
    }
}

module.exports = XPTracker;
