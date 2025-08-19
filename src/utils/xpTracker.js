// src/utils/xpTracker.js - Part 1: Class Setup & Core Methods

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// CONFIGURABLE RESET TIME (EST)
const DAILY_RESET_HOUR_EST = parseInt(process.env.DAILY_RESET_HOUR_EST) || 3;
const DAILY_RESET_MINUTE_EST = parseInt(process.env.DAILY_RESET_MINUTE_EST) || 0;

// Register custom fonts
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
    console.log('[XP TRACKER] Successfully registered custom fonts');
} catch (error) {
    console.error('[XP TRACKER] Failed to register custom fonts:', error.message);
}

class XPTracker {
    constructor(client, database) {
        this.client = client;
        this.db = database;
        this.voiceSessions = new Map();
        this.cooldowns = new Map();
        this.dailyVoiceXP = new Map();
        this.resetTimeouts = new Map();
        
        console.log(`[XP TRACKER] Daily reset configured for ${DAILY_RESET_HOUR_EST}:${DAILY_RESET_MINUTE_EST.toString().padStart(2, '0')} EST`);
        
        this.loadGuildSettingsFromDatabase();
        this.initializeExistingVoiceSessions();
        this.loadDailyVoiceXPFromDatabase();
    }

    // Get current day based on configurable EST reset time
    getCurrentDay() {
        const now = new Date();
        const estOffset = this.isEDT(now) ? -4 : -5;
        const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        
        const currentHour = estTime.getHours();
        const currentMinute = estTime.getMinutes();
        const resetTimeInMinutes = (DAILY_RESET_HOUR_EST * 60) + DAILY_RESET_MINUTE_EST;
        const currentTimeInMinutes = (currentHour * 60) + currentMinute;
        
        if (currentTimeInMinutes < resetTimeInMinutes) {
            estTime.setDate(estTime.getDate() - 1);
        }
        
        return estTime.toISOString().split('T')[0];
    }

    // Check if date is in Eastern Daylight Time (EDT)
    isEDT(date) {
        const year = date.getFullYear();
        const marchSecondSunday = new Date(year, 2, 8);
        marchSecondSunday.setDate(marchSecondSunday.getDate() + (7 - marchSecondSunday.getDay()));
        const novemberFirstSunday = new Date(year, 10, 1);
        novemberFirstSunday.setDate(novemberFirstSunday.getDate() + (7 - novemberFirstSunday.getDay()));
        return date >= marchSecondSunday && date < novemberFirstSunday;
    }

    // Load guild settings from database
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

            const existingColumns = tableInfo.rows.map(r => r.column_name);
            
            // Add missing columns if they don't exist
            if (!existingColumns.includes('levelup_channel')) {
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS levelup_channel VARCHAR(20)');
            }
            if (!existingColumns.includes('levelup_enabled')) {
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS levelup_enabled BOOLEAN DEFAULT true');
            }
            if (!existingColumns.includes('xp_log_channel')) {
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_log_channel VARCHAR(20)');
            }
            if (!existingColumns.includes('xp_log_enabled')) {
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_log_enabled BOOLEAN DEFAULT false');
            }
            if (!existingColumns.includes('xp_multiplier')) {
                await this.db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS xp_multiplier DECIMAL(3,2) DEFAULT 1.0');
            }

            const result = await this.db.query(`
                SELECT guild_id, levelup_channel, levelup_enabled, xp_log_channel, xp_log_enabled, xp_multiplier
                FROM guild_settings
            `);

