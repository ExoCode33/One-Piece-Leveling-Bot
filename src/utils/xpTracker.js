// src/utils/xpTracker.js - Complete fixed file with voice XP summaries

const { EmbedBuilder } = require('discord.js');

class XPTracker {
    constructor(client, database) {
        this.client = client;
        this.db = database;
        this.voiceSessions = new Map();
        this.cooldowns = new Map();
        this.dailyVoiceXP = new Map();
        
        // Initialize guild settings from database
        this.loadGuildSettingsFromDatabase();
        
        // Initialize voice sessions for users already in voice channels
        this.initializeExistingVoiceSessions();
    }

    // NEW: Load all guild settings from database on startup
    async loadGuildSettingsFromDatabase() {
        try {
            console.log('[SETTINGS] Loading guild settings from database...');
            
            // Initialize global guild settings map if it doesn't exist
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }

            // First, check what columns exist in the guild_settings table
            const tableInfo = await this.db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'guild_settings'
                ORDER BY ordinal_position
            `);

            console.log('[SETTINGS] Current guild_settings table columns:', tableInfo.rows.map(r => r.column_name).join(', '));

            // Add missing columns if needed
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

            // Load all guild settings from database
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

                console.log(`[SETTINGS] Guild ${row.guild_id}:`);
                console.log(`  - XP Multiplier: ${row.xp_multiplier}x`);
                console.log(`  - Level Up: ${row.levelup_enabled ? 'enabled' : 'disabled'}`);
                console.log(`  - Level Up Channel: ${row.levelup_channel || 'not set'}`);
                console.log(`  - XP Log: ${row.xp_log_enabled ? 'enabled' : 'disabled'}`);
                console.log(`  - XP Log Channel: ${row.xp_log_channel || 'not set'}`);
            }

            console.log(`[SETTINGS] Successfully loaded ${loadedCount} guild configurations from database`);

        } catch (error) {
            console.error('[SETTINGS] Error loading guild settings from database:', error);
            
            // Initialize empty map if loading fails
            if (!global.guildSettings) {
                global.guildSettings = new Map();
            }
        }
    }

    // NEW: Initialize voice sessions for users already in voice channels when bot starts
    async initializeExistingVoiceSessions() {
        try {
            console.log('[VOICE XP] Scanning for existing voice channel members...');
            
            // Wait a moment for the client to be fully ready
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            let totalFound = 0;
            
            // Scan all guilds the bot is in
            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    // Check all voice channels in this guild
                    const voiceChannels = guild.channels.cache.filter(channel => 
                        channel.type === 2 && // Voice channel type
                        channel.members && 
                        channel.members.size > 0
                    );
                    
                    for (const [channelId, channel] of voiceChannels) {
                        // Add each non-bot member to voice sessions
                        for (const [memberId, member] of channel.members) {
                            if (!member.user.bot) {
                                this.voiceSessions.set(memberId, {
                                    guildId: guildId,
                                    channelId: channelId,
                                    joinTime: Date.now(), // Use current time as join time
                                    lastXPTime: Date.now()
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

    async handleMessageXP(message) {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const guildId = message.guild.id;
        const cooldownKey = `${userId}_${guildId}_message`;

        // Check cooldown using YOUR environment variables
        if (this.isOnCooldown(cooldownKey, parseInt(process.env.MESSAGE_COOLDOWN) || 60000)) {
            return;
        }

        // Calculate XP using YOUR environment variables
        const xpGain = this.getRandomXP('message');

        // Award XP and check for level up
        await this.awardXP(userId, guildId, xpGain, 'message', message.author);
        this.setCooldown(cooldownKey);
    }

    async handleReactionXP(reaction, user) {
        if (user.bot || !reaction.message.guild) return;

        const userId = user.id;
        const guildId = reaction.message.guild.id;
        const cooldownKey = `${userId}_${guildId}_reaction`;

        // Check cooldown using YOUR environment variables
        if (this.isOnCooldown(cooldownKey, parseInt(process.env.REACTION_COOLDOWN) || 300000)) {
            return;
        }

        // Calculate XP using YOUR environment variables
        const xpGain = this.getRandomXP('reaction');

        // Award XP and check for level up
        await this.awardXP(userId, guildId, xpGain, 'reaction', user);
        this.setCooldown(cooldownKey);
    }

    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.id || oldState.id;
        const guildId = newState.guild?.id || oldState.guild?.id;
        
        if (!guildId) return;

        // User joined voice channel
        if (!oldState.channelId && newState.channelId) {
            this.voiceSessions.set(userId, {
                guildId,
                channelId: newState.channelId,
                joinTime: Date.now(),
                lastXPTime: Date.now()
            });
        }
        // User left voice channel
        else if (oldState.channelId && !newState.channelId) {
            this.voiceSessions.delete(userId);
        }
        // User changed channels
        else if (oldState.channelId !== newState.channelId) {
            if (this.voiceSessions.has(userId)) {
                const session = this.voiceSessions.get(userId);
                session.channelId = newState.channelId;
                session.joinTime = Date.now();
            }
        }
    }

    async processVoiceXP() {
        const now = Date.now();
        const voiceXPCooldown = parseInt(process.env.VOICE_COOLDOWN) || 60000;
        const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
        const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 6000;

        // Collect all voice XP activities for batch logging
        const voiceActivities = [];

        for (const [userId, session] of this.voiceSessions.entries()) {
            try {
                // Check if enough time has passed
                if (now - session.lastXPTime < voiceXPCooldown) continue;

                // Get voice channel
                const guild = this.client.guilds.cache.get(session.guildId);
                if (!guild) continue;

                const channel = guild.channels.cache.get(session.channelId);
                if (!channel) {
                    this.voiceSessions.delete(userId);
                    continue;
                }

                // Check minimum members requirement
                const memberCount = channel.members.filter(m => !m.user.bot).size;
                if (memberCount < minMembers) continue;

                // Check daily voice XP cap
                const today = new Date().toDateString();
                const dailyKey = `${userId}_${today}`;
                const dailyXP = this.dailyVoiceXP.get(dailyKey) || 0;
                
                if (dailyXP >= dailyCap) continue;

                // Calculate XP using YOUR environment variables
                const xpGain = this.getRandomXP('voice');
                const newDailyXP = dailyXP + xpGain;
                
                // Cap the XP gain if it would exceed daily limit
                const actualXPGain = Math.min(xpGain, dailyCap - dailyXP);
                
                if (actualXPGain <= 0) continue;

                // Update daily tracking
                this.dailyVoiceXP.set(dailyKey, newDailyXP);

                // Award XP
                const user = await this.client.users.fetch(userId).catch(() => null);
                if (user) {
                    await this.awardXP(userId, session.guildId, actualXPGain, 'voice', user);
                    
                    // Get updated user stats after XP award
                    const updatedStats = await this.getUserStats(userId, session.guildId);
                    
                    // Get guild settings for multiplier to show actual XP awarded
                    const guildSettings = global.guildSettings?.get(session.guildId) || { xpMultiplier: 1.0 };
                    const multiplier = guildSettings.xpMultiplier || parseFloat(process.env.XP_MULTIPLIER) || 1.0;
                    const finalXPAwarded = Math.floor(actualXPGain * multiplier);
                    
                    // Add to voice activities collection for batch logging
                    voiceActivities.push({
                        user,
                        guildId: session.guildId,
                        channelName: channel.name,
                        sessionDuration: Math.floor((now - session.joinTime) / 60000),
                        memberCount,
                        xpGain: finalXPAwarded, // Show the final XP after multiplier
                        dailyCapped: newDailyXP >= dailyCap,
                        totalXP: updatedStats?.total_xp || 0,
                        currentLevel: updatedStats?.level || 0
                    });
                }
                
                session.lastXPTime = now;

            } catch (error) {
                console.error(`Error processing voice XP for user ${userId}:`, error);
            }
        }

        // Send batch voice XP summary if there are activities
        if (voiceActivities.length > 0) {
            await this.sendVoiceXPSummary(voiceActivities);
        }
    }

    // NEW: Send voice XP summary for all users at once
    async sendVoiceXPSummary(activities) {
        try {
            if (activities.length === 0) return;

            // Get guild settings from the first activity
            const firstActivity = activities[0];
            const guildSettings = global.guildSettings?.get(firstActivity.guildId);
            
            // Check if XP logging is enabled for this guild
            const logEnabled = guildSettings?.xpLogEnabled === true;
            if (!logEnabled) return;

            // Get log channel from guild settings or find default
            let logChannelId = guildSettings?.xpLogChannel;
            
            if (!logChannelId) {
                // Try to find the default leveling event log channel
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

            // Check if voice logging is enabled
            const logVoice = process.env.XP_LOG_VOICE !== 'false';
            if (!logVoice) return;

            const channel = await this.client.channels.fetch(logChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) return;

            // Group activities by voice channel
            const channelGroups = new Map();
            activities.forEach(activity => {
                if (!channelGroups.has(activity.channelName)) {
                    channelGroups.set(activity.channelName, []);
                }
                channelGroups.get(activity.channelName).push(activity);
            });

            // Create summary embed
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTimestamp()
                .setAuthor({ 
                    name: '🚨 MARINE INTELLIGENCE BUREAU',
                    iconURL: null
                })
                .setTitle('VOICE ACTIVITY SUMMARY')
                .setFooter({ text: '⚓ Marine Intelligence Division • Activity Monitor' });

            let description = '```diff\n';
            let totalXPAwarded = 0;

            // Add each voice channel group
            for (const [channelName, channelActivities] of channelGroups) {
                description += `\n🎙️ CHANNEL: ${channelName}\n`;
                description += `- MEMBERS: ${channelActivities[0].memberCount}\n`;
                
                channelActivities.forEach(activity => {
                    const dailyCapText = activity.dailyCapped ? ' (CAP)' : '';
                    description += `- ${activity.user.username}: +${activity.xpGain} XP → ${activity.totalXP.toLocaleString()} (Lv.${activity.currentLevel})${dailyCapText}\n`;
                    totalXPAwarded += activity.xpGain;
                });
            }

            description += `\n📊 TOTAL XP AWARDED: +${totalXPAwarded}\n`;
            description += '```';

            embed.setDescription(description);

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[VOICE XP SUMMARY] Failed to send summary:', error);
        }
    }

    async awardXP(userId, guildId, xpAmount, source, user) {
        try {
            // Get guild settings for multiplier
            const guildSettings = global.guildSettings?.get(guildId) || { xpMultiplier: 1.0 };
            
            // Apply guild XP multiplier (database setting takes priority over environment)
            const multiplier = guildSettings.xpMultiplier || parseFloat(process.env.XP_MULTIPLIER) || 1.0;
            const finalXP = Math.floor(xpAmount * multiplier);

            // Get current user stats BEFORE update
            const beforeResult = await this.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            const oldLevel = beforeResult.rows.length > 0 ? beforeResult.rows[0].level : 0;
            const oldTotalXP = beforeResult.rows.length > 0 ? beforeResult.rows[0].total_xp : 0;

            // Update user stats using YOUR database structure
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
                userId, guildId, finalXP,
                source === 'message' ? 1 : 0,
                source === 'reaction' ? 1 : 0,
                source === 'voice' ? 1 : 0,
                oldLevel // Keep the old level for now
            ]);

            // Get the NEW total XP after update
            const afterResult = await this.db.query(
                'SELECT total_xp FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            const newTotalXP = afterResult.rows[0].total_xp;
            const newLevel = this.calculateLevel(newTotalXP);

            // Update the level in database
            await this.db.query(
                'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                [newLevel, userId, guildId]
            );

            // Log XP gain for non-admin and non-voice sources (voice logging handled in processVoiceXP summary)
            if (source !== 'admin' && source !== 'voice') {
                await this.logXPActivity(source, user, guildId, finalXP, {
                    totalXP: newTotalXP,
                    currentLevel: newLevel
                });
            }

            console.log(`[XP] ${user.username}: ${oldTotalXP} + ${finalXP} = ${newTotalXP} XP (Level ${oldLevel} → ${newLevel})`);

            // FIXED: Handle multiple level gains - announce EVERY level with XP source
            if (newLevel > oldLevel) {
                console.log(`[LEVEL UP] ${user.username} gained ${newLevel - oldLevel} levels: ${oldLevel} → ${newLevel}!`);
                
                // Announce each level individually
                for (let level = oldLevel + 1; level <= newLevel; level++) {
                    const levelXP = this.getXPForLevel(level);
                    await this.handleLevelUp(userId, guildId, level - 1, level, levelXP - 100, levelXP, user, source);
                    
                    // Small delay between announcements to prevent spam
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

            // Award level roles using YOUR level role system
            const roleReward = await this.awardLevelRoles(userId, guildId, newLevel);

            // Send Marine-themed level up notification
            await this.sendMarineLevelUpNotification(userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user, roleReward);

            // Log the level up event with XP source
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

            // Get guild settings from database/memory
            const guildSettings = global.guildSettings?.get(guildId);
            
            // Check if levelup is enabled
            const levelupEnabled = guildSettings?.levelupEnabled !== false; // Default to true
            if (!levelupEnabled) {
                console.log('[LEVEL UP] Level up announcements disabled for this guild');
                return;
            }

            // Get notification channel from guild settings
            let channelId = guildSettings?.levelupChannel;
            
            // Fallback to environment variable if not set in database
            if (!channelId) {
                channelId = process.env.LEVELUP_CHANNEL;
            }

            if (!channelId || channelId === 'your_levelup_channel_id') {
                // Try to find the default bounty notices channel first
                const defaultChannel = guild.channels.cache.find(ch => 
                    ch.name.toLowerCase().includes('bounty-notices') && ch.isTextBased()
                );
                
                if (defaultChannel) {
                    channelId = defaultChannel.id;
                    console.log(`[LEVEL UP] Using default bounty channel: ${defaultChannel.name}`);
                } else {
                    // Fallback to other common channel names
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

            // Create the userData object for the wanted poster (same format as /level command)
            const wantedPosterData = {
                userId: user.id,
                level: newLevel,
                total_xp: newTotalXP,
                messages: 0, // We don't need exact counts for level up announcements
                reactions: 0,
                voice_time: 0,
                member: await guild.members.fetch(user.id).catch(() => null)
            };

            // Create Canvas wanted poster (same as /level command)
            let canvas = null;
            let attachment = null;
            
            try {
                canvas = await this.createWantedPoster(wantedPosterData, guild);
                const { AttachmentBuilder } = require('discord.js');
                attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `wanted_${user.id}.png` });
            } catch (canvasError) {
                console.error('[LEVEL UP] Error creating wanted poster:', canvasError);
                // Continue without the poster
            }

            // Create Marine notification with red text
            const embed = this.createMarineLevelUpEmbed(user, oldLevel, newLevel, oldTotalXP, newTotalXP, roleReward);
            
            // Add the wanted poster image if successfully created
            if (attachment) {
                embed.setImage(`attachment://wanted_${user.id}.png`);
            }

            // Send the notification
            const messageOptions = { embeds: [embed] };
            if (attachment) {
                messageOptions.files = [attachment];
            }
            
            const message = await channel.send(messageOptions);
            console.log(`[LEVEL UP] Notification sent successfully for ${user.username} in #${channel.name}`);

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
            const bountyIncrease = newBounty - oldBounty;

            // Get threat level message
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

            // Add role reward if any
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
            
            // Fallback embed if bounty system fails
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

            // Check for level-specific roles using YOUR environment variables
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
                        break; // Only award the highest role achieved
                    }
                }
            }

            return roleReward;

        } catch (error) {
            console.error('Error awarding level roles:', error);
            return null;
        }
    }

    // XP Logging function for admin purposes - FIXED with red text and guild settings
    async logXPActivity(type, user, guildId, xpGain, additionalInfo = {}) {
        try {
            // Get guild settings from database/memory
            const guildSettings = global.guildSettings?.get(guildId);
            
            // Check if XP logging is enabled for this guild
            const logEnabled = guildSettings?.xpLogEnabled === true;
            if (!logEnabled) return;

            // Get log channel from guild settings or find default
            let logChannelId = guildSettings?.xpLogChannel;
            
            if (!logChannelId) {
                // Try to find the default leveling event log channel
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

            // Check specific logging settings (fallback to environment variables)
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

            // Helper function to properly handle level 0
            const formatLevel = (level) => {
                return level !== undefined && level !== null ? level.toString() : '0';
            };

            // Helper function to format XP totals
            const formatXP = (xp) => {
                return xp !== undefined && xp !== null ? xp.toLocaleString() : '0';
            };

            // Create logging embed
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTimestamp()
                .setFooter({ text: '⚓ Marine Intelligence Division • Activity Monitor' });

            // Configure embed based on type
            switch (type) {
                case 'message':
                    embed
                        .setAuthor({ 
                            name: '🚨 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('MESSAGE ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                    break;

                case 'reaction':
                    embed
                        .setAuthor({ 
                            name: '🚨 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('REACTION ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- CURRENT LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                    break;

                case 'levelup':
                    embed
                        .setAuthor({ 
                            name: '🚨 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('⚠️ THREAT LEVEL INCREASED ⚠️')
                        .setDescription(`\`\`\`diff\n- BOUNTY UPDATE CONFIRMED\n- SUBJECT: ${user.username} (${user.id})\n- LEVEL: ${formatLevel(additionalInfo.oldLevel)} → ${formatLevel(additionalInfo.newLevel)}\n- TOTAL XP: ${formatXP(additionalInfo.totalXP)}\n- XP SOURCE: ${additionalInfo.xpSource || 'UNKNOWN'}\n${additionalInfo.roleReward ? `- ROLE AWARDED: ${additionalInfo.roleReward}\n` : ''}\`\`\``);
                    break;

                case 'admin':
                    embed
                        .setAuthor({ 
                            name: '⚓ MARINE COMMAND CENTER',
                            iconURL: additionalInfo.adminUser?.displayAvatarURL({ size: 32 }) || null
                        })
                        .setTitle('MANUAL XP ADJUSTMENT')
                        .setDescription(`\`\`\`diff\n- ADMINISTRATIVE ACTION\n- TARGET: ${user.username} (${user.id})\n- AUTHORIZED BY: ${additionalInfo.adminUser?.username || 'Unknown'}\n- ADJUSTMENT: ${xpGain > 0 ? '+' : ''}${xpGain} XP\n- REASON: ${additionalInfo.reason || 'No reason'}\n- NEW TOTAL: ${formatXP(additionalInfo.totalXP)}\n- NEW LEVEL: ${formatLevel(additionalInfo.currentLevel)}\n\`\`\``);
                    break;
            }

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[XP LOG] Failed to send XP log:', error);
        }
    }

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

            // Get total count for pagination
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

    // Fixed XP calculation method using YOUR environment variables
    getXPForLevel(level) {
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const curve = process.env.FORMULA_CURVE || 'exponential';
        
        if (curve === 'exponential') {
            return Math.floor(100 * Math.pow(level, multiplier));
        } else if (curve === 'linear') {
            return 100 * level * multiplier;
        } else if (curve === 'logarithmic') {
            return Math.floor(100 * Math.log(level + 1) * multiplier * 10);
        }
        
        return Math.floor(100 * Math.pow(level, multiplier));
    }

    // Fixed XP generation using YOUR environment variables
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

        for (let level = 1; level <= maxLevel; level++) {
            let requiredXP;
            
            if (curve === 'exponential') {
                requiredXP = Math.floor(100 * Math.pow(level, multiplier));
            } else if (curve === 'linear') {
                requiredXP = 100 * level * multiplier;
            } else if (curve === 'logarithmic') {
                requiredXP = Math.floor(100 * Math.log(level + 1) * multiplier * 10);
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

    cleanupDailyVoiceXP() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toDateString();

        for (const [key] of this.dailyVoiceXP.entries()) {
            if (key.includes(yesterdayString)) {
                this.dailyVoiceXP.delete(key);
            }
        }
    }

    async cleanup() {
        // Cleanup method for graceful shutdown
        this.voiceSessions.clear();
        this.cooldowns.clear();
        this.dailyVoiceXP.clear();
    }

    // NEW: Manual method to reinitialize voice sessions (call this from index.js after bot ready)
    async reinitializeVoiceSessions() {
        try {
            console.log('[VOICE XP] Manually reinitializing voice sessions...');
            this.voiceSessions.clear(); // Clear existing sessions first
            
            let totalFound = 0;
            
            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    // Fetch fresh guild data
                    await guild.fetch();
                    
                    // Get all voice channels
                    const voiceChannels = guild.channels.cache.filter(channel => 
                        channel.type === 2 // Voice channel
                    );
                    
                    for (const [channelId, channel] of voiceChannels) {
                        try {
                            // Fetch fresh channel members
                            await channel.fetch();
                            
                            if (channel.members && channel.members.size > 0) {
                                for (const [memberId, member] of channel.members) {
                                    if (!member.user.bot) {
                                        this.voiceSessions.set(memberId, {
                                            guildId: guildId,
                                            channelId: channelId,
                                            joinTime: Date.now(),
                                            lastXPTime: Date.now()
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

    // EXACT SAME createWantedPoster function from level.js
    async createWantedPoster(userData, guild) {
        const { createCanvas, loadImage } = require('canvas');
        const path = require('path');
        
        const width = 600, height = 900;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Load and draw scroll texture background
        try {
            const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
            
            // Draw the texture to fill the entire canvas
            ctx.drawImage(scrollTexture, 0, 0, width, height);
            
            console.log('[DEBUG] Successfully loaded scroll texture background');
        } catch (error) {
            console.log('[DEBUG] Scroll texture not found, using fallback parchment color');
            // Fallback to original parchment background if texture fails to load
            ctx.fillStyle = '#f5e6c5';
            ctx.fillRect(0, 0, width, height);
        }
        
        // All borders and elements go on top of the texture
        // All borders now black for consistency
        ctx.strokeStyle = '#000000'; // Outer border - black
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, width, height);
        
        ctx.strokeStyle = '#000000'; // Middle border - black
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);
        
        ctx.strokeStyle = '#000000'; // Inner border - black
        ctx.lineWidth = 3;
        ctx.strokeRect(18, 18, width - 36, height - 36);

        // WANTED title - Size 27, Horiz 50, Vert 92
        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '81px CaptainKiddNF, Arial, sans-serif'; // Size 27/100 * 300 = 81px
        const wantedY = height * (1 - 92/100); // Vert 92: 92% from bottom = 8% from top
        const wantedX = (50/100) * width; // Horiz 50: centered
        ctx.fillText('WANTED', wantedX, wantedY);

        // Image Box - Size 95, Horiz 50, Vert 65 with slightly wider border
        const photoSize = (95/100) * 400; // Size 95/100 * reasonable max = 380px
        const photoX = ((50/100) * width) - (photoSize/2); // Horiz 50: centered
        const photoY = height * (1 - 65/100) - (photoSize/2); // Vert 65: 65% from bottom
        
        // Slightly wider black border
        ctx.strokeStyle = '#000000'; // Black border
        ctx.lineWidth = 3; // Increased from 1 to 3 for wider border
        ctx.strokeRect(photoX, photoY, photoSize, photoSize);
        
        // No white background - image goes directly on texture

        let member = null;
        try {
            if (guild && userData.userId) member = await guild.members.fetch(userData.userId);
        } catch {}
        
        const avatarArea = { x: photoX + 3, y: photoY + 3, width: photoSize - 6, height: photoSize - 6 }; // Adjusted for wider border
        if (member) {
            try {
                const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
                const avatar = await loadImage(avatarURL);
                
                ctx.save();
                ctx.beginPath();
                ctx.rect(avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                ctx.clip();
                
                // Subtle weathering effect
                ctx.filter = 'contrast(0.95) sepia(0.05)';
                ctx.drawImage(avatar, avatarArea.x, avatarArea.y, avatarArea.width, avatarArea.height);
                ctx.filter = 'none';
                
                ctx.restore();
            } catch {
                // If no avatar, just leave the texture showing through with border
                console.log('[DEBUG] No avatar found, texture will show through');
            }
        }

        // "DEAD OR ALIVE" - Size 19, Horiz 50, Vert 39
        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '57px CaptainKiddNF, Arial, sans-serif'; // Size 19/100 * 300 = 57px
        const deadOrAliveY = height * (1 - 39/100); // Vert 39: 39% from bottom
        const deadOrAliveX = (50/100) * width; // Horiz 50: centered
        ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);

        // Name ("SHANKS") - Size 23, Horiz 50, Vert 30
        ctx.font = '69px CaptainKiddNF, Arial, sans-serif'; // Size 23/100 * 300 = 69px
        let displayName = 'UNKNOWN PIRATE';
        if (member) displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
        else if (userData.userId) displayName = `PIRATE ${userData.userId.slice(-4)}`;
        
        // Check if name is too long and adjust
        ctx.textAlign = 'center';
        let nameWidth = ctx.measureText(displayName).width;
        if (nameWidth > width - 60) {
            ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
        }
        
        const nameY = height * (1 - 30/100); // Vert 30: 30% from bottom
        const nameX = (50/100) * width; // Horiz 50: centered
        ctx.fillText(displayName, nameX, nameY);

        // Berry Symbol and Bounty Numbers - FIXED TO USE BOUNTY AMOUNTS
        const berryBountyGap = 5; // Fixed gap in our 1-100 scale
        
        // FIXED: Get BOUNTY amount for user's level instead of XP
        const { getBountyForLevel } = require('./bountySystem');
        const bountyAmount = getBountyForLevel(userData.level);
        const bountyStr = bountyAmount.toLocaleString();
        
        console.log(`[LEVEL UP] Level ${userData.level} = Bounty ฿${bountyStr}`);
        
        ctx.font = '54px Cinzel, Georgia, serif'; // Set font to measure text
        const bountyTextWidth = ctx.measureText(bountyStr).width;
        
        // Berry symbol size
        const berrySize = (32/100) * 150; // Size 32/100 * reasonable max = 48px
        
        // Calculate total width of the bounty unit (berry + gap + text)
        const gapPixels = (berryBountyGap/100) * width; // Convert gap to pixels
        const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
        
        // Center the entire bounty unit horizontally
        const bountyUnitStartX = (width - totalBountyWidth) / 2;
        
        // Position berry symbol at the start of the centered unit
        const berryX = bountyUnitStartX + (berrySize/2); // Center of berry symbol
        const berryY = height * (1 - 22/100) - (berrySize/2); // Vert 22: 22% from bottom
        
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
        const bountyX = bountyUnitStartX + berrySize + gapPixels; // Start after berry + gap
        const bountyY = height * (1 - 22/100); // Vert 22: 22% from bottom (same as berry)
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#111';
        ctx.fillText(bountyStr, bountyX, bountyY);

        // One Piece logo - Size 26, Horiz 50, Vert 4.5
        try {
            const onePieceLogoPath = path.join(__dirname, '../../assets/one-piece-symbol.png');
            const onePieceLogo = await loadImage(onePieceLogoPath);
            const logoSize = (26/100) * 200; // Size 26/100 * reasonable max = 52px
            const logoX = ((50/100) * width) - (logoSize/2); // Horiz 50: centered
            const logoY = height * (1 - 4.5/100) - (logoSize/2); // Vert 4.5: 4.5% from bottom
            
            ctx.globalAlpha = 0.6;
            ctx.filter = 'sepia(0.2) brightness(0.9)';
            ctx.drawImage(onePieceLogo, logoX, logoY, logoSize, logoSize);
            ctx.globalAlpha = 1.0;
            ctx.filter = 'none';
        } catch {
            console.log('[DEBUG] One Piece logo not found at assets/one-piece-symbol.png');
        }

        // "MARINE" - Size 8, Horiz 96, Vert 2
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.font = '24px TimesNewNormal, Times, serif'; // Size 8/100 * 300 = 24px
        ctx.fillStyle = '#111';
        
        const marineText = 'M A R I N E';
        const marineX = (96/100) * width; // Horiz 96: very far right
        const marineY = height * (1 - 2/100); // Vert 2: 2% from bottom
        ctx.fillText(marineText, marineX, marineY);

        return canvas;
    }
}

module.exports = XPTracker;
