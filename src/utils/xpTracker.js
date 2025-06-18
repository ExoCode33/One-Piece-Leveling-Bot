// src/utils/xpTracker.js - Complete XPTracker with Marine Level-Up System

const { Pool } = require('pg');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');

class XPTracker {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.cooldowns = new Map();
        this.initializeTables();
    }

    async initializeTables() {
        try {
            // Create user_xp table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS user_xp (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    total_xp INTEGER DEFAULT 0,
                    messages INTEGER DEFAULT 0,
                    reactions INTEGER DEFAULT 0,
                    voice_time INTEGER DEFAULT 0,
                    daily_voice_time INTEGER DEFAULT 0,
                    last_voice_reset DATE DEFAULT CURRENT_DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, guild_id)
                )
            `);

            // Create guild_settings table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS guild_settings (
                    id SERIAL PRIMARY KEY,
                    guild_id VARCHAR(20) UNIQUE NOT NULL,
                    message_xp INTEGER DEFAULT 15,
                    voice_xp INTEGER DEFAULT 5,
                    reaction_xp INTEGER DEFAULT 2,
                    xp_cooldown INTEGER DEFAULT 60,
                    level_up_channel VARCHAR(20),
                    role_rewards JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create indexes
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_user_xp_lookup ON user_xp(user_id, guild_id);
                CREATE INDEX IF NOT EXISTS idx_user_xp_leaderboard ON user_xp(guild_id, total_xp DESC);
                CREATE INDEX IF NOT EXISTS idx_user_xp_voice_reset ON user_xp(last_voice_reset);
                CREATE INDEX IF NOT EXISTS idx_guild_settings_lookup ON guild_settings(guild_id);
            `);

            console.log('[INFO] Database tables initialized successfully');
        } catch (error) {
            console.error('[ERROR] Error initializing database tables:', error);
            throw error;
        }
    }

    // Core XP Methods
    async addXP(userId, guildId, amount, source = 'message') {
        try {
            const query = `
                INSERT INTO user_xp (user_id, guild_id, total_xp, ${source}s, updated_at)
                VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = user_xp.total_xp + $3,
                    ${source}s = user_xp.${source}s + 1,
                    ${source === 'voice' ? 'voice_time = user_xp.voice_time + 60,' : ''}
                    updated_at = CURRENT_TIMESTAMP
                RETURNING total_xp
            `;

            const result = await this.pool.query(query, [userId, guildId, amount]);
            const newTotalXP = result.rows[0].total_xp;

            // Check for level up
            const oldLevel = this.calculateLevel(newTotalXP - amount);
            const newLevel = this.calculateLevel(newTotalXP);

            if (newLevel > oldLevel) {
                // Get member and channel for level up
                const guild = global.client.guilds.cache.get(guildId);
                if (guild) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        // Find appropriate channel for level up message
                        const guildSettings = await this.getGuildSettings(guildId);
                        let channel = null;
                        
                        if (guildSettings.level_up_channel) {
                            channel = guild.channels.cache.get(guildSettings.level_up_channel);
                        }
                        
                        // Fallback to system channel or first text channel
                        if (!channel) {
                            channel = guild.systemChannel || 
                                     guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(guild.members.me).has('SendMessages'));
                        }

                        if (channel) {
                            await this.sendMarineLevelUp({
                                userId,
                                guildId,
                                oldLevel,
                                newLevel,
                                totalXP: newTotalXP,
                                member,
                                channel
                            });
                        }
                    }
                }
            }

            return { newTotalXP, leveledUp: newLevel > oldLevel, newLevel };
        } catch (error) {
            console.error('[ERROR] Error adding XP:', error);
            throw error;
        }
    }

    async getUserXP(userId, guildId) {
        try {
            const query = 'SELECT * FROM user_xp WHERE user_id = $1 AND guild_id = $2';
            const result = await this.pool.query(query, [userId, guildId]);
            
            if (result.rows.length > 0) {
                return result.rows[0];
            } else {
                // Return default data for new users
                return {
                    user_id: userId,
                    guild_id: guildId,
                    total_xp: 0,
                    messages: 0,
                    reactions: 0,
                    voice_time: 0,
                    daily_voice_time: 0
                };
            }
        } catch (error) {
            console.error('[ERROR] Error getting user XP:', error);
            throw error;
        }
    }

    async setUserXP(userId, guildId, totalXP) {
        try {
            const query = `
                INSERT INTO user_xp (user_id, guild_id, total_xp, updated_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id)
                DO UPDATE SET
                    total_xp = $3,
                    updated_at = CURRENT_TIMESTAMP
            `;
            await this.pool.query(query, [userId, guildId, totalXP]);
        } catch (error) {
            console.error('[ERROR] Error setting user XP:', error);
            throw error;
        }
    }

    async resetUser(userId, guildId) {
        try {
            const query = 'DELETE FROM user_xp WHERE user_id = $1 AND guild_id = $2';
            await this.pool.query(query, [userId, guildId]);
        } catch (error) {
            console.error('[ERROR] Error resetting user:', error);
            throw error;
        }
    }

    async getUserRank(userId, guildId) {
        try {
            const query = `
                SELECT COUNT(*) + 1 as rank
                FROM user_xp
                WHERE guild_id = $1 AND total_xp > (
                    SELECT COALESCE(total_xp, 0)
                    FROM user_xp
                    WHERE user_id = $2 AND guild_id = $1
                )
            `;
            const result = await this.pool.query(query, [guildId, userId]);
            return parseInt(result.rows[0].rank);
        } catch (error) {
            console.error('[ERROR] Error getting user rank:', error);
            return 0;
        }
    }

    async getLeaderboard(guildId, limit = 10) {
        try {
            const query = `
                SELECT user_id, total_xp, messages, reactions, voice_time
                FROM user_xp
                WHERE guild_id = $1
                ORDER BY total_xp DESC
                LIMIT $2
            `;
            const result = await this.pool.query(query, [guildId, limit]);
            return result.rows;
        } catch (error) {
            console.error('[ERROR] Error getting leaderboard:', error);
            return [];
        }
    }

    // Level Calculation Methods
    calculateLevel(totalXP) {
        if (totalXP < 0) return 1;
        return Math.floor(Math.sqrt(totalXP / 100)) + 1;
    }

    getXPForLevel(level) {
        if (level <= 1) return 0;
        return Math.pow(level - 1, 2) * 100;
    }

    getXPToNextLevel(currentXP) {
        const currentLevel = this.calculateLevel(currentXP);
        const nextLevelXP = this.getXPForLevel(currentLevel + 1);
        return nextLevelXP - currentXP;
    }

    // Cooldown Methods
    isOnCooldown(userId, guildId) {
        const key = `${userId}-${guildId}`;
        const now = Date.now();
        const cooldownTime = this.cooldowns.get(key);
        
        if (cooldownTime && now < cooldownTime) {
            return true;
        }
        
        return false;
    }

    setCooldown(userId, guildId, seconds = 60) {
        const key = `${userId}-${guildId}`;
        const cooldownTime = Date.now() + (seconds * 1000);
        this.cooldowns.set(key, cooldownTime);
        
        // Clean up expired cooldowns
        setTimeout(() => {
            this.cooldowns.delete(key);
        }, seconds * 1000);
    }

    // Voice XP Methods
    async processVoiceXP() {
        try {
            console.log('[DEBUG] Processing voice XP for active users...');
            
            const guilds = global.client.guilds.cache;
            
            for (const [guildId, guild] of guilds) {
                try {
                    const voiceChannels = guild.channels.cache.filter(channel => 
                        channel.type === 2 && channel.members.size > 0
                    );

                    for (const [channelId, channel] of voiceChannels) {
                        for (const [userId, member] of channel.members) {
                            if (member.user.bot) continue;

                            if (member.voice.mute || member.voice.deaf || member.voice.selfMute || member.voice.selfDeaf) {
                                continue;
                            }

                            if (guild.afkChannelId && channelId === guild.afkChannelId) {
                                continue;
                            }

                            const activeMembers = channel.members.filter(m => 
                                !m.user.bot && 
                                !m.voice.mute && 
                                !m.voice.deaf && 
                                !m.voice.selfMute && 
                                !m.voice.selfDeaf
                            );
                            
                            if (activeMembers.size < 2) continue;

                            const guildSettings = await this.getGuildSettings(guildId);
                            const voiceXP = guildSettings.voice_xp || parseInt(process.env.VOICE_XP) || 5;

                            await this.addXP(userId, guildId, voiceXP, 'voice');
                            console.log(`[DEBUG] Added ${voiceXP} voice XP to ${member.user.tag} in ${guild.name}`);
                        }
                    }
                } catch (guildError) {
                    console.error(`[ERROR] Error processing voice XP for guild ${guildId}:`, guildError);
                }
            }
        } catch (error) {
            console.error('[ERROR] Error in processVoiceXP:', error);
        }
    }

    async cleanupDailyVoiceXP() {
        try {
            console.log('[INFO] Starting daily voice XP cleanup...');
            
            const query = `
                UPDATE user_xp 
                SET daily_voice_time = 0, 
                    last_voice_reset = CURRENT_DATE 
                WHERE last_voice_reset < CURRENT_DATE OR last_voice_reset IS NULL
            `;
            
            const result = await this.pool.query(query);
            console.log(`[INFO] Daily voice XP cleanup completed. Reset ${result.rowCount} users.`);
            
            const cleanupQuery = `
                DELETE FROM user_xp 
                WHERE total_xp = 0 
                AND messages = 0 
                AND reactions = 0 
                AND voice_time = 0 
                AND updated_at < NOW() - INTERVAL '30 days'
            `;
            
            const cleanupResult = await this.pool.query(cleanupQuery);
            console.log(`[INFO] Cleaned up ${cleanupResult.rowCount} inactive user records.`);
            
        } catch (error) {
            console.error('[ERROR] Error in cleanupDailyVoiceXP:', error);
        }
    }

    // Marine Level-Up System
    async sendMarineLevelUp(levelUpData) {
        try {
            const { userId, guildId, oldLevel, newLevel, totalXP, member, channel } = levelUpData;

            const oldBounty = this.getBountyForLevel(oldLevel);
            const newBounty = this.getBountyForLevel(newLevel);
            const bountyIncrease = newBounty - oldBounty;

            const userData = await this.getUserXP(userId, guildId);
            
            const canvas = await this.createLevelUpPoster({
                userId: userId,
                level: newLevel,
                oldLevel: oldLevel,
                total_xp: totalXP,
                messages: userData.messages || 0,
                reactions: userData.reactions || 0,
                voice_time: userData.voice_time || 0,
                member: member
            });

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { 
                name: `bounty-update-${userId}.png` 
            });

            const oldThreat = this.getThreatLevelName(oldLevel);
            const newThreat = this.getThreatLevelName(newLevel);
            const threatUpgrade = oldThreat !== newThreat;

            const isPirateKing = newLevel >= 200;
            const isEmperor = newLevel >= 150 && newLevel < 200;
            const isWarlord = newLevel >= 100 && newLevel < 150;

            const getTerritory = (level) => {
                if (level >= 200) return "📍 **New World - Raftel**";
                if (level >= 150) return "📍 **New World - Yonko Territory**";
                if (level >= 100) return "📍 **New World - Paradise**";
                if (level >= 50) return "📍 **Grand Line**";
                if (level >= 25) return "📍 **Paradise**";
                return "📍 **East Blue**";
            };

            const embed = new EmbedBuilder()
                .setColor('#DC143C')
                .setTitle('🚨 WORLD GOVERNMENT BOUNTY UPDATE 🚨')
                .setDescription(`**MARINE INTELLIGENCE BUREAU**\n*Classified Report - Level ${newLevel} Threat*`)
                .addFields([
                    {
                        name: '👤 SUBJECT IDENTIFICATION',
                        value: `**Name:** ${member.displayName}\n**Previous Classification:** Level ${oldLevel} ${oldThreat}\n**New Classification:** Level ${newLevel} ${newThreat}`,
                        inline: false
                    },
                    {
                        name: '💰 BOUNTY ASSESSMENT',
                        value: `**Previous Bounty:** ${oldBounty.toLocaleString()} Berries\n**New Bounty:** ${newBounty.toLocaleString()} Berries\n**Increase:** +${bountyIncrease.toLocaleString()} Berries`,
                        inline: true
                    },
                    {
                        name: '📊 INTELLIGENCE SUMMARY',
                        value: `**Activity Assessment:** ${this.getActivityLevel(userData)}\n**Territory:** ${getTerritory(newLevel)}\n**Threat Level:** ${threatUpgrade ? `⬆️ UPGRADED` : '📊 Maintained'}`,
                        inline: true
                    }
                ])
                .setImage('attachment://bounty-update-' + userId + '.png')
                .setTimestamp()
                .setFooter({ 
                    text: '⚓ World Government Marine Intelligence Division'
                });

            if (isPirateKing) {
                embed.addFields([{
                    name: '👑 SPECIAL CLASSIFICATION',
                    value: '**🏴‍☠️ PIRATE KING DETECTED 🏴‍☠️**\n*Highest threat level achieved. All marines advised to exercise extreme caution.*',
                    inline: false
                }]);
            } else if (isEmperor) {
                embed.addFields([{
                    name: '⚡ EMPEROR STATUS',
                    value: '**🔥 YONKO-LEVEL THREAT 🔥**\n*Subject has achieved Emperor-class power level. Fleet Admiral notified.*',
                    inline: false
                }]);
            } else if (isWarlord) {
                embed.addFields([{
                    name: '⚔️ WARLORD STATUS',
                    value: '**🏴‍☠️ SHICHIBUKAI-LEVEL THREAT 🏴‍☠️**\n*Subject qualifies for Warlord consideration. Monitoring increased.*',
                    inline: false
                }]);
            }

            if (threatUpgrade) {
                embed.addFields([{
                    name: '🔺 THREAT ESCALATION',
                    value: `**Classification upgraded from ${oldThreat} to ${newThreat}**\n*All Marine units in the area have been notified of the threat level increase.*`,
                    inline: false
                }]);
            }

            await channel.send({
                content: `🚨 **MARINE HQ ALERT** 🚨\n${member} has been reclassified as a **Level ${newLevel}** threat!`,
                embeds: [embed],
                files: [attachment]
            });

            await this.handleRoleRewards(member, newLevel);

        } catch (error) {
            console.error('[ERROR] Error sending Marine level-up:', error);
        }
    }

    async createLevelUpPoster(wantedPosterData) {
        const canvas = createCanvas(800, 1000);
        const ctx = canvas.getContext('2d');

        try {
            const gradient = ctx.createLinearGradient(0, 0, 0, 1000);
            gradient.addColorStop(0, '#F4E4BC');
            gradient.addColorStop(0.5, '#E8D5A3');
            gradient.addColorStop(1, '#D4C18A');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 800, 1000);

            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 15;
            ctx.strokeRect(15, 15, 770, 970);

            ctx.strokeStyle = '#A0522D';
            ctx.lineWidth = 8;
            ctx.strokeRect(25, 25, 750, 950);

            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = '#8B0000';
            ctx.textAlign = 'center';
            ctx.fillText('BOUNTY UPDATE', 400, 80);

            ctx.font = 'bold 32px Arial';
            ctx.fillStyle = '#2F4F4F';
            ctx.fillText(`LEVEL ${wantedPosterData.oldLevel} → ${wantedPosterData.level}`, 400, 130);

            try {
                const avatar = await loadImage(wantedPosterData.member.displayAvatarURL({ extension: 'png', size: 256 }));
                
                ctx.save();
                ctx.beginPath();
                ctx.arc(400, 320, 120, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, 280, 200, 240, 240);
                ctx.restore();

                ctx.strokeStyle = '#8B0000';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(400, 320, 120, 0, Math.PI * 2);
                ctx.stroke();
            } catch (error) {
                console.error('Error loading avatar:', error);
                ctx.fillStyle = '#DDD';
                ctx.beginPath();
                ctx.arc(400, 320, 120, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.fillText(wantedPosterData.member.displayName.toUpperCase(), 400, 490);

            ctx.font = 'bold 42px Arial';
            ctx.fillStyle = '#8B0000';
            ctx.fillText('LEVEL UP!', 400, 540);

            const bounty = this.getBountyForLevel(wantedPosterData.level);
            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = '#FF6B35';
            ctx.fillText(`${bounty.toLocaleString()}`, 400, 620);

            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#FF8C00';
            ctx.fillText('BERRIES', 400, 670);

            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#2F4F4F';
            ctx.textAlign = 'left';
            
            const stats = [
                `Messages: ${wantedPosterData.messages}`,
                `Reactions: ${wantedPosterData.reactions}`,
                `Voice: ${Math.floor(wantedPosterData.voice_time / 60)}min`
            ];

            stats.forEach((stat, index) => {
                ctx.fillText(stat, 100, 750 + (index * 35));
            });

            ctx.font = 'bold 28px Arial';
            ctx.fillStyle = '#8B0000';
            ctx.textAlign = 'center';
            ctx.fillText(`THREAT: ${this.getThreatLevelName(wantedPosterData.level)}`, 400, 880);

            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = 'rgba(139, 0, 0, 0.3)';
            ctx.textAlign = 'center';
            ctx.fillText('MARINE', 400, 940);

            return canvas;
        } catch (error) {
            console.error('Canvas error:', error);
            ctx.fillStyle = '#F4E4BC';
            ctx.fillRect(0, 0, 800, 1000);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('LEVEL UP!', 400, 400);
            ctx.fillText(`Level ${wantedPosterData.level}`, 400, 500);
            return canvas;
        }
    }

    // Helper Methods
    getBountyForLevel(level) {
        if (level >= 200) return 5000000000;
        if (level >= 150) return 3000000000;
        if (level >= 100) return 1000000000;
        if (level >= 75) return 500000000;
        if (level >= 50) return 100000000;
        if (level >= 25) return 50000000;
        if (level >= 10) return 10000000;
        return level * 1000000;
    }

    getThreatLevelName(level) {
        if (level >= 200) return "PIRATE KING";
        if (level >= 150) return "EMPEROR";
        if (level >= 100) return "WARLORD";
        if (level >= 75) return "SUPERNOVA";
        if (level >= 50) return "NOTORIOUS";
        if (level >= 25) return "WANTED";
        if (level >= 10) return "KNOWN";
        return "ROOKIE";
    }

    getActivityLevel(userData) {
        const totalActivity = (userData.messages || 0) + (userData.reactions || 0) + Math.floor((userData.voice_time || 0) / 60);
        
        if (totalActivity >= 5000) return "Extremely Active";
        if (totalActivity >= 2000) return "Highly Active";
        if (totalActivity >= 1000) return "Very Active";
        if (totalActivity >= 500) return "Active";
        if (totalActivity >= 100) return "Moderately Active";
        return "Low Activity";
    }

    // Guild Settings Methods
    async getGuildSettings(guildId) {
        try {
            const query = 'SELECT * FROM guild_settings WHERE guild_id = $1';
            const result = await this.pool.query(query, [guildId]);
            
            if (result.rows.length > 0) {
                return result.rows[0];
            } else {
                return {
                    guild_id: guildId,
                    message_xp: parseInt(process.env.MESSAGE_XP) || 15,
                    voice_xp: parseInt(process.env.VOICE_XP) || 5,
                    reaction_xp: parseInt(process.env.REACTION_XP) || 2,
                    xp_cooldown: parseInt(process.env.XP_COOLDOWN) || 60,
                    level_up_channel: null,
                    role_rewards: {}
                };
            }
        } catch (error) {
            console.error('[ERROR] Error getting guild settings:', error);
            return {
                guild_id: guildId,
                message_xp: 15,
                voice_xp: 5,
                reaction_xp: 2,
                xp_cooldown: 60,
                level_up_channel: null,
                role_rewards: {}
            };
        }
    }

    async updateGuildSettings(guildId, settings) {
        try {
            const query = `
                INSERT INTO guild_settings (guild_id, message_xp, voice_xp, reaction_xp, xp_cooldown, level_up_channel, role_rewards, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                ON CONFLICT (guild_id)
                DO UPDATE SET
                    message_xp = $2,
                    voice_xp = $3,
                    reaction_xp = $4,
                    xp_cooldown = $5,
                    level_up_channel = $6,
                    role_rewards = $7,
                    updated_at = CURRENT_TIMESTAMP
            `;
            
            await this.pool.query(query, [
                guildId,
                settings.message_xp,
                settings.voice_xp,
                settings.reaction_xp,
                settings.xp_cooldown,
                settings.level_up_channel,
                JSON.stringify(settings.role_rewards || {})
            ]);
        } catch (error) {
            console.error('[ERROR] Error updating guild settings:', error);
            throw error;
        }
    }

    // Role Rewards
    async handleRoleRewards(member, level) {
        try {
            const guildSettings = await this.getGuildSettings(member.guild.id);
            const roleRewards = guildSettings.role_rewards || {};

            for (const [rewardLevel, roleId] of Object.entries(roleRewards)) {
                if (level >= parseInt(rewardLevel)) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role && !member.roles.cache.has(roleId)) {
                        await member.roles.add(role);
                        console.log(`[INFO] Added role ${role.name} to ${member.user.tag} for reaching level ${level}`);
                    }
                }
            }
        } catch (error) {
            console.error('[ERROR] Error handling role rewards:', error);
        }
    }

    // Cleanup method
    async cleanup() {
        try {
            await this.pool.end();
            console.log('[INFO] XP Tracker cleanup completed');
        } catch (error) {
            console.error('[ERROR] Error during XP Tracker cleanup:', error);
        }
    }
}

module.exports = XPTracker;
