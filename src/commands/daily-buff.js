// src/commands/daily-buff.js - Enhanced Daily Spin Wheel with One Piece Theme

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Animation Configuration
const ANIMATION_CONFIG = {
    SPIN_FRAMES: 8,
    SPIN_DELAY: 400,
    RAINBOW_DELAY: 300
};

// Tier Colors
const TIER_COLORS = {
    1: 0x8B4513,  // Brown - Common Devil Fruit
    2: 0x4169E1,  // Royal Blue - Rare Devil Fruit
    3: 0x9932CC,  // Dark Orchid - Epic Devil Fruit
    4: 0xFF4500,  // Orange Red - Legendary Devil Fruit
    5: 0xFFD700,  // Gold - Mythical Devil Fruit
    6: 0xFF69B4   // Hot Pink - Ancient Zoan Devil Fruit
};

// Tier Emojis (Dice faces)
const TIER_EMOJIS = {
    1: '⚀',
    2: '⚁', 
    3: '⚂',
    4: '⚃',
    5: '⚄',
    6: '⚅'
};

// One Piece themed tier names
const TIER_NAMES = {
    1: 'Common Devil Fruit',
    2: 'Rare Devil Fruit',
    3: 'Epic Devil Fruit',
    4: 'Legendary Devil Fruit',
    5: 'Mythical Devil Fruit',
    6: 'Ancient Zoan Devil Fruit'
};

class WheelAnimator {
    static getRainbowPattern(frame, length = 15) {
        const colors = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣'];
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
        const wheelSymbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
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
            .setTitle('🎰 DEVIL FRUIT FORTUNE WHEEL')
            .setDescription(
                `🌊 **Spinning the Devil Fruit wheel...**\n\n` +
                `${pattern}\n\n` +
                `🎰 **SPINNING:** ${wheel}\n\n` +
                `⚓ **The Grand Line's fortune wheel turns...**\n` +
                `🏴‍☠️ **Your Devil Fruit power awaits...**\n\n` +
                `${pattern}`
            )
            .setColor(color)
            .setFooter({ text: '🎰 The wheel of the Grand Line spins...' })
            .setTimestamp();
        
        return embed;
    }

    static createSlowingFrame(finalTier) {
        const tierSymbol = TIER_EMOJIS[finalTier];
        const color = TIER_COLORS[finalTier];
        const tierName = TIER_NAMES[finalTier];
        
        // Create a slowing wheel effect
        const wheelDisplay = `⚀ ⚁ ⚂ [${tierSymbol}] ⚃ ⚄ ⚅`;
        
        const embed = new EmbedBuilder()
            .setTitle('🎰 DEVIL FRUIT FORTUNE WHEEL')
            .setDescription(
                `🎰 **THE WHEEL SLOWS DOWN...**\n\n` +
                `🎯 **WHEEL:** ${wheelDisplay}\n\n` +
                `**${tierSymbol} ${tierName.toUpperCase()} DISCOVERED! ${tierSymbol}**\n\n` +
                `🏴‍☠️ **The Grand Line has chosen your power...**`
            )
            .setColor(color)
            .setFooter({ text: '🎯 Your Devil Fruit power is revealed!' })
            .setTimestamp();
        
        return embed;
    }

    static createResultFrame(tier, tierInfo) {
        const embed = new EmbedBuilder()
            .setColor(tierInfo.color)
            .setTitle('🎰 DEVIL FRUIT FORTUNE WHEEL')
            .setDescription(`**🎉 DEVIL FRUIT POWER AWAKENED! 🎉**`)
            .addFields(
                {
                    name: `${tierInfo.emoji} ${tierInfo.name} • Duration: Until <t:${getNextResetUnixTimestamp()}:R>`,
                    value: `**${tierInfo.multiplier}x** XP Multiplier boost active!\n🏴‍☠️ *Your Devil Fruit power courses through you...*`,
                    inline: false
                }
            )
            .setFooter({ text: '⚓ Marine Intelligence • Devil Fruit Power Active' })
            .setTimestamp();

        return embed;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎰 Spin the Devil Fruit Fortune Wheel for daily XP buffs!'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            if (!global.xpTracker?.db) {
                return await interaction.reply({
                    content: '❌ **System Error**\n\nMarine Intelligence database is offline.',
                    ephemeral: true
                });
            }

            // Check if user already claimed today's buff
            const today = getCurrentDayKey();
            const existingBuff = await global.xpTracker.db.query(
                'SELECT * FROM daily_buffs WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, today]
            );

