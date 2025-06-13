// src/utils/bountySystem.js - Enhanced with proper bounty amounts and threat levels

const { EmbedBuilder } = require('discord.js');

// Complete bounty ladder for levels 0-55
const BOUNTY_LADDER = {
  0: 0,
  1: 1000000,      // 1 million
  2: 3000000,      // 3 million
  3: 5000000,      // 5 million
  4: 8000000,      // 8 million
  5: 30000000,     // 30 million
  6: 35000000,     // 35 million
  7: 42000000,     // 42 million
  8: 50000000,     // 50 million
  9: 65000000,     // 65 million
  10: 81000000,    // 81 million
  11: 90000000,    // 90 million
  12: 100000000,   // 100 million
  13: 108000000,   // 108 million
  14: 115000000,   // 115 million
  15: 120000000,   // 120 million
  16: 135000000,   // 135 million
  17: 150000000,   // 150 million
  18: 170000000,   // 170 million
  19: 185000000,   // 185 million
  20: 200000000,   // 200 million
  21: 220000000,   // 220 million
  22: 240000000,   // 240 million
  23: 260000000,   // 260 million
  24: 280000000,   // 280 million
  25: 320000000,   // 320 million
  26: 350000000,   // 350 million
  27: 380000000,   // 380 million
  28: 420000000,   // 420 million
  29: 460000000,   // 460 million
  30: 500000000,   // 500 million
  31: 550000000,   // 550 million
  32: 600000000,   // 600 million
  33: 660000000,   // 660 million
  34: 720000000,   // 720 million
  35: 860000000,   // 860 million
  36: 900000000,   // 900 million
  37: 950000000,   // 950 million
  38: 1000000000,  // 1 billion
  39: 1030000000,  // 1.03 billion
  40: 1057000000,  // 1.057 billion
  41: 1100000000,  // 1.1 billion
  42: 1200000000,  // 1.2 billion
  43: 1300000000,  // 1.3 billion
  44: 1400000000,  // 1.4 billion
  45: 1500000000,  // 1.5 billion
  46: 1800000000,  // 1.8 billion
  47: 2100000000,  // 2.1 billion
  48: 2500000000,  // 2.5 billion
  49: 2800000000,  // 2.8 billion
  50: 3000000000,  // 3 billion
  51: 3500000000,  // 3.5 billion
  52: 4000000000,  // 4 billion
  53: 4200000000,  // 4.2 billion
  54: 4500000000,  // 4.5 billion
  55: 5000000000   // 5 billion
};

// Threat level messages for milestone levels
const THREAT_LEVEL_MESSAGES = {
  0: "New individual detected. No criminal activity reported. Continue monitoring.",
  5: "Criminal activity confirmed in East Blue region. Initial bounty authorized.",
  10: "Multiple incidents involving Marine personnel. Elevated threat status.",
  15: "Subject has crossed into Grand Line territory. Enhanced surveillance required.",
  20: "Dangerous individual. Multiple Marine casualties reported. Caution advised.",
  25: "HIGH PRIORITY TARGET: Classified as extremely dangerous. Deploy specialized units.",
  30: "ADVANCED COMBATANT: Confirmed use of advanced fighting techniques. Vice Admiral response.",
  35: "TERRITORIAL THREAT: Capable of commanding large operations. Fleet mobilization recommended.",
  40: "ELITE LEVEL THREAT: Extreme danger to Marine operations. Admiral consultation required.",
  45: "EXTRAORDINARY ABILITIES: Unprecedented power levels detected. Maximum security protocols.",
  50: "EMPEROR CLASS THREAT: Controls vast territories. Considered one of the most dangerous pirates.",
  55: "LEGENDARY THREAT LEVEL: Power exceeds known classifications. Ultimate priority target."
};

const DEFAULT_LEVEL_UP_MSG = "Bounty increased. Threat level rising.";
const PIRATE_KING_BOUNTY = 4600000000; // 4.6 billion

