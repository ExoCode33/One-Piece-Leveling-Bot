// src/utils/voiceXP.js

module.exports = {
  async handleVoiceStateUpdate(xpTracker, oldState, newState) {
    const userId = newState.id;
    const guildId = newState.guild.id;
    if (!xpTracker.voiceSessions) xpTracker.voiceSessions = new Map();

    // Joined voice
    if (!oldState.channelId && newState.channelId) {
      if (process.env.VOICE_ANTI_AFK === 'true') {
        const channel = newState.channel;
        if (!channel || channel.members.size < (parseInt(process.env.VOICE_MIN_MEMBERS) || 2)) return;
      }
      xpTracker.voiceSessions.set(userId, Date.now());
    }
    // Left voice
    else if (oldState.channelId && !newState.channelId) {
      if (xpTracker.voiceSessions.has(userId)) {
        const joinTime = xpTracker.voiceSessions.get(userId);
        const duration = Math.floor((Date.now() - joinTime) / 1000); // seconds
        if (duration >= 60) {
          const min = parseInt(process.env.VOICE_XP_MIN) || 5;
          const max = parseInt(process.env.VOICE_XP_MAX) || 15;
          const xpGain = Math.floor(duration / 60) * (Math.floor(Math.random() * (max - min + 1)) + min);
          await xpTracker.updateUserLevel(userId, guildId, xpGain, 'voice', { voiceTime: duration });
        }
        xpTracker.voiceSessions.delete(userId);
      }
    }
  },

  // Optionally award per-minute voice XP to users still in channel (call in your interval)
  async processVoiceXP(xpTracker) {
    if (!xpTracker.voiceSessions) return;
    const min = parseInt(process.env.VOICE_XP_MIN) || 5;
    const max = parseInt(process.env.VOICE_XP_MAX) || 15;
    for (const [userId, joinTime] of xpTracker.voiceSessions.entries()) {
      const duration = Math.floor((Date.now() - joinTime) / 1000);
      if (duration >= 60) {
        // (Optional: check if user is still in an active voice channel)
        // Award XP per minute interval
        const xpGain = Math.floor(Math.random() * (max - min + 1)) + min;
        // You may need to find guildId based on the session; adjust as needed!
        // await xpTracker.updateUserLevel(userId, guildId, xpGain, 'voice', { voiceTime: 60 });
        xpTracker.voiceSessions.set(userId, Date.now());
      }
    }
  }
};