            if (existingBuff.rows.length > 0) {
                const buff = existingBuff.rows[0];
                const tierInfo = await getTierInfo(buff.tier, guildId);
                
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('🎰 DEVIL FRUIT FORTUNE WHEEL')
                    .setDescription(`**DEVIL FRUIT POWER ALREADY AWAKENED**`)
                    .addFields(
                        {
                            name: 'Current Power',
                            value: `**${tierInfo.name}** • Duration: Until <t:${getNextResetUnixTimestamp()}:R>`,
                            inline: false
                        },
                        {
                            name: 'XP Multiplier',
                            value: `**${tierInfo.multiplier}x** boost active\n🏴‍☠️ *Your Devil Fruit power is still active...*`,
                            inline: false
                        }
                    )
                    .setFooter({ text: '⚓ Marine Intelligence • Devil Fruit Power System' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Create initial spin wheel embed
            const spinEmbed = new EmbedBuilder()
                .setColor(0x4A90E2)
                .setTitle('🎰 DEVIL FRUIT FORTUNE WHEEL')
                .setDescription(
                    `**Prepare to awaken your Devil Fruit power!**\n\n` +
                    `🎯 **Available Devil Fruits:**\n` +
                    `⚀ **${TIER_NAMES[1]}** (40%): Basic power boost\n` +
                    `⚁ **${TIER_NAMES[2]}** (25%): Enhanced abilities\n` +
                    `⚂ **${TIER_NAMES[3]}** (15%): Epic transformation\n` +
                    `⚃ **${TIER_NAMES[4]}** (10%): Legendary might\n` +
                    `⚄ **${TIER_NAMES[5]}** (7%): Mythical powers\n` +
                    `⚅ **${TIER_NAMES[6]}** (3%): Ancient Zoan form\n\n` +
                    `⏰ **Reset:** <t:${getNextResetUnixTimestamp()}:F>\n\n` +
                    `Click **SPIN** to discover your Devil Fruit power!`
                )
                .setFooter({ text: '⚓ Marine Intelligence • Devil Fruit Power System' })
                .setTimestamp();

            const spinButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`daily_buff_spin_${userId}`)
                        .setLabel('🎰 SPIN THE WHEEL')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [spinEmbed], components: [spinButton] });

        } catch (error) {
            console.error('[DAILY BUFF] Error in daily-buff command:', error);
            await interaction.reply({
                content: '❌ **System Error**\n\nFailed to access Devil Fruit fortune assessment.',
                ephemeral: true
            });
        }
    },

    async handleSpinInteraction(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            // Verify this is the correct user
            if (!interaction.customId.includes(userId)) {
                return await interaction.reply({
                    content: '❌ This Devil Fruit wheel is not for you!',
                    ephemeral: true
                });
            }

            await interaction.deferUpdate();

            // Run spinning animation
            for (let frame = 0; frame < ANIMATION_CONFIG.SPIN_FRAMES; frame++) {
                const spinEmbed = WheelAnimator.createSpinFrame(frame);
                await interaction.editReply({ embeds: [spinEmbed], components: [] });
                await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.SPIN_DELAY));
            }

            // Determine tier based on weighted random
            const tier = calculateTier();
            const tierInfo = await getTierInfo(tier, guildId);

            // Show slowing down animation
            const slowingEmbed = WheelAnimator.createSlowingFrame(tier);
            await interaction.editReply({ embeds: [slowingEmbed], components: [] });
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Show final result
            const resultEmbed = WheelAnimator.createResultFrame(tier, tierInfo);
            await interaction.editReply({ embeds: [resultEmbed], components: [] });

            // Save to database
            const today = getCurrentDayKey();
            await global.xpTracker.db.query(`
                INSERT INTO daily_buffs (user_id, guild_id, date, tier, created_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO NOTHING
            `, [userId, guildId, today, tier]);

            // Award ONLY the buff role
            await awardDailyBuffRole(interaction, tier, tierInfo);

        } catch (error) {
            console.error('[DAILY BUFF] Error in spin interaction:', error);
            await interaction.followUp({
                content: '❌ **Spin Failed**\n\nDevil Fruit wheel malfunction detected.',
                ephemeral: true
            });
        }
    }
};

// Helper functions
function calculateTier() {
    const random = Math.random() * 100;
    
    if (random < 40) return 1;      // 40% chance - Common
    if (random < 65) return 2;      // 25% chance - Rare
    if (random < 80) return 3;      // 15% chance - Epic
    if (random < 90) return 4;      // 10% chance - Legendary
    if (random < 97) return 5;      // 7% chance - Mythical
    return 6;                       // 3% chance - Ancient Zoan
}

