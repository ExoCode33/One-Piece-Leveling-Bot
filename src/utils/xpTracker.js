// src/utils/xpTracker.js - Complete clean version with all fixes

const { getBountyForLevel, getThreatLevelMessage, createLevelUpEmbed } = require('./bountySystem');
const { getMessageXP } = require('./messageXP');
const { getReactionXP } = require('./reactionXP');
const { getVoiceXP } = require('./voiceXP');
const { sendXPLog } = require('./xpLogger');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { AttachmentBuilder } = require('discord.js');
const path = require('path');

// Register custom fonts for wanted posters
try {
    registerFont(path.join(__dirname, '../../assets/fonts/captkd.ttf'), { family: 'CaptainKiddNF' });
    registerFont(path.join(__dirname, '../../assets/fonts/Cinzel-Bold.otf'), { family: 'Cinzel' });
    registerFont(path.join(__dirname, '../../assets/fonts/Times New Normal Regular.ttf'), { family: 'TimesNewNormal' });
} catch (error) {
    console.log('[XP_TRACKER] Custom fonts not found, using system fonts');
}

class XPTracker {
    constructor(client, db) {
        this.client = client;
        this.db = db;
        this.voiceSessions = new Map();
        this.messageCooldowns = new Map();
        this.reactionCooldowns = new Map();
        this.dailyVoiceXP = new Map(); // Track daily voice XP per user
        console.log('[XP_TRACKER] Initialized with database connection');
    }

    // === MESSAGE XP ===
    async handleMessageXP(message) {
        if (!message.guild || message.author.bot) return;

        try {
            const settings = global.guildSettings?.get(message.guild.id) || {};
            if (settings.excludedRole) {
                const member = await message.guild.members.fetch(message.author.id).catch(() => null);
                if (member && member.roles.cache.has(settings.excludedRole)) {
                    return;
                }
            }

            const cooldown = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
            const key = `${message.guild.id}:${message.author.id}`;
            const now = Date.now();
            if (this.messageCooldowns.has(key) && now - this.messageCooldowns.get(key) < cooldown) return;
            this.messageCooldowns.set(key, now);

            const xp = getMessageXP(message);
            if (xp > 0) {
                const result = await this.addXP(message.author.id, message.guild.id, xp, { messages: 1 });
                
                if (process.env.XP_LOG_ENABLED === 'true') {
                    await sendXPLog(this.client, 'message', message.author, xp, {
                        channelId: message.channel.id,
                        totalXP: result.total_xp,
                        level: result.level
                    });
                }
                
                console.log(`[XP_TRACKER] Message XP: ${message.author.username} gained ${xp} XP`);
            }
        } catch (error) {
            console.error('[XP_TRACKER] Error in handleMessageXP:', error);
        }
    }

    // === REACTION XP ===
    async handleReactionXP(reaction, user) {
        if (!reaction.message.guild || user.bot) return;

        try {
            const settings = global.guildSettings?.get(reaction.message.guild.id) || {};
            if (settings.excludedRole) {
                const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
                if (member && member.roles.cache.has(settings.excludedRole)) {
                    return;
                }
            }

            const cooldown = parseInt(process.env.REACTION_COOLDOWN) || 300000;
            const key = `${reaction.message.guild.id}:${user.id}`;
            const now = Date.now();
            if (this.reactionCooldowns.has(key) && now - this.reactionCooldowns.get(key) < cooldown) return;
            this.reactionCooldowns.set(key, now);

            const xp = getReactionXP(reaction, user);
            if (xp > 0) {
                const result = await this.addXP(user.id, reaction.message.guild.id, xp, { reactions: 1 });
                
                if (process.env.XP_LOG_ENABLED === 'true') {
                    await sendXPLog(this.client, 'reaction', user, xp, {
                        channelId: reaction.message.channel.id,
                        emoji: reaction.emoji.toString(),
                        totalXP: result.total_xp,
                        level: result.level
                    });
                }
                
                console.log(`[XP_TRACKER] Reaction XP: ${user.username} gained ${xp} XP`);
            }
        } catch (error) {
            console.error('[XP_TRACKER] Error in handleReactionXP:', error);
        }
    }