function getBountyForLevel(level) {
  // Clamp level to maximum
  if (level > 55) level = 55;
  if (level < 0) level = 0;
  
  // Return exact bounty if it exists
  if (BOUNTY_LADDER[level] !== undefined) {
    return BOUNTY_LADDER[level];
  }
  
  // For any missing levels, interpolate between known values
  const lowerLevel = Math.floor(level);
  const upperLevel = Math.ceil(level);
  
  if (lowerLevel === upperLevel) {
    return BOUNTY_LADDER[lowerLevel] || 0;
  }
  
  const lowerBounty = BOUNTY_LADDER[lowerLevel] || 0;
  const upperBounty = BOUNTY_LADDER[upperLevel] || lowerBounty;
  const ratio = level - lowerLevel;
  
  return Math.floor(lowerBounty + (upperBounty - lowerBounty) * ratio);
}

function getThreatLevelMessage(level) {
  // Check for exact milestone matches
  if (THREAT_LEVEL_MESSAGES[level]) {
    return THREAT_LEVEL_MESSAGES[level];
  }
  
  // For non-milestone levels, return default message
  return DEFAULT_LEVEL_UP_MSG;
}

function createLevelUpEmbed(user, prevLevel, newLevel) {
  const bounty = getBountyForLevel(newLevel);
  const prevBounty = getBountyForLevel(prevLevel);
  const threatMessage = getThreatLevelMessage(newLevel);
  
  // Determine embed color based on level
  let embedColor = 0xf7d560; // Default gold
  if (newLevel >= 50) embedColor = 0xFF0000; // Red for Emperor class
  else if (newLevel >= 40) embedColor = 0xFF4500; // Orange red for Elite
  else if (newLevel >= 30) embedColor = 0xFF8C00; // Dark orange for Advanced
  else if (newLevel >= 20) embedColor = 0xFFA500; // Orange for Dangerous
  else if (newLevel >= 10) embedColor = 0xFFD700; // Gold for Elevated

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle('🚨 WORLD GOVERNMENT BOUNTY UPDATE 🚨')
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setDescription(
      `**${user.username}** has reached a new level of infamy!\n\n` +
      `*${threatMessage}*`
    )
    .addFields(
      { 
        name: '📑 Previous Bounty', 
        value: `Level ${prevLevel}\n฿${prevBounty.toLocaleString()}`, 
        inline: true 
      },
      { 
        name: '🔥 NEW BOUNTY', 
        value: `Level ${newLevel}\n฿${bounty.toLocaleString()}`, 
        inline: true 
      },
      { 
        name: '💰 Bounty Increase', 
        value: `+฿${(bounty - prevBounty).toLocaleString()}`, 
        inline: true 
      }
    )
    .setFooter({ 
      text: `⚓ Marine Bounty Tracking System • Threat Level: ${getThreatLevelName(newLevel)}` 
    })
    .setTimestamp();

  return embed;
}

function getThreatLevelName(level) {
  if (level >= 55) return "LEGENDARY";
  if (level >= 50) return "EMPEROR CLASS";
  if (level >= 45) return "EXTRAORDINARY";
  if (level >= 40) return "ELITE LEVEL";
  if (level >= 35) return "TERRITORIAL";
  if (level >= 30) return "ADVANCED COMBATANT";
  if (level >= 25) return "HIGH PRIORITY";
  if (level >= 20) return "DANGEROUS";
  if (level >= 15) return "GRAND LINE";
  if (level >= 10) return "ELEVATED";
  if (level >= 5) return "CONFIRMED CRIMINAL";
  return "MONITORING";
}

// Auto-dismiss function for ephemeral messages
async function autoDissmissEphemeralMessage(interaction, delay = 20000) {
  if (!interaction.ephemeral && !interaction.replied) return;
  
  setTimeout(async () => {
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.deleteReply().catch(() => {
          // Silently fail if message is already deleted or interaction expired
        });
      }
    } catch (error) {
      // Silently handle errors - message might already be gone
    }
  }, delay);
}

module.exports = {
  getBountyForLevel,
  getThreatLevelMessage,
  createLevelUpEmbed,
  getThreatLevelName,
  autoDissmissEphemeralMessage,
  BOUNTY_LADDER,
  THREAT_LEVEL_MESSAGES,
  PIRATE_KING_BOUNTY
};
