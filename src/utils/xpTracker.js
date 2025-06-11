// src/utils/xpTracker.js

const { getBountyForLevel, getLevelUpMessage } = require('./bountySystem');
const { getMessageXP } = require('./messageXP');
const { getReactionXP } = require('./reactionXP');
const { getVoiceXP } = require('./voiceXP');
const { sendXPLog } = require('./xpLogger');

class XPTracker {
    constructor(client, db) {
        this.client = client;
        this.db = db;
        this.voiceSessions = new Map(); // userId => { joinTimestamp, guildId }
        this.messageCooldowns = new Map(); // For message XP cooldowns
        this.reactionCooldowns = new Map(); // For reaction XP cooldowns
    }

    // === MESSAGE XP ===
    async handleMessageXP(message) {
        if (!message.guild || message.author.bot) return;

        // Message XP cooldown per user
        const cooldown = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
        const key = `${message.guild.id}:${message.author.id}`;
        const now = Date.now();
        if (this.messageCooldowns.has(key) && now - this.messageCooldowns.get(key) < cooldown) return;
        this.messageCooldowns.set(key, now);

        const xp = getMessageXP(message);
        if (xp > 0) {
            await this.addXP(message.author.id, message.guild.id, xp, { messages: 1 });
            await sendXPLog(this.client, {
                type: 'message',
                userId: message.author.id,
                guildId: message.guild.id,
                amount: xp,
                reason: 'Message sent'
            });
        }
    }

    // === REACTION XP ===
    async handleReactionXP(reaction, user) {
        if (!reaction.message.guild || user.bot) return;

        // Reaction XP cooldown per user
        const cooldown = parseInt(process.env.REACTION_COOLDOWN) || 300000;
        const key = `${reaction.message.guild.id}:${user.id}`;
        const now = Date.now();
        if (this.reactionCooldowns.has(key) && now - this.reactionCooldowns.get(key) < cooldown) return;
        this.reactionCooldowns.set(key, now);

        const xp = getReactionXP(reaction, user);
        if (xp > 0) {
            await this.addXP(user.id, reaction.message.guild.id, xp, { reactions: 1 });
            await sendXPLog(this.client, {
                type: 'reaction',
                userId: user.id,
                guildId: reaction.message.guild.id,
                amount: xp,
                reason: 'Reaction added'
            });
        }
    }

    // === VOICE XP ===
    async handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.id;
        const guildId = newState.guild.id;
        // Joined voice
        if (!oldState.channelId && newState.channelId) {
            this.voiceSessions.set(userId, { joinTimestamp: Date.now(), guildId });
        }
        // Left voice
        else if (oldState.channelId && !newState.channelId) {
            if (this.voiceSessions.has(userId)) {
                const session = this.voiceSessions.get(userId);
                const duration = Math.floor((Date.now() - session.joinTimestamp) / 1000); // seconds
                if (duration >= 60) {
                    // Award for every full minute in VC
                    const minutes = Math.floor(duration / 60);
                    for (let i = 0; i < minutes; i++) {
                        const xpGain = getVoiceXP();
                        await this.addXP(userId, guildId, xpGain, { voice_time: 60 });
                    }
                }
                this.voiceSessions.delete(userId);
            }
        }
    }

    // This runs every 60s to give active users their voice XP while in VC
    async processVoiceXP() {
        const now = Date.now();
        for (const [userId, session] of this.voiceSessions.entries()) {
            const duration = Math.floor((now - session.joinTimestamp) / 1000);
            if (duration >= 60) {
                const xpGain = getVoiceXP();
                await this.addXP(userId, session.guildId, xpGain, { voice_time: 60 });
                // Reset their join time for next interval
                this.voiceSessions.set(userId, { ...session, joinTimestamp: now });
            }
        }
    }

    // === XP & LEVELING DATABASE OPS ===

    async addXP(userId, guildId, amount, stats = {}) {
        try {
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
                    amount,
                    0, // Level calculated below
                    stats.messages || 0,
                    stats.reactions || 0,
                    stats.voice_time || 0
                ]
            );
            // Update level
            const user = res.rows[0];
            const newLevel = this.calculateLevel(user.total_xp);
            if (newLevel > user.level) {
                await this.db.query(
                    `UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3`,
                    [newLevel, userId, guildId]
                );
                // Level up announcement
                this._sendLevelUp(userId, guildId, newLevel);
            }
        } catch (err) {
            console.error('Error in addXP:', err);
        }
    }

    async getUserStats(userId, guildId) {
        try {
            const res = await this.db.query(
                `SELECT * FROM user_levels WHERE user_id = $1 AND guild_id = $2`,
                [userId, guildId]
            );
            return res.rows[0];
        } catch (err) {
            console.error('Error in getUserStats:', err);
            return null;
        }
    }

    async getLeaderboard(guildId) {
        try {
            const res = await this.db.query(
                `SELECT user_id AS "userId", level, total_xp AS xp FROM user_levels WHERE guild_id = $1 ORDER BY total_xp DESC`,
                [guildId]
            );
            return res.rows;
        } catch (err) {
            console.error('Error in getLeaderboard:', err);
            return [];
        }
    }

    calculateLevel(xp) {
        let level = 0;
        let xpNeeded = 500;
        let remaining = xp;
        while (remaining >= xpNeeded && level < 50) {
            remaining -= xpNeeded;
            level += 1;
            xpNeeded += 250;
        }
        return level;
    }

    async _sendLevelUp(userId, guildId, level) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;
            const channelId = process.env.LEVELUP_CHANNEL;
            if (!channelId) return;
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return;

            const bounty = getBountyForLevel(level);
            const flavor = getLevelUpMessage(level);

            await channel.send(
                `:sparkles: <@${userId}> has reached **Level ${level}**!\n:money_with_wings: New Bounty: **฿${bounty.toLocaleString()}**\n${flavor}`
            );
        } catch (err) {}
    }
}

module.exports = XPTracker;
