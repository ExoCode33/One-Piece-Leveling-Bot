// src/commands/daily-buff.js - Daily Spin Wheel (Separate Buff and Cap Roles)

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎰 Spin the Marine Intelligence Luck Wheel for daily XP buffs and caps!'),

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
                const tierInfo = getTierInfo(buff.tier);
                const resetTime = getNextResetTime();
                
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('🎰 MARINE INTELLIGENCE LUCK WHEEL')
                    .setDescription(`\`\`\`diff\n- DAILY ROLES ALREADY CLAIMED\n- Current Tier: ${buff.tier}\n- XP Buff Role: ${tierInfo.buffRoleName}\n- XP Cap Role: ${tierInfo.capRoleName}\n- Next Reset: ${resetTime}\n\`\`\``)
                    .setFooter({ text: '⚓ Marine Intelligence • Daily Reset: 3 AM EST' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Create spin wheel embed
            const spinEmbed = new EmbedBuilder()
                .setColor(0x4A90E2)
                .setTitle('🎰 MARINE INTELLIGENCE LUCK WHEEL')
                .setDescription(`\`\`\`yaml\nPrepare for Fortune Assessment!\n\nTier 1 (60%): Tier-1 XP Buff + Tier-1 XP Cap (${process.env.DAILY_VOICE_XP_CAP_TIER_1})\nTier 2 (30%): Tier-2 XP Buff + Tier-2 XP Cap (${process.env.DAILY_VOICE_XP_CAP_TIER_2})\nTier 3 (10%): Tier-3 XP Buff + Tier-3 XP Cap (${process.env.DAILY_VOICE_XP_CAP_TIER_3})\n\nEach tier gives you BOTH roles!\nConfigure XP multipliers for buff roles in /settings!\n\nClick SPIN to test your luck!\n\`\`\``)
                .setFooter({ text: '⚓ Marine Intelligence • Daily Role Assignment' })
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
            const tierInfo = getTierInfo(tier);

            // Create spinning animation
            await showSpinAnimation(interaction, tier, tierInfo);

            // Save to database
            const today = getCurrentDayKey();
            await global.xpTracker.db.query(`
                INSERT INTO daily_buffs (user_id, guild_id, date, tier, created_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, guild_id, date)
                DO NOTHING
            `, [userId, guildId, today, tier]);

            // Award BOTH the buff and cap roles
            await awardDailyRoles(interaction, tier, tierInfo);

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

function getTierInfo(tier) {
    const tiers = {
        1: {
            name: 'Standard Operations',
            buffRoleName: 'Tier-1 XP Buff',
            capRoleName: 'Tier-1 XP Cap',
            color: 0x28A745,
            description: 'Tier 1 XP buff role + Tier 1 XP cap role',
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_1_ROLE',
            capRoleEnv: 'DAILY_XP_CAP_TIER_1_ROLE',
            cap: parseInt(process.env.DAILY_VOICE_XP_CAP_TIER_1) || 2000,
            emoji: '⚡'
        },
        2: {
            name: 'Enhanced Operations', 
            buffRoleName: 'Tier-2 XP Buff',
            capRoleName: 'Tier-2 XP Cap',
            color: 0x007BFF,
            description: 'Tier 2 XP buff role + Tier 2 XP cap role',
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_2_ROLE',
            capRoleEnv: 'DAILY_XP_CAP_TIER_2_ROLE',
            cap: parseInt(process.env.DAILY_VOICE_XP_CAP_TIER_2) || 3000,
            emoji: '💎'
        },
        3: {
            name: 'Elite Operations',
            buffRoleName: 'Tier-3 XP Buff',
            capRoleName: 'Tier-3 XP Cap',
            color: 0xFFD700,
            description: 'Tier 3 XP buff role + Tier 3 XP cap role',
            buffRoleEnv: 'DAILY_XP_BUFF_TIER_3_ROLE',
            capRoleEnv: 'DAILY_XP_CAP_TIER_3_ROLE',
            cap: parseInt(process.env.DAILY_VOICE_XP_CAP_TIER_3) || 5000,
            emoji: '👑'
        }
    };

    return tiers[tier];
}

async function showSpinAnimation(interaction, finalTier, tierInfo) {
    const spinFrames = [
        '🎰 ⚡💎👑 ⚡💎👑 ⚡💎👑',
        '🎰 💎👑⚡ 💎👑⚡ 💎👑⚡',
        '🎰 👑⚡💎 👑⚡💎 👑⚡💎',
        '🎰 ⚡💎👑 ⚡💎👑 ⚡💎👑',
        '🎰 💎👑⚡ 💎👑⚡ 💎👑⚡'
    ];

    // Show spinning animation
    for (let i = 0; i < 5; i++) {
        const spinEmbed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🎰 MARINE INTELLIGENCE LUCK WHEEL')
            .setDescription(`\`\`\`yaml\n${spinFrames[i]}\n\nAnalyzing your fortune...\nMarine Intelligence processing...\n\`\`\``)
            .setFooter({ text: '⚓ Marine Intelligence • Luck Assessment In Progress' });

        await interaction.editReply({ embeds: [spinEmbed], components: [] });
        await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Show final result
    const resultEmbed = new EmbedBuilder()
        .setColor(tierInfo.color)
        .setTitle('🎰 MARINE INTELLIGENCE LUCK WHEEL')
        .setDescription(`\`\`\`diff\n+ FORTUNE ASSESSMENT COMPLETE!\n+ ${tierInfo.emoji} TIER ${finalTier}: ${tierInfo.name.toUpperCase()}\n+ Buff Role: ${tierInfo.buffRoleName}\n+ Cap Role: ${tierInfo.capRoleName}\n+ Daily XP Cap: ${tierInfo.cap.toLocaleString()}\n+ Valid Until: ${getNextResetTime()}\n\`\`\``)
        .addFields({
            name: `${tierInfo.emoji} DUAL ROLE ASSIGNMENT`,
            value: `\`\`\`yaml\nXP Buff Role: ${tierInfo.buffRoleName}\nXP Cap Role: ${tierInfo.capRoleName}\nDuration: Until 3:00 AM EST\nXP Multiplier: Configure in /settings\nStatus: BOTH ROLES ACTIVE\n\`\`\``,
            inline: false
        })
        .setFooter({ text: '⚓ Marine Intelligence • Daily Roles Active' })
        .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed], components: [] });
}

