// src/commands/daily-buff.js - Updated with ASCII Art Animation

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DailyBuffAsciiAnimator = require('../utils/dailyBuffAsciiArt');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily-buff')
        .setDescription('🎰 Spin the daily XP buff wheel! Resets at 3:00 AM EST'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;

            // Check if XP tracker is available
            if (!global.xpTracker || !global.xpTracker.db) {
                return await interaction.reply({
                    content: '❌ **Daily Buff System Unavailable**\n\nXP tracking system not initialized.',
                    flags: 64
                });
            }

            // Check if user already rolled today
            const hasRolledToday = await this.checkDailyRoll(userId, guildId);
            if (hasRolledToday) {
                const currentBuff = await this.getCurrentBuff(userId, guildId, member);
                const nextReset = getNextResetUnixTimestamp();
                
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🎰 DAILY BUFF ALREADY CLAIMED')
                    .setDescription(`You've already rolled your daily buff!\n\n**Current Buff:** ${currentBuff.name}\n**Multiplier:** ${currentBuff.multiplier}x XP\n\n*Next reset: <t:${nextReset}:R>*`)
                    .setFooter({ text: 'Marine Intelligence • Daily Buff System' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Start the ASCII art animation sequence
            await interaction.deferReply();
            await this.performAsciiAnimation(interaction, userId, guildId, member);

        } catch (error) {
            console.error('[DAILY BUFF] Error in daily-buff command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ **Error**\n\nSomething went wrong with the daily buff system. Please try again.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **Error**\n\nSomething went wrong with the daily buff system. Please try again.',
                    flags: 64
                });
            }
        }
    },

    // ASCII art animation sequence
    async performAsciiAnimation(interaction, userId, guildId, member) {
        const finalResult = this.calculateBuffTier();
        
        try {
            // Create the full animation sequence
            const animationSequence = DailyBuffAsciiAnimator.createAnimationSequence(finalResult);
            
            console.log(`[DAILY BUFF] Starting ASCII animation for ${interaction.user.username}, tier ${finalResult}`);
            
            // Play through each frame in the sequence
            for (let i = 0; i < animationSequence.length; i++) {
                const sequenceItem = animationSequence[i];
                
                // Create embed for this frame
                const embed = new EmbedBuilder()
                    .setColor(sequenceItem.color)
                    .setTitle('⚡ MARINE ENHANCEMENT SCANNER')
                    .setDescription(DailyBuffAsciiAnimator.createStatusDisplay(sequenceItem, finalResult))
                    .setFooter({ 
                        text: `Phase ${sequenceItem.phase === 'detection' ? '1' : sequenceItem.phase === 'explosion' ? '2' : '3'}/3 • ${sequenceItem.phase === 'result' ? 'Enhancement Complete' : 'Processing...'}` 
                    })
                    .setTimestamp();
                
                // Update the message
                await interaction.editReply({ embeds: [embed] });
                
                // Wait for the specified delay (except for the last frame)
                if (i < animationSequence.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, sequenceItem.delay));
                }
            }

            // Apply the buff role and save to database
            await this.applyBuffRole(userId, guildId, member, finalResult);
            
            // Create final success embed with enhanced details
            const finalEmbed = await this.createFinalSuccessEmbed(interaction, finalResult, member);
            
            // Wait a moment then show the final result
            await new Promise(resolve => setTimeout(resolve, 1000));
            await interaction.editReply({ embeds: [finalEmbed] });

        } catch (error) {
            console.error('[DAILY BUFF] ASCII animation error:', error);
            await interaction.editReply({
                content: '❌ **Animation Error**\n\nFailed to complete enhancement sequence. Please try again.'
            });
        }
    },

    // Create enhanced final success embed
    async createFinalSuccessEmbed(interaction, tier, member) {
        const config = DailyBuffAsciiAnimator.getTierConfig(tier);
        const buffInfo = this.getBuffTiers()[tier];
        const nextReset = getNextResetUnixTimestamp();
        
        const embed = new EmbedBuilder()
            .setColor(DailyBuffAsciiAnimator.getTierColorHex(tier))
            .setTitle('✨ MARINE ENHANCEMENT ACQUIRED')
            .setDescription(`**Enhancement Matrix Successfully Stabilized!**\n\n\`\`\`\n${DailyBuffAsciiAnimator.createFinalResult(tier)}\n\`\`\`\n\n🎉 **Enhancement Complete!** 🎉`)
            .addFields(
                {
                    name: '🔬 Enhancement Analysis',
                    value: `**Classification:** ${config.name}\n**Type:** ${buffInfo.name}\n**Power Amplification:** ${buffInfo.multiplier}x\n**Stability:** Fully Crystallized`,
                    inline: true
                },
                {
                    name: '⏰ Operational Window',
                    value: `**Activated:** Right Now\n**Duration:** Until 3:00 AM EST\n**Next Reset:** <t:${nextReset}:R>\n**Status:** ✅ Active`,
                    inline: true
                },
                {
                    name: '⚡ Enhancement Effects',
                    value: `🚀 All XP gains boosted by **${buffInfo.multiplier}x**\n🔄 Stacks with other multipliers\n🛡️ Marine training protocols enhanced\n⭐ Active until daily reset`,
                    inline: false
                }
            )
            .setFooter({ text: `${buffInfo.name} Enhancement Active • Marine Enhancement Division` })
            .setTimestamp();

        return embed;
    },

    // Calculate which tier to roll (weighted probabilities)
    calculateBuffTier() {
        const random = Math.random() * 100;
        
        if (random < 45) return 1;        // 45% - Common
        else if (random < 70) return 2;   // 25% - Rare  
        else if (random < 85) return 3;   // 15% - Epic
        else if (random < 94) return 4;   // 9% - Legendary
        else if (random < 99) return 5;   // 5% - Mythical
        else return 6;                    // 1% - Divine
    },

    // Check if user has already rolled today
    async checkDailyRoll(userId, guildId) {
        try {
            const currentDay = getCurrentDayKey();
            
            const result = await global.xpTracker.db.query(
                'SELECT * FROM daily_buff_rolls WHERE user_id = $1 AND guild_id = $2 AND date = $3',
                [userId, guildId, currentDay]
            );

            return result.rows.length > 0;
        } catch (error) {
            console.error('[DAILY BUFF] Error checking daily roll:', error);
            return false;
        }
    },

    // Get current buff for a user
    async getCurrentBuff(userId, guildId, member) {
        const buffRoles = this.getBuffTiers();
        
        for (const tier of Object.keys(buffRoles)) {
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
            if (roleId && member.roles.cache.has(roleId)) {
                return {
                    tier: parseInt(tier),
                    name: buffRoles[tier].name,
                    multiplier: buffRoles[tier].multiplier
                };
            }
        }

        return { tier: 0, name: 'No Buff', multiplier: 1.0 };
    },

    // Get buff tier information
    getBuffTiers() {
        return {
            1: { name: 'Marine Training', multiplier: 1.1 },
            2: { name: 'Enhanced Drill', multiplier: 1.2 },
            3: { name: 'Elite Protocol', multiplier: 1.3 },
            4: { name: 'Admiral Focus', multiplier: 1.5 },
            5: { name: 'Fleet Command', multiplier: 1.7 },
            6: { name: 'World Government Authorization', multiplier: 2.0 }
        };
    },

    // Apply the buff role to the user
    async applyBuffRole(userId, guildId, member, tier) {
        try {
            // Remove any existing buff roles first
            await this.removeAllBuffRoles(member);

            // Add the new buff role
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${tier}_ROLE`];
            if (roleId) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`[DAILY BUFF] ✅ Awarded ${role.name} to ${member.user.username}`);
                } else {
                    console.error(`[DAILY BUFF] ❌ Role not found: ${roleId}`);
                }
            } else {
                console.warn(`[DAILY BUFF] ⚠️ No role ID configured for tier ${tier}`);
            }

            // Save to database
            await this.saveBuffRoll(userId, guildId, tier);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error applying buff role:', error);
        }
    },

    // Remove all buff roles from user
    async removeAllBuffRoles(member) {
        for (let i = 1; i <= 6; i++) {
            const roleId = process.env[`DAILY_XP_BUFF_TIER_${i}_ROLE`];
            if (roleId && member.roles.cache.has(roleId)) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.remove(role);
                    console.log(`[DAILY BUFF] Removed ${role.name} from ${member.user.username}`);
                }
            }
        }
    },

    // Save the buff roll to database
    async saveBuffRoll(userId, guildId, tier) {
        try {
            // Create table if it doesn't exist
            await global.xpTracker.db.query(`
                CREATE TABLE IF NOT EXISTS daily_buff_rolls (
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    date DATE NOT NULL,
                    tier INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, guild_id, date)
                )
            `);

            const currentDay = getCurrentDayKey();
            
            await global.xpTracker.db.query(`
                INSERT INTO daily_buff_rolls (user_id, guild_id, date, tier)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id, date)
                DO UPDATE SET tier = $4
            `, [userId, guildId, currentDay, tier]);

            console.log(`[DAILY BUFF] ✅ Saved tier ${tier} roll for ${userId} on ${currentDay}`);

        } catch (error) {
            console.error('[DAILY BUFF] ❌ Error saving buff roll:', error);
        }
    }
};

// Helper functions for timezone handling
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
    
    const utcReset = new Date(nextReset.getTime() - (estOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}
