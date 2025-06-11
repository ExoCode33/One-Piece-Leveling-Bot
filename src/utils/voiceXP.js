// src/utils/voiceXP.js

/**
 * Calculate XP for voice chat activities
 * @returns {number} XP amount to award per minute in voice
 */
function getVoiceXP() {
    // Base XP per minute in voice chat
    const baseXP = parseInt(process.env.VOICE_BASE_XP) || 10;
    
    // Add some randomness (±30% variation)
    const randomMultiplier = 0.7 + (Math.random() * 0.6);
    const finalXP = Math.floor(baseXP * randomMultiplier);
    
    // Ensure minimum XP
    return Math.max(finalXP, 5);
}

/**
 * Calculate bonus XP for extended voice sessions
 * @param {number} minutes - Total minutes in voice
 * @returns {number} Bonus XP amount
 */
function getVoiceSessionBonus(minutes) {
    if (minutes < 30) return 0;
    if (minutes < 60) return 10;
    if (minutes < 120) return 25;
    if (minutes < 240) return 50;
    return 100; // 4+ hours
}

module.exports = {
    getVoiceXP,
    getVoiceSessionBonus
};
