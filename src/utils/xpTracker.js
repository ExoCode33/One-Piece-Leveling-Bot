// src/utils/xpTracker.js - Complete Marine Intelligence XP Tracking System

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

    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.id || oldState.id;
        const guildId = newState.guild?.id || oldState.guild?.id;
        
        if (!guildId) return;

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return;

        const member = guild.members.cache.get(userId);
        if (!member || member.user.bot) return;

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
        else if (oldState.channelId && !newState.channelId) {
            console.log(`[VOICE] ${member.user.username} left voice channel`);
            this.voiceSessions.delete(userId);
        }
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
        else if (oldState.channelId && newState.channelId) {
            const oldMuted = oldState.mute || oldState.selfMute;
            const newMuted = newState.mute || newState.selfMute;
            const oldDeafened = oldState.deaf || oldState.selfDeaf;
            const newDeafened = newState.deaf || newState.selfDeaf;
            
            if (oldMuted !== newMuted || oldDeafened !== newDeafened) {
                console.log(`[VOICE] ${member.user.username} mute/deafen state changed`);
                if (this.voiceSessions.has(userId)) {
                    const session = this.voiceSessions.get(userId);
                    session.isMuted = newMuted;
                    session.isDeafened = newDeafened;
                }
            }
        }
    }

    // Process voice XP with proper daily cap implementation
    async processVoiceXP() {
        const now = Date.now();
        const voiceXPCooldown = parseInt(process.env.VOICE_COOLDOWN) || 60000; // Default 1 minute
        const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
        const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500; // Default 1500 XP per day
        const antiAFK = process.env.VOICE_ANTI_AFK === 'true';
        const today = this.getCurrentDayKey(); // Use 3 AM EST reset

        console.log(`[VOICE XP] Processing voice XP for ${this.voiceSessions.size} active sessions (Daily cap: ${dailyCap} XP, Reset: 3 AM EST)`);

        const voiceActivities = [];
        const processedUsers = new Set(); // Track users we've already processed this cycle

        for (const [userId, session] of this.voiceSessions.entries()) {
            try {
                // Skip if we already processed this user this cycle
                if (processedUsers.has(userId)) continue;
                processedUsers.add(userId);

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
                    console.log(`[VOICE XP] ${userId} in ${channel.name}: Not enough members (${memberCount}/${minMembers}), skipping`);
                    continue;
                }

                const user = await this.client.users.fetch(userId).catch(() => null);
                if (!user) continue;

                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;

                // Check if user has excluded role (Pirate King)
                const guildSettings = global.guildSettings?.get(session.guildId) || { xpMultiplier: 1.0 };
                if (guildSettings.excludedRole && member.roles.cache.has(guildSettings.excludedRole)) {
                    console.log(`[VOICE XP] ${user.username} has excluded role, skipping`);
                    continue;
                }

                // Check daily cap with proper key format
                const currentDailyXP = this.getDailyVoiceXP(userId, session.guildId, today);
                
                if (currentDailyXP >= dailyCap) {
                    console.log(`[VOICE XP] ${user.username} has reached daily cap: ${currentDailyXP}/${dailyCap} XP`);
                    continue;
                }

                // Calculate base XP
                const voiceXPMin = parseInt(process.env.VOICE_XP_MIN) || 45;
                const voiceXPMax = parseInt(process.env.VOICE_XP_MAX) || 55;
                const baseXP = Math.floor(Math.random() * (voiceXPMax - voiceXPMin + 1)) + voiceXPMin;

                let finalXP = baseXP;

                // Apply mute/deafen penalty
                let muteMultiplier = 1.0;
                let muteReason = '';
                if (antiAFK && (session.isMuted || session.isDeafened)) {
                    // Check for exemptions
                    const exemptUsers = process.env.VOICE_MUTE_EXEMPT_USERS?.split(',') || [];
                    const exemptUser = process.env.VOICE_MUTE_EXEMPT_USER;
                    const exemptRoles = process.env.VOICE_MUTE_EXEMPT_ROLES?.split(',') || [];
                    const exemptMultiplier = parseFloat(process.env.VOICE_MUTE_EXEMPT_MULTIPLIER) || 1.0;
                    
                    let isExempt = false;
                    
                    // Check user exemptions
                    if (exemptUsers.includes(userId) || userId === exemptUser) {
                        isExempt = true;
                        muteMultiplier = exemptMultiplier;
                        muteReason = 'EXEMPT USER';
                    }
                    
                    // Check role exemptions
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
                    
                    // Apply penalty if not exempt
                    if (!isExempt) {
                        muteMultiplier = 0.25; // 25% XP when muted/deafened
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
                
                // Apply global multiplier
                const globalMultiplier = guildSettings.xpMultiplier || 1.0;
                if (globalMultiplier !== 1.0) {
                    const afterGlobal = Math.round(finalXP * globalMultiplier);
                    console.log(`[XP CALC] ${user.username} voice: ${finalXP} → ${afterGlobal} (${globalMultiplier}x global)`);
                    finalXP = afterGlobal;
                }

                // Apply daily cap properly
                const newDailyTotal = currentDailyXP + finalXP;
                let actualXPGain = finalXP;
                let hitCap = false;
                
                if (newDailyTotal > dailyCap) {
                    actualXPGain = Math.max(0, dailyCap - currentDailyXP);
                    hitCap = true;
                    console.log(`[DAILY CAP] ${user.username}: ${finalXP} → ${actualXPGain} (would exceed daily cap: ${newDailyTotal}/${dailyCap})`);
                }
                
                if (actualXPGain <= 0) {
                    console.log(`[VOICE XP] ${user.username} would get 0 XP, skipping`);
                    continue;
                }

                // Update daily XP tracking with proper persistence
                const updatedDailyXP = currentDailyXP + actualXPGain;
                await this.setDailyVoiceXP(userId, session.guildId, updatedDailyXP, today);

                // Award the XP (skip multiplier since we already applied everything)
                await this.awardXP(userId, session.guildId, actualXPGain, 'voice_silent', user, true);
                
                // Get updated stats for logging
                const updatedStats = await this.getUserStats(userId, session.guildId);
                
                voiceActivities.push({
                    user,
                    guildId: session.guildId,
                    channelName: channel.name,
                    sessionDuration: Math.floor((now - session.joinTime) / 60000),
                    memberCount,
                    baseXP: baseXP,
                    finalXP: finalXP,
                    xpGain: actualXPGain,
                    dailyXPBefore: currentDailyXP,
                    dailyXPAfter: updatedDailyXP,
                    dailyCap: dailyCap,
                    hitDailyCap: hitCap,
                    totalXP: updatedStats?.total_xp || 0,
                    currentLevel: updatedStats?.level || 0,
                    wasMuted: session.isMuted || session.isDeafened,
                    muteMultiplier: muteMultiplier,
                    muteReason: muteReason
                });
                
                // Update session timestamp
                session.lastXPTime = now;

                console.log(`[VOICE XP] ${user.username}: +${actualXPGain} XP (Daily: ${updatedDailyXP}/${dailyCap}) ${hitCap ? '[CAP HIT]' : ''}`);

            } catch (error) {
                console.error(`[VOICE XP] Error processing user ${userId}:`, error);
            }
        }

        // Send enhanced summary with cap information
        if (voiceActivities.length > 0) {
            await this.sendEnhancedVoiceXPSummary(voiceActivities);
        }

        console.log(`[VOICE XP] Processing complete: ${voiceActivities.length} users received XP`);
    }

    // Enhanced voice XP summary with ALL RED THEME
    async sendEnhancedVoiceXPSummary(activities) {
        try {
            if (activities.length === 0) return;

            const firstActivity = activities[0];
            const guildSettings = global.guildSettings?.get(firstActivity.guildId);
            
            const logEnabled = guildSettings?.xpLogEnabled === true;
            if (!logEnabled) return;

            let logChannelId = guildSettings?.xpLogChannel;
            
            if (!logChannelId) {
                const guild = this.client.guilds.cache.get(firstActivity.guildId);
                if (guild) {
                    const defaultLogChannel = guild.channels.cache.find(ch => 
                        ch.name.toLowerCase().includes('leveling-event-log') && ch.isTextBased()
                    );
                    
                    if (defaultLogChannel) {
                        logChannelId = defaultLogChannel.id;
                        console.log(`[VOICE XP SUMMARY] Using default log channel: ${defaultLogChannel.name}`);
                    }
                }
            }
            
            if (!logChannelId) return;

            const logVoice = process.env.XP_LOG_VOICE !== 'false';
            if (!logVoice) return;

            const channel = await this.client.channels.fetch(logChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) return;

            // Group by voice channel for better organization
            const channelGroups = new Map();
            activities.forEach(activity => {
                if (!channelGroups.has(activity.channelName)) {
                    channelGroups.set(activity.channelName, []);
                }
                channelGroups.get(activity.channelName).push(activity);
            });

            const embed = new EmbedBuilder()
                .setColor(0xFF0000) // FORCE RED - Marine red theme
                .setTimestamp()
                .setAuthor({ 
                    name: '🔴 MARINE INTELLIGENCE BUREAU',
                    iconURL: null
                })
                .setTitle('🔴 🎙️ VOICE ACTIVITY SURVEILLANCE REPORT')
                .setFooter({ text: '⚓ Marine Intelligence Division • Voice Monitoring System' });

            let description = '```diff\n';
            let totalXPAwarded = 0;
            let capHits = 0;
            let mutePenalties = 0;

            for (const [channelName, channelActivities] of channelGroups) {
                description += `\n- 🎙️ CHANNEL: ${channelName}\n`;
                description += `- ACTIVE MEMBERS: ${channelActivities[0].memberCount}\n`;
                
                channelActivities.forEach(activity => {
                    const capText = activity.hitDailyCap ? ' [DAILY CAP]' : '';
                    const muteText = activity.wasMuted ? ` [${activity.muteReason}]` : '';
                    const dailyProgress = `${activity.dailyXPAfter}/${activity.dailyCap}`;
                    
                    description += `- ${activity.user.username}: +${activity.xpGain} XP`;
                    description += ` (Daily: ${dailyProgress})`;
                    description += `${capText}${muteText}\n`;
                    description += `-   └ Total: ${activity.totalXP.toLocaleString()} XP (Lv.${activity.currentLevel})\n`;
                    
                    totalXPAwarded += activity.xpGain;
                    if (activity.hitDailyCap) capHits++;
                    if (activity.wasMuted) mutePenalties++;
                });
            }

            description += `\n- 📊 SESSION SUMMARY:\n`;
            description += `- Total XP Awarded: +${totalXPAwarded}\n`;
            description += `- Daily Caps Hit: ${capHits}/${activities.length}\n`;
            description += `- Mute Penalties: ${mutePenalties}/${activities.length}\n`;
            description += `- THREAT STATUS: MONITORED\n`;
            description += '```';

            embed.setDescription(description);

            // Add fields for detailed cap information if any caps were hit - ALL RED
            if (capHits > 0) {
                const cappedUsers = activities.filter(a => a.hitDailyCap);
                let capDetails = '```diff\n';
                cappedUsers.forEach(a => {
                    capDetails += `- ${a.user.username}: ${a.dailyXPAfter}/${a.dailyCap} XP (MAXIMUM REACHED)\n`;
                });
                capDetails += '```';

                embed.addFields({
                    name: '🔴 DAILY CAP STATUS',
                    value: capDetails,
                    inline: false
                });
            }

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[VOICE XP SUMMARY] Failed to send enhanced summary:', error);
        }
    }

    // Clean up daily voice XP with database persistence and 3 AM EST reset
    async cleanupDailyVoiceXP() {
        try {
            console.log('[DAILY CAP] Starting daily voice XP cleanup (3 AM EST reset)...');
            
            const today = this.getCurrentDayKey(); // Use 3 AM EST reset

            // Clean up memory cache
            let memoryDeleted = 0;
            for (const [key] of this.dailyVoiceXP.entries()) {
                // Remove entries that are not from current day (based on 3 AM EST reset)
                if (!key.includes(today)) {
                    this.dailyVoiceXP.delete(key);
                    memoryDeleted++;
                }
            }

            console.log(`[DAILY CAP] Cleaned up ${memoryDeleted} old entries from memory`);

            // Clean up database (keep last 7 days for analysis)
            const dbResult = await this.db.query(
                "DELETE FROM daily_voice_xp WHERE date < CURRENT_DATE - INTERVAL '7 days'"
            );

            console.log(`[DAILY CAP] Cleaned up ${dbResult.rowCount || 0} old entries from database`);
            console.log(`[DAILY CAP] Cleanup complete - Current memory entries: ${this.dailyVoiceXP.size}`);
            console.log(`[DAILY CAP] Current day: ${today} (3 AM EST reset)`);
            console.log(`[DAILY CAP] Next reset: ${this.getNextResetTime()}`);

        } catch (error) {
            console.error('[DAILY CAP] Error during cleanup:', error);
        }
    }

    // Schedule automatic daily reset at 3 AM EST
    scheduleDailyReset() {
        const scheduleNextReset = () => {
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
            
            // Convert back to UTC for setTimeout
            const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
            const msUntilReset = utcReset.getTime() - now.getTime();
            
            console.log(`[DAILY CAP] Scheduled automatic reset in ${Math.round(msUntilReset / 1000 / 60 / 60)} hours (at 3 AM EST)`);
            console.log(`[DAILY CAP] Next reset: ${this.getNextResetTime()}`);
            
            setTimeout(async () => {
                console.log('[DAILY CAP] 🕒 3 AM EST - Performing automatic daily reset...');
                await this.performDailyReset();
                scheduleNextReset(); // Schedule the next reset
            }, msUntilReset);
        };
        
        scheduleNextReset();
    }

    // Perform the actual daily reset
    async performDailyReset() {
        try {
            console.log('[DAILY CAP] 🔄 Performing daily XP cap reset at 3 AM EST...');
            
            const oldDayKey = this.getCurrentDayKey();
            
            // Clear memory cache for old day
            let resetCount = 0;
            for (const [key] of this.dailyVoiceXP.entries()) {
                if (!key.includes(oldDayKey)) {
                    this.dailyVoiceXP.delete(key);
                    resetCount++;
                }
            }
            
            console.log(`[DAILY CAP] ✅ Daily reset complete!`);
            console.log(`[DAILY CAP] - Reset ${resetCount} user daily caps`);
            console.log(`[DAILY CAP] - New day: ${this.getCurrentDayKey()}`);
            console.log(`[DAILY CAP] - Next reset: ${this.getNextResetTime()}`);
            
            // Send reset notification to all guilds (optional)
            await this.broadcastResetNotification();
            
        } catch (error) {
            console.error('[DAILY CAP] Error during daily reset:', error);
        }
    }

    // Optional: Broadcast reset notification to configured channels
    async broadcastResetNotification() {
        try {
            if (!global.guildSettings) return;
            
            let notificationsSent = 0;
            
            for (const [guildId, settings] of global.guildSettings.entries()) {
                if (settings.xpLogEnabled && settings.xpLogChannel) {
                    try {
                        const channel = await this.client.channels.fetch(settings.xpLogChannel).catch(() => null);
                        if (channel && channel.isTextBased()) {
                            const embed = new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setAuthor({ name: '🔴 MARINE INTELLIGENCE BUREAU' })
                                .setTitle('🔴 🕒 DAILY XP CAP RESET')
                                .setDescription(`\`\`\`diff\n- DAILY VOICE XP CAPS RESET AT 3:00 AM EST\n- ALL PIRATES CAN NOW EARN VOICE XP AGAIN\n- DAILY CAP: ${process.env.DAILY_VOICE_XP_CAP || 1500} XP\n- NEXT RESET: ${this.getNextResetTime()}\n- STATUS: SURVEILLANCE CONTINUES\n\`\`\``)
                                .setFooter({ text: '⚓ Marine Intelligence Division • Daily Reset System' })
                                .setTimestamp();
                            
                            await channel.send({ embeds: [embed] });
                            notificationsSent++;
                        }
                    } catch (error) {
                        console.error(`[DAILY CAP] Failed to send reset notification to guild ${guildId}:`, error);
                    }
                }
            }
            
            if (notificationsSent > 0) {
                console.log(`[DAILY CAP] Sent reset notifications to ${notificationsSent} guilds`);
            }
            
        } catch (error) {
            console.error('[DAILY CAP] Error broadcasting reset notifications:', error);
        }
    }

    async awardXP(userId, guildId, xpAmount, source, user, skipMultiplier = false) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
            
            let finalXP = xpAmount;
            
            if (xpAmount === null) {
                finalXP = this.getRandomXP(source);
                console.log(`[XP CALC] Generated base XP for ${source}: ${finalXP}`);
            }
            
            if (!skipMultiplier) {
                if (global.xpBoostManager && member) {
                    try {
                        const boostResult = await global.xpBoostManager.calculateUserBoost(guildId, member);
                        if (boostResult.multiplier > 1.0) {
                            const boostedXP = Math.round(finalXP * boostResult.multiplier);
                            console.log(`[XP BOOST] ${user.username} ${source}: ${finalXP} base → ${boostedXP} boosted`);
                            finalXP = boostedXP;
                        }
                    } catch (error) {
                        console.error('[XP BOOST ERROR] Failed to calculate user boost:', error);
                    }
                }
                
                const guildSettings = global.guildSettings?.get(guildId) || { xpMultiplier: 1.0 };
                const multiplier = guildSettings.xpMultiplier || parseFloat(process.env.XP_MULTIPLIER) || 1.0;
                
                if (multiplier !== 1.0) {
                    const rawFinalXP = finalXP * multiplier;
                    const afterGlobal = Math.round(rawFinalXP);
                    console.log(`[XP CALC] ${user.username} ${source}: ${finalXP} boosted → ${afterGlobal} final`);
                    finalXP = afterGlobal;
                }
            }
            
            const actualXP = (xpAmount > 0 && finalXP === 0) ? 1 : finalXP;

            console.log(`[XP AWARD] Final XP to award: ${actualXP} (source: ${source}, skipMultiplier: ${skipMultiplier})`);

            const beforeResult = await this.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            const oldLevel = beforeResult.rows.length > 0 ? beforeResult.rows[0].level : 0;
            const oldTotalXP = beforeResult.rows.length > 0 ? beforeResult.rows[0].total_xp : 0;

            await this.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, messages, reactions, voice_time, level)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
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
                (source === 'voice' || source === 'voice_silent') ? 1 : 0,
                oldLevel
            ]);

            const afterResult = await this.db.query(
                'SELECT total_xp FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            const newTotalXP = afterResult.rows[0].total_xp;
            const newLevel = this.calculateLevel(newTotalXP);

            await this.db.query(
                'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                [newLevel, userId, guildId]
            );

            if (source !== 'admin' && source !== 'voice' && source !== 'voice_silent') {
                await this.logXPActivity(source, user, guildId, actualXP, {
                    totalXP: newTotalXP,
                    currentLevel: newLevel
                });
            }

            console.log(`[XP] ${user.username}: ${oldTotalXP} + ${actualXP} = ${newTotalXP} XP (Level ${oldLevel} → ${newLevel})`);

            if (newLevel > oldLevel) {
                console.log(`[LEVEL UP] ${user.username} gained ${newLevel - oldLevel} levels: ${oldLevel} → ${newLevel}!`);
                
                for (let level = oldLevel + 1; level <= newLevel; level++) {
                    const levelXP = this.getXPForLevel(level);
                    const levelUpSource = source === 'voice_silent' ? 'voice' : source;
                    await this.handleLevelUp(userId, guildId, level - 1, level, levelXP - 100, levelXP, user, levelUpSource);
                    
                    if (level < newLevel) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

        } catch (error) {
            console.error('Error awarding XP:', error);
        }
    }

    async handleLevelUp(userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user, xpSource = 'unknown') {
        try {
            console.log(`[LEVEL UP] Processing level up for ${user.username}: ${oldLevel} → ${newLevel}`);

            const roleReward = await this.awardLevelRoles(userId, guildId, newLevel);

            await this.sendMarineLevelUpNotification(userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user, roleReward);

            await this.logXPActivity('levelup', user, guildId, 0, {
                oldLevel,
                newLevel,
                totalXP: newTotalXP,
                roleReward,
                xpSource: xpSource.toUpperCase()
            });

            console.log(`[LEVEL UP] Completed level up processing for ${user.username}`);

        } catch (error) {
            console.error('Error handling level up:', error);
        }
    }

    async sendMarineLevelUpNotification(userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user, roleReward = null) {
        try {
            console.log(`[LEVEL UP] Sending notification for ${user.username}: ${oldLevel} → ${newLevel}`);

            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                console.log('[LEVEL UP] Guild not found');
                return;
            }

            const guildSettings = global.guildSettings?.get(guildId);
            
            const levelupEnabled = guildSettings?.levelupEnabled !== false;
            if (!levelupEnabled) {
                console.log('[LEVEL UP] Level up announcements disabled for this guild');
                return;
            }

            let channelId = guildSettings?.levelupChannel;
            
            if (!channelId) {
                channelId = process.env.LEVELUP_CHANNEL;
            }

            if (!channelId || channelId === 'your_levelup_channel_id') {
                const defaultChannel = guild.channels.cache.find(ch => 
                    ch.name.toLowerCase().includes('bounty-notices') && ch.isTextBased()
                );
                
                if (defaultChannel) {
                    channelId = defaultChannel.id;
                    console.log(`[LEVEL UP] Using default bounty channel: ${defaultChannel.name}`);
                } else {
                    const fallbackChannels = ['general', 'chat', 'levelup', 'announcements'];
                    for (const name of fallbackChannels) {
                        const foundChannel = guild.channels.cache.find(ch => 
                            ch.name.toLowerCase().includes(name) && ch.isTextBased()
                        );
                        if (foundChannel) {
                            channelId = foundChannel.id;
                            console.log(`[LEVEL UP] Using fallback channel: ${foundChannel.name}`);
                            break;
                        }
                    }
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

            const wantedPosterData = {
                userId: user.id,
                level: newLevel,
                total_xp: newTotalXP,
                messages: 0,
                reactions: 0,
                voice_time: 0,
                member: await guild.members.fetch(user.id).catch(() => null)
            };

            let canvas = null;
            let attachment = null;
            
            try {
                canvas = await this.createWantedPoster(wantedPosterData, guild);
                attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${user.id}.png` });
            } catch (canvasError) {
                console.error('[LEVEL UP] Error creating wanted poster:', canvasError);
            }

            const embed = this.createMarineLevelUpEmbed(user, oldLevel, newLevel, oldTotalXP, newTotalXP, roleReward);
            
            if (attachment) {
                embed.setImage(`attachment://wanted_${user.id}.png`);
            }

            const pingUser = process.env.LEVELUP_PING_USER !== 'false';
            
            const messageOptions = { 
                embeds: [embed] 
            };
            
            if (pingUser) {
                messageOptions.content = `<@${userId}>`;
            }
            
            if (attachment) {
                messageOptions.files = [attachment];
            }
            
            const message = await channel.send(messageOptions);
            console.log(`[LEVEL UP] Notification sent successfully for ${user.username} in #${channel.name}${pingUser ? ' with user ping' : ' without ping'}`);

            return message;

        } catch (error) {
            console.error('Error sending Marine level up notification:', error);
        }
    }

    createMarineLevelUpEmbed(user, oldLevel, newLevel, oldTotalXP, newTotalXP, roleReward = null) {
        try {
            const { getBountyForLevel } = require('./bountySystem');
            
            const oldBounty = getBountyForLevel(oldLevel);
            const newBounty = getBountyForLevel(newLevel);

            function getThreatLevelName(level) {
                if (level >= 55) return "LEGENDARY THREAT";
                if (level >= 50) return "EMPEROR CLASS";
                if (level >= 45) return "EXTRAORDINARY";
                if (level >= 40) return "ELITE LEVEL";
                if (level >= 35) return "TERRITORIAL";
                if (level >= 30) return "ADVANCED COMBATANT";
                if (level >= 25) return "HIGH PRIORITY";
                if (level >= 20) return "DANGEROUS";
                if (level >= 15) return "GRAND LINE";
                if (level >= 10) return "ELEVATED";
                if (level >= 5) return "CONFIRMED CRIMINAL";
                return "MONITORING";
            }

            const embed = new EmbedBuilder()
                .setColor('#DC143C')
                .setTitle('🚨 WORLD GOVERNMENT BOUNTY UPDATE 🚨')
                .setDescription(`**${user.username}** has reached a new level of infamy!\n\n*${getThreatLevelName(newLevel)} threat level confirmed. Enhanced surveillance protocols activated.*`)
                .setThumbnail(user.displayAvatarURL({ size: 128 }))
                .addFields(
                    {
                        name: '💰 BOUNTY PROGRESSION',
                        value: `\`\`\`diff\n- OLD BOUNTY: ฿${oldBounty.toLocaleString()} (Level ${oldLevel})\n- NEW BOUNTY: ฿${newBounty.toLocaleString()} (Level ${newLevel})\n\`\`\``,
                        inline: false
                    },
                    {
                        name: '📊 Intelligence Summary',
                        value: `\`\`\`diff\n- Total Criminal Activity: ${newTotalXP.toLocaleString()} XP (Level ${newLevel})\n- Threat Classification: ${getThreatLevelName(newLevel)}\n\`\`\``,
                        inline: false
                    }
                );

            if (roleReward) {
                embed.addFields({
                    name: '👑 New Authority Granted',
                    value: `\`\`\`diff\n- **${roleReward}** role assigned for reaching Level ${newLevel}\n\`\`\``,
                    inline: false
                });
            }

            embed.setFooter({ 
                text: `⚓ Marine Intelligence • BOUNTY INCREASE CONFIRMED • ${new Date().toLocaleDateString()}` 
            })
            .setTimestamp();

            return embed;
        } catch (error) {
            console.error('Error creating Marine level up embed:', error);
            
            return new EmbedBuilder()
                .setColor('#DC143C')
                .setTitle('🚨 LEVEL UP! 🚨')
                .setDescription(`**${user.username}** leveled up from ${oldLevel} to ${newLevel}!`)
                .setThumbnail(user.displayAvatarURL({ size: 128 }))
                .setTimestamp();
        }
    }

    async awardLevelRoles(userId, guildId, level) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return null;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return null;

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
                    const role = guild.roles.cache.get(roleId);
                    if (role && !member.roles.cache.has(roleId)) {
                        await member.roles.add(role);
                        roleReward = role.name;
                        console.log(`[LEVEL UP] Added level ${reqLevel} role (${role.name}) to ${member.user.username}`);
                        break;
                    }
                }
            }

            return roleReward;

        } catch (error) {
            console.error('Error awarding level roles:', error);
            return null;
        }
    }

    // ALL RED XP logging with Marine Intelligence theme
    async logXPActivity(type, user, guildId, xpGain, additionalInfo = {}) {
        try {
            const guildSettings = global.guildSettings?.get(guildId);
            
            const logEnabled = guildSettings?.xpLogEnabled === true;
            if (!logEnabled) return;

            let logChannelId = guildSettings?.xpLogChannel;
            
            if (!logChannelId) {
                const guild = this.client.guilds.cache.get(guildId);
                if (guild) {
                    const defaultLogChannel = guild.channels.cache.find(ch => 
                        ch.name.toLowerCase().includes('leveling-event-log') && ch.isTextBased()
                    );
                    
                    if (defaultLogChannel) {
                        logChannelId = defaultLogChannel.id;
                        console.log(`[XP LOG] Using default log channel: ${defaultLogChannel.name}`);
                    }
                }
            }
            
            if (!logChannelId) return;

            const logSettings = {
                message: process.env.XP_LOG_MESSAGES !== 'false',
                reaction: process.env.XP_LOG_REACTIONS !== 'false',
                voice: process.env.XP_LOG_VOICE !== 'false',
                levelup: process.env.XP_LOG_LEVELUP !== 'false',
                admin: process.env.XP_LOG_ADMIN !== 'false'
            };

            if (!logSettings[type]) return;

            const guild = this.client.guilds.cache.get(guildId);
            const channel = await this.client.channels.fetch(logChannelId).catch(() => null);
            
            if (!channel || !channel.isTextBased()) return;

            const formatLevel = (level) => {
                return level !== undefined && level !== null ? level.toString() : '0';
            };

            const formatXP = (xp) => {
                return xp !== undefined && xp !== null ? xp.toLocaleString() : '0';
            };

            const embed = new EmbedBuilder()
                .setColor(0xFF0000) // FORCE RED - Always Marine red
                .setTimestamp()
                .setFooter({ text: '⚓ Marine Intelligence Division • Activity Monitor' });

            // Get daily cap info for voice activities with 3 AM EST reset
            let dailyCapInfo = '';
            if (type === 'voice' || type === 'voice_silent') {
                const today = this.getCurrentDayKey(); // Use 3 AM EST reset
                const dailyXP = this.getDailyVoiceXP(user.id, guildId, today);
                const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
                dailyCapInfo = `\n- DAILY VOICE XP: ${dailyXP}/${dailyCap}`;
                
                if (dailyXP >= dailyCap) {
                    dailyCapInfo += ' [CAP REACHED]';
                }
                
                // Add reset time info
                const nextReset = this.getNextResetTime();
                dailyCapInfo += `\n- NEXT RESET: ${nextReset}`;
            }

            switch (type) {
                case 'message':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 MESSAGE ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n- THREAT STATUS: ACTIVE\n\`\`\``);
                    break;

                case 'reaction':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 REACTION ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n- THREAT STATUS: ACTIVE\n\`\`\``);
                    break;

                case 'voice':
                case 'voice_silent':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 VOICE ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}${dailyCapInfo}\n- THREAT STATUS: ACTIVE\n\`\`\``);
                    break;

                case 'levelup':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('🔴 ⚠️ THREAT LEVEL INCREASED ⚠️')
                        .setDescription(`\`\`\`diff\n- BOUNTY UPDATE CONFIRMED\n- SUBJECT: ${user.username} (${user.id})\n- LEVEL: ${formatLevel(additionalInfo.oldLevel)} → ${formatLevel(additionalInfo.newLevel)}\n- TOTAL XP: ${formatXP(additionalInfo.totalXP)}\n- XP SOURCE: ${additionalInfo.xpSource || 'UNKNOWN'}\n- THREAT STATUS: ESCALATED\n${additionalInfo.roleReward ? `- ROLE AWARDED: ${additionalInfo.roleReward}\n` : ''}\`\`\``);
                    break;

                case 'admin':
                    embed
                        .setAuthor({ 
                            name: '🔴 MARINE COMMAND CENTER',
                            iconURL: additionalInfo.adminUser?.displayAvatarURL({ size: 32 }) || null
                        })
                        .setTitle('🔴 MANUAL XP ADJUSTMENT')
                        .setDescription(`\`\`\`diff\n- ADMINISTRATIVE ACTION\n- TARGET: ${user.username} (${user.id})\n- AUTHORIZED BY: ${additionalInfo.adminUser?.username || 'Unknown'}\n- ADJUSTMENT: ${xpGain > 0 ? '+' : ''}${xpGain} XP\n- REASON: ${additionalInfo.reason || 'No reason'}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- NEW LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n- AUTHORIZATION: CONFIRMED\n\`\`\``);
                    break;
            }

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[XP LOG] Failed to send XP log:', error);
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
        
        const earlyLevelPenalty = parseFloat(process.env.EARLY_LEVEL_PENALTY) || 1.0;
        const earlyLevelThreshold = parseInt(process.env.EARLY_LEVEL_THRESHOLD) || 0;
        
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
        
        if (level <= earlyLevelThreshold && earlyLevelPenalty > 1.0) {
            const penaltyStrength = 1 + ((earlyLevelPenalty - 1) * (earlyLevelThreshold - level + 1) / earlyLevelThreshold);
            const originalXP = xpRequired;
            xpRequired = Math.floor(xpRequired * penaltyStrength);
            
            console.log(`[XP CALC] Level ${level} early penalty: ${penaltyStrength.toFixed(2)}x (${originalXP.toLocaleString()} → ${xpRequired.toLocaleString()} XP)`);
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
        
        const earlyLevelPenalty = parseFloat(process.env.EARLY_LEVEL_PENALTY) || 1.0;
        const earlyLevelThreshold = parseInt(process.env.EARLY_LEVEL_THRESHOLD) || 0;

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
            
            if (level <= earlyLevelThreshold && earlyLevelPenalty > 1.0) {
                const penaltyStrength = 1 + ((earlyLevelPenalty - 1) * (earlyLevelThreshold - level + 1) / earlyLevelThreshold);
                requiredXP = Math.floor(requiredXP * penaltyStrength);
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

    async cleanup() {
        this.voiceSessions.clear();
        this.cooldowns.clear();
        this.dailyVoiceXP.clear();
    }

    async createWantedPoster(userData, guild) {
        const { createCanvas, loadImage } = require('canvas');
        const path = require('path');
        
        const width = 600, height = 900;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        try {
            const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
            ctx.drawImage(scrollTexture, 0, 0, width, height);
            console.log('[DEBUG] Successfully loaded scroll texture background');
        } catch (error) {
            console.log('[DEBUG] Scroll texture not found, using fallback parchment color');
            ctx.fillStyle = '#f5e6c5';
            ctx.fillRect(0, 0, width, height);
        }
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, width, height);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(18, 18, width - 36, height - 36);

        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '81px Arial, sans-serif';
        const wantedY = height * (1 - 92/100);
        const wantedX = (50/100) * width;
        ctx.fillText('WANTED', wantedX, wantedY);

        const photoSize = (95/100) * 400;
        const photoX = ((50/100) * width) - (photoSize/2);
        const photoY = height * (1 - 65/100) - (photoSize/2);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(photoX, photoY, photoSize, photoSize);

        const member = userData.member;
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
            } catch {
                console.log('[DEBUG] No avatar found, texture will show through');
            }
        }

        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '57px Arial, sans-serif';
        const deadOrAliveY = height * (1 - 39/100);
        const deadOrAliveX = (50/100) * width;
        ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);

        ctx.font = '69px Arial, sans-serif';
        let displayName = 'UNKNOWN PIRATE';
        if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
        else if (userData.userId) displayName = `PIRATE ${userData.userId.slice(-4)}`;
        
        ctx.textAlign = 'center';
        let nameWidth = ctx.measureText(displayName).width;
        if (nameWidth > width - 60) {
            ctx.font = '55px Arial, sans-serif';
        }
        
        const nameY = height * (1 - 30/100);
        const nameX = (50/100) * width;
        ctx.fillText(displayName, nameX, nameY);

        const berryBountyGap = 5;
        
        const { getBountyForLevel } = require('./bountySystem');
        const bountyAmount = getBountyForLevel(userData.level);
        const bountyStr = bountyAmount.toLocaleString();
        
        console.log(`[LEVEL UP] Level ${userData.level} = Bounty ฿${bountyStr}`);
        
        ctx.font = '54px serif';
        const bountyTextWidth = ctx.measureText(bountyStr).width;
        
        const berrySize = (32/100) * 150;
        const gapPixels = (berryBountyGap/100) * width;
        const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
        const bountyUnitStartX = (width - totalBountyWidth) / 2;
        
        const berryX = bountyUnitStartX + (berrySize/2);
        const berryY = height * (1 - 22/100) - (berrySize/2);
        
        // Simple berry symbol
        const berryCanvas = createCanvas(berrySize, berrySize);
        const berryCtx = berryCanvas.getContext('2d');
        berryCtx.fillStyle = '#111';
        berryCtx.font = `bold ${berrySize}px serif`;
        berryCtx.textAlign = 'center';
        berryCtx.textBaseline = 'middle';
        berryCtx.fillText('฿', berrySize/2, berrySize/2);
        
        ctx.drawImage(berryCanvas, berryX - (berrySize/2), berryY, berrySize, berrySize);

        const bountyX = bountyUnitStartX + berrySize + gapPixels;
        const bountyY = height * (1 - 22/100);
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#111';
        ctx.fillText(bountyStr, bountyX, bountyY);

        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.font = '24px serif';
        ctx.fillStyle = '#111';
        
        const marineText = 'M A R I N E';
        const marineX = (96/100) * width;
        const marineY = height * (1 - 2/100);
        ctx.fillText(marineText, marineX, marineY);

        return canvas;
    }

    // Get daily voice XP statistics for a user
    async getDailyVoiceXPStats(userId, guildId, days = 7) {
        try {
            const result = await this.db.query(`
                SELECT date, total_xp 
                FROM daily_voice_xp 
                WHERE user_id = $1 AND guild_id = $2 AND date >= CURRENT_DATE - INTERVAL '${days} days'
                ORDER BY date DESC
            `, [userId, guildId]);

            return result.rows.map(row => ({
                date: row.date,
                xp: row.total_xp
            }));
        } catch (error) {
            console.error('[DAILY CAP] Error getting daily voice XP stats:', error);
            return [];
        }
    }

    // Get guild-wide daily voice XP statistics
    async getGuildDailyVoiceXPStats(guildId, date = null) {
        try {
            if (!date) {
                date = new Date().toISOString().split('T')[0];
            }

            const result = await this.db.query(`
                SELECT user_id, total_xp 
                FROM daily_voice_xp 
                WHERE guild_id = $1 AND date = $2
                ORDER BY total_xp DESC
            `, [guildId, date]);

            const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
            const cappedUsers = result.rows.filter(row => row.total_xp >= dailyCap);
            const totalUsers = result.rows.length;
            const totalXP = result.rows.reduce((sum, row) => sum + row.total_xp, 0);

            return {
                date,
                totalUsers,
                cappedUsers: cappedUsers.length,
                cappedPercentage: totalUsers > 0 ? (cappedUsers.length / totalUsers) * 100 : 0,
                totalXP,
                averageXP: totalUsers > 0 ? totalXP / totalUsers : 0,
                topUsers: result.rows.slice(0, 10) // Top 10 users by daily voice XP
            };
        } catch (error) {
            console.error('[DAILY CAP] Error getting guild daily voice XP stats:', error);
            return null;
        }
    }

    async reinitializeVoiceSessions() {
        try {
            console.log('[VOICE XP] Manually reinitializing voice sessions...');
            this.voiceSessions.clear();
            
            let totalFound = 0;
            
            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    await guild.fetch();
                    
                    const voiceChannels = guild.channels.cache.filter(channel => 
                        channel.type === 2
                    );
                    
                    for (const [channelId, channel] of voiceChannels) {
                        try {
                            await channel.fetch();
                            
                            if (channel.members && channel.members.size > 0) {
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
                                        console.log(`[VOICE XP] Reinitialized: ${member.user.username} in ${channel.name} (${guild.name})`);
                                    }
                                }
                            }
                        } catch (channelError) {
                            console.error(`[VOICE XP] Error with channel ${channel.name}:`, channelError);
                        }
                    }
                    
                } catch (guildError) {
                    console.error(`[VOICE XP] Error with guild ${guild.name}:`, guildError);
                }
            }
            
            console.log(`[VOICE XP] Successfully reinitialized ${totalFound} voice sessions`);
            return totalFound;
            
        } catch (error) {
            console.error('[VOICE XP] Error reinitializing voice sessions:', error);
            return 0;
        }
    }
}

module.exports = XPTracker;
