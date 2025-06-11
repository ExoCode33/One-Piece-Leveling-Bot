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
        // Map for voice XP tracking: userId => { joinTimestamp }
        this.voiceSessions = new Map();
    }

    // --- XP Award and Level Logic ---

    async handleMessageXP(message) {
        // Ignore bots and system messages
        if (!message.guild || message.author.bot) return;
        const userId = message.author.id;
        const guildId = message.guild.id;
        const xp = getMessageXP(message);

        if (xp > 0) {
            await this.addXP(userId, guildId, xp, { messages: 1 });
            await sendXPLog(this.client, {
                type: 'message',
                userId,
                guildId,
                amount: xp,
                reason: 'Message sent'
            });
        }
    }

    async handleReactionXP(reaction, user) {
        if (!reaction.message.guild || user.bot) return;
        const userId = user.id;
        const guildId = reaction.message.guild.id;
        const xp = getReactionXP(reaction, user);

        if (xp > 0) {
            await this.addXP(userId, guildId, xp, { reactions: 1 });
            await sendXPLog(this.client, {
                type: 'reaction',
                userId,
                guildId,
                amount: xp,
                reason: 'Reaction added'
            });
        }
    }

    async handleVoiceStateUpdate(oldState, newState) {
        // Track when users join/leave voice channels
        const userId = newState.id;
        const guildId = newState.guild.id;
        if (newState.channelId && !oldState.channelId) {
            // Joined a voice channel
            this.voiceSessions.set(userId, { joinTimestamp: Date.now(), guildId });
        } else if (!newState.channelId && oldState.channelId) {
            // Left a voice channel
            await this._endVoiceSession(userId);
        }
    }

    async processVoiceXP() {
        // Grant XP to all users still in voice every minute
        const now = Date.now();
        for (const [userId, session] of this.voiceSessions.entries()) {
            const voiceXP = getVoiceXP(session);
            if (voiceXP > 0) {
                await this.addXP(userId, session.guildId, voiceXP, { voice_time: 60 });
                await sendXPLog(this.client, {
                    type: 'voice',
                    userId,
                    guildId: session.guildId,
                    amount: voiceXP,
                    reason: 'Voice session active'
                });
            }
            // Update session time
            this.voiceSessions.set(userId, { ...session, joinTimestamp: now });
        }
    }

    async _endVoiceSession(userId) {
        if (!this.voiceSessions.has(userId)) return;
        // Optional: do final XP tick on leaving
        this.voiceSessions.delete(userId);
    }

    // --- XP Database Methods ---

    async addXP(userId, guildId, amount, stats = {}) {
        // Upsert user record
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
                // Level up!
                await this.db.query(
                    `UPDATE user_levels SET level = $1 WHERE user_id = $2 AND guild_id = $3`,
                    [newLevel, userId, guildId]
                );
                // Optionally send level-up message here
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
        // Example curve: each level needs 500 + 250*(level-1) more XP than previous
        let level = 0;
        let xpNeeded = 500;
        let remaining = xp;
        while (remaining >= xpNeeded && level < 50) { // 50 = max level, change as needed
            remaining -= xpNeeded;
            level += 1;
            xpNeeded += 250;
        }
        return level;
    }

    async _sendLevelUp(userId, guildId, level) {
        // Fetch the user and send a level up message to the channel if desired
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;
            // Send to the main channel or a specific channel (adjust as needed)
            const channelId = process.env.LEVELUP_CHANNEL;
            if (!channelId) return;
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return;

            const bounty = getBountyForLevel(level);
            const flavor = getLevelUpMessage(level);

            await channel.send(
                `:sparkles: <@${userId}> has reached **Level ${level}**!\n:money_with_wings: New Bounty: **฿${bounty.toLocaleString()}**\n${flavor}`
            );
        } catch (err) {
            // It's okay for this to fail silently
        }
    }
}

module.exports = XPTracker;
