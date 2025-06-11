// src/utils/xpTracker.js

const { createLevelUpEmbed, getBountyForLevel } = require('./bountySystem');
const { sendXPLog } = require('./xpLogger');

class XPTracker {
  constructor(client, db) {
    this.client = client;
    this.db = db;
    this.voiceSessions = new Map();
  }

  async updateUserLevel(userId, guildId, xpGain, activityType, additionalInfo = {}) {
    try {
      // Fetch user row
      const res = await this.db.query(
        `SELECT total_xp, level, messages, reactions, voice_time, rep
         FROM user_levels WHERE user_id = $1 AND guild_id = $2`,
        [userId, guildId]
      );
      let currentXP = 0, currentLevel = 0, messages = 0, reactions = 0, voiceTime = 0, rep = 0;
      if (res.rows.length) {
        ({ total_xp: currentXP, level: currentLevel, messages, reactions, voice_time: voiceTime, rep } = res.rows[0]);
      }
      const newXP = currentXP + xpGain;
      const newLevel = Math.min(this.calculateLevel(newXP), 50);

      // Update
      await this.db.query(
        `INSERT INTO user_levels (user_id, guild_id, total_xp, level, messages, reactions, voice_time, rep)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id, guild_id) DO UPDATE SET
            total_xp=EXCLUDED.total_xp, level=EXCLUDED.level, messages=EXCLUDED.messages,
            reactions=EXCLUDED.reactions, voice_time=EXCLUDED.voice_time, rep=EXCLUDED.rep`,
        [
          userId, guildId, newXP, newLevel,
          activityType === 'message' ? messages + 1 : messages,
          activityType === 'reaction' ? reactions + 1 : reactions,
          activityType === 'voice' ? voiceTime + (additionalInfo.voiceTime || 0) : voiceTime,
          rep
        ]
      );

      await sendXPLog(this.client, {
        userId, guildId, xpGain, totalXP: newXP, level: newLevel,
        messages, reactions, voiceTime, activityType, rep
      });

      // Level-up embed
      if (newLevel > currentLevel) {
        const guild = await this.client.guilds.fetch(guildId);
        let member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          const channelId = process.env.LEVELUP_CHANNEL;
          let announceChannel = (channelId && guild.channels.cache.get(channelId)) || guild.systemChannel || null;
          if (announceChannel) {
            const embed = createLevelUpEmbed(member.user, currentLevel, newLevel);
            await announceChannel.send({ embeds: [embed] });
          }
        }
      }
    } catch (error) {
      console.error(`[XPTracker] Error updating user level: ${error}`);
    }
  }

  calculateLevel(xp) {
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
    switch (curve) {
      case 'linear':
        return Math.floor(xp / (1000 * multiplier));
      case 'logarithmic':
        return Math.floor(Math.log(xp / 100 + 1) * multiplier);
      case 'exponential':
      default:
        return Math.floor(Math.sqrt(xp / 100) * multiplier);
    }
  }

  // For leaderboard.js or level.js
  getBounty(level) {
    return getBountyForLevel(level);
  }

  async getLeaderboard(guildId) {
    const res = await this.db.query(
      `SELECT user_id, total_xp, level, rep
       FROM user_levels WHERE guild_id = $1
       ORDER BY total_xp DESC`, [guildId]);
    return res.rows.map(r => ({
      userId: r.user_id,
      xp: r.total_xp,
      level: r.level,
      rep: r.rep || 0
    }));
  }

  async getUserStats(userId, guildId) {
    const res = await this.db.query(
      `SELECT total_xp, level, messages, reactions, voice_time, rep
       FROM user_levels WHERE user_id = $1 AND guild_id = $2`, [userId, guildId]);
    if (!res.rows.length) return null;
    const row = res.rows[0];
    return {
      xp: row.total_xp, level: row.level, messages: row.messages || 0,
      reactions: row.reactions || 0, voiceTime: row.voice_time || 0, rep: row.rep || 0
    };
  }
}

module.exports = XPTracker;
