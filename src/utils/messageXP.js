// src/utils/messageXP.js

function getMessageXP(message) {
    // Ignore bots or DMs (guildless messages)
    if (message.author.bot || !message.guild) return 0;

    const min = parseInt(process.env.MESSAGE_XP_MIN) || 15;
    const max = parseInt(process.env.MESSAGE_XP_MAX) || 25;
    // You can add cooldown logic in XPTracker if needed
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { getMessageXP };
