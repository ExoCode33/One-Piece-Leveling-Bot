// src/utils/xpTracker.js - Fixed to announce EVERY level gained

const { EmbedBuilder } = require('discord.js');

class XPTracker {
    constructor(client, database) {
        this.client = client;
        this.db = database;
        this.voiceSessions = new Map();
        this.cooldowns = new Map();
        this.dailyVoiceXP = new Map();
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
                    
                    // Log voice XP if logging is enabled
                    await this.logXPActivity('voice', user, session.guildId, actualXPGain, {
                        channelName: channel.name,
                        sessionDuration: Math.floor((now - session.joinTime) / 60000),
                        memberCount,
                        dailyCapped: newDailyXP >= dailyCap
                    });
                }
                
                session.lastXPTime = now;

            } catch (error) {
                console.error(`Error processing voice XP for user ${userId}:`, error);
            }
        }
    }

    async awardXP(userId, guildId, xpAmount, source, user) {
        try {
            // Get guild settings for multiplier
            const guildSettings = global.guildSettings?.get(guildId) || { xpMultiplier: 1.0 };
            
            // Apply YOUR XP multiplier
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

            // Log XP gain for non-admin sources
            if (source !== 'admin') {
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

    async handleLevelUp(userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user) {
        try {
            console.log(`[LEVEL UP] Processing level up for ${user.username}: ${oldLevel} → ${newLevel}`);

            // Award level roles using YOUR level role system
            const roleReward = await this.awardLevelRoles(userId, guildId, newLevel);

            // Send Marine-themed level up notification
            await this.sendMarineLevelUpNotification(userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user, roleReward);

            // Log the level up event
            await this.logXPActivity('levelup', user, guildId, 0, {
                oldLevel,
                newLevel,
                totalXP: newTotalXP,
                roleReward
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

            // Get notification channel
            let channelId = process.env.LEVELUP_CHANNEL;
            
            // Check if levelup is enabled
            const levelupEnabled = process.env.LEVELUP_ENABLED !== 'false';
            if (!levelupEnabled) {
                console.log('[LEVEL UP] Level up announcements disabled');
                return;
            }

            if (!channelId || channelId === 'your_levelup_channel_id') {
                // Try to find a default channel
                const defaultChannels = ['general', 'chat', 'levelup', 'announcements'];
                for (const name of defaultChannels) {
                    const foundChannel = guild.channels.cache.find(ch => 
                        ch.name.toLowerCase().includes(name) && ch.isTextBased()
                    );
                    if (foundChannel) {
                        channelId = foundChannel.id;
                        console.log(`[LEVEL UP] Using default channel: ${foundChannel.name}`);
                        break;
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

            // Create Marine notification using YOUR bounty system
            const embed = this.createMarineLevelUpEmbed(user, oldLevel, newLevel, oldTotalXP, newTotalXP, roleReward);

            // Send the notification
            const message = await channel.send({ embeds: [embed] });
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
                        name: '📑 Previous Status',
                        value: `Level ${oldLevel}\n฿${oldBounty.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '🔥 NEW BOUNTY',
                        value: `Level ${newLevel}\n฿${newBounty.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '💰 Bounty Increase',
                        value: `+฿${bountyIncrease.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '📊 Intelligence Summary',
                        value: `Total Criminal Activity: ${newTotalXP.toLocaleString()} XP\nThreat Classification: ${getThreatLevelName(newLevel)}`,
                        inline: false
                    }
                );

            // Add role reward if any
            if (roleReward) {
                embed.addFields({
                    name: '👑 New Authority Granted',
                    value: `**${roleReward}** role assigned for reaching Level ${newLevel}`,
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

    // XP Logging function for admin purposes
    async logXPActivity(type, user, guildId, xpGain, additionalInfo = {}) {
        try {
            // Check if XP logging is enabled
            const logChannelId = process.env.XP_LOG_CHANNEL;
            const logEnabled = process.env.XP_LOG_ENABLED === 'true';
            
            if (!logChannelId || !logEnabled) return;

            // Check specific logging settings
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
                            name: '📝 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('MESSAGE ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- GUILD: ${guild?.name || 'Unknown'}\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || 'Unknown'}\n\`\`\``);
                    break;

                case 'reaction':
                    embed
                        .setAuthor({ 
                            name: '😄 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('REACTION ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- GUILD: ${guild?.name || 'Unknown'}\n- XP AWARDED: +${xpGain}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || 'Unknown'}\n\`\`\``);
                    break;

                case 'voice':
                    embed
                        .setAuthor({ 
                            name: '🎙️ MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('VOICE ACTIVITY DETECTED')
                        .setDescription(`\`\`\`diff\n- SUBJECT: ${user.username} (${user.id})\n- GUILD: ${guild?.name || 'Unknown'}\n- CHANNEL: ${additionalInfo.channelName || 'Unknown'}\n- DURATION: ${additionalInfo.sessionDuration || 1} minute(s)\n- MEMBERS: ${additionalInfo.memberCount || 'Unknown'}\n- XP AWARDED: +${xpGain}${additionalInfo.dailyCapped ? ' (DAILY CAP)' : ''}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n- CURRENT LEVEL: ${additionalInfo.currentLevel || 'Unknown'}\n\`\`\``);
                    break;

                case 'levelup':
                    embed
                        .setAuthor({ 
                            name: '🚨 MARINE INTELLIGENCE BUREAU',
                            iconURL: user.displayAvatarURL({ size: 32 })
                        })
                        .setTitle('⚠️ THREAT LEVEL INCREASED ⚠️')
                        .setDescription(`\`\`\`diff\n+ BOUNTY UPDATE CONFIRMED\n+ SUBJECT: ${user.username} (${user.id})\n+ GUILD: ${guild?.name || 'Unknown'}\n+ LEVEL: ${additionalInfo.oldLevel || 0} → ${additionalInfo.newLevel || 0}\n+ TOTAL XP: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n${additionalInfo.roleReward ? `+ ROLE AWARDED: ${additionalInfo.roleReward}\n` : ''}! ENHANCED SURVEILLANCE REQUIRED\n\`\`\``);
                    break;

                case 'admin':
                    embed
                        .setAuthor({ 
                            name: '⚓ MARINE COMMAND CENTER',
                            iconURL: additionalInfo.adminUser?.displayAvatarURL({ size: 32 }) || null
                        })
                        .setTitle('MANUAL XP ADJUSTMENT')
                        .setDescription(`\`\`\`diff\n- ADMINISTRATIVE ACTION\n- TARGET: ${user.username} (${user.id})\n- AUTHORIZED BY: ${additionalInfo.adminUser?.username || 'Unknown'}\n- ADJUSTMENT: ${xpGain > 0 ? '+' : ''}${xpGain} XP\n- REASON: ${additionalInfo.reason || 'No reason'}\n- NEW TOTAL: ${additionalInfo.totalXP?.toLocaleString() || 'Unknown'}\n- NEW LEVEL: ${additionalInfo.currentLevel || 'Unknown'}\n\`\`\``);
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
}

module.exports = XPTracker;
