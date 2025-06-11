// src/utils/bountySystem.js

const { EmbedBuilder } = require('discord.js');

const BOUNTY_LADDER = [
  { level: 0,   bounty: 0 },
  { level: 5,   bounty: 30000000 },
  { level: 10,  bounty: 81000000 },
  { level: 15,  bounty: 120000000 },
  { level: 20,  bounty: 200000000 },
  { level: 25,  bounty: 320000000 },
  { level: 30,  bounty: 500000000 },
  { level: 35,  bounty: 860000000 },
  { level: 40,  bounty: 1057000000 },
  { level: 45,  bounty: 1500000000 },
  { level: 50,  bounty: 3000000000 }
];
const LEVEL_UP_MESSAGES = {
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
  50: "EMPEROR CLASS THREAT: Controls vast territories. Considered one of the most dangerous pirates."
};
const DEFAULT_UP_MSG = "Bounty increased. Threat level rising.";
const PIRATE_KING_BOUNTY = 4600000000;

function getBountyForLevel(level) {
  if (level > 50) level = 50; // Cap at 50
  for (let i = 0; i < BOUNTY_LADDER.length; i++) {
    if (level === BOUNTY_LADDER[i].level) return BOUNTY_LADDER[i].bounty;
  }
  for (let i = 1; i < BOUNTY_LADDER.length; i++) {
    if (level < BOUNTY_LADDER[i].level) {
      const prev = BOUNTY_LADDER[i-1];
      const next = BOUNTY_LADDER[i];
      const pct = (level - prev.level) / (next.level - prev.level);
      return Math.round(prev.bounty + pct * (next.bounty - prev.bounty));
    }
  }
  return BOUNTY_LADDER[BOUNTY_LADDER.length - 1].bounty;
}

function getLevelUpMessage(level) {
  return LEVEL_UP_MESSAGES[level] || DEFAULT_UP_MSG;
}

function createLevelUpEmbed(user, prevLevel, newLevel) {
  const bounty = getBountyForLevel(newLevel);
  const prevBounty = getBountyForLevel(prevLevel);
  const msg = getLevelUpMessage(newLevel);

  return new EmbedBuilder()
    .setColor(0xf7d560)
    .setTitle('WORLD GOVERNMENT BOUNTY UPDATE')
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setDescription(
      `🌟 **BOUNTY INCREASE!** 🌟\n\n` +
      `**${user.username}** has reached a new level of infamy!\n` +
      `*${msg}*`
    )
    .addFields(
      { name: '📑 Previous Bounty\nLevel', value: `Level ${prevLevel}\n฿${prevBounty.toLocaleString()}`, inline: true },
      { name: '🔥 NEW BOUNTY\nLEVEL', value: `Level ${newLevel}\n฿${bounty.toLocaleString()}`, inline: true },
      { name: '💎 Total Bounty', value: `฿${bounty.toLocaleString()} ⚡`, inline: true }
    )
    .setFooter({ text: `⚓ Marine Bounty Tracking System • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` });
}

module.exports = {
  getBountyForLevel,
  getLevelUpMessage,
  createLevelUpEmbed,
  PIRATE_KING_BOUNTY
};
