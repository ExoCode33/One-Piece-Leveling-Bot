// src/utils/voiceXP.js

/**
 * Calculate XP for voice chat activities
 * @returns {number} XP amount to award per minute in voice
 */
function getVoiceXP() {
    // Get XP range from your environment variables
    const min = parseInt(process.env.VOICE_XP_MIN) || 45;
    const max = parseInt(process.env.VOICE_XP_MAX) || 55;
    const multiplier = parseFloat(process.env.XP_MULTIPLIER) || 1.0;
    
    // Calculate random XP within range
    const baseXP = Math.floor(Math.random() * (max - min + 1)) + min;
    const finalXP = Math.floor(baseXP * multiplier);
    
    return finalXP;
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
