// src/utils/dailyResetManager.js - COMPLETE FIXED Daily Reset System with Daily Quiz Support

const { EmbedBuilder } = require('discord.js');

// CONFIGURABLE RESET TIME (EDT)
const DAILY_RESET_HOUR_EDT = parseInt(process.env.DAILY_RESET_HOUR_EDT) || parseInt(process.env.DAILY_RESET_HOUR_EST) || 3;
const DAILY_RESET_MINUTE_EDT = parseInt(process.env.DAILY_RESET_MINUTE_EDT) || parseInt(process.env.DAILY_RESET_MINUTE_EST) || 0;

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

    // Get current day based on configurable EDT reset time
    getCurrentDay() {
        const now = new Date();
        const edtOffset = this.isEDT(now) ? -4 : -5;
        const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
        
        const currentHour = edtTime.getHours();
        const currentMinute = edtTime.getMinutes();
        const resetTimeInMinutes = (DAILY_RESET_HOUR_EDT * 60) + DAILY_RESET_MINUTE_EDT;
        const currentTimeInMinutes = (currentHour * 60) + currentMinute;
        
        if (currentTimeInMinutes < resetTimeInMinutes) {
            edtTime.setDate(edtTime.getDate() - 1);
        }
        
        return edtTime.toISOString().split('T')[0];
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
            const edtOffset = this.isEDT(now) ? -4 : -5;
            const edtNow = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
            
            // DEBUG: Show timezone calculation details
            console.log(`[DAILY RESET] Current UTC time: ${now.toISOString()}`);
            console.log(`[DAILY RESET] EDT offset: ${edtOffset} hours`);
            console.log(`[DAILY RESET] Calculated EDT time: ${edtNow.toISOString().replace('T', ' ').substring(0, 19)} EDT`);
            console.log(`[DAILY RESET] Is EDT (Daylight Saving)? ${this.isEDT(now)}`);
            
            let nextReset = new Date(edtNow);
            nextReset.setHours(DAILY_RESET_HOUR_EDT, DAILY_RESET_MINUTE_EDT, 0, 0);
            
            const currentTimeInMinutes = (edtNow.getHours() * 60) + edtNow.getMinutes();
            const resetTimeInMinutes = (DAILY_RESET_HOUR_EDT * 60) + DAILY_RESET_MINUTE_EDT;
            
            if (currentTimeInMinutes >= resetTimeInMinutes) {
                nextReset.setDate(nextReset.getDate() + 1);
            }
            
            const utcReset = new Date(nextReset.getTime() - (edtOffset * 60 * 60 * 1000));
            const timeUntilReset = utcReset.getTime() - now.getTime();
            
            const hoursUntil = Math.floor(timeUntilReset / (1000 * 60 * 60));
            const minutesUntil = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
            
            console.log(`[DAILY RESET] Next reset: ${DAILY_RESET_HOUR_EDT}:${DAILY_RESET_MINUTE_EDT.toString().padStart(2, '0')} EDT (${hoursUntil}h ${minutesUntil}m)`);
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

    // ✅ COMPLETE FIXED: Perform daily reset with ALL daily quiz support
    async performDailyReset() {
        try {
            console.log(`[DAILY CAP] ⏰ Performing daily reset at ${DAILY_RESET_HOUR_EDT}:${DAILY_RESET_MINUTE_EDT.toString().padStart(2, '0')} EDT...`);
            
            const currentDay = this.getCurrentDay();
            
            // ✅ FIXED: Clear ALL voice XP cache (not just old entries)
            console.log(`[DAILY CAP] Clearing ALL voice XP cache for new day: ${currentDay}`);
            this.dailyVoiceXP.clear();
            
            // ✅ FIXED: Reset BOTH daily buffs AND daily quiz buffs FIRST
            await this.resetAllDailyBuffs();
            
            // ✅ FIXED: Clean up ALL daily-related database tables INCLUDING daily_buff_xp_caps
            await this.cleanupAllDailyTables();
            
            console.log(`[DAILY CAP] 🆕 New day started: ${currentDay}`);
            await this.notifyDailyReset(currentDay);
            
        } catch (error) {
            console.error('[DAILY CAP] ❌ Error during daily reset:', error);
        }
    }

    // ✅ COMPLETE FIXED: Reset ALL daily buffs including daily quiz buffs
    async resetAllDailyBuffs() {
        try {
            console.log('[DAILY BUFF] 🔄 Resetting ALL daily buffs (voice buffs + daily quiz buffs)...');
            
            // ✅ FIXED: Get ALL possible buff roles (both voice buffs AND daily quiz)
            const allBuffRoles = [];
            
            // Add voice/traditional daily buff roles (Tier 1-6)
            for (let i = 1; i <= 6; i++) {
                const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
                if (roleId && roleId !== `role_id_${i}`) {
                    allBuffRoles.push({ tier: i, roleId, type: 'voice_buff' });
                }
            }
            
            // ✅ FIXED: Add daily quiz roles (Tier 1-10)
            for (let i = 1; i <= 10; i++) {
                const roleId = process.env[`DAILY_QUIZ_TIER_${i}_ROLE`];
                if (roleId && roleId !== `role_id_${i}`) {
                    allBuffRoles.push({ tier: i, roleId, type: 'quiz_buff' });
                }
            }

            if (allBuffRoles.length === 0) {
                console.log('[DAILY BUFF] No buff roles configured (check environment variables)');
                return;
            }

            console.log(`[DAILY BUFF] Found ${allBuffRoles.length} total buff roles:`, 
                allBuffRoles.map(r => `${r.type} Tier ${r.tier}: ${r.roleId}`));

            let totalUsersReset = 0;
            let totalErrors = 0;

            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    let guildUsersReset = 0;
                    let guildErrors = 0;
                    
                    console.log(`[DAILY BUFF] Processing guild: ${guild.name} (${guild.id})`);
                    
                    for (const { tier, roleId, type } of allBuffRoles) {
                        const role = guild.roles.cache.get(roleId);
                        if (role && role.members.size > 0) {
                            console.log(`[DAILY BUFF] 🎯 FORCE REMOVING ${type} ${role.name} from ${role.members.size} users in ${guild.name}`);
                            
                            // ✅ FIXED: Process members in smaller batches with more aggressive error handling
                            const memberArray = Array.from(role.members.values());
                            const batchSize = 3; // Reduced batch size for better reliability
                            
                            for (let i = 0; i < memberArray.length; i += batchSize) {
                                const batch = memberArray.slice(i, i + batchSize);
                                
                                // ✅ FIXED: Process each member individually with full error handling
                                for (const member of batch) {
                                    try {
                                        console.log(`[DAILY BUFF] 🗑️ Removing ${role.name} from ${member.user.username}...`);
                                        await member.roles.remove(role, `Daily reset - force removing all ${type} roles`);
                                        guildUsersReset++;
                                        console.log(`[DAILY BUFF] ✅ Successfully removed ${role.name} from ${member.user.username}`);
                                    } catch (error) {
                                        guildErrors++;
                                        console.error(`[DAILY BUFF] ❌ Failed to remove ${role.name} from ${member.user.username}:`, error.message);
                                        
                                        // ✅ FIXED: Try alternative removal method if standard fails
                                        try {
                                            console.log(`[DAILY BUFF] 🔄 Retrying removal for ${member.user.username}...`);
                                            await member.edit({ 
                                                roles: member.roles.cache.filter(r => r.id !== roleId).map(r => r.id),
                                                reason: `Daily reset - force ${type} role removal (retry method)`
                                            });
                                            console.log(`[DAILY BUFF] ✅ Retry successful for ${member.user.username}`);
                                            guildUsersReset++;
                                            guildErrors--; // Cancel out the error since retry worked
                                        } catch (retryError) {
                                            console.error(`[DAILY BUFF] ❌ Retry also failed for ${member.user.username}:`, retryError.message);
                                        }
                                    }
                                    
                                    // ✅ FIXED: Longer delay between each member to avoid rate limits
                                    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms per member
                                }
                                
                                // Rate limiting: wait between batches
                                if (i + batchSize < memberArray.length) {
                                    console.log(`[DAILY BUFF] ⏳ Batch complete, waiting before next batch...`);
                                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between batches
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
                    console.log(`[DAILY BUFF] Guild ${guild.name} complete: ${guildUsersReset} users reset, ${guildErrors} errors`);
                    
                } catch (error) {
                    console.error(`[DAILY BUFF] Error resetting buffs in guild ${guild.name}:`, error);
                    totalErrors++;
                }
                
                // ✅ FIXED: Wait between guilds to avoid global rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log(`[DAILY BUFF] ✅ ALL daily buff reset complete - removed roles from ${totalUsersReset} total users, ${totalErrors} errors`);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error during complete daily buff reset:', error);
        }
    }

    // ✅ COMPLETE FIXED: Clean up ALL daily-related database tables INCLUDING daily_buff_xp_caps
    async cleanupAllDailyTables() {
        try {
            console.log('[DAILY DB CLEANUP] 🧹 Cleaning up ALL daily-related database tables...');
            
            let totalDeleted = 0;
            const tables = [
                'daily_buff_rolls',
                'daily_voice_xp',
                'daily_buff_xp_caps' // ✅ CRITICAL FIX: Added missing table cleanup
            ];
            
            for (const tableName of tables) {
                try {
                    // ✅ FIXED: Check if table exists first
                    const tableExists = await this.db.query(`
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_name = $1
                        );
                    `, [tableName]);
                    
                    if (tableExists.rows[0].exists) {
                        const deleteResult = await this.db.query(`DELETE FROM ${tableName}`);
                        const deletedCount = deleteResult.rowCount || 0;
                        totalDeleted += deletedCount;
                        console.log(`[DAILY DB CLEANUP] ✅ Deleted ${deletedCount} records from ${tableName}`);
                    } else {
                        console.log(`[DAILY DB CLEANUP] ⚠️ Table ${tableName} does not exist, skipping`);
                    }
                } catch (error) {
                    console.error(`[DAILY DB CLEANUP] ❌ Error cleaning table ${tableName}:`, error);
                }
            }
            
            console.log(`[DAILY DB CLEANUP] ✅ Database cleanup complete: ${totalDeleted} total records deleted`);
            
        } catch (error) {
            console.error('[DAILY DB CLEANUP] ❌ Error during database cleanup:', error);
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

    // ✅ COMPLETE FIXED: Force daily reset with complete ALL daily systems clearing
    async forceDailyReset(triggeredBy = 'SYSTEM') {
        try {
            console.log(`[DAILY RESET] 🚨 FORCE RESET TRIGGERED BY ${triggeredBy} 🚨`);
            
            const currentDay = this.getCurrentDay();
            const beforeCacheSize = this.dailyVoiceXP.size;
            
            // ✅ FIXED: Completely clear voice XP cache
            this.dailyVoiceXP.clear();
            console.log(`[DAILY RESET] Cleared ${beforeCacheSize} voice XP cache entries`);
            
            // ✅ FIXED: Reset ALL daily buffs FIRST (remove roles before database cleanup)
            await this.resetAllDailyBuffs();
            
            // ✅ FIXED: Clean up ALL daily database tables INCLUDING daily_buff_xp_caps
            await this.cleanupAllDailyTables();
            
            await this.notifyDailyReset(currentDay, true, triggeredBy);
            
            return {
                currentDay,
                cacheCleared: beforeCacheSize,
                voiceXPRecordsDeleted: true,
                buffRolesRemoved: true,
                quizBuffsRemoved: true, // ✅ NEW
                tierXPCapsCleared: true, // ✅ NEW - CRITICAL FIX
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

    // ✅ FIXED: Notify daily reset with improved messaging about ALL systems including tier XP caps
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
                                .setDescription(`\`\`\`diff\n${isForced ? '+ MANUAL RESET TRIGGERED' : '+ Daily systems have been reset'}\n+ New tracking day: ${newDay}\n+ Reset time: ${DAILY_RESET_HOUR_EDT}:${DAILY_RESET_MINUTE_EDT.toString().padStart(2, '0')} EDT\n${isForced ? `+ Triggered by: ${triggeredBy}\n` : ''}\`\`\``)
                                .addFields(
                                    {
                                        name: '🎤 Voice XP Reset',
                                        value: `\`\`\`yaml\nDaily cap: ${parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500} XP\nStatus: All daily limits reset\nCache: Completely cleared\nDatabase: All records deleted\n\`\`\``,
                                        inline: true
                                    },
                                    {
                                        name: '🎰 Daily Buffs Reset',
                                        value: `\`\`\`yaml\nAll buff roles FORCE removed\nNew rolls available\nCommand: /daily-buff\nDatabase: All records deleted\n\`\`\``,
                                        inline: true
                                    },
                                    {
                                        name: '🎌 Daily Quiz Reset', // ✅ NEW
                                        value: `\`\`\`yaml\nQuiz roles FORCE removed\nTier XP caps cleared\nCommand: /daily-quiz\nDatabase: ALL tables cleared\n\`\`\``,
                                        inline: true
                                    }
                                )
                                .addFields({
                                    name: '🗄️ Database Tables Reset', // ✅ NEW - CRITICAL INFO
                                    value: `\`\`\`diff\n+ daily_voice_xp: CLEARED\n+ daily_buff_rolls: CLEARED\n+ daily_buff_xp_caps: CLEARED\n+ All tier XP progress: RESET\n+ All daily limits: RESTORED\n\`\`\``,
                                    inline: false
                                })
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
        const edtOffset = this.isEDT(now) ? -4 : -5;
        const edtNow = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
        
        console.log('\n🔍 TIMEZONE DEBUG INFORMATION:');
        console.log(`Server UTC time: ${now.toISOString()}`);
        console.log(`Server local time: ${now.toString()}`);
        console.log(`Is EDT (Daylight Saving)? ${this.isEDT(now)}`);
        console.log(`EDT offset: ${edtOffset} hours`);
        console.log(`Calculated EDT time: ${edtNow.toISOString().replace('T', ' ').substring(0, 19)}`);
        console.log(`Using built-in timezone: ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
        console.log(`Current day key: ${this.getCurrentDay()}`);
        console.log(`Reset hour: ${DAILY_RESET_HOUR_EDT}:${DAILY_RESET_MINUTE_EDT}`);
        
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
            calculatedEDT: edtNow.toISOString(),
            systemNY: nyTime,
            isEDT: this.isEDT(now),
            edtOffset: edtOffset,
            currentDay: this.getCurrentDay()
        };
    }

    // ✅ NEW: Debug table cleanup status
    async debugTableCleanup() {
        try {
            console.log('\n🧹 TABLE CLEANUP DEBUG:');
            
            const tables = ['daily_voice_xp', 'daily_buff_rolls', 'daily_buff_xp_caps'];
            
            for (const tableName of tables) {
                try {
                    const result = await this.db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
                    const count = result.rows[0].count;
                    console.log(`📊 ${tableName}: ${count} records`);
                } catch (error) {
                    console.log(`❌ ${tableName}: Error or doesn't exist - ${error.message}`);
                }
            }
            
            console.log('───────────────────────────────────────\n');
            
        } catch (error) {
            console.error('[DEBUG] Error in table cleanup debug:', error);
        }
    }
}

module.exports = DailyResetManager;
