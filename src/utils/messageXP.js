// src/utils/messageXP.js

/**
 * Calculate XP for message-based activities
 * @param {Message} message - The Discord message object
 * @returns {number} XP amount to award
 */
function getMessageXP(message) {
    // Don't award XP for bot messages or empty messages
    if (message.author.bot || !message.content) return 0;
    
    // Base XP per message
    const baseXP = parseInt(process.env.MESSAGE_BASE_XP) || 15;
    
    // Length bonus (more XP for longer messages)
    const length = message.content.length;
    let lengthBonus = 0;
    
    if (length > 50) lengthBonus += 2;
    if (length > 100) lengthBonus += 3;
    if (length > 200) lengthBonus += 5;
    if (length > 500) lengthBonus += 5; // Cap at reasonable length
    
    // Media bonus (images, videos, etc.)
    const mediaBonus = message.attachments.size > 0 ? 5 : 0;
    
    // Link bonus
    const linkBonus = message.content.match(/https?:\/\/[^\s]+/g) ? 2 : 0;
    
    // Calculate total XP
    const totalXP = baseXP + lengthBonus + mediaBonus + linkBonus;
    
    // Add some randomness (±20%)
    const randomMultiplier = 0.8 + (Math.random() * 0.4);
    const finalXP = Math.floor(totalXP * randomMultiplier);
    
    // Cap XP to reasonable limits
    return Math.min(Math.max(finalXP, 1), 50);
}

module.exports = {
    getMessageXP
};
