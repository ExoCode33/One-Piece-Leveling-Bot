// src/utils/reactionXP.js

/**
 * Calculate XP for reaction-based activities
 * @param {MessageReaction} reaction - The reaction object
 * @param {User} user - The user who added the reaction
 * @returns {number} XP amount to award
 */
function getReactionXP(reaction, user) {
    // Don't award XP for reactions on bot messages
    if (reaction.message.author.bot) return 0;
    
    // Don't award XP for self-reactions
    if (reaction.message.author.id === user.id) return 0;
    
    // Base XP for reactions
    const baseXP = parseInt(process.env.REACTION_BASE_XP) || 5;
    
    // Different XP amounts based on emoji type
    const emojiMultipliers = {
        '❤️': 1.5,
        '💖': 1.5,
        '👍': 1.2,
        '👎': 0.8,
        '😂': 1.3,
        '😭': 1.1,
        '😮': 1.0,
        '😡': 0.9,
        '🎉': 1.4,
        '🔥': 1.3,
        '💯': 1.5,
        '✨': 1.2
    };
    
    // Get the emoji (handle both Unicode and custom emojis)
    const emoji = reaction.emoji.name;
    const multiplier = emojiMultipliers[emoji] || 1.0;
    
    // Calculate final XP
    const finalXP = Math.floor(baseXP * multiplier);
    
    // Cap XP to reasonable limits
    return Math.min(finalXP, 25);
}

module.exports = {
    getReactionXP
};
