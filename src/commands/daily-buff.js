// src/commands/daily-buff.js - Daily Spin Wheel (XP Buff Only with Settings Integration)

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎰 Spin the Marine Intelligence Luck Wheel for daily XP buffs!'),

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
                    .setTitle('🎰 MARINE INTELLIGENCE LUCK WHEEL')
                    .setDescription(`**DAILY XP BUFF ALREADY CLAIMED**`)
                    .addFields(
                        {
                            name: 'Current Buff',
                            value: `**Tier ${buff.tier}** • Duration: Until <t:${getNextResetUnixTimestamp()}:R>`,
                            inline: false
                        },
                        {
                            name: 'XP Multiplier',
                            value: `**${tierInfo.multiplier}x** boost active`,
                            inline: false
                        }
                    )
                    .setFooter({ text: '⚓ Marine Intelligence • Daily XP Buff System' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Create spin wheel embed
            const spinEmbed = new EmbedBuilder()
                .setColor(0x4A90E2)
                .setTitle('🎰 MARINE INTELLIGENCE LUCK WHEEL')
                .setDescription(`**Prepare for Fortune Assessment!**\n\n🎯 **Available Rewards:**\n⚡ **Tier 1** (60%): Standard XP Boost\n💎 **Tier 2** (30%): Enhanced XP Boost\n👑 **Tier 3** (10%): Elite XP Boost\n\n⏰ **Reset:** <t:${getNextResetUnixTimestamp()}:F>\n\nClick **SPIN** to test your luck!`)
                .setFooter({ text: '⚓ Marine Intelligence • Daily XP Buff System' })
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
                content: '❌ **System Error**\n\nFailed to access Marine Intelligence luck assessment.',
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
                    content: '❌ This spin wheel is not for you!',
                    ephemeral: true
                });
            }

            await interaction.deferUpdate();

            // Determine tier based on weighted random
            const tier = calculateTier();
            const tierInfo = await getTierInfo(tier, guildId);

            // Create spinning animation
            await showWheelOfFortuneAnimation(interaction, tier, tierInfo);

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
                content: '❌ **Spin Failed**\n\nMarine Intelligence wheel malfunction detected.',
                ephemeral: true
            });
        }
    }
};

// Helper functions
function calculateTier() {
    const random = Math.random() * 100;
    
    if (random < 60) return 1;      // 60% chance
    if (random < 90) return 2;      // 30% chance  
    return 3;                       // 10% chance
}

async function getTierInfo(tier, guildId) {
    const baseInfo = {
        1: {
            name: 'Standard Operations',
            color: 0x28A745,
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_1_ROLE',
            emoji: '⚡'
        },
        2: {
            name: 'Enhanced Operations', 
            color: 0x007BFF,
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_2_ROLE',
            emoji: '💎'
        },
        3: {
            name: 'Elite Operations',
            color: 0xFFD700,
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_3_ROLE',
            emoji: '👑'
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

async function showWheelOfFortuneAnimation(interaction, finalTier, tierInfo) {
    // Wheel of Fortune style animation frames
    const wheelFrames = [
        '🎰 **SPINNING...**\n```\n    ⚡💎👑\n  ⚡💎👑⚡💎\n👑⚡💎👑⚡💎👑\n  ⚡💎👑⚡💎\n    👑⚡💎\n```',
        '🎰 **SPINNING...**\n```\n    💎👑⚡\n  💎👑⚡💎👑\n⚡💎👑⚡💎👑⚡\n  👑⚡💎👑⚡\n    ⚡💎👑\n```',
        '🎰 **SPINNING...**\n```\n    👑⚡💎\n  👑⚡💎👑⚡\n💎👑⚡💎👑⚡💎\n  ⚡💎👑⚡💎\n    💎👑⚡\n```',
        '🎰 **SPINNING...**\n```\n    ⚡💎👑\n  ⚡💎👑⚡💎\n👑⚡💎👑⚡💎👑\n  ⚡💎👑⚡💎\n    👑⚡💎\n```',
        '🎰 **SPINNING...**\n```\n    💎👑⚡\n  💎👑⚡💎👑\n⚡💎👑⚡💎👑⚡\n  👑⚡💎👑⚡\n    ⚡💎👑\n```'
    ];

    // Show spinning animation
    for (let i = 0; i < 8; i++) {
        const frameIndex = i % wheelFrames.length;
        const spinEmbed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🎰 MARINE INTELLIGENCE LUCK WHEEL')
            .setDescription(wheelFrames[frameIndex] + '\n\n**Marine Intelligence analyzing your fortune...**')
            .setFooter({ text: '⚓ Marine Intelligence • Luck Assessment In Progress' });

        await interaction.editReply({ embeds: [spinEmbed], components: [] });
        await new Promise(resolve => setTimeout(resolve, 600));
    }

    // Slow down animation for final result
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Show stopping animation with winner highlighted
    const winningSymbol = finalTier === 1 ? '⚡' : finalTier === 2 ? '💎' : '👑';
    const stoppingEmbed = new EmbedBuilder()
        .setColor(tierInfo.color)
        .setTitle('🎰 MARINE INTELLIGENCE LUCK WHEEL')
        .setDescription(`🎰 **SLOWING DOWN...**\n\`\`\`\n    ⚡💎👑\n  ⚡💎👑⚡💎\n👑⚡[${winningSymbol}]👑⚡💎👑\n  ⚡💎👑⚡💎\n    👑⚡💎\n\`\`\`\n\n**${winningSymbol} TIER ${finalTier} SELECTED! ${winningSymbol}**`)
        .setFooter({ text: '⚓ Marine Intelligence • Fortune Determined' });

    await interaction.editReply({ embeds: [stoppingEmbed], components: [] });
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Show final result
    const resultEmbed = new EmbedBuilder()
        .setColor(tierInfo.color)
        .setTitle('🎰 MARINE INTELLIGENCE LUCK WHEEL')
        .setDescription(`**🎉 FORTUNE ASSESSMENT COMPLETE! 🎉**`)
        .addFields(
            {
                name: `${tierInfo.emoji} Tier ${finalTier} • Duration: Until <t:${getNextResetUnixTimestamp()}:R>`,
                value: `**${tierInfo.multiplier}x** XP Multiplier boost active!`,
                inline: false
            }
        )
        .setFooter({ text: '⚓ Marine Intelligence • Daily XP Buff Active' })
        .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed], components: [] });
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
            process.env.DAILY_XP_BUFF_TIER_3_ROLE
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
