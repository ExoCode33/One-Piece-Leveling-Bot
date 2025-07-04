// src/utils/reactionXP.js

/**
 * Calculate XP for reaction-based activities
 * @param {MessageReaction} reaction - The reaction object
 * @param {User} user - The user who added the reaction
 * @returns {number} XP amount to award
 */
function getReactionXP(reaction, user) {
    // Don't award XP for bot reactions or DMs
    if (user.bot || !reaction.message.guild) return 0;
    
    // Get XP range from your environment variables
    const min = parseInt(process.env.REACTION_XP_MIN) || 25;
    const max = parseInt(process.env.REACTION_XP_MAX) || 35;
    const multiplier = parseFloat(process.env.XP_MULTIPLIER) || 1.0;
    
    // Calculate random XP within range
    const baseXP = Math.floor(Math.random() * (max - min + 1)) + min;
    const finalXP = Math.floor(baseXP * multiplier);
    
    return finalXP;
}

// Keep the original function for backwards compatibility if needed elsewhere
async function handleReactionXP(xpTracker, reaction, user) {
    if (user.bot || !reaction.message.guild) return;
    const min = parseInt(process.env.REACTION_XP_MIN) || 25;
    const max = parseInt(process.env.REACTION_XP_MAX) || 35;
    const cooldown = parseInt(process.env.REACTION_COOLDOWN) || 300000;
    const multiplier = parseFloat(process.env.XP_MULTIPLIER) || 1.0;
    
    const key = `${reaction.message.guild.id}:${user.id}`;
    const now = Date.now();
    if (!xpTracker.reactionCooldowns) xpTracker.reactionCooldowns = new Map();
    if (xpTracker.reactionCooldowns.has(key) && now - xpTracker.reactionCooldowns.get(key) < cooldown) return;
    xpTracker.reactionCooldowns.set(key, now);
    
    const baseXP = Math.floor(Math.random() * (max - min + 1)) + min;
    const xpGain = Math.floor(baseXP * multiplier);
    await xpTracker.updateUserLevel(user.id, reaction.message.guild.id, xpGain, 'reaction');
}

module.exports = {
    getReactionXP,
    handleReactionXP
};
