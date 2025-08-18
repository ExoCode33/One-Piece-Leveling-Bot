// src/commands/daily-buff.js - Enhanced Daily Spin Wheel with Updated Symbols and Rarities

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Animation Configuration
const ANIMATION_CONFIG = {
    SPIN_FRAMES: 8,
    SPIN_DELAY: 400,
    RAINBOW_DELAY: 300
};

// Tier Colors
const TIER_COLORS = {
    1: 0x8B4513,  // Brown - Uncommon
    2: 0x4169E1,  // Royal Blue - Rare
    3: 0x9932CC,  // Dark Orchid - Epic
    4: 0xFF4500,  // Orange Red - Legendary
    5: 0xFFD700,  // Gold - Mythical
    6: 0xFF1493   // Deep Pink - Divine
};

// Tier Emojis (Colored Circles)
const TIER_EMOJIS = {
    1: '🟢',  // Green circle - Uncommon
    2: '🔵',  // Blue circle - Rare
    3: '🟣',  // Purple circle - Epic
    4: '🟡',  // Yellow circle - Legendary
    5: '🟠',  // Orange circle - Mythical
    6: '🔴'   // Red circle - Divine
};

// Updated tier names
const TIER_NAMES = {
    1: 'Uncommon Buff',
    2: 'Rare Buff',
    3: 'Epic Buff',
    4: 'Legendary Buff',
    5: 'Mythical Buff',
    6: 'Divine Buff'
};

class WheelAnimator {
    static getRainbowPattern(frame, length = 15) {
        const colors = ['🟢', '🔵', '🟣', '🟡', '🟠', '🔴'];
        const pattern = [];
        
        for (let i = 0; i < length; i++) {
            const colorIndex = (i + frame) % colors.length;
            pattern.push(colors[colorIndex]);
        }
        
        return pattern.join('');
    }

    static getRainbowColor(frame) {
        const colors = [0xFF0000, 0xFF8000, 0xFFFF00, 0x00FF00, 0x0080FF, 0x8000FF];
        return colors[frame % colors.length];
    }

    static getSpinningWheel(frame) {
        const wheelSymbols = ['🟢', '🔵', '🟣', '🟡', '🟠', '🔴'];
        const currentPosition = frame % wheelSymbols.length;
        
        let wheel = '';
        for (let i = 0; i < wheelSymbols.length; i++) {
            if (i === currentPosition) {
                wheel += `[${wheelSymbols[i]}] `;
            } else {
                wheel += `${wheelSymbols[i]} `;
            }
        }
        
        return wheel.trim();
    }

    static createSpinFrame(frame) {
        const pattern = this.getRainbowPattern(frame, 12);
        const color = this.getRainbowColor(frame);
        const wheel = this.getSpinningWheel(frame);
        
        const embed = new EmbedBuilder()
            .setTitle('🎰 DAILY BUFF WHEEL')
            .setDescription(
                `🌊 **Spinning the buff wheel...**\n\n` +
                `${pattern}\n\n` +
                `🎰 **SPINNING:** ${wheel}\n\n` +
                `⚓ **The wheel of fortune turns...**\n` +
                `🏴‍☠️ **Your daily buff awaits...**\n\n` +
                `${pattern}`
            )
            .setColor(color)
            .setFooter({ text: '🎰 The wheel of fortune spins...' })
            .setTimestamp();
        
        return embed;
    }

    static createSlowingFrame(finalTier) {
        const tierSymbol = TIER_EMOJIS[finalTier];
        const color = TIER_COLORS[finalTier];
        const tierName = TIER_NAMES[finalTier];
        
        // Create a slowing wheel effect
        const wheelDisplay = `🟢 🔵 🟣 [${tierSymbol}] 🟡 🟠 🔴`;
        
        const embed = new EmbedBuilder()
            .setTitle('🎰 DAILY BUFF WHEEL')
            .setDescription(
                `🎰 **THE WHEEL SLOWS DOWN...**\n\n` +
                `🎯 **WHEEL:** ${wheelDisplay}\n\n` +
                `**${tierSymbol} ${tierName.toUpperCase()} DISCOVERED! ${tierSymbol}**\n\n` +
                `🏴‍☠️ **Fortune has chosen your buff...**`
            )
            .setColor(color)
            .setFooter({ text: '🎯 Your daily buff is revealed!' })
            .setTimestamp();
        
        return embed;
    }

    static createResultFrame(tier, tierInfo) {
        const embed = new EmbedBuilder()
            .setColor(tierInfo.color)
            .setTitle('🎰 DAILY BUFF WHEEL')
            .setDescription(`**🎉 DAILY BUFF ACTIVATED! 🎉**`)
            .addFields(
                {
                    name: `${tierInfo.emoji} ${tierInfo.name} • Duration: Until <t:${getNextResetUnixTimestamp()}:R>`,
                    value: `**${tierInfo.multiplier}x** XP Multiplier boost active!\n🏴‍☠️ *Your daily buff power is now active...*`,
                    inline: false
                }
            )
            .setFooter({ text: '⚓ Marine Intelligence • Daily Buff System' })
            .setTimestamp();

        return embed;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎰 Spin the Daily Buff Wheel for daily XP buffs!'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            if (!global.xpTracker?.db) {
                return await interaction.reply({
                    content: '❌ **System
