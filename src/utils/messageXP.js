// src/utils/messageXP.js

module.exports = {
  async handleMessageXP(xpTracker, message) {
    if (message.author.bot || !message.guild) return;
    const min = parseInt(process.env.MESSAGE_XP_MIN) || 15;
    const max = parseInt(process.env.MESSAGE_XP_MAX) || 25;
    const cooldown = parseInt(process.env.MESSAGE_COOLDOWN) || 60000;
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    if (!xpTracker.messageCooldowns) xpTracker.messageCooldowns = new Map();
    if (xpTracker.messageCooldowns.has(key) && now - xpTracker.messageCooldowns.get(key) < cooldown) return;
    xpTracker.messageCooldowns.set(key, now);
    const xpGain = Math.floor(Math.random() * (max - min + 1)) + min;
    await xpTracker.updateUserLevel(message.author.id, message.guild.id, xpGain, 'message');
  }
};
