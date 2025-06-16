// src/utils/xpTracker.js
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

        // Check cooldown
        if (this.isOnCooldown(cooldownKey, parseInt(process.env.MESSAGE_COOLDOWN) || 60000)) {
            return;
        }

        // Calculate XP
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

        // Check cooldown
        if (this.isOnCooldown(cooldownKey, parseInt(process.env.REACTION_COOLDOWN) || 300000)) {
            return;
        }

        // Calculate XP
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
        const voiceXPCooldown = parseInt(process.env.VOICE_COOLDOWN) || 180000;
        const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
        const dailyCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;

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

                // Calculate XP
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
                }
                
                session.lastXPTime = now;

            } catch (error) {
                console.error(`Error processing voice XP for user ${userId}:`, error);
            }
        }
    }

    async awardXP(userId, guildId, xpAmount, source, user) {
        try {
            // Get current user stats
            const currentResult = await this.db.query(
                'SELECT total_xp, level FROM user_levels WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            const oldLevel = currentResult.rows.length > 0 ? currentResult.rows[0].level : 0;
            const oldTotalXP = currentResult.rows.length > 0 ? currentResult.rows[0].total_xp : 0;

            // Update user stats
            const result = await this.db.query(`
                INSERT INTO user_levels (user_id, guild_id, total_xp, messages, reactions, voice_time)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = user_levels.total_xp + $3,
                    messages = user_levels.messages + $4,
                    reactions = user_levels.reactions + $5,
                    voice_time = user_levels.voice_time + $6,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING total_xp, level
            `, [
                userId, guildId, xpAmount,
                source === 'message' ? 1 : 0,
                source === 'reaction' ? 1 : 0,
                source === 'voice' ? 1 : 0
            ]);

            const userStats = result.rows[0];
            const newLevel = this.calculateLevel(userStats.total_xp);

            // Check for level up
            if (newLevel > oldLevel) {
                await this.handleLevelUp(userId, guildId, oldLevel, newLevel, oldTotalXP, userStats.total_xp, user);
            }

            // Update level in database if it changed
            if (newLevel !== userStats.level) {
                await this.db.query(
                    'UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                    [newLevel, userId, guildId]
                );
            }

        } catch (error) {
            console.error('Error awarding XP:', error);
        }
    }

    async handleLevelUp(userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user) {
        try {
            // Award level roles
            await this.awardLevelRoles(userId, guildId, newLevel);

            // Send Marine-themed level up notification
            await this.sendMarineLevelUpNotification(userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user);

        } catch (error) {
            console.error('Error handling level up:', error);
        }
    }

    async sendMarineLevelUpNotification(userId, guildId, oldLevel, newLevel, oldTotalXP, newTotalXP, user) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            // Get notification channel
            const guildSettings = global.guildSettings?.get(guildId) || {};
            const channelId = guildSettings.levelupChannel || process.env.LEVELUP_CHANNEL;
            
            if (!channelId) return;

            const channel = guild.channels.cache.get(channelId);
            if (!channel) return;

            // Create clean Marine notification
            const embed = this.createCleanMarineEmbed(user, oldLevel, newLevel, oldTotalXP, newTotalXP);

            // Send the notification
            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Error sending Marine level up notification:', error);
        }
    }

    createCleanMarineEmbed(user, oldLevel, newLevel, oldTotalXP, newTotalXP) {
        const { getBountyForLevel } = require('./bountySystem');
        
        const oldBounty = getBountyForLevel(oldLevel);
        const newBounty = getBountyForLevel(newLevel);
        const bountyIncrease = newBounty - oldBounty;

        const embed = new EmbedBuilder()
            .setColor('#DC143C')
            .setTitle('WORLD GOVERNMENT BOUNTY UPDATE')
            .setDescription(`**${user.username}** has reached a new level of infamy!\n\nSubject has crossed into Grand Line territory. Enhanced surveillance required.`)
            .setThumbnail(user.displayAvatarURL({ size: 128 }))
            .addFields(
                {
                    name: 'Previous Bounty',
                    value: `Level ${oldLevel}\n฿${oldBounty.toLocaleString()}`,
                    inline: true
                },
                {
                    name: 'NEW BOUNTY',
                    value: `Level ${newLevel}\n฿${newBounty.toLocaleString()}`,
                    inline: true
                },
                {
                    name: 'Bounty Increase',
                    value: `+฿${bountyIncrease.toLocaleString()}`,
                    inline: true
                },
                {
                    name: 'Marine Intelligence Report',
                    value: `Multiple incidents involving Marine personnel. Elevated threat status.`,
                    inline: false
                }
            )
            .setFooter({ 
                text: `Marine Intelligence • BOUNTY INCREASE CONFIRMED • ${new Date().toLocaleDateString()}` 
            })
            .setTimestamp();

        return embed;
    }

    async awardLevelRoles(userId, guildId, level) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            // Check for level-specific roles
            const levelRoleId = process.env[`LEVEL_${level}_ROLE`];
            if (levelRoleId) {
                const role = guild.roles.cache.get(levelRoleId);
                if (role && !member.roles.cache.has(levelRoleId)) {
                    await member.roles.add(role);
                    console.log(`[LEVEL ROLE] Awarded ${role.name} to ${member.user.username}`);
                }
            }

        } catch (error) {
            console.error('Error awarding level roles:', error);
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

    // MISSING METHOD - This fixes the error!
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

    getRandomXP(type) {
        const min = parseInt(process.env[`${type.toUpperCase()}_XP_MIN`]) || 25;
        const max = parseInt(process.env[`${type.toUpperCase()}_XP_MAX`]) || 35;
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
}

module.exports = XPTracker;