async function getTierInfo(tier, guildId) {
    const baseInfo = {
        1: {
            name: TIER_NAMES[1],
            color: TIER_COLORS[1],
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_1_ROLE',
            emoji: TIER_EMOJIS[1]
        },
        2: {
            name: TIER_NAMES[2], 
            color: TIER_COLORS[2],
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_2_ROLE',
            emoji: TIER_EMOJIS[2]
        },
        3: {
            name: TIER_NAMES[3],
            color: TIER_COLORS[3],
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_3_ROLE',
            emoji: TIER_EMOJIS[3]
        },
        4: {
            name: TIER_NAMES[4],
            color: TIER_COLORS[4],
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_4_ROLE',
            emoji: TIER_EMOJIS[4]
        },
        5: {
            name: TIER_NAMES[5],
            color: TIER_COLORS[5],
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_5_ROLE',
            emoji: TIER_EMOJIS[5]
        },
        6: {
            name: TIER_NAMES[6],
            color: TIER_COLORS[6],
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_6_ROLE',
            emoji: TIER_EMOJIS[6]
        }
    };

    const info = baseInfo[tier];
    
    // Get the actual multiplier from XP boost settings
    let multiplier = '1.0';
    try {
        if (global.xpBoostManager) {
            const roleId = process.env[info.buffRoleEnv];
            if (roleId) {
                const boostInfo = await global.xpBoostManager.getRoleBoost(guildId, roleId);
                if (boostInfo) {
                    multiplier = parseFloat(boostInfo.boost_multiplier).toFixed(1);
                }
            }
        }
    } catch (error) {
        console.error('[DAILY BUFF] Error getting multiplier:', error);
    }

    return { ...info, multiplier };
}

async function awardDailyBuffRole(interaction, tier, tierInfo) {
    try {
        const buffRoleId = process.env[tierInfo.buffRoleEnv];
        
        if (!buffRoleId || buffRoleId.includes('ROLE_ID')) {
            console.log(`[DAILY BUFF] Buff role not configured for tier ${tier}`);
            return;
        }

        const buffRole = interaction.guild.roles.cache.get(buffRoleId);
        
        if (!buffRole) {
            console.log(`[DAILY BUFF] Buff role not found for tier ${tier}`);
            return;
        }

        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!member) return;

        // Remove any existing daily buff roles first
        const allBuffRoles = [
            process.env.DAILY_XP_BUFF_TIER_1_ROLE,
            process.env.DAILY_XP_BUFF_TIER_2_ROLE,
            process.env.DAILY_XP_BUFF_TIER_3_ROLE,
            process.env.DAILY_XP_BUFF_TIER_4_ROLE,
            process.env.DAILY_XP_BUFF_TIER_5_ROLE,
            process.env.DAILY_XP_BUFF_TIER_6_ROLE
        ].filter(id => id && !id.includes('ROLE_ID'));

        for (const roleId of allBuffRoles) {
            if (member.roles.cache.has(roleId)) {
                const oldRole = interaction.guild.roles.cache.get(roleId);
                if (oldRole) {
                    await member.roles.remove(oldRole);
                    console.log(`[DAILY BUFF] Removed old daily buff role: ${oldRole.name}`);
                }
            }
        }

        // Add new buff role
        await member.roles.add(buffRole);
        
        console.log(`[DAILY BUFF] Awarded ${buffRole.name} to ${member.user.username}`);

    } catch (error) {
        console.error('[DAILY BUFF] Error awarding buff role:', error);
    }
}

// Helper functions with proper timezone handling
function getCurrentDayKey() {
    const now = new Date();
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    if (estTime.getHours() < 3) {
        estTime.setDate(estTime.getDate() - 1);
    }
    
    return estTime.toISOString().split('T')[0];
}

function isESTDaylightSaving(date) {
    const year = date.getFullYear();
    const march = new Date(year, 2, 1);
    const november = new Date(year, 10, 1);
    const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
    const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
    return date >= dstStart && date < dstEnd;
}

function getNextResetUnixTimestamp() {
    const now = new Date();
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    const nextReset = new Date(estTime);
    nextReset.setHours(3, 0, 0, 0);
    
    if (estTime.getHours() >= 3) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    // Convert back to UTC for Discord timestamp
    const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}
