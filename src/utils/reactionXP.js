// src/utils/reactionXP.js

module.exports = {
  async handleReactionXP(xpTracker, reaction, user) {
    if (user.bot || !reaction.message.guild) return;
    const min = parseInt(process.env.REACTION_XP_MIN) || 15;
    const max = parseInt(process.env.REACTION_XP_MAX) || 25;
    const cooldown = parseInt(process.env.REACTION_COOLDOWN) || 300000;
    const key = `${reaction.message.guild.id}:${user.id}`;
    const now = Date.now();
    if (!xpTracker.reactionCooldowns) xpTracker.reactionCooldowns = new Map();
    if (xpTracker.reactionCooldowns.has(key) && now - xpTracker.reactionCooldowns.get(key) < cooldown) return;
    xpTracker.reactionCooldowns.set(key, now);
    const xpGain = Math.floor(Math.random() * (max - min + 1)) + min;
    await xpTracker.updateUserLevel(user.id, reaction.message.guild.id, xpGain, 'reaction');
  }
};
