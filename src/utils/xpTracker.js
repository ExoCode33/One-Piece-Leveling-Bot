// src/utils/xpTracker.js - XP Tracking and Management System

const { EmbedBuilder } = require('discord.js');
const { sendXPLog } = require('./xpLogger');

// --- Bounty Ladder and Messages
const BOUNTY_LADDER = [
  { level: 0,   bounty: 0 },
  { level: 5,   bounty: 30000000 },
  { level: 10,  bounty: 81000000 },
  { level: 15,  bounty: 120000000 },
  { level: 20,  bounty: 200000000 },
  { level: 25,  bounty: 320000000 },
  { level: 30,  bounty: 500000000 },
  { level: 35,  bounty: 860000000 },
  { level: 40,  bounty: 1057000000 },
  { level: 45,  bounty: 1500000000 },
  { level: 50,  bounty: 3000000000 }
];
const LEVEL_UP_MESSAGES = {
  0: "New individual detected. No criminal activity reported. Continue monitoring.",
  5: "Criminal activity confirmed in East Blue region. Initial bounty authorized.",
  10: "Multiple incidents involving Marine personnel. Elevated threat status.",
  15: "Subject has crossed into Grand Line territory. Enhanced surveillance required.",
  20: "Dangerous individual. Multiple Marine casualties reported. Caution advised.",
  25: "HIGH PRIORITY TARGET: Classified as extremely dangerous. Deploy specialized units.",
  30: "ADVANCED COMBATANT: Confirmed use of advanced fighting techniques. Vice Admiral response.",
  35: "TERRITORIAL THREAT: Capable of commanding large operations. Fleet mobilization recommended.",
  40: "ELITE LEVEL THREAT: Extreme danger to Marine operations. Admiral consultation required.",
  45: "EXTRAORDINARY ABILITIES: Unprecedented power levels detected. Maximum security protocols.",
  50: "EMPEROR CLASS THREAT: Controls vast territories. Considered one of the most dangerous pirates."
};
const DEFAULT_UP_MSG = "Bounty increased. Threat level rising.";
const PIRATE_KING_BOUNTY = 4600000000;

// --- Helper Functions
function getBountyForLevel(level) {
  if (level > 50) level = 50; // Cap at 50
  for (let i = 0; i < BOUNTY_LADDER.length; i++) {
    if (level === BOUNTY_LADDER[i].level) return BOUNTY_LADDER[i].bounty;
  }
  for (let i = 1; i < BOUNTY_LADDER.length; i++) {
    if (level < BOUNTY_LADDER[i].level) {
      const prev = BOUNTY_LADDER[i-1];
      const next = BOUNTY_LADDER[i];
      const pct = (level - prev.level) / (next.level - prev.level);
      return Math.round(prev.bounty + pct * (next.bounty - prev.bounty));
    }
  }
  return BOUNTY_LADDER[BOUNTY_LADDER.length - 1].bounty;
}
function getLevelUpMessage(level) {
  return LEVEL_UP_MESSAGES[level] || DEFAULT_UP_MSG;
}
function createLevelUpEmbed(user, prevLevel, newLevel) {
  const bounty = getBountyForLevel(newLevel);
  const prevBounty = getBountyForLevel(prevLevel);
  const msg = getLevelUpMessage(newLevel);

  return new EmbedBuilder()
    .setColor(0xf7d560)
    .setTitle('WORLD GOVERNMENT BOUNTY UPDATE')
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setDescription(
      `🌟 **BOUNTY INCREASE!** 🌟\n\n` +
      `**${user.username}** has reached a new level of infamy!\n` +
      `*${msg}*`
    )
    .addFields(
      { name: '📑 Previous Bounty\nLevel', value: `Level ${prevLevel}\n฿${prevBounty.toLocaleString()}`, inline: true },
      { name: '🔥 NEW BOUNTY\nLEVEL', value: `Level ${newLevel}\n฿${bounty.toLocaleString()}`, inline: true },
      { name: '💎 Total Bounty', value: `฿${bounty.toLocaleString()} ⚡`, inline: true }
    )
    .setFooter({ text: `⚓ Marine Bounty Tracking System • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` });
}

// --- Main Class
class XPTracker {
  constructor(client, db) {
    this.client = client;
    this.db = db;

    // Cooldown maps
    this.messageCooldowns = new Map();
    this.reactionCooldowns = new Map();
    this.voiceSessions = new Map();
  }