            let loadedCount = 0;
            for (const row of result.rows) {
                const guildSettings = {
                    levelupChannel: row.levelup_channel,
                    levelupEnabled: row.levelup_enabled,
                    xpLogChannel: row.xp_log_channel,
                    xpLogEnabled: row.xp_log_enabled,
                    xpMultiplier: parseFloat(row.xp_multiplier) || 1.0
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

    // Initialize existing voice sessions
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
// src/utils/xpTracker.js - Part 2: Daily Voice XP & Reset Logic
// (Add this after Part 1)

    // Load daily voice XP from database on startup
    async loadDailyVoiceXPFromDatabase() {
        try {
            console.log('[DAILY CAP] Loading daily voice XP data from database...');
            
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

            await this.db.query('CREATE INDEX IF NOT EXISTS idx_daily_voice_xp_date ON daily_voice_xp(date)');

            const currentDay = this.getCurrentDay();
            const result = await this.db.query(
                'SELECT user_id, guild_id, total_xp FROM daily_voice_xp WHERE date = $1',
                [currentDay]
            );

            let loadedCount = 0;
            for (const row of result.rows) {
                const dailyKey = `${row.user_id}_${row.guild_id}_${currentDay}`;
                this.dailyVoiceXP.set(dailyKey, row.total_xp);
                loadedCount++;
            }

            console.log(`[DAILY CAP] Loaded ${loadedCount} daily voice XP records for ${currentDay}`);

            await this.db.query(
                "DELETE FROM daily_voice_xp WHERE date < CURRENT_DATE - INTERVAL '30 days'"
            );

            this.scheduleDailyReset();

        } catch (error) {
            console.error('[DAILY CAP] Error loading daily voice XP data:', error);
        }
    }

    // Schedule daily reset
    scheduleDailyReset() {
        const scheduleNext = () => {
            const now = new Date();
            const estOffset = this.isEDT(now) ? -4 : -5;
            const estNow = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
            
            console.log(`[DAILY RESET] Current EST time: ${estNow.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
            
            let nextReset = new Date(estNow);
            nextReset.setHours(DAILY_RESET_HOUR_EST, DAILY_RESET_MINUTE_EST, 0, 0);
            
            const currentTimeInMinutes = (estNow.getHours() * 60) + estNow.getMinutes();
            const resetTimeInMinutes = (DAILY_RESET_HOUR_EST * 60) + DAILY_RESET_MINUTE_EST;
            
            if (currentTimeInMinutes >= resetTimeInMinutes) {
                nextReset.setDate(nextReset.getDate() + 1);
            }
            
            const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
            const timeUntilReset = utcReset.getTime() - now.getTime();
            
            const hoursUntil = Math.floor(timeUntilReset / (1000 * 60 * 60));
            const minutesUntil = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
            
            console.log(`[DAILY RESET] Next reset: ${DAILY_RESET_HOUR_EST}:${DAILY_RESET_MINUTE_EST.toString().padStart(2, '0')} EST (${hoursUntil}h ${minutesUntil}m)`);
            
            if (this.resetTimeouts.has('daily')) {
                clearTimeout(this.resetTimeouts.get('daily'));
            }
            
            const timeoutId = setTimeout(async () => {
                console.log(`[DAILY RESET] 🚨 AUTOMATIC RESET TRIGGERED 🚨`);
                await this.performDailyReset();
                scheduleNext();
            }, timeUntilReset);
            
            this.resetTimeouts.set('daily', timeoutId);
        };
        
        scheduleNext();
    }

    // Perform daily reset
    async performDailyReset() {
        try {
            console.log(`[DAILY CAP] ⏰ Performing daily reset at ${DAILY_RESET_HOUR_EST}:${DAILY_RESET_MINUTE_EST.toString().padStart(2, '0')} EST...`);
            
            const currentDay = this.getCurrentDay();
            
            // Clear memory cache
            const keysToDelete = [];
            for (const [key] of this.dailyVoiceXP.entries()) {
                if (!key.includes(currentDay)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => this.dailyVoiceXP.delete(key));
            console.log(`[DAILY CAP] ✅ Voice XP reset complete - cleared ${keysToDelete.length} cached entries`);

            // Reset daily buffs
            await this.resetDailyBuffs();
            
            // Clean up database records
            try {
                const buffDeleteResult = await this.db.query(
                    'DELETE FROM daily_buff_rolls WHERE date < $1',
                    [currentDay]
                );
                console.log(`[DAILY BUFF] Cleaned up ${buffDeleteResult.rowCount} old daily buff records`);
            } catch (error) {
                console.error('[DAILY BUFF] Error cleaning up daily buff database:', error);
            }
            
            console.log(`[DAILY CAP] 🆕 New day started: ${currentDay}`);
            await this.notifyDailyReset(currentDay);
            
        } catch (error) {
            console.error('[DAILY CAP] ❌ Error during daily reset:', error);
        }
    }

    // Reset daily buffs for all users
    async resetDailyBuffs() {
        try {
            console.log('[DAILY BUFF] 🔄 Resetting daily buffs for all users...');
            
            const buffRoles = [];
            for (let i = 1; i <= 6; i++) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                if (roleId) {
                    buffRoles.push(roleId);
                }
            }

            if (buffRoles.length === 0) {
                console.log('[DAILY BUFF] No buff roles configured');
                return;
            }

            let totalUsersReset = 0;

            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    let guildUsersReset = 0;
                    
                    for (const roleId of buffRoles) {
                        const role = guild.roles.cache.get(roleId);
                        if (role && role.members.size > 0) {
                            console.log(`[DAILY BUFF] Removing ${role.name} from ${role.members.size} users in ${guild.name}`);
                            
                            for (const [memberId, member] of role.members) {
                                try {
                                    await member.roles.remove(role);
                                    guildUsersReset++;
                                } catch (error) {
                                    console.error(`[DAILY BUFF] Failed to remove role from ${member.user.username}:`, error.message);
                                }
                                
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        }
                    }
                    
                    totalUsersReset += guildUsersReset;
                    console.log(`[DAILY BUFF] Reset ${guildUsersReset} users in ${guild.name}`);
                    
                } catch (error) {
                    console.error(`[DAILY BUFF] Error resetting buffs in guild ${guild.name}:`, error);
                }
            }

            console.log(`[DAILY BUFF] ✅ Daily buff reset complete - removed roles from ${totalUsersReset} total users`);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error during daily buff reset:', error);
        }
    }

    // Daily voice XP methods
    getDailyVoiceXP(userId, guildId, date = null) {
        if (!date) {
            date = this.getCurrentDay();
        }
        const dailyKey = `${userId}_${guildId}_${date}`;
        return this.dailyVoiceXP.get(dailyKey) || 0;
    }

    async setDailyVoiceXP(userId, guildId, xp, date = null) {
        if (!date) {
            date = this.getCurrentDay();
        }
        const dailyKey = `${userId}_${guildId}_${date}`;
        this.dailyVoiceXP.set(dailyKey, xp);
        
        this.saveDailyVoiceXP(userId, guildId, date, xp).catch(error => {
            console.error('[DAILY CAP] Failed to save to database:', error);
        });
    }

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

    // Force daily reset for testing
    async forceDailyReset(triggeredBy = 'SYSTEM') {
        try {
            console.log(`[DAILY RESET] 🚨 FORCE RESET TRIGGERED BY ${triggeredBy} 🚨`);
            
            const currentDay = this.getCurrentDay();
            const beforeCacheSize = this.dailyVoiceXP.size;
            this.dailyVoiceXP.clear();
            
            await this.resetDailyBuffs();
            
            try {
                const buffDeleteResult = await this.db.query(
                    'DELETE FROM daily_buff_rolls WHERE date < $1',
                    [currentDay]
                );
                console.log(`[DAILY BUFF] Force deleted ${buffDeleteResult.rowCount} old daily buff records`);
            } catch (error) {
                console.error('[DAILY RESET] Error during force cleanup:', error);
            }
            
            await this.notifyDailyReset(currentDay, true, triggeredBy);
            
            return {
                currentDay,
                cacheCleared: beforeCacheSize,
                success: true
            };
            
        } catch (error) {
            console.error('[DAILY CAP] ❌ Error during force daily reset:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    // src/utils/xpTracker.js - Part 3: Voice State & XP Processing
// (Add this after Part 2)

    // Handle voice state updates
    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.id || oldState.id;
        const guildId = newState.guild?.id || oldState.guild?.id;
        
        if (!guildId) return;

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return;

        const member = guild.members.cache.get(userId);
        if (!member || member.user.bot) return;

        // User joined a voice channel
        if (!oldState.channelId && newState.channelId) {
            console.log(`[VOICE] ${member.user.username} joined ${newState.channel.name}`);
            this.voiceSessions.set(userId, {
                guildId,
                channelId: newState.channelId,
                joinTime: Date.now(),
                lastXPTime: Date.now(),
                isMuted: newState.mute || newState.selfMute,
                isDeafened: newState.deaf || newState.selfDeaf
            });
        }
        // User left voice channel
        else if (oldState.channelId && !newState.channelId) {
            console.log(`[VOICE] ${member.user.username} left voice channel`);
            this.voiceSessions.delete(userId);
        }
        // User moved to different channel
        else if (oldState.channelId !== newState.channelId) {
            console.log(`[VOICE] ${member.user.username} moved to ${newState.channel.name}`);
            if (this.voiceSessions.has(userId)) {
                const session = this.voiceSessions.get(userId);
                session.channelId = newState.channelId;
                session.joinTime = Date.now();
                session.isMuted = newState.mute || newState.selfMute;
                session.isDeafened = newState.deaf || newState.selfDeaf;
            }
        }
        // Mute/deafen state changed
        else if (oldState.channelId && newState.channelId) {
            const oldMuted = oldState.mute || oldState.selfMute;
            const newMuted = newState.mute || newState.selfMute;
            const oldDeafened = oldState.deaf || oldState.selfDeaf;
            const newDeafened = newState.deaf || newState.selfDeaf;
            
            if (oldMuted !== newMuted || oldDeafened !== newDeafened) {
                if (this.voiceSessions.has(userId)) {
                    const session = this.voiceSessions.get(userId);
                    session.isMuted = newMuted;
                    session.isDeafened = newDeafened;
                }
            }
        }
    }

    // Process voice XP
    async processVoiceXP() {
        const now = Date.now();
        const voiceXPCooldown = parseInt(process.env.VOICE_COOLDOWN) || 60000;
        const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
        const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 20000;
        const antiAFK = process.env.VOICE_ANTI_AFK === 'true';
        const currentDay = this.getCurrentDay();

        for (const [userId, session] of this.voiceSessions.entries()) {
            try {
                // Check cooldown
                if (now - session.lastXPTime < voiceXPCooldown) {
                    continue;
                }

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

                // Check minimum member requirement
                const memberCount = channel.members.filter(m => !m.user.bot).size;
                if (memberCount < minMembers) {
                    continue;
                }

                const user = await this.client.users.fetch(userId).catch(() => null);
                if (!user) continue;

                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;

                // Check daily cap
                const currentDailyXP = this.getDailyVoiceXP(userId, session.guildId, currentDay);
                
                if (currentDailyXP >= dailyCap) {
                    continue;
                }

                // Calculate base XP
                const voiceXPMin = parseInt(process.env.VOICE_XP_MIN) || 45;
                const voiceXPMax = parseInt(process.env.VOICE_XP_MAX) || 55;
                const baseXP = Math.floor(Math.random() * (voiceXPMax - voiceXPMin + 1)) + voiceXPMin;

                let finalXP = baseXP;

                // Apply mute/deafen penalty with exemptions
                if (antiAFK && (session.isMuted || session.isDeafened)) {
                    const exemptUsers = process.env.VOICE_MUTE_EXEMPT_USERS?.split(',') || [];
                    const exemptUser = process.env.VOICE_MUTE_EXEMPT_USER;
                    const exemptRoles = process.env.VOICE_MUTE_EXEMPT_ROLES?.split(',') || [];
                    const exemptMultiplier = parseFloat(process.env.VOICE_MUTE_EXEMPT_MULTIPLIER) || 1.0;
                    
                    let isExempt = false;
                    
                    // Check user exemptions
                    if (exemptUsers.includes(userId) || userId === exemptUser) {
                        isExempt = true;
                        finalXP = Math.round(baseXP * exemptMultiplier);
                    }
                    
                    // Check role exemptions
                    if (!isExempt && exemptRoles.length > 0) {
                        for (const roleId of exemptRoles) {
                            if (roleId && member.roles.cache.has(roleId.trim())) {
                                isExempt = true;
                                finalXP = Math.round(baseXP * exemptMultiplier);
                                break;
                            }
                        }
                    }
                    
                    // Apply penalty if not exempt
                    if (!isExempt) {
                        finalXP = Math.round(baseXP * 0.25); // 25% XP when muted/deafened
                    }
                }

                // Apply daily cap properly
                const newDailyTotal = currentDailyXP + finalXP;
                let actualXPGain = finalXP;
                let hitCap = false;
                
                if (newDailyTotal > dailyCap) {
                    actualXPGain = Math.max(0, dailyCap - currentDailyXP);
                    hitCap = true;
                }
                
                if (actualXPGain <= 0) {
                    continue;
                }

                // Update daily XP tracking
                const updatedDailyXP = currentDailyXP + actualXPGain;
                await this.setDailyVoiceXP(userId, session.guildId, updatedDailyXP, currentDay);

                // Award the XP
                await this.awardXP(userId, session.guildId, actualXPGain, 'voice', user, true);
                
                // Update session timestamp
                session.lastXPTime = now;

                console.log(`[VOICE XP] ${user.username}: +${actualXPGain} XP (Daily: ${updatedDailyXP}/${dailyCap}) ${hitCap ? '[CAP HIT]' : ''}`);

            } catch (error) {
                console.error(`[VOICE XP] Error processing user ${userId}:`, error);
            }
        }
    }

    // Award XP method
    async awardXP(userId, guildId, xpAmount, source, user, skipMultiplier = false) {
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
                // Apply XP role boosts
                if (global.xpBoostManager && member) {
                    try {
                        const boostResult = await global.xpBoostManager.calculateUserBoost(guildId, member);
                        if (boostResult.multiplier > 1.0) {
                            const boostedXP = Math.round(finalXP * boostResult.multiplier);
                            finalXP = boostedXP;
                        }
                    } catch (error) {
                        console.error('[XP BOOST ERROR] Failed to calculate user boost:', error);
                    }
                }
                
                // Apply global multiplier
                const guildSettings = global.guildSettings?.get(guildId) || { xpMultiplier: 1.0 };
                const multiplier = guildSettings.xpMultiplier || parseFloat(process.env.XP_MULTIPLIER) || 1.0;
                
                if (multiplier !== 1.0) {
                    const afterGlobal = Math.round(finalXP * multiplier);
                    finalXP = afterGlobal;
                }
            }
            
            const actualXP = Math.max(1, finalXP);

            // Get user's current stats
            const beforeResult = await this.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            const oldLevel = beforeResult.rows.length > 0 ? beforeResult.rows[0].level : 0;
            const oldTotalXP = beforeResult.rows.length > 0 ? beforeResult.rows[0].total_xp : 0;

            // Update user
        // src/utils/xpTracker.js - Part 4: Utility Methods & Cleanup
// (Add this after Part 3)

    // Log XP activity
    async logXPActivity(type, user, guildId, xpGain, additionalInfo = {}) {
        try {
            const guildSettings = global.guildSettings?.get(guildId);
            
            const logEnabled = guildSettings?.xpLogEnabled === true;
            if (!logEnabled) return;

            let logChannelId = guildSettings?.xpLogChannel;
            if (!logChannelId) return;

            const channel = await this.client.channels.fetch(logChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) return;

            const formatLevel = (level) => {
                return level !== undefined && level !== null ? level.toString() : '0';
            };

            const formatXP = (xp) => {
                return xp !== undefined && xp !== null ? xp.toLocaleString() : '0';
            };

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTimestamp()
                .setFooter({ text: '⚓ Marine Intelligence Division • Activity Monitor' });

            switch (type) {
                case 'message':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 MESSAGE ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                    break;

                case 'reaction':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 REACTION ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                    break;

                case 'levelup':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 ⚠️ THREAT LEVEL INCREASED ⚠️')
                        .setDescription(`\`\`\`diff\n- BOUNTY UPDATE CONFIRMED\n- SUBJECT: ${user.username} (${user.id})\n- LEVEL: ${formatLevel(additionalInfo.oldLevel)} → ${formatLevel(additionalInfo.newLevel)}\n- TOTAL XP: ${formatXP(additionalInfo.totalXP)}\n- XP SOURCE: ${additionalInfo.xpSource || 'UNKNOWN'}\n${additionalInfo.roleReward ? `- ROLE AWARDED: ${additionalInfo.roleReward}\n` : ''}\`\`\``);
                    break;

                case 'admin':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE COMMAND CENTER',
                            iconURL: additionalInfo.adminUser?.displayAvatarURL({ size: 32 }) || null
                        })
                        .setTitle('🔴 MANUAL XP ADJUSTMENT')
                        .setDescription(`\`\`\`diff\n- ADMINISTRATIVE ACTION\n- TARGET: ${user.username} (${user.id})\n- AUTHORIZED BY: ${additionalInfo.adminUser?.username || 'Unknown'}\n- ADJUSTMENT: ${xpGain > 0 ? '+' : ''}${xpGain} XP\n- REASON: ${additionalInfo.reason || 'No reason'}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- NEW LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                    break;
            }

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[XP LOG] Failed to send XP log:', error);
        }
    }

    // Notify daily reset
    async notifyDailyReset(newDay, isForced = false, triggeredBy = 'SYSTEM') {
        try {
            const { EmbedBuilder } = require('discord.js');
            
            for (const [guildId, guildSettings] of (global.guildSettings || new Map()).entries()) {
                if (guildSettings.xpLogEnabled && guildSettings.xpLogChannel) {
                    try {
                        const channel = await this.client.channels.fetch(guildSettings.xpLogChannel);
                        if (channel && channel.isTextBased()) {
                            const embed = new EmbedBuilder()
                                .setColor(isForced ? 0xFFFF00 : 0x00FF00)
                                .setTitle(isForced ? '🚨 MANUAL DAILY RESET COMPLETE' : '🌅 DAILY RESET COMPLETE')
                                .setDescription(`\`\`\`diff\n${isForced ? '+ MANUAL RESET TRIGGERED' : '+ Daily systems have been reset'}\n+ New tracking day: ${newDay}\n+ Reset time: ${DAILY_RESET_HOUR_EST}:${DAILY_RESET_MINUTE_EST.toString().padStart(2, '0')} EST\n${isForced ? `+ Triggered by: ${triggeredBy}\n` : ''}\`\`\``)
                                .addFields(
                                    {
                                        name: '🎤 Voice XP Reset',
                                        value: `\`\`\`yaml\nDaily cap: ${parseInt(process.env.DAILY_VOICE_XP_CAP) || 20000} XP\nStatus: All daily limits reset\n\`\`\``,
                                        inline: true
                                    },
                                    {
                                        name: '🎰 Daily Buffs Reset',
                                        value: `\`\`\`yaml\nAll buff roles removed\nNew rolls available\nCommand: /daily-buff\n\`\`\``,
                                        inline: true
                                    }
                                )
                                .setFooter({ text: `⚓ Marine Intelligence • ${isForced ? 'Manual' : 'Automatic'} Reset System` })
                                .setTimestamp();
                            
                            await channel.send({ embeds: [embed] });
                        }
                    } catch (error) {
                        console.log(`[DAILY CAP] Could not notify guild ${guildId}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error('[DAILY CAP] Error sending reset notifications:', error);
        }
    }

    // Utility methods
    async getLeaderboard(guildId, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;
            
            const result = await this.db.query(`
                SELECT user_id, total_xp, level, messages, reactions, voice_time
                FROM user_levels 
                WHERE guild_id = $1 
                ORDER BY total_xp DESC 
                LIMIT $2 OFFSET $3
            `, [guildId, limit, offset]);

            const countResult = await this.db.query(
                'SELECT COUNT(*) FROM user_levels WHERE guild_id = $1',
                [guildId]
            );

            const totalUsers = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalUsers / limit);

            return {
                users: result.rows.map((row, index) => ({
                    userId: row.user_id,
                    totalXP: row.total_xp,
                    level: row.level,
                    messages: row.messages,
                    reactions: row.reactions,
                    voiceTime: row.voice_time,
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
            console.error('Error getting leaderboard:', error);
            throw error;
        }
    }

    async getUserRank(userId, guildId) {
        try {
            const result = await this.db.query(`
                SELECT COUNT(*) + 1 as rank
                FROM user_levels 
                WHERE guild_id = $1 AND total_xp > (
                    SELECT total_xp FROM user_levels 
                    WHERE user_id = $2 AND guild_id = $1
                )
            `, [guildId, userId]);
            
            return parseInt(result.rows[0].rank);
        } catch (error) {
            console.error('Error getting user rank:', error);
            return null;
        }
    }

    async getUserStats(userId, guildId) {
        try {
            const result = await this.db.query(`
                SELECT user_id, guild_id, total_xp, level, messages, reactions, voice_time, 
                       created_at, updated_at
                FROM user_levels 
                WHERE user_id = $1 AND guild_id = $2
            `, [userId, guildId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return result.rows[0];
        } catch (error) {
            console.error('Error getting user stats:', error);
            throw error;
        }
    }

    getXPForLevel(level) {
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const curve = process.env.FORMULA_CURVE || 'exponential';
        const baseXP = parseInt(process.env.FORMULA_BASE_XP) || 500;
        
        let xpRequired;
        
        if (curve === 'exponential') {
            xpRequired = Math.floor(baseXP * Math.pow(level, multiplier));
        } else if (curve === 'linear') {
            xpRequired = baseXP * level * multiplier;
        } else if (curve === 'logarithmic') {
            xpRequired = Math.floor(baseXP * Math.log(level + 1) * multiplier * 2);
        } else {
            xpRequired = Math.floor(baseXP * Math.pow(level, multiplier));
        }
        
        return xpRequired;
    }

    getRandomXP(type) {
        let min, max;
        
        switch (type) {
            case 'message':
                min = parseInt(process.env.MESSAGE_XP_MIN) || 25;
                max = parseInt(process.env.MESSAGE_XP_MAX) || 35;
                break;
            case 'voice':
                min = parseInt(process.env.VOICE_XP_MIN) || 45;
                max = parseInt(process.env.VOICE_XP_MAX) || 55;
                break;
            case 'reaction':
                min = parseInt(process.env.REACTION_XP_MIN) || 25;
                max = parseInt(process.env.REACTION_XP_MAX) || 35;
                break;
            default:
                min = 25;
                max = 35;
        }
        
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    calculateLevel(totalXP) {
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const curve = process.env.FORMULA_CURVE || 'exponential';
        const maxLevel = parseInt(process.env.MAX_LEVEL) || 50;
        const baseXP = parseInt(process.env.FORMULA_BASE_XP) || 500;

        for (let level = 1; level <= maxLevel; level++) {
            let requiredXP;
            
            if (curve === 'exponential') {
                requiredXP = Math.floor(baseXP * Math.pow(level, multiplier));
            } else if (curve === 'linear') {
                requiredXP = baseXP * level * multiplier;
            } else if (curve === 'logarithmic') {
                requiredXP = Math.floor(baseXP * Math.log(level + 1) * multiplier * 2);
            } else {
                requiredXP = Math.floor(baseXP * Math.pow(level, multiplier));
            }

            if (totalXP < requiredXP) {
                return level - 1;
            }
        }

        return maxLevel;
    }

    isOnCooldown(key, cooldownMs) {
        const now = Date.now();
        const lastUse = this.cooldowns.get(key);
        return lastUse && (now - lastUse) < cooldownMs;
    }

    setCooldown(key) {
        this.cooldowns.set(key, Date.now());
    }

    // Get next reset time as Unix timestamp for Discord formatting
    getNextResetUnixTimestamp() {
        const now = new Date();
        const estOffset = this.isEDT(now) ? -4 : -5;
        const estNow = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        
        let nextReset = new Date(estNow);
        nextReset.setHours(DAILY_RESET_HOUR_EST, DAILY_RESET_MINUTE_EST, 0, 0);
        
        const currentTimeInMinutes = (estNow.getHours() * 60) + estNow.getMinutes();
        const resetTimeInMinutes = (DAILY_RESET_HOUR_EST * 60) + DAILY_RESET_MINUTE_EST;
        
        if (currentTimeInMinutes >= resetTimeInMinutes) {
            nextReset.setDate(nextReset.getDate() + 1);
        }
        
        const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
        return Math.floor(utcReset.getTime() / 1000);
    }

    // Get current reset time info
    getResetTimeInfo() {
        const now = new Date();
        const estOffset = this.isEDT(now) ? -4 : -5;
        const estNow = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        
        return {
            resetHour: DAILY_RESET_HOUR_EST,
            resetMinute: DAILY_RESET_MINUTE_EST,
            resetTimeString: `${DAILY_RESET_HOUR_EST}:${DAILY_RESET_MINUTE_EST.toString().padStart(2, '0')} EST`,
            currentESTTime: estNow.toLocaleString('en-US', { timeZone: 'America/New_York' }),
            currentDay: this.getCurrentDay(),
            nextResetUnix: this.getNextResetUnixTimestamp(),
            isDST: this.isEDT(now)
        };
    }

    async cleanup() {
        // Clear all timeouts
        for (const [key, timeoutId] of this.resetTimeouts.entries()) {
            clearTimeout(timeoutId);
            console.log(`[CLEANUP] Cleared timeout: ${key}`);
        }
        
        this.voiceSessions.clear();
        this.cooldowns.clear();
        this.dailyVoiceXP.clear();
        this.resetTimeouts.clear();
        
        console.log('[XP TRACKER] Cleanup complete');
    }
}

module.exports = XPTracker;