    // === VOICE XP ===
    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.id;
        const guildId = newState.guild.id;
        
        try {
            const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
            
            if (!oldState.channelId && newState.channelId) {
                const memberCount = newState.channel.members.filter(m => !m.user.bot).size;
                if (memberCount >= minMembers) {
                    this.voiceSessions.set(userId, { 
                        joinTimestamp: Date.now(), 
                        guildId,
                        channelId: newState.channelId,
                        channelName: newState.channel.name
                    });
                    console.log(`[XP_TRACKER] ${newState.member.displayName} joined voice channel: ${newState.channel.name}`);
                }
            }
            else if (oldState.channelId && !newState.channelId) {
                if (this.voiceSessions.has(userId)) {
                    const session = this.voiceSessions.get(userId);
                    const duration = Math.floor((Date.now() - session.joinTimestamp) / 1000);
                    
                    if (duration >= 60) {
                        const minutes = Math.floor(duration / 60);
                        let totalXP = 0;
                        
                        for (let i = 0; i < minutes; i++) {
                            const xpGain = getVoiceXP();
                            totalXP += xpGain;
                        }
                        
                        if (totalXP > 0) {
                            // Apply daily voice XP cap
                            const cappedXP = this.applyDailyVoiceXPCap(userId, guildId, totalXP);
                            
                            if (cappedXP > 0) {
                                const result = await this.addXP(userId, guildId, cappedXP, { voice_time: duration });
                                
                                if (process.env.XP_LOG_ENABLED === 'true') {
                                    await sendXPLog(this.client, 'voice', newState.member.user, cappedXP, {
                                        channelName: session.channelName,
                                        sessionDuration: minutes,
                                        memberCount: oldState.channel?.members?.filter(m => !m.user.bot).size || 0,
                                        totalXP: result.total_xp,
                                        level: result.level,
                                        dailyCapped: cappedXP < totalXP
                                    });
                                }
                                
                                console.log(`[XP_TRACKER] Voice XP: ${newState.member.displayName} gained ${cappedXP} XP for ${minutes} minutes${cappedXP < totalXP ? ' (daily capped)' : ''}`);
                            } else {
                                console.log(`[XP_TRACKER] Voice XP: ${newState.member.displayName} hit daily voice XP cap`);
                            }
                        }
                    }
                    
                    this.voiceSessions.delete(userId);
                }
            }
            else if (oldState.channelId !== newState.channelId && oldState.channelId && newState.channelId) {
                if (this.voiceSessions.has(userId)) {
                    const session = this.voiceSessions.get(userId);
                    const duration = Math.floor((Date.now() - session.joinTimestamp) / 1000);
                    
                    if (duration >= 60) {
                        const minutes = Math.floor(duration / 60);
                        let totalXP = 0;
                        
                        for (let i = 0; i < minutes; i++) {
                            const xpGain = getVoiceXP();
                            totalXP += xpGain;
                        }
                        
                        if (totalXP > 0) {
                            // Apply daily voice XP cap
                            const cappedXP = this.applyDailyVoiceXPCap(userId, guildId, totalXP);
                            
                            if (cappedXP > 0) {
                                await this.addXP(userId, guildId, cappedXP, { voice_time: duration });
                                console.log(`[XP_TRACKER] Voice switch XP: ${newState.member.displayName} gained ${cappedXP} XP${cappedXP < totalXP ? ' (daily capped)' : ''}`);
                            }
                        }
                    }
                }
                
                const memberCount = newState.channel.members.filter(m => !m.user.bot).size;
                if (memberCount >= minMembers) {
                    this.voiceSessions.set(userId, { 
                        joinTimestamp: Date.now(), 
                        guildId,
                        channelId: newState.channelId,
                        channelName: newState.channel.name
                    });
                }
            }
        } catch (error) {
            console.error('[XP_TRACKER] Error in handleVoiceStateUpdate:', error);
        }
    }

    async processVoiceXP() {
        const now = Date.now();
        const voiceCooldown = parseInt(process.env.VOICE_COOLDOWN) || 180000;
        
        try {
            for (const [userId, session] of this.voiceSessions.entries()) {
                const duration = Math.floor((now - session.joinTimestamp) / 1000);
                
                if (duration >= 60 && duration >= voiceCooldown / 1000) {
                    try {
                        const guild = this.client.guilds.cache.get(session.guildId);
                        if (!guild) continue;
                        
                        const settings = global.guildSettings?.get(session.guildId) || {};
                        if (settings.excludedRole) {
                            const member = await guild.members.fetch(userId).catch(() => null);
                            if (member && member.roles.cache.has(settings.excludedRole)) {
                                continue;
                            }
                        }
                        
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (!member || !member.voice.channelId) {
                            this.voiceSessions.delete(userId);
                            continue;
                        }
                        
                        const minMembers = parseInt(process.env.VOICE_MIN_MEMBERS) || 2;
                        const currentChannel = member.voice.channel;
                        const memberCount = currentChannel.members.filter(m => !m.user.bot).size;
                        
                        if (memberCount >= minMembers) {
                            const xpGain = getVoiceXP();
                            
                            // Apply daily voice XP cap
                            const cappedXP = this.applyDailyVoiceXPCap(userId, session.guildId, xpGain);
                            
                            if (cappedXP > 0) {
                                const result = await this.addXP(userId, session.guildId, cappedXP, { voice_time: 60 });
                                console.log(`[XP_TRACKER] Interval Voice XP: ${member.displayName} gained ${cappedXP} XP${cappedXP < xpGain ? ' (daily capped)' : ''}`);
                            } else {
                                console.log(`[XP_TRACKER] Interval Voice XP: ${member.displayName} hit daily voice XP cap`);
                            }
                            
                            this.voiceSessions.set(userId, { 
                                ...session, 
                                joinTimestamp: now 
                            });
                        }
                    } catch (error) {
                        console.error(`[XP_TRACKER] Error processing voice XP for user ${userId}:`, error);
                        this.voiceSessions.delete(userId);
                    }
                }
            }
        } catch (error) {
            console.error('[XP_TRACKER] Error in processVoiceXP:', error);
        }
    }

    // === DATABASE OPERATIONS ===
    async addXP(userId, guildId, amount, stats = {}) {
        try {
            const settings = global.guildSettings?.get(guildId) || {};
            const multiplier = settings.xpMultiplier || 1.0;
            const finalAmount = Math.floor(amount * multiplier);
            
            const currentUser = await this.db.query(
                `SELECT * FROM user_levels WHERE user_id = $1 AND guild_id = $2`,
                [userId, guildId]
            );
            
            const oldLevel = currentUser.rows[0]?.level || 0;
            
            const res = await this.db.query(
                `INSERT INTO user_levels (user_id, guild_id, total_xp, level, messages, reactions, voice_time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (user_id, guild_id)
                 DO UPDATE SET
                    total_xp = user_levels.total_xp + $3,
                    messages = user_levels.messages + $5,
                    reactions = user_levels.reactions + $6,
                    voice_time = user_levels.voice_time + $7
                 RETURNING *`,
                [
                    userId,
                    guildId,
                    finalAmount,
                    0,
                    stats.messages || 0,
                    stats.reactions || 0,
                    stats.voice_time || 0
                ]
            );
            
            const user = res.rows[0];
            const newLevel = this.calculateLevel(user.total_xp);
            const newXP = user.total_xp;
            
            if (newLevel !== user.level) {
                await this.db.query(
                    `UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3`,
                    [newLevel, userId, guildId]
                );
            }
            
            if (newLevel !== oldLevel) {
                if (newLevel > oldLevel) {
                    await this._handleLevelUp(userId, guildId, oldLevel, newLevel, newXP);
                } else if (newLevel < oldLevel) {
                    await this._handleLevelDown(userId, guildId, oldLevel, newLevel, newXP);
                }
            }
            
            return { ...user, level: newLevel };
        } catch (err) {
            console.error('[XP_TRACKER] Error in addXP:', err);
            throw err;
        }
    }

    async getUserStats(guildId, userId) {
        try {
            const res = await this.db.query(
                `SELECT user_id, guild_id, total_xp AS xp, level, messages, reactions, voice_time, created_at
                 FROM user_levels WHERE guild_id = $1 AND user_id = $2`,
                [guildId, userId]
            );
            return res.rows[0] || null;
        } catch (err) {
            console.error('[XP_TRACKER] Error in getUserStats:', err);
            return null;
        }
    }

    async getLeaderboard(guildId) {
        try {
            const res = await this.db.query(
                `SELECT user_id AS "userId", level, total_xp AS xp, messages, reactions, voice_time 
                 FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 100`,
                [guildId]
            );
            return res.rows;
        } catch (err) {
            console.error('[XP_TRACKER] Error in getLeaderboard:', err);
            return [];
        }
    }

    calculateLevel(xp) {
        const curve = process.env.FORMULA_CURVE || 'exponential';
        const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
        const maxLevel = parseInt(process.env.MAX_LEVEL) || 50;
        
        if (curve === 'exponential') {
            const level = Math.floor(multiplier * Math.sqrt(xp / 100));
            return Math.min(level, maxLevel);
        } else if (curve === 'linear') {
            let level = 0;
            let xpNeeded = 500;
            let remaining = xp;
            while (remaining >= xpNeeded && level < maxLevel) {
                remaining -= xpNeeded;
                level += 1;
                xpNeeded += (multiplier * 100);
            }
            return level;
        } else {
            let level = 0;
            let xpNeeded = 500;
            let remaining = xp;
            while (remaining >= xpNeeded && level < maxLevel) {
                remaining -= xpNeeded;
                level += 1;
                xpNeeded += 250;
            }
            return level;
        }
    }

    // === LEVEL UP/DOWN HANDLING ===
    async _handleLevelUp(userId, guildId, oldLevel, newLevel, totalXP) {
        try {
            console.log(`[XP_TRACKER] Level up: User ${userId} went from level ${oldLevel} to level ${newLevel}`);
            
            const rolesAssigned = [];
            
            for (let level = oldLevel + 1; level <= newLevel; level++) {
                const roleReward = await this._assignLevelRole(userId, guildId, level);
                if (roleReward) {
                    rolesAssigned.push({ level, roleName: roleReward });
                }
            }
            
            await this._sendLevelUpWithPoster(userId, guildId, oldLevel, newLevel, totalXP, rolesAssigned);
            
            if (process.env.XP_LOG_ENABLED === 'true') {
                const guild = this.client.guilds.cache.get(guildId);
                const user = await this.client.users.fetch(userId).catch(() => null);
                if (guild && user) {
                    await sendXPLog(this.client, 'levelup', user, 0, {
                        oldLevel,
                        newLevel,
                        totalXP,
                        roleReward: rolesAssigned.length > 0 ? rolesAssigned.map(r => r.roleName).join(', ') : null,
                        rolesAssigned: rolesAssigned.length
                    });
                }
            }
        } catch (error) {
            console.error('[XP_TRACKER] Error in _handleLevelUp:', error);
        }
    }

    async _handleLevelDown(userId, guildId, oldLevel, newLevel, totalXP) {
        try {
            console.log(`[XP_TRACKER] Level down: User ${userId} went from level ${oldLevel} to level ${newLevel}`);
            
            const rolesRemoved = [];
            
            for (let level = newLevel + 1; level <= oldLevel; level++) {
                const roleRemoved = await this._removeLevelRole(userId, guildId, level);
                if (roleRemoved) {
                    rolesRemoved.push({ level, roleName: roleRemoved });
                }
            }
            
            if (rolesRemoved.length > 0) {
                console.log(`[XP_TRACKER] Removed ${rolesRemoved.length} roles from user ${userId} due to level decrease`);
            }
            
        } catch (error) {
            console.error('[XP_TRACKER] Error in _handleLevelDown:', error);
        }
    }

    async _assignLevelRole(userId, guildId, level) {
        try {
            const roleEnvVar = `LEVEL_${level}_ROLE`;
            const roleId = process.env[roleEnvVar];
            
            if (!roleId || roleId === 'role_id' || roleId === 'your_role_id_here') {
                return null;
            }
            
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return null;
            
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return null;
            
            const role = guild.roles.cache.get(roleId);
            if (!role) {
                console.log(`[XP_TRACKER] Role ${roleId} not found for level ${level}`);
                return null;
            }
            
            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(role);
                console.log(`[XP_TRACKER] Assigned role ${role.name} to ${member.displayName} for reaching level ${level}`);
                return role.name;
            }
            
            return null;
        } catch (error) {
            console.error(`[XP_TRACKER] Error assigning level role for level ${level}:`, error);
            return null;
        }
    }

    async _removeLevelRole(userId, guildId, level) {
        try {
            const roleEnvVar = `LEVEL_${level}_ROLE`;
            const roleId = process.env[roleEnvVar];
            
            if (!roleId || roleId === 'role_id' || roleId === 'your_role_id_here') {
                return null;
            }
            
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return null;
            
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return null;
            
            const role = guild.roles.cache.get(roleId);
            if (!role) {
                console.log(`[XP_TRACKER] Role ${roleId} not found for level ${level}`);
                return null;
            }
            
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(role);
                console.log(`[XP_TRACKER] Removed role ${role.name} from ${member.displayName} (no longer level ${level})`);
                return role.name;
            }
            
            return null;
        } catch (error) {
            console.error(`[XP_TRACKER] Error removing level role for level ${level}:`, error);
            return null;
        }
    }

    // === LEVEL UP MESSAGES ===
    async _sendLevelUpWithPoster(userId, guildId, oldLevel, newLevel, totalXP, rolesAssigned) {
        try {
            if (process.env.LEVELUP_ENABLED !== 'true') return;
            
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;
            
            let channelId = process.env.LEVELUP_CHANNEL;
            
            if (!channelId || channelId === 'your_levelup_channel_id') {
                const channels = guild.channels.cache.filter(c => 
                    c.isTextBased() && 
                    (c.name.includes('level') || c.name.includes('general') || c.name.includes('chat'))
                );
                const channel = channels.first();
                if (channel) channelId = channel.id;
            }
            
            if (!channelId) return;
            
            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) return;

            const canvas = await this.createWantedPoster({ level: newLevel }, member);
            const attachment = new AttachmentBuilder(canvas, { name: `bounty_update_${userId}.png` });

            const embed = createLevelUpEmbed(member.user, oldLevel, newLevel);
            
            if (newLevel - oldLevel > 1) {
                embed.setDescription(`**${member.user.username}** has made a massive leap in infamy!\n*🚀 Jumped ${newLevel - oldLevel} levels and earned ${rolesAssigned.length} new titles! 🚀*`);
            }
            
            const threatMessage = getThreatLevelMessage(newLevel);
            if (threatMessage !== "Bounty increased. Threat level rising.") {
                embed.addFields({
                    name: '🚨 Marine Intelligence Report',
                    value: `*${threatMessage}*`,
                    inline: false
                });
            }
            
            if (rolesAssigned && rolesAssigned.length > 0) {
                const roleText = rolesAssigned.map(r => `Level ${r.level}: ${r.roleName}`).join('\n');
                embed.addFields({
                    name: `🏆 New Titles Earned (${rolesAssigned.length})`,
                    value: roleText,
                    inline: false
                });
            }

            embed.setImage(`attachment://bounty_update_${userId}.png`);
            embed.setFooter({ text: 'Marine Intelligence • BOUNTY INCREASE CONFIRMED' });

            await channel.send({ 
                content: process.env.LEVELUP_PING_USER === 'true' ? `<@${userId}>` : null,
                embeds: [embed],
                files: [attachment]
            });
            
        } catch (error) {
            console.error('[XP_TRACKER] Error sending level up message with poster:', error);
            await this._sendLevelUp(userId, guildId, oldLevel, newLevel, totalXP, rolesAssigned);
        }
    }

    async _sendLevelUp(userId, guildId, oldLevel, newLevel, totalXP, rolesAssigned) {
        try {
            if (process.env.LEVELUP_ENABLED !== 'true') return;
            
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;
            
            let channelId = process.env.LEVELUP_CHANNEL;
            
            if (!channelId || channelId === 'your_levelup_channel_id') {
                const channels = guild.channels.cache.filter(c => 
                    c.isTextBased() && 
                    (c.name.includes('level') || c.name.includes('general') || c.name.includes('chat'))
                );
                const channel = channels.first();
                if (channel) channelId = channel.id;
            }
            
            if (!channelId) return;
            
            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) return;

            const embed = createLevelUpEmbed(member.user, oldLevel, newLevel);
            
            const threatMessage = getThreatLevelMessage(newLevel);
            if (threatMessage !== "Bounty increased. Threat level rising.") {
                embed.addFields({
                    name: '🚨 Marine Intelligence Report',
                    value: `*${threatMessage}*`,
                    inline: false
                });
            }
            
            if (rolesAssigned && rolesAssigned.length > 0) {
                const roleText = rolesAssigned.map(r => `Level ${r.level}: ${r.roleName}`).join('\n');
                embed.addFields({
                    name: `🏆 New Titles Earned (${rolesAssigned.length})`,
                    value: roleText,
                    inline: false
                });
                
                if (newLevel - oldLevel > 1) {
                    embed.setDescription(`**${member.user.username}** has made a massive leap in infamy!\n*🚀 Jumped ${newLevel - oldLevel} levels and earned ${rolesAssigned.length} new titles! 🚀*`);
                }
            }

            await channel.send({ 
                content: process.env.LEVELUP_PING_USER === 'true' ? `<@${userId}>` : null,
                embeds: [embed] 
            });
            
        } catch (error) {
            console.error('[XP_TRACKER] Error sending level up message:', error);
        }
    }

    // === CANVAS CREATION ===
    async createWantedPoster(userStats, member) {
        const width = 600, height = 900;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        try {
            const scrollTexture = await loadImage(path.join(__dirname, '../../assets/scroll_texture.jpg'));
            ctx.drawImage(scrollTexture, 0, 0, width, height);
        } catch (error) {
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

        // DEAD OR ALIVE
        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '57px CaptainKiddNF, Arial, sans-serif';
        const deadOrAliveY = height * (1 - 39/100);
        const deadOrAliveX = (50/100) * width;
        ctx.fillText('DEAD OR ALIVE', deadOrAliveX, deadOrAliveY);

        // Name
        ctx.font = '69px CaptainKiddNF, Arial, sans-serif';
        let displayName = member.displayName.replace(/[^\w\s-]/g, '').toUpperCase().substring(0, 16);
        
        ctx.textAlign = 'center';
        let nameWidth = ctx.measureText(displayName).width;
        if (nameWidth > width - 60) {
            ctx.font = '55px CaptainKiddNF, Arial, sans-serif';
        }
        
        const nameY = height * (1 - 30/100);
        const nameX = (50/100) * width;
        ctx.fillText(displayName, nameX, nameY);

        // Berry Symbol and BOUNTY (not XP)
        const berryBountyGap = 5;
        
        // Get BOUNTY amount for level instead of XP
        const bountyAmount = getBountyForLevel(userStats.level);
        const bountyStr = bountyAmount.toLocaleString();
        
        ctx.font = '54px Cinzel, Georgia, serif';
        const bountyTextWidth = ctx.measureText(bountyStr).width;
        
        const berrySize = (32/100) * 150;
        const gapPixels = (berryBountyGap/100) * width;
        const totalBountyWidth = berrySize + gapPixels + bountyTextWidth;
        const bountyUnitStartX = (width - totalBountyWidth) / 2;
        
        const berryX = bountyUnitStartX + (berrySize/2);
        const berryY = height * (1 - 22/100) - (berrySize/2);
        
        // Berry symbol
        let berryImg;
        try {
            const berryPath = path.join(__dirname, '../../assets/berry.png');
            berryImg = await loadImage(berryPath);
        } catch {
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

        // BOUNTY numbers (not XP)
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
            console.log('[DEBUG] One Piece logo not found');
        }

        // MARINE text
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.font = '24px TimesNewNormal, Times, serif';
        ctx.fillStyle = '#111';
        
        const marineText = 'M A R I N E';
        const marineX = (96/100) * width;
        const marineY = height * (1 - 2/100);
        ctx.fillText(marineText, marineX, marineY);

        return canvas.toBuffer();
    }

    // === UTILITY METHODS ===
    
    // Utility method to manually update user XP (for admin commands)
    applyDailyVoiceXPCap(userId, guildId, xpGain) {
        const dailyVoiceXPCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500; // Default 1500 XP per day
        const today = new Date().toDateString(); // Get current date as string
        const key = `${guildId}:${userId}:${today}`;
        
        // Get current daily voice XP for this user
        const currentDailyXP = this.dailyVoiceXP.get(key) || 0;
        
        // Calculate how much XP can still be earned today
        const remainingCap = Math.max(0, dailyVoiceXPCap - currentDailyXP);
        
        // Cap the XP gain to the remaining daily allowance
        const cappedXP = Math.min(xpGain, remainingCap);
        
        // Update the daily voice XP tracker
        if (cappedXP > 0) {
            this.dailyVoiceXP.set(key, currentDailyXP + cappedXP);
        }
        
        return cappedXP;
    }

    // Clean up old daily voice XP data (call this daily)
    cleanupDailyVoiceXP() {
        const today = new Date().toDateString();
        
        // Remove entries that are not from today
        for (const [key, value] of this.dailyVoiceXP.entries()) {
            if (!key.endsWith(today)) {
                this.dailyVoiceXP.delete(key);
            }
        }
        
        console.log('[XP_TRACKER] Cleaned up old daily voice XP data');
    }

    // Get remaining daily voice XP for a user
    getRemainingDailyVoiceXP(userId, guildId) {
        const dailyVoiceXPCap = parseInt(process.env.DAILY_VOICE_XP_CAP) || 1500;
        const today = new Date().toDateString();
        const key = `${guildId}:${userId}:${today}`;
        
        const currentDailyXP = this.dailyVoiceXP.get(key) || 0;
        return Math.max(0, dailyVoiceXPCap - currentDailyXP);
    }

    // Get daily voice XP used for a user
    getDailyVoiceXPUsed(userId, guildId) {
        const today = new Date().toDateString();
        const key = `${guildId}:${userId}:${today}`;
        
        return this.dailyVoiceXP.get(key) || 0;
    }
    async updateUserLevel(userId, guildId, xpAmount, source = 'admin') {
        try {
            console.log(`[XP_TRACKER] Manual XP update: ${userId} ${xpAmount > 0 ? '+' : ''}${xpAmount} XP (${source})`);
            return await this.addXP(userId, guildId, xpAmount, {});
        } catch (error) {
            console.error('[XP_TRACKER] Error in updateUserLevel:', error);
            throw error;
        }
    }
}

module.exports = XPTracker;