  // Helper functions
  getRandomXP(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  calculateLevel(xp) {
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;
    const maxLevel = 50; // Always capped at 50

    let level;
    switch (curve) {
      case 'linear':
        level = Math.floor(xp / (1000 * multiplier));
        break;
      case 'logarithmic':
        level = Math.floor(Math.log(xp / 100 + 1) * multiplier);
        break;
      case 'exponential':
      default:
        level = Math.floor(Math.sqrt(xp / 100) * multiplier);
        break;
    }
    return Math.min(level, maxLevel);
  }

  calculateXPForLevel(level) {
    const curve = process.env.FORMULA_CURVE || 'exponential';
    const multiplier = parseFloat(process.env.FORMULA_MULTIPLIER) || 1.75;

    switch (curve) {
      case 'linear':
        return Math.floor(level * 1000 * multiplier);
      case 'logarithmic':
        return Math.floor((Math.exp(level / multiplier) - 1) * 100);
      case 'exponential':
      default:
        return Math.floor(Math.pow(level / multiplier, 2) * 100);
    }
  }

  async debugLog(message) {
    if (process.env.DEBUG_MODE === 'true') {
      console.log(`[DEBUG] ${message}`);
    }
  }

  // Main XP update function
  async updateUserLevel(userId, guildId, xpGain, activityType, additionalInfo = {}) {
    try {
      // Get current user data
      const userQuery = `
        SELECT total_xp, level, messages, reactions, voice_time
        FROM user_levels
        WHERE user_id = $1 AND guild_id = $2
      `;
      let userResult = await this.db.query(userQuery, [userId, guildId]);

      let currentXP = 0;
      let currentLevel = 0;
      let messages = 0;
      let reactions = 0;
      let voiceTime = 0;

      if (userResult.rows.length > 0) {
        currentXP = userResult.rows[0].total_xp;
        currentLevel = userResult.rows[0].level;
        messages = userResult.rows[0].messages || 0;
        reactions = userResult.rows[0].reactions || 0;
        voiceTime = userResult.rows[0].voice_time || 0;
      }

      // Calculate new XP/level
      const newXP = currentXP + xpGain;
      const newLevel = this.calculateLevel(newXP);

      // Update database
      const updateQuery = `
        INSERT INTO user_levels (user_id, guild_id, total_xp, level, messages, reactions, voice_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, guild_id) DO UPDATE
        SET total_xp = EXCLUDED.total_xp,
            level = EXCLUDED.level,
            messages = EXCLUDED.messages,
            reactions = EXCLUDED.reactions,
            voice_time = EXCLUDED.voice_time
      `;
      await this.db.query(updateQuery, [
        userId, guildId, newXP, newLevel,
        activityType === 'message' ? messages + 1 : messages,
        activityType === 'reaction' ? reactions + 1 : reactions,
        activityType === 'voice' ? voiceTime + (additionalInfo.voiceTime || 0) : voiceTime
      ]);

      // Log the XP update (optional)
      await sendXPLog(this.client, {
        userId,
        guildId,
        xpGain,
        totalXP: newXP,
        level: newLevel,
        messages: activityType === 'message' ? messages + 1 : messages,
        reactions: activityType === 'reaction' ? reactions + 1 : reactions,
        voiceTime: activityType === 'voice' ? voiceTime + (additionalInfo.voiceTime || 0) : voiceTime,
        activityType
      });

      // If level up occurred, announce with embed!
      if (newLevel > currentLevel) {
        // Announce in configured channel, or fallback to system channel
        const guild = await this.client.guilds.fetch(guildId);
        let user = await guild.members.fetch(userId).catch(() => null);
        if (user) {
          const channelId = process.env.LEVEL_UP_CHANNEL_ID;
          let announceChannel =
            (channelId && guild.channels.cache.get(channelId)) ||
            guild.systemChannel ||
            null;

          if (announceChannel) {
            const embed = createLevelUpEmbed(user.user, currentLevel, newLevel);
            await announceChannel.send({ embeds: [embed] });
          }
        }
      }

    } catch (error) {
      console.error(`[XPTracker] Error updating user level: ${error}`);
    }
  }

  // You can also provide a bounty getter for external use (e.g., leaderboard)
  getBounty(level) {
    return getBountyForLevel(level);
  }

  // Returns array of leaderboard objects: [{ userId, xp, level, rep }]
  async getLeaderboard(guildId) {
    const query = `
      SELECT user_id, total_xp, level, rep
      FROM user_levels
      WHERE guild_id = $1
      ORDER BY total_xp DESC
    `;
    const result = await this.db.query(query, [guildId]);
    return result.rows.map(r => ({
      userId: r.user_id,
      xp: r.total_xp,
      level: r.level,
      rep: r.rep || 0
    }));
  }
}

module.exports = XPTracker;
