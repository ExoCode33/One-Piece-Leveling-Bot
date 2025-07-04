// src/utils/messageXP.js

/**
 * Calculate XP for message-based activities
 * @param {Message} message - The Discord message object
 * @returns {number} XP amount to award
 */
function getMessageXP(message) {
    // Don't award XP for bot messages or empty messages
    if (message.author.bot || !message.content) return 0;
    
    // Get XP range from your environment variables
    const min = parseInt(process.env.MESSAGE_XP_MIN) || 25;
    const max = parseInt(process.env.MESSAGE_XP_MAX) || 35;
    const multiplier = parseFloat(process.env.XP_MULTIPLIER) || 1.0;
    
    // Calculate random XP within range
    const baseXP = Math.floor(Math.random() * (max - min + 1)) + min;
    const finalXP = Math.floor(baseXP * multiplier);
    
    return finalXP;
}

module.exports = {
    getMessageXP
};
