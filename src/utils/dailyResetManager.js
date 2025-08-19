// src/utils/dailyResetManager.js - Fixed Daily Reset System

const { EmbedBuilder } = require('discord.js');

// CONFIGURABLE RESET TIME (EST)
const DAILY_RESET_HOUR_EST = parseInt(process.env.DAILY_RESET_HOUR_EST) || 3;
const DAILY_RESET_MINUTE_EST = parseInt(process.env.DAILY_RESET_MINUTE_EST) || 0;

class DailyResetManager {
    constructor(xpTracker) {
        this.xpTracker = xpTracker;
        this.client = xpTracker.client;
        this.db = xpTracker.db;
        this.dailyVoiceXP = new Map();
        this.resetTimeouts = new Map();
    }

    async initialize() {
        await this.loadDailyVoiceXPFromDatabase();
        this.scheduleDailyReset();
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

    // Check if date is in Eastern Daylight Time (EDT) - FIXED DST CALCULATION
    isEDT(date) {
        const year = date.getFullYear();
        
        // Second Sunday in March at 2:00 AM
        const marchSecondSunday = new Date(year, 2, 1); // March 1st
        marchSecondSunday.setDate(1 + (14 - marchSecondSunday.getDay()) % 7); // First Sunday
        marchSecondSunday.setDate(marchSecondSunday.getDate() + 7); // Second Sunday
        marchSecondSunday.setHours(2, 0, 0, 0); // 2:00 AM
        
        // First Sunday in November at 2:00 AM
        const novemberFirstSunday = new Date(year, 10, 1); // November 1st
        novemberFirstSunday.setDate(1 + (7 - novemberFirstSunday.getDay()) % 7); // First Sunday
        novemberFirstSunday.setHours(2, 0, 0, 0); // 2:00 AM
        
        return date >= marchSecondSunday && date < novemberFirstSunday;
    }

    // Load daily voice XP from database
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

            // Clean up old records (keep last 30 days)
            await this.db.query(
                "DELETE FROM daily_voice_xp WHERE date < CURRENT_DATE - INTERVAL '30 days'"
            );

        } catch (error) {
            console.error('[DAILY CAP] Error loading daily voice XP data:', error);
        }
    }

    // Schedule daily reset - FIXED TIMEZONE DISPLAY
    scheduleDailyReset() {
        const scheduleNext = () => {
            const now = new Date();
            const estOffset = this.isEDT(now) ? -4 : -5;
            const estNow = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
            
            // DEBUG: Show timezone calculation details
            console.log(`[DAILY RESET] Current UTC time: ${now.toISOString()}`);
            console.log(`[DAILY RESET] EST offset: ${estOffset} hours`);
            console.log(`[DAILY RESET] Calculated EST time: ${estNow.toISOString().replace('T', ' ').substring(0, 19)} EST`);
            console.log(`[DAILY RESET] Is EDT (Daylight Saving)? ${this.isEDT(now)}`);
            
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
            console.log(`[DAILY RESET] Next reset UTC: ${utcReset.toISOString()}`);
            
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

    // Perform daily reset - FIXED VERSION
    async performDailyReset() {
        try {
            console.log(`[DAILY CAP] ⏰ Performing daily reset at ${DAILY_RESET_HOUR_EST}:${DAILY_RESET_MINUTE_EST.toString().padStart(2, '0')} EST...`);
            
            const currentDay = this.getCurrentDay();
            
            // ✅ FIXED: Clear ALL voice XP cache (not just old entries)
            console.log(`[DAILY CAP] Clearing ALL voice XP cache for new day: ${currentDay}`);
            this.dailyVoiceXP.clear();
            
            // Reset daily buffs with improved error handling
            await this.resetDailyBuffs();
            
            // Clean up database records with better error handling
            try {
                const buffDeleteResult = await this.db.query(
                    'DELETE FROM daily_buff_rolls WHERE date < $1',
                    [currentDay]
                );
                console.log(`[DAILY BUFF] Cleaned up ${buffDeleteResult.rowCount} old daily buff records`);
            } catch (error) {
                console.error('[DAILY BUFF] Error cleaning up daily buff database:', error);
            }
            
            // ✅ FIXED: Clean up old voice XP records but don't delete current day
            try {
                const voiceDeleteResult = await this.db.query(
                    'DELETE FROM daily_voice_xp WHERE date < $1',
                    [currentDay]
                );
                console.log(`[DAILY CAP] Cleaned up ${voiceDeleteResult.rowCount} old voice XP records`);
            } catch (error) {
                console.error('[DAILY CAP] Error cleaning up voice XP database:', error);
            }
            
            console.log(`[DAILY CAP] 🆕 New day started: ${currentDay}`);
            await this.notifyDailyReset(currentDay);
            
        } catch (error) {
            console.error('[DAILY CAP] ❌ Error during daily reset:', error);
        }
    }

    // ✅ FIXED: Reset daily buffs with better error handling and rate limiting
    async resetDailyBuffs() {
        try {
            console.log('[DAILY BUFF] 🔄 Resetting daily buffs for all users...');
            
            const buffRoles = [];
            for (let i = 1; i <= 6; i++) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                if (roleId && roleId !== `role_id_${i}`) { // Skip placeholder values
                    buffRoles.push({ tier: i, roleId });
                }
            }

            if (buffRoles.length === 0) {
                console.log('[DAILY BUFF] No buff roles configured (check environment variables)');
                return;
            }

            console.log(`[DAILY BUFF] Found ${buffRoles.length} configured buff roles:`, buffRoles.map(r => `Tier ${r.tier}: ${r.roleId}`));

            let totalUsersReset = 0;
            let totalErrors = 0;

            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    let guildUsersReset = 0;
                    let guildErrors = 0;
                    
                    console.log(`[DAILY BUFF] Processing guild: ${guild.name} (${guild.id})`);
                    
                    for (const { tier, roleId } of buffRoles) {
                        const role = guild.roles.cache.get(roleId);
                        if (role && role.members.size > 0) {
                            console.log(`[DAILY BUFF] Removing ${role.name} from ${role.members.size} users in ${guild.name}`);
                            
                            // Process members in smaller batches to avoid rate limits
                            const memberArray = Array.from(role.members.values());
                            const batchSize = 5; // Process 5 members at a time
                            
                            for (let i = 0; i < memberArray.length; i += batchSize) {
                                const batch = memberArray.slice(i, i + batchSize);
                                
                                await Promise.all(batch.map(async (member) => {
                                    try {
                                        await member.roles.remove(role, 'Daily reset - removing buff roles');
                                        guildUsersReset++;
                                        console.log(`[DAILY BUFF] ✅ Removed ${role.name} from ${member.user.username}`);
                                    } catch (error) {
                                        guildErrors++;
                                        console.error(`[DAILY BUFF] ❌ Failed to remove role from ${member.user.username}:`, error.message);
                                    }
                                }));
                                
                                // Rate limiting: wait between batches
                                if (i + batchSize < memberArray.length) {
                                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                                }
                            }
                        } else if (role) {
                            console.log(`[DAILY BUFF] Role ${role.name} has no members to remove`);
                        } else {
                            console.warn(`[DAILY BUFF] Role not found in ${guild.name}: ${roleId}`);
                        }
                    }
                    
                    totalUsersReset += guildUsersReset;
                    totalErrors += guildErrors;
                    console.log(`[DAILY BUFF] Guild ${guild.name}: ${guildUsersReset} users reset, ${guildErrors} errors`);
                    
                } catch (error) {
                    console.error(`[DAILY BUFF] Error resetting buffs in guild ${guild.name}:`, error);
                    totalErrors++;
                }
            }

            console.log(`[DAILY BUFF] ✅ Daily buff reset complete - removed roles from ${totalUsersReset} total users, ${totalErrors} errors`);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error during daily buff reset:', error);
        }
    }

    // Daily voice XP methods - FIXED
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

    // ✅ FIXED: Force daily reset with complete cache clearing
    async forceDailyReset(triggeredBy = 'SYSTEM') {
        try {
            console.log(`[DAILY RESET] 🚨 FORCE RESET TRIGGERED BY ${triggeredBy} 🚨`);
            
            const currentDay = this.getCurrentDay();
            const beforeCacheSize = this.dailyVoiceXP.size;
            
            // ✅ FIXED: Completely clear voice XP cache
            this.dailyVoiceXP.clear();
            console.log(`[DAILY RESET] Cleared ${beforeCacheSize} voice XP cache entries`);
            
            // Reset daily buffs
            await this.resetDailyBuffs();
            
            // Clean up database
            try {
                const buffDeleteResult = await this.db.query(
                    'DELETE FROM daily_buff_rolls WHERE date < $1',
                    [currentDay]
                );
                console.log(`[DAILY BUFF] Force deleted ${buffDeleteResult.rowCount} old daily buff records`);
                
                // ✅ FIXED: Don't delete current day voice XP, only old records
                const voiceDeleteResult = await this.db.query(
                    'DELETE FROM daily_voice_xp WHERE date < $1',
                    [currentDay]
                );
                console.log(`[DAILY CAP] Force deleted ${voiceDeleteResult.rowCount} old voice XP records`);
                
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

    // Enhanced cleanup for daily voice XP on specific day
    async cleanupDailyVoiceXP() {
        try {
            const currentDay = this.getCurrentDay();
            
            // Clean memory cache for any non-current day entries
            const keysToDelete = [];
            for (const [key] of this.dailyVoiceXP.entries()) {
                if (!key.endsWith(`_${currentDay}`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => this.dailyVoiceXP.delete(key));
            
            if (keysToDelete.length > 0) {
                console.log(`[DAILY CAP] Cleaned up ${keysToDelete.length} old cache entries`);
            }
            
        } catch (error) {
            console.error('[DAILY CAP] Error cleaning up daily voice XP:', error);
        }
    }

    // Notify daily reset with improved messaging
    async notifyDailyReset(newDay, isForced = false, triggeredBy = 'SYSTEM') {
        try {
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
                                        value: `\`\`\`yaml\nDaily cap: ${parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500} XP\nStatus: All daily limits reset\nCache: Completely cleared\n\`\`\``,
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

    async cleanup() {
        // Clear all timeouts
        for (const [key, timeoutId] of this.resetTimeouts.entries()) {
            clearTimeout(timeoutId);
            console.log(`[CLEANUP] Cleared timeout: ${key}`);
        }
        
        this.dailyVoiceXP.clear();
        this.resetTimeouts.clear();
        
        console.log('[DAILY RESET] Cleanup complete');
    }

    // 🔍 DEBUG METHOD: Check timezone calculation
    debugTimezone() {
        const now = new Date();
        const estOffset = this.isEDT(now) ? -4 : -5;
        const estNow = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        
        console.log('\n🔍 TIMEZONE DEBUG INFORMATION:');
        console.log(`Server UTC time: ${now.toISOString()}`);
        console.log(`Server local time: ${now.toString()}`);
        console.log(`Is EDT (Daylight Saving)? ${this.isEDT(now)}`);
        console.log(`EST offset: ${estOffset} hours`);
        console.log(`Calculated EST time: ${estNow.toISOString().replace('T', ' ').substring(0, 19)}`);
        console.log(`Using built-in timezone: ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
        console.log(`Current day key: ${this.getCurrentDay()}`);
        console.log(`Reset hour: ${DAILY_RESET_HOUR_EST}:${DAILY_RESET_MINUTE_EST}`);
        
        // Compare with system timezone
        const nyTime = new Date().toLocaleString('en-US', { 
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        console.log(`System NY time: ${nyTime}`);
        console.log('───────────────────────────────────────\n');
        
        return {
            serverUTC: now.toISOString(),
            calculatedEST: estNow.toISOString(),
            systemNY: nyTime,
            isEDT: this.isEDT(now),
            estOffset: estOffset,
            currentDay: this.getCurrentDay()
        };
    }
}

module.exports = DailyResetManager;