async function awardDailyRoles(interaction, tier, tierInfo) {
    try {
        const buffRoleId = process.env[tierInfo.buffRoleEnv];
        const capRoleId = process.env[tierInfo.capRoleEnv];
        
        if ((!buffRoleId || buffRoleId.includes('ROLE_ID')) || (!capRoleId || capRoleId.includes('ROLE_ID'))) {
            console.log(`[DAILY BUFF] Roles not configured for tier ${tier}`);
            return;
        }

        const buffRole = interaction.guild.roles.cache.get(buffRoleId);
        const capRole = interaction.guild.roles.cache.get(capRoleId);
        
        if (!buffRole || !capRole) {
            console.log(`[DAILY BUFF] Roles not found for tier ${tier}`);
            return;
        }

        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!member) return;

        // Remove any existing daily roles first
        const allDailyRoles = [
            // All buff roles
            process.env.DAILY_XP_BUFF_TIER_1_ROLE,
            process.env.DAILY_XP_BUFF_TIER_2_ROLE,
            process.env.DAILY_XP_BUFF_TIER_3_ROLE,
            // All cap roles
            process.env.DAILY_XP_CAP_TIER_1_ROLE,
            process.env.DAILY_XP_CAP_TIER_2_ROLE,
            process.env.DAILY_XP_CAP_TIER_3_ROLE,
            // Quest completion role
            process.env.DAILY_QUEST_COMPLETION_ROLE
        ].filter(id => id && !id.includes('ROLE_ID'));

        for (const roleId of allDailyRoles) {
            if (member.roles.cache.has(roleId)) {
                const oldRole = interaction.guild.roles.cache.get(roleId);
                if (oldRole) {
                    await member.roles.remove(oldRole);
                    console.log(`[DAILY BUFF] Removed old daily role: ${oldRole.name}`);
                }
            }
        }

        // Add BOTH new roles
        await member.roles.add(buffRole);
        await member.roles.add(capRole);
        
        console.log(`[DAILY BUFF] Awarded ${buffRole.name} + ${capRole.name} to ${member.user.username}`);

    } catch (error) {
        console.error('[DAILY BUFF] Error awarding roles:', error);
    }
}

// Helper functions
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

function getNextResetTime() {
    const now = new Date();
    const estOffset = isESTDaylightSaving(now) ? -4 : -5;
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    const nextReset = new Date(estTime);
    nextReset.setHours(3, 0, 0, 0);
    
    if (estTime.getHours() >= 3) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    const localReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    
    return localReset.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}
